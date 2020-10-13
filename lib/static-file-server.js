/* jshint node: true, esversion: 8 */

const fs = require("fs");
const url = require("url");
const path = require("path");

const FALLBACK_MIME_TYPE = "application/octet-stream";
const EXTENSION_TO_MIME_TYPE = {
    ".json": "application/json",
    ".html": "text/html",
    ".ico": "image/x-icon",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".js": "text/javascript"
};

class FileServer {
    constructor(rootFolder) {
        this.rootFolder = rootFolder;
    }

    isInRootDirectory(dir) {
        const relative = path.relative(this.rootFolder, dir);
        return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
    }

    sendStaticFile(response, filePath) {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                response.statusCode = 500;
                response.end();
                console.error(`Can't read static file ${filePath}: ${err.toString()}`);
                return;
            }

            const fileExtension = path.parse(filePath).ext;
            const mimeType = EXTENSION_TO_MIME_TYPE[fileExtension] || FALLBACK_MIME_TYPE;
            response.writeHead(200, {"Content-Type": mimeType});
            response.end(data);
        });
    }

    handleRequest(request, response) {
        const parsedUrl = url.parse(request.url);
        const requestedFileUrl = `.${parsedUrl.pathname}`;
        const requestedFilePath = `${this.rootFolder}${parsedUrl.pathname}`;

        if (requestedFileUrl !== "./" && !this.isInRootDirectory(requestedFilePath)) {
            response.statusCode = 404;
            response.end();
            return;
        }

        fs.exists(requestedFilePath, (fileExists) => {
            if (!fileExists) {
                response.statusCode = 404;
                response.end();
            }
            else if (fs.statSync(requestedFilePath).isDirectory()) {
                this.sendStaticFile(response, requestedFilePath + "/index.html");
            }
            else {
                this.sendStaticFile(response, requestedFilePath); 
            }
        });
    }
}

module.exports = FileServer;