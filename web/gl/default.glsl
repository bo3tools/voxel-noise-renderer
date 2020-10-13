precision highp float;

uniform float time;
uniform float scale;
uniform vec2 mousePosition;
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
    return TILE_OFFSET + vec2(floor(position.x / TILE_SIZE), floor(position.y / TILE_SIZE));
}

bool isOutOfBounds(float a, float b, float p) {
    return ((p > max(a, b)) || (p < min(a, b)));
}

bool isOutOfBounds(vec2 a, vec2 b, vec2 p) {
    return (isOutOfBounds(a.x, b.x, p.x) || isOutOfBounds(a.y, b.y, p.y));
}

bool isInWorld(vec2 coord) {
    return !isOutOfBounds(worldOffset, worldSize + worldOffset - 1.0, coord);
}

float round(float value) {
    return floor(value + 0.5);
}

struct Tile {
    vec3 color;
    vec2 coord;
    float height;
    bool underwater;
};

const vec3 RGB_GRASS = vec3(37, 73, 20);
const vec3 RGB_DANDELION = vec3(63, 63, 18);
const vec3 RGB_OXEYE_DAISY = vec3(97, 109, 87);
const vec3 RGB_ALLIUM = vec3(78, 72, 100);
const vec3 RGB_TALLGRASS = vec3(111, 111, 111);
const vec3 RGB_SUNFLOWER = vec3(26, 58, 16);
const vec3 RGB_CORNFLOWER = vec3(238, 241, 244);
const vec3 RGB_POPPY = vec3(58, 32, 14);
const vec3 RGB_DEAD_BUSH = vec3(61, 44, 22);
const vec3 RGB_SEAGRASS = vec3(103, 132, 97);
const vec3 RGB_KELP = vec3(54, 83, 27);
const vec3 RGB_KELP_PLANT = vec3(37, 62, 19);

const vec3 RGB_WATER_SHALLOW = vec3(41, 77, 150);
const vec3 RGB_WATER_DEEP = vec3(27, 53, 100);

vec4 getRawTileColorAt(vec2 coord) {
    return texture2D(worldTexture, (coord - worldOffset + 0.5) / worldSize);
}

// Water tile colors are encoded with 0x00ggbb, where:
//   bb is ocean floor depth from 0x01 to 0xff (1..255)
//   gg is plant state bit from 0x00 to 0x01 (0..1)
bool isWaterTile(Tile tile) {
    return tile.color.r == 0.0 && tile.color.g <= 1.0 && tile.color.b > 0.0;
}

Tile getTile(vec2 coord) {
    if (!isInWorld(coord)) {
        return Tile(OUTSIDE_COLOR, coord, -1.0, false);
    }

    vec4 color = getRawTileColorAt(coord);
    Tile tile = Tile(color.rgb * 255.0, coord, color.a * 255.0, false);

    if (tile.color == RGB_GRASS || tile.color == RGB_DANDELION || tile.color == RGB_OXEYE_DAISY || tile.color == RGB_ALLIUM || tile.color == RGB_TALLGRASS || tile.color == RGB_SUNFLOWER || tile.color == RGB_CORNFLOWER || tile.color == RGB_POPPY || tile.color == RGB_DEAD_BUSH || tile.color == RGB_SEAGRASS || tile.color == RGB_KELP_PLANT) {
        tile.height -= 1.0;
        tile.color = mix(getRawTileColorAt(coord + vec2(1, 1)).rgb * 255.0, tile.color, 0.5);
    }

    if (isWaterTile(tile)) {
        float floorDepth = tile.color.b;
        float plantShadow = tile.color.g * 4.0;
        tile.color = mix(RGB_WATER_SHALLOW, RGB_WATER_DEEP, (tile.height - floorDepth) / 16.0) - plantShadow;
        tile.height = floorDepth;
        tile.underwater = true;
    }

    return tile;
}

Tile getTile(Tile tile, vec2 offset) {
    return getTile(tile.coord + offset);
}

float heightDiff(Tile tile, vec2 offset) {
    return tile.height - getTile(tile, offset).height;
}

const float LIGHT_MAX_HEIGHT = 14.0;
const float LIGHT_MAX_INCREASE = 18.0;

float valueIfAboveMul(float returnValue, float blockHeight) {
    if (blockHeight <= 0.0) {
        return 0.0;
    }

    float increasePercentage = min(abs(blockHeight), LIGHT_MAX_HEIGHT) / LIGHT_MAX_HEIGHT;
    return returnValue + increasePercentage * LIGHT_MAX_INCREASE;
}

