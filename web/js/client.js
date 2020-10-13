/* jshint browser: true, esversion: 8 */
/* globals WorldRegion, CHUNK_SIZE, CHUNK_HEIGHT */
/* globals updateWorldTexture, updateShader, fragmentShaderUrl */

const worldRegion = new WorldRegion();
const chunkParser = new Worker("js/worker.js");

window.addEventListener("load", initializeClient);
window.addEventListener("error", reportRuntimeError);
window.addEventListener("keyup", handleWindowKeyUp);
window.addEventListener("keydown", handleWindowKeyDown);
window.addEventListener("unhandledrejection", reportRuntimeError);

let webSocket = null;

function initializeClient() {
    reconnectWebSocket();

    const updateTextureNextFrame = debounceNextFrame(updateWorldTexture);
    chunkParser.onmessage = (event) => {
        const chunkData = event.data;
        worldRegion.setChunkData(chunkData.chunkX, chunkData.chunkZ, chunkData.heightMap);
        updateTextureNextFrame();
    };
}

function debounceNextFrame(func) {
    let requestId = null;

    return function() {
        let thisArg = this, args = arguments;
        let debounceCallback = function() {
            requestId = null;
            func.apply(thisArg, args);
        };

        window.cancelAnimationFrame(requestId);
        requestId = window.requestAnimationFrame(debounceCallback);
        
        if (!requestId) {
            func.apply(thisArg, args);
        }
    };
}

function reconnectWebSocket() {
    if (webSocket !== null) {
        webSocket.close(1000, "Manual reconnect");
    }

    webSocket = new WebSocket(`ws://${window.location.host}`);
    webSocket.binaryType = "arraybuffer";

    webSocket.addEventListener("open", () => {
        addClientMessage("&7&o[Socket: Connection established]");
    });

    webSocket.addEventListener("close", (event) => {
        addClientMessage(`&7&o[Socket: Connection closed (${event.reason || event.code})]`);
    });

    webSocket.addEventListener("error", () => {
        addClientMessage("&7&o[Socket: Connection error]");
    });

    webSocket.addEventListener("message", (event) => {
        parseServerPacket(event.data);
    });
}

const PACKET_HELLO      = 0x10;
const PACKET_MESSAGE    = 0x11;
const PACKET_EXCEPTION  = 0x12;
const PACKET_CHUNK_DATA = 0x13;

const packetHandlers = new Map();

packetHandlers.set(PACKET_HELLO, (dataView) => {
    const clientId = dataView.getUint8();
    addClientMessage(`&eHello: Client ID is ${clientId}`);
});

const textDecoder = new TextDecoder("utf8");

packetHandlers.set(PACKET_MESSAGE, (dataView) => {
    const messageText = textDecoder.decode(dataView);
    addClientMessage(messageText);
});

packetHandlers.set(PACKET_EXCEPTION, (dataView) => {
    const errorMessage = textDecoder.decode(dataView);
    addClientMessage(errorMessage, true);
});

const FULL_CHUNK_SIZE = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT * 3;

packetHandlers.set(PACKET_CHUNK_DATA, (dataView, packetData) => {
    const chunkData = new Uint8Array(packetData.slice(8));
    const chunkInfo = {
        x: dataView.getInt32(0),
        z: dataView.getInt32(4)
    };

    if (chunkData.length !== FULL_CHUNK_SIZE) {
        throw new Error(`Invalid chunk data at ${chunkInfo.x}, ${chunkInfo.z}: expected ${FULL_CHUNK_SIZE} bytes, got ${chunkData.length}`);
    }

    chunkParser.postMessage({
        chunkX: chunkInfo.x,
        chunkZ: chunkInfo.z,
        chunkData: chunkData
    });
});

function parseServerPacket(buffer) {
    const packetType = (new DataView(buffer.slice(0, 1))).getUint8();
    const packetData = buffer.slice(1);
    const packetView = new DataView(packetData);

    if (!packetHandlers.has(packetType)) {
        throw new Error(`Unexpected packet type 0x${packetType.toString(16)}`);
    }

    const handlerFunc = packetHandlers.get(packetType);
    handlerFunc.call(null, packetView, packetData);
}

let reloadKeyPressed = false;

function handleWindowKeyUp(event) {
    if (event.code == "KeyR") {
        reloadKeyPressed = false;
    }
}

async function handleReloadShadersKey() {
    if (!reloadKeyPressed) {
        reloadKeyPressed = true;
        await updateShader();
        addClientMessage("&7&o[Client: Shaders reloaded]");
    }
}

const shaderShortcutKeyMap = {
    "Digit0": "gl/default.glsl",
    "Digit1": "gl/variants/regular.glsl",
    "Digit2": "gl/variants/height.glsl"
};

function handleSetShaderUrlKey(event) {
    if (event.shiftKey) {
        const newShaderUrl = shaderShortcutKeyMap[event.code];
        if (!newShaderUrl) {
            addClientMessage(`&7&o[Client: No shader shortcut for ${event.code}]`);
            return;
        }

        fragmentShaderUrl = newShaderUrl;
        addClientMessage(`&7&o[Client: Set current shader to ${newShaderUrl}]`);
    }
}

