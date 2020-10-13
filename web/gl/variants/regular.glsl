precision highp float;

uniform float time;
uniform float scale;
uniform sampler2D worldTexture;
uniform vec2 worldSize;
uniform vec2 worldOffset;
uniform vec2 translation;
uniform vec2 resolution;

const float TILE_SIZE = 4.0; // was 20.0
const vec2 TILE_OFFSET = vec2(0, 0);
const vec3 OUTSIDE_COLOR = vec3(0.5, 0.5, 0.5);

const vec2 OFFSET_TOP = vec2(0, 1);
const vec2 OFFSET_LEFT = vec2(-1, 0);
const vec2 OFFSET_BOTTOM = vec2(0, -1);
const vec2 OFFSET_RIGHT = vec2(1, 0);

const vec2 OFFSET_TOP_LEFT = vec2(-1, 1);
const vec2 OFFSET_TOP_RIGHT = vec2(1, 1);
const vec2 OFFSET_BOTTOM_LEFT = vec2(-1, -1);
const vec2 OFFSET_BOTTOM_RIGHT = vec2(1, -1);

vec2 getTileCoord(vec2 position) {
    return TILE_OFFSET + vec2(floor(position.x / (TILE_SIZE * scale)), floor(position.y / (TILE_SIZE * scale)));
}

bool isOutOfBounds(float a, float b, float p) {
    return ((p > max(a, b)) || (p < min(a, b)));
}

bool isOutOfBounds(vec2 a, vec2 b, vec2 p) {
    return (isOutOfBounds(a.x, b.x, p.x) || isOutOfBounds(a.y, b.y, p.y));
}

bool isInWorld(vec2 coord) {
    return !isOutOfBounds(worldOffset + 1.0, worldSize + worldOffset - 1.0, coord);
}

float round(float value) {
    return floor(value + 0.5);
}

struct Tile {
    vec3 color;
    vec2 coord;
    float height;
};

const vec3 RGB_GRASS = vec3(37, 73, 20);
const vec3 RGB_DANDELION = vec3(63, 63, 18);
const vec3 RGB_OXEYE_DAISY = vec3(97, 109, 87);
const vec3 RGB_ALLIUM = vec3(78, 72, 100);
const vec3 RGB_TALLGRASS = vec3(111, 111, 111);
const vec3 RGB_SUNFLOWER = vec3(26, 58, 16);
const vec3 RGB_CORNFLOWER = vec3(238, 241, 244);
const vec3 RGB_POPPY = vec3(58, 32, 14);

Tile getTile(vec2 coord) {
    if (!isInWorld(coord)) {
        return Tile(OUTSIDE_COLOR, coord, -1.0);
    }

    vec4 color = texture2D(worldTexture, (coord - worldOffset + 0.5) / worldSize);
    Tile tile = Tile(color.rgb * 255.0, coord, color.a * 255.0);

    if (tile.color == RGB_GRASS || tile.color == RGB_DANDELION || tile.color == RGB_OXEYE_DAISY || tile.color == RGB_ALLIUM || tile.color == RGB_TALLGRASS || tile.color == RGB_SUNFLOWER || tile.color == RGB_CORNFLOWER || tile.color == RGB_POPPY) {
        tile.height -= 1.0;
        tile.color = mix(vec3(51, 100, 27), tile.color, 0.4);
    }

    return tile;
}

Tile getTile(Tile tile, vec2 offset) {
    return getTile(tile.coord + offset);
}

float heightDiff(Tile tile, vec2 offset) {
    return tile.height - getTile(tile, offset).height;
}

float countTopTilesAbove(Tile tile) {
    float diffTop = heightDiff(tile, OFFSET_TOP) > 0.0 ? 1.0 : 0.0;
    float diffLeft = heightDiff(tile, OFFSET_LEFT) > 0.0 ? 1.0 : 0.0;
    return diffTop + diffLeft;
}

float countNearbyTilesBelow(Tile tile, float multiplier) {
    float diffTop = heightDiff(tile, OFFSET_TOP * multiplier) < 0.0 ? 1.0 : 0.0;
    float diffLeft = heightDiff(tile, OFFSET_LEFT * multiplier) < 0.0 ? 1.0 : 0.0;
    float diffRight = heightDiff(tile, OFFSET_RIGHT * multiplier) < 0.0 ? 1.0 : 0.0;
    float diffBottom = heightDiff(tile, OFFSET_BOTTOM * multiplier) < 0.0 ? 1.0 : 0.0;
    return diffTop + diffLeft + diffRight + diffBottom;
}

float countCornerTilesBelow(Tile tile) {
    float diffTopLeft = heightDiff(tile, OFFSET_TOP_LEFT) < 0.0 ? 1.0 : 0.0;
    float diffTopRight = heightDiff(tile, OFFSET_TOP_RIGHT) < 0.0 ? 1.0 : 0.0;
    float diffBottomRight = heightDiff(tile, OFFSET_BOTTOM_RIGHT) < 0.0 ? 1.0 : 0.0;
    float diffBottomLeft = heightDiff(tile, OFFSET_BOTTOM_LEFT) < 0.0 ? 1.0 : 0.0;
    return diffTopLeft + diffTopRight + diffBottomRight + diffBottomLeft;
}

void main() {
    vec2 position = gl_FragCoord.xy - (resolution.xy / 2.0) + translation;
    vec2 coord = getTileCoord(position);

    Tile tile = getTile(coord);
    if (tile.height < 0.0) {
        discard;
    }

    float lightMultiplier = 255.0;
    if (countTopTilesAbove(tile) > 0.0) {
        lightMultiplier = 280.0;
    }

    lightMultiplier -= 12.0 * countNearbyTilesBelow(tile, 1.0);
    lightMultiplier -= 10.0 * countCornerTilesBelow(tile);
    lightMultiplier -= 8.0 * countNearbyTilesBelow(tile, 2.0);
    lightMultiplier -= 6.0 * countNearbyTilesBelow(tile, 3.0);
    lightMultiplier -= 4.0 * countNearbyTilesBelow(tile, 4.0);

    tile.color.r = min(round((tile.color.r * lightMultiplier) / 255.0), 255.0) / 255.0;
    tile.color.g = min(round((tile.color.g * lightMultiplier) / 255.0), 255.0) / 255.0;
    tile.color.b = min(round((tile.color.b * lightMultiplier) / 255.0), 255.0) / 255.0;

    gl_FragColor = vec4(tile.color, 1.0);
}