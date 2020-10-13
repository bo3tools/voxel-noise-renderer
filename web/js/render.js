/* jshint browser: true, esversion: 8 */
/* globals worldRegion, addClientMessage, Stats */

let canvas, gl, shader, buffer, texture;

let fragmentShaderUrl = "gl/default.glsl";

const vertexPosition = null;

const uniforms = {
    locationTime: null,
    locationScale: null,
    locationMousePosition: null,
    locationWorldTexture: null,
    locationWorldOffset: null,
    locationWorldSize: null,
    locationResolution: null,
    locationTranslation: null
};

const params = {
    tileScale: 1,
    mouseX: 0,
    mouseY: 0,
    translateX: 0,
    translateY: 0,
    worldWidth: 0,
    worldHeight: 0,
    worldOffsetWidth: 0,
    worldOffsetHeight: 0,
    screenWidth: 0,
    screenHeight: 0,
    timePassed: 0,
    timeStarted: 0
};

const stats = new Stats();
let fpsCounter, memoryPercent, memoryUsed, memoryTotal;
let fpsHidden = true, memoryHidden = true;

const TILE_SCALE_MIN = 0.3;
const TILE_SCALE_MAX = 4;
const MOUSE_PRIMARY = 1;
const MOUSE_AUXILIARY = 4;

window.addEventListener("resize", resizeCanvas);
window.addEventListener("load", initializeRender);
window.addEventListener("wheel", mouseWheelHandler);
window.addEventListener("mousemove", mouseMoveHandler);

function mouseMoveHandler(event) {
    params.mouseX = event.clientX * window.devicePixelRatio;
    params.mouseY = event.clientY * window.devicePixelRatio;

    if (event.buttons == MOUSE_PRIMARY) {
        params.translateX -= (event.movementX * params.tileScale);
        params.translateY += (event.movementY * params.tileScale);
    }
    else if (event.buttons == MOUSE_AUXILIARY) {
        const delta = 0.1 * Math.sign(event.movementY);
        params.tileScale = Math.min(Math.max(TILE_SCALE_MIN, params.tileScale + delta), TILE_SCALE_MAX);
    }
}

function mouseWheelHandler(event) {
    const delta = 0.1 * Math.sign(event.deltaY);
    params.tileScale = Math.min(Math.max(TILE_SCALE_MIN, params.tileScale + delta), TILE_SCALE_MAX);
}

function renderCanvas() {
    if (!shader) {
        return;
    }

    params.timePassed = new Date().getTime() - params.timeStarted;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Upload shader to GPU and set uniforms
    gl.useProgram(shader);
    gl.uniform1f(uniforms.locationTime, params.timePassed / 1000);
    gl.uniform1f(uniforms.locationScale, params.tileScale);
    gl.uniform2f(uniforms.locationMousePosition, params.mouseX, params.mouseY);
    gl.uniform2f(uniforms.locationResolution, params.screenWidth, params.screenHeight);
    gl.uniform2f(uniforms.locationTranslation, params.translateX, params.translateY);
    gl.uniform2f(uniforms.locationWorldSize, params.worldWidth, params.worldHeight);
    gl.uniform2f(uniforms.locationWorldOffset, params.worldOffsetWidth, params.worldOffsetHeight);

    // Set texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.locationWorldTexture, 0);

    // Render geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexPosition);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(vertexPosition);

}

function renderLoop() {
    stats.begin();
    renderCanvas();
    window.requestAnimationFrame(renderLoop);
    stats.end();
    updateStats();
}

function updateStats() {
    fpsCounter.textContent = Math.round(stats.data.fps);
    if (fpsHidden && stats.data.fps != null) {
        fpsHidden = false;
        document.getElementById("stats-fps").classList.remove("hidden");
    }

    memoryPercent.textContent = Math.round((stats.data.memory / stats.data.maxMemory) * 100) || 0;
    memoryUsed.textContent = Math.round(stats.data.memory) || 0;
    memoryTotal.textContent = Math.round(stats.data.maxMemory) || 0;
    if (memoryHidden && stats.data.memory != null) {
        memoryHidden = false;
        document.getElementById("stats-memory").classList.remove("hidden");
    }
}