function handleClearMessagesKey() {
    const messagesContainer = document.getElementById("messages");
    while (messagesContainer.firstChild) {
        messagesContainer.removeChild(messagesContainer.lastChild);
    }
    addClientMessage("&7&o[Client: Chat cleared]");
}

function handleSocketReconnectKey() {
    addClientMessage("&7&o[Socket: Reconnecting...]");
    reconnectWebSocket();
}

async function handleWindowKeyDown(event) {
    switch (event.code) {
        case "KeyC":
            handleClearMessagesKey(event);
            break;
        case "KeyF":
            handleSocketReconnectKey(event);
            break;
        case "KeyR":
            handleReloadShadersKey(event);
            break;
        case "Digit0":   
        case "Digit1":
        case "Digit2":
        case "Digit3":
        case "Digit4":
        case "Digit5":
        case "Digit6":
        case "Digit7":
        case "Digit8":
        case "Digit9":
            handleSetShaderUrlKey(event);
            break;
    }
}

function reportRuntimeError(event) {
    const error = event.error || event.reason;
    
    if (!error) {
        addClientMessage("&cUnknown error occurred", true);
    }
    else {
        const errorMessage = "&c" + error.stack.replace(/^([\w\s]+:)/, "&4$1&c");
        addClientMessage(errorMessage, true);
    }
}

const MAX_CLIENT_MESSAGES = 30;
const MESSAGE_FADE_TIME = 10000;

function addClientMessage(messageText, isImportant = false) {
    const messageElement = importTemplate("template-message").firstElementChild;
    const textElement = messageElement.querySelector(".text");
    textElement.appendChild(parseColoredText(messageText));

    const messagesContainer = document.getElementById("messages");
    messagesContainer.appendChild(messageElement);

    if (isImportant) {
        messageElement.dataset.isImportant = true;
    }
    else {
        setTimeout(() => { removeMessage(messageElement); }, MESSAGE_FADE_TIME);
    }

    if (messagesContainer.childNodes.length > MAX_CLIENT_MESSAGES) {
        for (let i = 0; i < messagesContainer.childNodes.length; i++) {
            const nodeToRemove = messagesContainer.childNodes[i];
            if (!nodeToRemove.dataset.isImportant && !nodeToRemove.dataset.isDisappearing) {
                messagesContainer.removeChild(nodeToRemove);
                return;
            }
        }
    }
}

const CHAT_COLOR_CODES = {
    "0": "black",
    "1": "dark-blue",
    "2": "dark-green",
    "3": "dark-aqua",
    "4": "dark-red",
    "5": "dark-purple",
    "6": "gold",
    "7": "gray",
    "8": "dark-gray",
    "9": "blue",
    "a": "green",
    "b": "aqua",
    "c": "red",
    "d": "light-purple",
    "e": "yellow",
    "f": "white",
    "r": "white"
};

const CHAT_STYLE_CODES = {
    "r": "normal",
    "o": "italic",
    "l": "bold"
};

function parseColoredText(coloredText) {
    const textFragment = document.createDocumentFragment();

    const textLength = coloredText.length;
    const textBuffer = [];
    const currentStyle = {
        chatColor: "white",
        chatStyle: "normal"
    };

    const flushBuffer = () => {
        if (textBuffer.length > 0) {
            const styledElement = document.createElement("span");
            if (currentStyle.chatStyle != "normal") {
                styledElement.dataset.chatStyle = currentStyle.chatStyle;
            }
            styledElement.dataset.chatColor = currentStyle.chatColor;
            styledElement.textContent = textBuffer.join("");
            textFragment.appendChild(styledElement);
            textBuffer.length = 0;
        }
    };

    for (let i = 0; i < textLength; i++) {
        const currentChar = coloredText.charAt(i);
        const hasMoreText = i + 1 < textLength;

        if ((currentChar === "&" || currentChar === "§") && hasMoreText) {
            const formattingCode = coloredText.charAt(i + 1);

            const newChatColor = CHAT_COLOR_CODES[formattingCode];
            const newChatStyle = CHAT_STYLE_CODES[formattingCode];

            if (newChatColor || newChatStyle) {
                flushBuffer();
                currentStyle.chatColor = newChatColor || currentStyle.chatColor;
                currentStyle.chatStyle = newChatStyle || currentStyle.chatStyle;
                i += 1;
                continue;
            }
        }

        textBuffer.push(currentChar);

        if (currentChar === "\n") {
            textBuffer.push(" ");
        }
    }

    flushBuffer();
    return textFragment;
}

function removeMessage(messageElement) {
    messageElement.dataset.isDisappearing = true;
    setTimeout(() => {
        if (messageElement.parentElement) {
            messageElement.parentElement.removeChild(messageElement);
        }
    }, 1000);
}

function importTemplate(templateId) {
    return document.importNode(document.getElementById(templateId).content, true);
}