const float SHADOW_MAX_HEIGHT = 26.0;
const float SHADOW_MAX_INCREASE = 20.0;

float valueIfBelowMul(float returnValue, float blockHeight) {
    if (blockHeight >= 0.0) {
        return 0.0;
    }

    float increasePercentage = min(abs(blockHeight), SHADOW_MAX_HEIGHT) / SHADOW_MAX_HEIGHT;
    return returnValue + increasePercentage * SHADOW_MAX_INCREASE;
}

float countTopTilesAbove(Tile tile, float lightValue) {
    float diffTop = valueIfAboveMul(lightValue, heightDiff(tile, OFFSET_TOP));
    float diffLeft = valueIfAboveMul(lightValue, heightDiff(tile, OFFSET_LEFT));
    return diffTop + diffLeft;
}

float countNearbyTilesBelow(Tile tile, float lightValue, float offsetMult) {
    float diffTop = valueIfBelowMul(lightValue, heightDiff(tile, OFFSET_TOP * offsetMult));
    float diffLeft = valueIfBelowMul(lightValue, heightDiff(tile, OFFSET_LEFT * offsetMult));
    float diffRight = valueIfBelowMul(lightValue, heightDiff(tile, OFFSET_RIGHT * offsetMult));
    float diffBottom = valueIfBelowMul(lightValue, heightDiff(tile, OFFSET_BOTTOM * offsetMult));
    return diffTop + diffLeft + diffRight + diffBottom;
}

float countCornerTilesBelow(Tile tile, float lightValue, float offsetMult) {
    float diffTopLeft = valueIfBelowMul(lightValue, heightDiff(tile, OFFSET_TOP_LEFT * offsetMult));
    float diffTopRight = valueIfBelowMul(lightValue, heightDiff(tile, OFFSET_TOP_RIGHT * offsetMult));
    float diffBottomRight = valueIfBelowMul(lightValue, heightDiff(tile, OFFSET_BOTTOM_RIGHT * offsetMult));
    float diffBottomLeft = valueIfBelowMul(lightValue, heightDiff(tile, OFFSET_BOTTOM_LEFT * offsetMult));
    return diffTopLeft + diffTopRight + diffBottomRight + diffBottomLeft;
}

vec2 getCursorPosition() {
    vec2 cursor = ((mousePosition.xy - (resolution.xy / 2.0)) * scale);
    return vec2(cursor.x, -cursor.y) + translation; 
}

void main() {
    vec2 position = ((gl_FragCoord.xy - (resolution.xy / 2.0)) * scale) + translation;
    vec2 cursor = getTileCoord(getCursorPosition());
    vec2 coord = getTileCoord(position);

    Tile tile = getTile(coord);
    if (tile.height >= 0.0) {
        float depthMultiplier = tile.underwater ? 0.4 : 1.0;
        float lightMultiplier = 255.0;
        
        lightMultiplier += countTopTilesAbove(tile, 10.0 * depthMultiplier);
        lightMultiplier -= countNearbyTilesBelow(tile, 10.0 * depthMultiplier, 1.0);
        lightMultiplier -= countCornerTilesBelow(tile, 8.0 * depthMultiplier, 1.0);
        lightMultiplier -= countNearbyTilesBelow(tile, 8.0 * depthMultiplier, 2.0);
        lightMultiplier -= countNearbyTilesBelow(tile, 6.0 * depthMultiplier, 3.0);
        lightMultiplier -= countNearbyTilesBelow(tile, 4.0 * depthMultiplier, 4.0);

        tile.color.r = min(round((tile.color.r * lightMultiplier) / 255.0), 255.0) / 255.0;
        tile.color.g = min(round((tile.color.g * lightMultiplier) / 255.0), 255.0) / 255.0;
        tile.color.b = min(round((tile.color.b * lightMultiplier) / 255.0), 255.0) / 255.0;
    }
    else {
        tile.color = vec3(10.0 / 255.0);
    }
    


    vec2 nearestChunk = coord - mod(coord, 16.0);
    if (!isOutOfBounds(nearestChunk, nearestChunk + vec2(15, 15), cursor)) {
        tile.color.rgb += 0.2;
    }

    gl_FragColor = vec4(tile.color, 1.0);
}