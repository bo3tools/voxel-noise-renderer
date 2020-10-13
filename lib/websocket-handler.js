/* jshint node: true, esversion: 8 */

const Packet = require("./packet-types.js");
const EventEmitter = require("events").EventEmitter;
const WebSocket = require("ws");

const COMPRESSION_ENABLED = true;

class WebsocketHandler {
    constructor() {
        this.eventEmitter = new EventEmitter();
        this.activeClients = new Map();
        this.isAttached = false;
        this.wssServer = null;
        this.nextClientId = 0;
    }

    get totalClients() {
        return this.activeClients.size;
    }

    sendPacket(clientId, packet) {
        if (!(packet instanceof Packet)) {
            throw new Error("Can only send Packet types");
        }

        if (!(this.activeClients.has(clientId))) {
            throw new Error(`Client with id ${clientId} doesn't exist`);
        }

        const webSocket = this.activeClients.get(clientId);
        webSocket.send(packet.toBuffer(), {
            compress: COMPRESSION_ENABLED,
            binary: true
        });
    }

    broadcastPacket(packet) {
        if (!(packet instanceof Packet)) {
            throw new Error("Can only broadcast Packet types");
        }

        for (const clientId of this.activeClients.keys()) {
            this.sendPacket(clientId, packet);
        }
    }

    attachToServer(httpServer) {
        if (this.isAttached) {
            throw new Error("Already attached to a server");
        }

        this.isAttached = true;

        this.wssServer = new WebSocket.Server({
            server: httpServer,
            perMessageDeflate: COMPRESSION_ENABLED
        });

        this.wssServer.on("connection", (webSocket) => {

            const clientId = this.nextClientId++;
            this.activeClients.set(clientId, webSocket);
            this.eventEmitter.emit("connect", clientId);
            
            webSocket.on("close", (code, reason) => {
                this.activeClients.delete(clientId);
                this.eventEmitter.emit("disconnect", clientId, code, reason);
            });

            webSocket.on("message", (data) => {
                this.eventEmitter.emit("message", clientId, data);
            });
        });
    }

    on(event, handler) {
        this.eventEmitter.addListener(event, handler);
    }
}

module.exports = WebsocketHandler;