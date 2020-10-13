/* jshint node: true, esversion: 8 */

const url = require("url");
const http = require("http");
const querystring = require("querystring");

const FileServer = require("./lib/static-file-server.js");
const WorldStorage = require("./lib/world-storage.js");
const CommandPrompt = require("./lib/command-line-prompt.js");
const WebsocketHandler = require("./lib/websocket-handler.js");
const Packet = require("./lib/packet-types.js");

const ROOT_FOLDER = "./web";
const LISTEN_HOST = "localhost";
const LISTEN_PORT = 8081;

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 256;
const CHUNK_DATA_SIZE = 3 * CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;

const fileServer = new FileServer(ROOT_FOLDER);
const commandPrompt = new CommandPrompt();
const wsHandler = new WebsocketHandler();

const tempChunkStorage = new Map();

const httpServer = http.createServer((request, response) => {
    const parsedUrl = url.parse(request.url);
    const requestPath = parsedUrl.pathname;

    if (requestPath === "/api/set-chunk") {
        const requestQuery = querystring.parse(parsedUrl.query);
        const chunkX = Number(requestQuery.x);
        const chunkZ = Number(requestQuery.z);

        if (!Number.isInteger(chunkX) || !Number.isInteger(chunkZ)) {
            response.statusCode = 500;
            response.end("Invalid chunk coordinates");
            return;
        }

        if (request.method !== "POST") {
            response.statusCode = 500;
            response.end("Invalid request method");
            return;
        }

        const pieces = [];
        request.on("data", (piece) => pieces.push(piece));
        request.on("end", () => {
            const buffer = Buffer.concat(pieces);

            if (buffer.length != CHUNK_DATA_SIZE) {
                response.statusCode = 500;
                response.end("Invalid chunk data");
                return;
            }

            const chunkPacket = new Packet.Chunk(chunkX, chunkZ, buffer);
            tempChunkStorage.set(chunkX + "," + chunkZ, chunkPacket);
            wsHandler.broadcastPacket(chunkPacket);

            response.statusCode = 200;
            response.end();
        });
        
        return;
    }

    fileServer.handleRequest(request, response);
});

wsHandler.attachToServer(httpServer);

process.on("uncaughtException", (error) => {
    wsHandler.broadcastPacket(new Packet.Exception("&4Uncaught server exception: &c" + error.stack.toString()));
    console.error(error);
    setTimeout(() => process.exit(1));
});

wsHandler.on("connect", (clientId) => {
    console.log(`Client ${clientId} connected, total clients: ${wsHandler.totalClients}`);
    wsHandler.sendPacket(clientId, new Packet.Hello(clientId));

    tempChunkStorage.forEach((chunkPacket) => {
        wsHandler.sendPacket(clientId, chunkPacket);
    });

    wsHandler.sendPacket(clientId, new Packet.Message(`Sent ${tempChunkStorage.size} chunk packets`));
});

wsHandler.on("disconnect", (clientId) => {
    console.log(`Client ${clientId} disconnected, total clients: ${wsHandler.totalClients}`);
});

commandPrompt.setCompleteCommands("say");
commandPrompt.on("command", (command, args) => {
    if (command === "say") {
        const message = args.join(" ");

        if (!message) {
            console.log("Usage: say <text>");
            return;
        }

        if (wsHandler.totalClients == 0) {
            console.log("No clients connected");
            return;
        }

        const messagePacket = new Packet.Message(message);
        console.log(`Broadcasting message "${message}" to ${wsHandler.totalClients} clients...`);
        wsHandler.broadcastPacket(messagePacket);
        return;
    }

    console.log("Unknown command");
});

httpServer.listen(LISTEN_PORT, LISTEN_HOST, () => {
    console.info(`Server listening on http://${LISTEN_HOST}:${LISTEN_PORT}`);
    if (LISTEN_HOST === "0.0.0.0") {
        console.warn("");
        console.warn("Warning: The server is configured to listen on all IPs (0.0.0.0)");
        console.warn("This application is meant to be used on a local machine only.");
        console.warn("");
    }

    commandPrompt.startPrompt();
});