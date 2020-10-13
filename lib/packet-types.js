/* jshint node: true, esversion: 8 */

class Packet {
    constructor(type) {
        this.typeBuffer = Buffer.allocUnsafe(1);
        this.typeBuffer.writeUInt8(type);
    }

    toBuffer() {
        throw new Error("Packet not implemented");
    }
}

const PACKET_HELLO      = 0x10;
const PACKET_MESSAGE    = 0x11;
const PACKET_EXCEPTION  = 0x12;
const PACKET_CHUNK_DATA = 0x13;

Packet.Hello = class extends Packet {
    constructor(clientId) {
        super(PACKET_HELLO);

        const clientIdBuffer = Buffer.allocUnsafe(1);
        clientIdBuffer.writeUInt8(clientId, 0);
        this.packetData = Buffer.concat([this.typeBuffer, clientIdBuffer]);
    }

    toBuffer() {
        return this.packetData;
    }
};

Packet.Message = class extends Packet {
    constructor(text) {
        super(PACKET_MESSAGE);

        const textBuffer = Buffer.from(text, "utf8");
        this.packetData = Buffer.concat([this.typeBuffer, textBuffer]);
    }

    toBuffer() {
        return this.packetData;
    }
};

Packet.Exception = class extends Packet {
    constructor(text) {
        super(PACKET_EXCEPTION);

        const textBuffer = Buffer.from(text, "utf8");
        this.packetData = Buffer.concat([this.typeBuffer, textBuffer]);
    }

    toBuffer() {
        return this.packetData;
    }
};

Packet.Chunk = class extends Packet {
    constructor(x, z, data) {
        super(PACKET_CHUNK_DATA);

        const chunkData = Buffer.from(data);
        const chunkCoord = Buffer.allocUnsafe(8);
        chunkCoord.writeInt32BE(x, 0);
        chunkCoord.writeInt32BE(z, 4);
        this.packetData = Buffer.concat([this.typeBuffer, chunkCoord, chunkData]);
    }

    toBuffer() {
        return this.packetData;
    }
};

module.exports = Packet;