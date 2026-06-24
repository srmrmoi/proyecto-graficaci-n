import { Obj3D } from './Obj3D.js';
import { CvWireframe } from './CvWireFrame.js';
import { CvHLines } from './CvHLines.js';
import { CvZbuf } from './CvZbuf.js';
import { Rota3D } from './Rota3D.js';
import { Point3D } from './Point3D.js';
import { WINDOW_MODEL, WINDOW_LEFT_SASH_START, WINDOW_LEFT_SASH_END, WINDOW_RIGHT_SASH_START, WINDOW_RIGHT_SASH_END } from './ModeloVentana.js';
function getElement(id) {
    var element = document.getElementById(id);
    if (!element)
        throw new Error("No se encontr\u00F3 el elemento #".concat(id));
    return element;
}
var canvas = getElement('circlechart');
var canvasWrap = getElement('canvas-wrap');
var graphics = canvas.getContext('2d');
if (!graphics)
    throw new Error('El navegador no pudo crear el contexto 2D.');
var fileInput = getElement('file-input');
var modelStatus = getElement('model-status');
var toggleAnimationButton = getElement('toggle-animation');
var resetAnimationButton = getElement('reset-animation');
var resetViewButton = getElement('reset-view');
var loadWindowButton = getElement('load-window');
var animationLabel = getElement('animation-label');
var animationIcon = getElement('animation-icon');
var speedRange = getElement('speed-range');
var speedOutput = getElement('speed-output');
var obj = null;
var renderer = null;
var renderMode = 'zbuffer';
var isWindowModel = false;
var animationPlaying = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var windowAngle = 0;
var animationDirection = 1;
var animationSpeed = Number(speedRange.value);
var animatedSashes = [];
var lastAnimationTime = 0;
var lastRenderedTime = 0;
var dragging = false;
var lastPointerX = 0;
var lastPointerY = 0;
function createRenderer(mode) {
    if (mode === 'wireframe')
        return new CvWireframe(graphics, canvas);
    if (mode === 'hlines')
        return new CvHLines(graphics, canvas);
    return new CvZbuf(graphics, canvas);
}
function repaint() {
    if (!obj || !renderer)
        return;
    renderer.setObj(obj);
    renderer.paint();
}
function updateModeButtons() {
    var buttons = document.querySelectorAll('.mode-button');
    for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        var active = button.dataset.mode === renderMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    }
}
function setRenderMode(mode) {
    renderMode = mode;
    renderer = createRenderer(mode);
    if (obj)
        renderer.setObj(obj);
    updateModeButtons();
    repaint();
}
function resetCamera() {
    if (!obj)
        return;
    obj.theta = 0.52;
    obj.phi = 1.18;
    obj.rho = 3 * obj.rhoMin;
    repaint();
    canvas.focus();
}
function moveView(dTheta, dPhi, zoomFactor) {
    if (!obj || !renderer)
        return;
    obj.vp(renderer, dTheta, dPhi, zoomFactor);
}
function createAnimatedSash(start, end, hingeSide, direction) {
    if (!obj)
        return null;
    var originalPoints = [];
    var minX = Number.POSITIVE_INFINITY;
    var maxX = Number.NEGATIVE_INFINITY;
    var minY = Number.POSITIVE_INFINITY;
    var maxY = Number.NEGATIVE_INFINITY;
    var minZ = Number.POSITIVE_INFINITY;
    var maxZ = Number.NEGATIVE_INFINITY;
    for (var i = start; i <= end; i++) {
        var point = obj.w[i];
        if (!point)
            continue;
        originalPoints[i] = new Point3D(point.x, point.y, point.z);
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
        minZ = Math.min(minZ, point.z);
        maxZ = Math.max(maxZ, point.z);
    }
    if (!isFinite(minX) || !isFinite(maxX))
        return null;
    var hingeX = hingeSide === 'minX' ? minX : maxX;
    var centerY = (minY + maxY) / 2;
    return {
        start: start,
        end: end,
        direction: direction,
        originalPoints: originalPoints,
        hingeA: new Point3D(hingeX, centerY, minZ),
        hingeB: new Point3D(hingeX, centerY, maxZ)
    };
}
function captureWindowGeometry() {
    animatedSashes = [];
    if (!obj)
        return;
    var left = createAnimatedSash(WINDOW_LEFT_SASH_START, WINDOW_LEFT_SASH_END, 'minX', 1);
    var right = createAnimatedSash(WINDOW_RIGHT_SASH_START, WINDOW_RIGHT_SASH_END, 'maxX', -1);
    if (left)
        animatedSashes.push(left);
    if (right)
        animatedSashes.push(right);
}
function applyWindowAngle(angleDegrees) {
    if (!obj || animatedSashes.length === 0)
        return;
    for (var sashIndex = 0; sashIndex < animatedSashes.length; sashIndex++) {
        var sash = animatedSashes[sashIndex];
        Rota3D.initRotate(sash.hingeA, sash.hingeB, sash.direction * angleDegrees * Math.PI / 180);
        for (var i = sash.start; i <= sash.end; i++) {
            var original = sash.originalPoints[i];
            if (original)
                obj.w[i] = Rota3D.rotate(original);
        }
    }
}
function updateAnimationButton() {
    toggleAnimationButton.disabled = !isWindowModel;
    resetAnimationButton.disabled = !isWindowModel;
    if (!isWindowModel) {
        animationIcon.textContent = '—';
        animationLabel.textContent = 'Sin animación';
        toggleAnimationButton.setAttribute('aria-pressed', 'false');
        return;
    }
    animationIcon.textContent = animationPlaying ? 'Ⅱ' : '▶';
    animationLabel.textContent = animationPlaying ? 'Pausar' : 'Reanudar';
    toggleAnimationButton.setAttribute('aria-pressed', String(!animationPlaying));
}
function hasSolidFaces(model) {
    var faces = model.getPolyList();
    for (var i = 0; i < faces.length; i++) {
        if (faces[i].getNrs().length >= 3)
            return true;
    }
    return false;
}
function loadObject(contents, windowObject, name) {
    var nextObject = new Obj3D();
    if (!nextObject.read(contents)) {
        modelStatus.textContent = 'No se pudo cargar el archivo';
        modelStatus.setAttribute('title', 'Formato esperado: vértices "índice x y z", seguido de "Faces:" y sus caras.');
        return;
    }
    obj = nextObject;
    isWindowModel = windowObject;
    windowAngle = 0;
    animationDirection = 1;
    obj.theta = 0.52;
    obj.phi = 1.18;
    obj.rho = 3 * obj.rhoMin;
    if (isWindowModel) {
        captureWindowGeometry();
        applyWindowAngle(0);
    }
    else {
        animatedSashes = [];
        animationPlaying = false;
        if (!hasSolidFaces(obj) && renderMode === 'zbuffer')
            renderMode = 'wireframe';
    }
    renderer = createRenderer(renderMode);
    renderer.setObj(obj);
    updateModeButtons();
    updateAnimationButton();
    var modelName = name.replace(/^.*[\\/]/, '').replace(/\.(txt|dat|obj)$/i, '');
    modelStatus.textContent = modelName || name;
    modelStatus.removeAttribute('title');
    repaint();
}
function loadDefaultWindow() {
    animationPlaying = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    loadObject(WINDOW_MODEL, true, 'Ventana 3D');
}
function toggleAnimation() {
    if (!isWindowModel)
        return;
    animationPlaying = !animationPlaying;
    lastAnimationTime = 0;
    updateAnimationButton();
}
function closeWindow() {
    if (!isWindowModel)
        return;
    windowAngle = 0;
    animationDirection = 1;
    applyWindowAngle(windowAngle);
    repaint();
}
function animationLoop(timestamp) {
    window.requestAnimationFrame(animationLoop);
    if (!animationPlaying || !isWindowModel || !obj) {
        lastAnimationTime = timestamp;
        return;
    }
    if (!lastAnimationTime)
        lastAnimationTime = timestamp;
    if (timestamp - lastRenderedTime < 44)
        return;
    var deltaSeconds = Math.min((timestamp - lastAnimationTime) / 1000, 0.12);
    lastAnimationTime = timestamp;
    lastRenderedTime = timestamp;
    windowAngle += animationDirection * animationSpeed * deltaSeconds;
    if (windowAngle >= 95) {
        windowAngle = 95;
        animationDirection = -1;
    }
    else if (windowAngle <= 0) {
        windowAngle = 0;
        animationDirection = 1;
    }
    applyWindowAngle(windowAngle);
    repaint();
}
function syncCanvasSize() {
    var availableWidth = Math.max(320, Math.min(1080, Math.floor(canvasWrap.clientWidth)));
    var desiredHeight = Math.max(330, Math.min(680, Math.floor(availableWidth * 0.64)));
    if (canvas.width !== availableWidth || canvas.height !== desiredHeight) {
        canvas.width = availableWidth;
        canvas.height = desiredHeight;
        repaint();
    }
}
fileInput.addEventListener('change', function (event) {
    var target = event.target;
    var file = target.files && target.files[0];
    if (!file)
        return;
    var reader = new FileReader();
    reader.onload = function () {
        loadObject(String(reader.result || ''), false, file.name);
        target.value = '';
    };
    reader.onerror = function () {
        modelStatus.textContent = 'No se pudo leer el archivo';
    };
    reader.readAsText(file);
});
var modeButtons = document.querySelectorAll('.mode-button');
var _loop_1 = function (i) {
    modeButtons[i].addEventListener('click', function () {
        setRenderMode(modeButtons[i].dataset.mode);
    });
};
for (var i = 0; i < modeButtons.length; i++) {
    _loop_1(i);
}
var actionButtons = document.querySelectorAll('[data-action]');
var _loop_2 = function (i) {
    actionButtons[i].addEventListener('click', function () {
        var action = actionButtons[i].dataset.action;
        if (action === 'up')
            moveView(0, -0.10, 1);
        else if (action === 'down')
            moveView(0, 0.10, 1);
        else if (action === 'left')
            moveView(-0.10, 0, 1);
        else if (action === 'right')
            moveView(0.10, 0, 1);
        else if (action === 'zoom-in')
            moveView(0, 0, 0.86);
        else if (action === 'zoom-out')
            moveView(0, 0, 1.16);
    });
};
for (var i = 0; i < actionButtons.length; i++) {
    _loop_2(i);
}
toggleAnimationButton.addEventListener('click', toggleAnimation);
resetAnimationButton.addEventListener('click', closeWindow);
resetViewButton.addEventListener('click', resetCamera);
loadWindowButton.addEventListener('click', loadDefaultWindow);
speedRange.addEventListener('input', function () {
    animationSpeed = Number(speedRange.value);
    speedOutput.value = String(animationSpeed);
    speedOutput.textContent = String(animationSpeed);
});
canvas.addEventListener('pointerdown', function (event) {
    dragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    canvas.classList.add('dragging');
    canvas.setPointerCapture(event.pointerId);
    canvas.focus();
});
canvas.addEventListener('pointermove', function (event) {
    if (!dragging)
        return;
    var deltaX = event.clientX - lastPointerX;
    var deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    moveView(-deltaX * 0.007, deltaY * 0.007, 1);
});
function stopDragging(event) {
    dragging = false;
    canvas.classList.remove('dragging');
    if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
}
canvas.addEventListener('pointerup', stopDragging);
canvas.addEventListener('pointercancel', stopDragging);
canvas.addEventListener('wheel', function (event) {
    event.preventDefault();
    moveView(0, 0, event.deltaY > 0 ? 1.12 : 0.89);
}, { passive: false });
canvas.addEventListener('keydown', function (event) {
    var key = event.key.toLowerCase();
    var handled = true;
    if (key === 'arrowleft' || key === 'a')
        moveView(-0.08, 0, 1);
    else if (key === 'arrowright' || key === 'd')
        moveView(0.08, 0, 1);
    else if (key === 'arrowup' || key === 'w')
        moveView(0, -0.08, 1);
    else if (key === 'arrowdown' || key === 's')
        moveView(0, 0.08, 1);
    else if (key === '+' || key === '=')
        moveView(0, 0, 0.88);
    else if (key === '-' || key === '_')
        moveView(0, 0, 1.14);
    else if (key === 'r')
        resetCamera();
    else if (key === ' ')
        toggleAnimation();
    else
        handled = false;
    if (handled)
        event.preventDefault();
});
var ResizeObserverConstructor = window.ResizeObserver;
if (ResizeObserverConstructor) {
    var resizeObserver = new ResizeObserverConstructor(syncCanvasSize);
    resizeObserver.observe(canvasWrap);
}
else {
    window.addEventListener('resize', syncCanvasSize);
}
syncCanvasSize();
loadDefaultWindow();
updateModeButtons();
updateAnimationButton();
window.requestAnimationFrame(animationLoop);
