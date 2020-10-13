/* jshint browser: true, esversion: 8 */

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 256;
const CHUNK_DATA_SIZE = CHUNK_SIZE * CHUNK_SIZE * 4;

class WorldRegion {
    constructor(initialSize = 64) {
        this.sizeX = initialSize * 2;
        this.sizeZ = initialSize * 2;
        this.offsetX = -initialSize;
        this.offsetZ = -initialSize;
        this.worldData = new Uint8Array(CHUNK_DATA_SIZE * this.sizeX * this.sizeZ);
    }

    fillChunkData(chunkX, chunkZ, dataValue) {
        const chunkData = new Uint8Array(CHUNK_DATA_SIZE);

        let colorIndex = -1;
        for (let i = 0; i < CHUNK_DATA_SIZE; i++) {
            colorIndex = (colorIndex + 1) % 4;
            chunkData[i] = dataValue[colorIndex];

            if (i % 4 != 3) {
                chunkData[i] *= Math.max(0.05, ((i % 64) + parseInt(i / 64)) / 64);
            }

            chunkData[i] = Math.max(0, Math.min(chunkData[i], 255));
        }

        this.setChunkData(chunkX, chunkZ, chunkData);
    }

    getChunkIndex(blockX, blockZ) {
        return (blockX * CHUNK_SIZE + blockZ) * 4;
    }

    getWorldIndex(blockX, blockZ, offsetX, offsetZ) {
        return ((blockX + offsetX) * CHUNK_SIZE * this.sizeX + (blockZ + offsetZ)) * 4;
    }

    getBlock(blockX, blockZ) {
        const relativeX = blockX % CHUNK_SIZE;
        const relativeZ = blockZ % CHUNK_SIZE;
        const chunkX = (blockX < 0 ? 1 : 0) + (blockX >> 4);
        const chunkZ = (blockZ < 0 ? 1 : 0) + (blockZ >> 4);
        const offsetX = (chunkX - this.offsetX) << 4;
        const offsetZ = (chunkZ - this.offsetZ) << 4;

        const worldIndex = this.getWorldIndex(relativeX, relativeZ, offsetX, offsetZ);

        const setColor = (r = 255, g = 255, b = 255, a = 255) => {
            this.worldData[worldIndex] = r;
            this.worldData[worldIndex + 1] = g;
            this.worldData[worldIndex + 2] = b;
            this.worldData[worldIndex + 3] = a;
        };

        return {setColor};
    }

    setChunkData(chunkX, chunkZ, chunkData) {
        const cx = (chunkX - this.offsetX) << 4;
        const cz = (chunkZ - this.offsetZ) << 4;

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const chunkIndex = this.getChunkIndex(x, z);
                const worldIndex = this.getWorldIndex(x, z, cx, cz);

                for (let i = 0; i < 4; i++) {
                    this.worldData[worldIndex + i] = chunkData[chunkIndex + i];
                }
            }
        }
    }

    getTexture() {
        return this.worldData;
    }
}