async function initializeRender() {

    // Initialize UI elements
    fpsCounter = document.getElementById("fps-counter");
    memoryPercent = document.getElementById("memory-percent");
    memoryUsed = document.getElementById("memory-used");
    memoryTotal = document.getElementById("memory-total");
    
    // Initialize WebGL
    canvas = document.getElementById("canvas");
    gl = getGlContext(canvas);
    if (!gl) {
        return;
    }

    resizeCanvas();

    // Create fullscreen quad buffer
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0]), gl.STATIC_DRAW);

    // Create a world map texture
    texture = gl.createTexture();
    updateWorldTexture();

    // Create shader program
    await updateShader();

    // Start render loop
    params.timeStarted = new Date().getTime();
    renderLoop();
}

async function updateShader() {
    shader = await createProgram();
    uniforms.locationTime = gl.getUniformLocation(shader, "time");
    uniforms.locationScale = gl.getUniformLocation(shader, "scale");
    uniforms.locationMousePosition = gl.getUniformLocation(shader, "mousePosition");
    uniforms.locationWorldTexture = gl.getUniformLocation(shader, "worldTexture");
    uniforms.locationWorldOffset = gl.getUniformLocation(shader, "worldOffset");
    uniforms.locationWorldSize = gl.getUniformLocation(shader, "worldSize");
    uniforms.locationResolution = gl.getUniformLocation(shader, "resolution");
    uniforms.locationTranslation = gl.getUniformLocation(shader, "translation");
}

function updateWorldTexture() {
    params.worldWidth = worldRegion.sizeX * 16;
    params.worldHeight = worldRegion.sizeZ * 16;
    params.worldOffsetWidth = worldRegion.offsetX * 16;
    params.worldOffsetHeight = worldRegion.offsetZ * 16;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, params.worldWidth, params.worldHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, worldRegion.getTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function displayError(data) {
    const errorMessage = data.toString().replace(/[\u0000]+/g, "").trim();
    addClientMessage("&c" + errorMessage, true);
}

function getGlContext(canvas) {
    try {
        return canvas.getContext("experimental-webgl");
    }
    catch (error) {
        displayError(error);
    }

    return null;
}

function createShader(shaderSource, shaderType) {
    const shaderObject = gl.createShader(shaderType);

    gl.shaderSource(shaderObject, shaderSource);
    gl.compileShader(shaderObject);

    if (!gl.getShaderParameter(shaderObject, gl.COMPILE_STATUS)) {
        const infoLog = gl.getShaderInfoLog(shaderObject);
        const shaderName = shaderType == gl.VERTEX_SHADER ? "vertex" : "fragment";
        displayError(`&4Can't compile ${shaderName} shader: \n&c${infoLog}`);
        return null;
    }

    return shaderObject;
}

async function loadTextFile(url) {
    return (await fetch(url)).text();
}

async function createProgram() {
    const vertexShaderSource = await loadTextFile("gl/vertex.glsl");
    const fragmentShaderSource = await loadTextFile(fragmentShaderUrl);

    const vertexShader = createShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = createShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) {
        return null;
    }

    const shaderProgram = gl.createProgram();

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        const validateStatus = gl.getProgramParameter(shaderProgram, gl.VALIDATE_STATUS);
        const glError = gl.getError();

        displayError(`Can't link shader program: ${validateStatus}, ${glError.trim()}`);
        return null;

    }

    return shaderProgram;
}

function resizeCanvas() {
    const pixelRatio = window.devicePixelRatio || 1;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const scaledWidth = Math.round(canvasWidth * pixelRatio);
    const scaledHeight = Math.round(canvasHeight * pixelRatio);

    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    params.screenWidth = scaledWidth;
    params.screenHeight = scaledHeight;
    gl.viewport(0, 0, scaledWidth, scaledHeight);
}