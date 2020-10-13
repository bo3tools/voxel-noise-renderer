/* jshint worker: true, esversion: 8 */
/* globals CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_DATA_SIZE */

importScripts("world.js");

self.onmessage = (event) => {
    const {chunkX, chunkZ, chunkData} = event.data;
    const heightMap = parseChunkMessage(chunkData);

    postMessage({
        chunkX, chunkZ, heightMap
    });
};

const COLOR_AIR = 0;
const COLOR_WATER = 0x294d96;
const COLOR_KELP_STEM = 0x253e13;
const COLOR_KELP_PLANT = 0x36531b;
const COLOR_SEAGRASS = 0x56764e;
const COLOR_TALL_SEAGRASS = 0x678461;
const COLOR_SEA_PICKLE = 0x81886b;
const GO_UNDERWATER = true;

function parseChunkMessage(chunkData) {
    const heightMap = new Uint8Array(CHUNK_DATA_SIZE);

    const getMapIndex = (x, z) => (x * CHUNK_SIZE + z) * 4;
    const getChunkIndex = (x, y, z) => (CHUNK_HEIGHT * (CHUNK_SIZE * x + z) + y) * 3;

    const getColorValue = (r, g, b) => (r << 16) + (g << 8) + b;
    const getChunkBlock = (i) => getColorValue(chunkData[i], chunkData[i + 1], chunkData[i + 2]);

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            loopColumn: for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
                const chunkIndex = getChunkIndex(x, y, z);
                const chunkBlock = getChunkBlock(chunkIndex);

                if (chunkBlock != COLOR_AIR) {
                    const mapIndex = getMapIndex(x, z);
                    if (chunkBlock == COLOR_WATER && GO_UNDERWATER) {
                        let hasPlantGrowth = false;

                        loopDepth: for (let d = y; d >= 0; d--) {
                            const depthIndex = getChunkIndex(x, d, z);
                            const depthBlock = getChunkBlock(depthIndex);

                            switch (depthBlock) {
                                case COLOR_KELP_PLANT:
                                case COLOR_KELP_STEM:
                                case COLOR_SEAGRASS:
                                case COLOR_SEA_PICKLE:
                                case COLOR_TALL_SEAGRASS:
                                    hasPlantGrowth = true; /* falls through */
                                case COLOR_WATER:
                                    continue loopDepth;
                            }

                            heightMap[mapIndex] = 0x00;
                            heightMap[mapIndex + 1] = hasPlantGrowth ? 0x01 : 0x00;
                            heightMap[mapIndex + 2] = d;
                            heightMap[mapIndex + 3] = y;
                            break loopColumn;
                        }
                    }
                    else {
                        heightMap[mapIndex] = chunkData[chunkIndex];
                        heightMap[mapIndex + 1] = chunkData[chunkIndex + 1];
                        heightMap[mapIndex + 2] = chunkData[chunkIndex + 2];
                        heightMap[mapIndex + 3] = y;
                        break loopColumn;
                    }
                }
            }
        }
    }

    return heightMap;
}