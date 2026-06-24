import { Obj3D } from './Obj3D.js';
import { CvWireframe } from './CvWireFrame.js';
import { CvHLines } from './CvHLines.js';
import { CvZbuf } from './CvZbuf.js';
import { Rota3D } from './Rota3D.js';
import { Point3D } from './Point3D.js';
import {
  WINDOW_MODEL,
  WINDOW_LEFT_SASH_START,
  WINDOW_LEFT_SASH_END,
  WINDOW_RIGHT_SASH_START,
  WINDOW_RIGHT_SASH_END
} from './ModeloVentana.js';

type RenderMode = 'wireframe' | 'hlines' | 'zbuffer';
type Renderer = CvWireframe | CvHLines | CvZbuf;

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`No se encontró el elemento #${id}`);
  return element as T;
}

const canvas = getElement<HTMLCanvasElement>('circlechart');
const canvasWrap = getElement<HTMLDivElement>('canvas-wrap');
const graphics = canvas.getContext('2d');
if (!graphics) throw new Error('El navegador no pudo crear el contexto 2D.');

const fileInput = getElement<HTMLInputElement>('file-input');
const modelStatus = getElement<HTMLElement>('model-status');
const toggleAnimationButton = getElement<HTMLButtonElement>('toggle-animation');
const resetAnimationButton = getElement<HTMLButtonElement>('reset-animation');
const resetViewButton = getElement<HTMLButtonElement>('reset-view');
const loadWindowButton = getElement<HTMLButtonElement>('load-window');
const animationLabel = getElement<HTMLElement>('animation-label');
const animationIcon = getElement<HTMLElement>('animation-icon');
const speedRange = getElement<HTMLInputElement>('speed-range');
const speedOutput = getElement<HTMLOutputElement>('speed-output');

let obj: Obj3D | null = null;
let renderer: Renderer | null = null;
let renderMode: RenderMode = 'zbuffer';
let isWindowModel = false;
let animationPlaying = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let windowAngle = 0;
let animationDirection = 1;
let animationSpeed = Number(speedRange.value);
type AnimatedSash = {
  start: number;
  end: number;
  direction: number;
  originalPoints: Array<Point3D | null>;
  hingeA: Point3D;
  hingeB: Point3D;
};

let animatedSashes: AnimatedSash[] = [];
let lastAnimationTime = 0;
let lastRenderedTime = 0;
let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

function createRenderer(mode: RenderMode): Renderer {
  if (mode === 'wireframe') return new CvWireframe(graphics, canvas);
  if (mode === 'hlines') return new CvHLines(graphics, canvas);
  return new CvZbuf(graphics, canvas);
}

function repaint(): void {
  if (!obj || !renderer) return;
  renderer.setObj(obj);
  renderer.paint();
}

function updateModeButtons(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.mode-button');
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    const active = button.dataset.mode === renderMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function setRenderMode(mode: RenderMode): void {
  renderMode = mode;
  renderer = createRenderer(mode);
  if (obj) renderer.setObj(obj);
  updateModeButtons();
  repaint();
}

function resetCamera(): void {
  if (!obj) return;
  obj.theta = 0.52;
  obj.phi = 1.18;
  obj.rho = 3 * obj.rhoMin;
  repaint();
  canvas.focus();
}

function moveView(dTheta: number, dPhi: number, zoomFactor: number): void {
  if (!obj || !renderer) return;
  obj.vp(renderer, dTheta, dPhi, zoomFactor);
}

function createAnimatedSash(
  start: number,
  end: number,
  hingeSide: 'minX' | 'maxX',
  direction: number
): AnimatedSash | null {
  if (!obj) return null;

  const originalPoints: Array<Point3D | null> = [];
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let i = start; i <= end; i++) {
    const point = obj.w[i] as Point3D;
    if (!point) continue;
    originalPoints[i] = new Point3D(point.x, point.y, point.z);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  if (!isFinite(minX) || !isFinite(maxX)) return null;
  const hingeX = hingeSide === 'minX' ? minX : maxX;
  const centerY = (minY + maxY) / 2;

  return {
    start,
    end,
    direction,
    originalPoints,
    hingeA: new Point3D(hingeX, centerY, minZ),
    hingeB: new Point3D(hingeX, centerY, maxZ)
  };
}

function captureWindowGeometry(): void {
  animatedSashes = [];
  if (!obj) return;

  const left = createAnimatedSash(
    WINDOW_LEFT_SASH_START,
    WINDOW_LEFT_SASH_END,
    'minX',
    1
  );
  const right = createAnimatedSash(
    WINDOW_RIGHT_SASH_START,
    WINDOW_RIGHT_SASH_END,
    'maxX',
    -1
  );

  if (left) animatedSashes.push(left);
  if (right) animatedSashes.push(right);
}

function applyWindowAngle(angleDegrees: number): void {
  if (!obj || animatedSashes.length === 0) return;

  for (let sashIndex = 0; sashIndex < animatedSashes.length; sashIndex++) {
    const sash = animatedSashes[sashIndex];
    Rota3D.initRotate(
      sash.hingeA,
      sash.hingeB,
      sash.direction * angleDegrees * Math.PI / 180
    );

    for (let i = sash.start; i <= sash.end; i++) {
      const original = sash.originalPoints[i];
      if (original) obj.w[i] = Rota3D.rotate(original);
    }
  }
}

function updateAnimationButton(): void {
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

function hasSolidFaces(model: Obj3D): boolean {
  const faces = model.getPolyList();
  for (let i = 0; i < faces.length; i++) {
    if (faces[i].getNrs().length >= 3) return true;
  }
  return false;
}

function loadObject(contents: string, windowObject: boolean, name: string): void {
  const nextObject = new Obj3D();
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
  } else {
    animatedSashes = [];
    animationPlaying = false;

    if (!hasSolidFaces(obj) && renderMode === 'zbuffer') renderMode = 'wireframe';
  }

  renderer = createRenderer(renderMode);
  renderer.setObj(obj);
  updateModeButtons();
  updateAnimationButton();

  const modelName = name.replace(/^.*[\\/]/, '').replace(/\.(txt|dat|obj)$/i, '');
  modelStatus.textContent = modelName || name;
  modelStatus.removeAttribute('title');
  repaint();
}

function loadDefaultWindow(): void {
  animationPlaying = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  loadObject(WINDOW_MODEL, true, 'Ventana 3D');
}

function toggleAnimation(): void {
  if (!isWindowModel) return;
  animationPlaying = !animationPlaying;
  lastAnimationTime = 0;
  updateAnimationButton();
}

function closeWindow(): void {
  if (!isWindowModel) return;
  windowAngle = 0;
  animationDirection = 1;
  applyWindowAngle(windowAngle);
  repaint();
}

function animationLoop(timestamp: number): void {
  window.requestAnimationFrame(animationLoop);
  if (!animationPlaying || !isWindowModel || !obj) {
    lastAnimationTime = timestamp;
    return;
  }

  if (!lastAnimationTime) lastAnimationTime = timestamp;
  if (timestamp - lastRenderedTime < 44) return;

  const deltaSeconds = Math.min((timestamp - lastAnimationTime) / 1000, 0.12);
  lastAnimationTime = timestamp;
  lastRenderedTime = timestamp;
  windowAngle += animationDirection * animationSpeed * deltaSeconds;

  if (windowAngle >= 95) {
    windowAngle = 95;
    animationDirection = -1;
  } else if (windowAngle <= 0) {
    windowAngle = 0;
    animationDirection = 1;
  }

  applyWindowAngle(windowAngle);
  repaint();
}

function syncCanvasSize(): void {
  const availableWidth = Math.max(320, Math.min(1080, Math.floor(canvasWrap.clientWidth)));
  const desiredHeight = Math.max(330, Math.min(680, Math.floor(availableWidth * 0.64)));
  if (canvas.width !== availableWidth || canvas.height !== desiredHeight) {
    canvas.width = availableWidth;
    canvas.height = desiredHeight;
    repaint();
  }
}

fileInput.addEventListener('change', function (event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files && target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (): void {
    loadObject(String(reader.result || ''), false, file.name);
    target.value = '';
  };
  reader.onerror = function (): void {
    modelStatus.textContent = 'No se pudo leer el archivo';
  };
  reader.readAsText(file);
});

const modeButtons = document.querySelectorAll<HTMLButtonElement>('.mode-button');
for (let i = 0; i < modeButtons.length; i++) {
  modeButtons[i].addEventListener('click', function (): void {
    setRenderMode(modeButtons[i].dataset.mode as RenderMode);
  });
}

const actionButtons = document.querySelectorAll<HTMLButtonElement>('[data-action]');
for (let i = 0; i < actionButtons.length; i++) {
  actionButtons[i].addEventListener('click', function (): void {
    const action = actionButtons[i].dataset.action;
    if (action === 'up') moveView(0, -0.10, 1);
    else if (action === 'down') moveView(0, 0.10, 1);
    else if (action === 'left') moveView(-0.10, 0, 1);
    else if (action === 'right') moveView(0.10, 0, 1);
    else if (action === 'zoom-in') moveView(0, 0, 0.86);
    else if (action === 'zoom-out') moveView(0, 0, 1.16);
  });
}

toggleAnimationButton.addEventListener('click', toggleAnimation);
resetAnimationButton.addEventListener('click', closeWindow);
resetViewButton.addEventListener('click', resetCamera);
loadWindowButton.addEventListener('click', loadDefaultWindow);

speedRange.addEventListener('input', function (): void {
  animationSpeed = Number(speedRange.value);
  speedOutput.value = String(animationSpeed);
  speedOutput.textContent = String(animationSpeed);
});

canvas.addEventListener('pointerdown', function (event: PointerEvent): void {
  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(event.pointerId);
  canvas.focus();
});

canvas.addEventListener('pointermove', function (event: PointerEvent): void {
  if (!dragging) return;
  const deltaX = event.clientX - lastPointerX;
  const deltaY = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  moveView(-deltaX * 0.007, deltaY * 0.007, 1);
});

function stopDragging(event: PointerEvent): void {
  dragging = false;
  canvas.classList.remove('dragging');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener('pointerup', stopDragging);
canvas.addEventListener('pointercancel', stopDragging);

canvas.addEventListener('wheel', function (event: WheelEvent): void {
  event.preventDefault();
  moveView(0, 0, event.deltaY > 0 ? 1.12 : 0.89);
}, { passive: false });

canvas.addEventListener('keydown', function (event: KeyboardEvent): void {
  const key = event.key.toLowerCase();
  let handled = true;

  if (key === 'arrowleft' || key === 'a') moveView(-0.08, 0, 1);
  else if (key === 'arrowright' || key === 'd') moveView(0.08, 0, 1);
  else if (key === 'arrowup' || key === 'w') moveView(0, -0.08, 1);
  else if (key === 'arrowdown' || key === 's') moveView(0, 0.08, 1);
  else if (key === '+' || key === '=') moveView(0, 0, 0.88);
  else if (key === '-' || key === '_') moveView(0, 0, 1.14);
  else if (key === 'r') resetCamera();
  else if (key === ' ') toggleAnimation();
  else handled = false;

  if (handled) event.preventDefault();
});

const ResizeObserverConstructor = (window as any).ResizeObserver;
if (ResizeObserverConstructor) {
  const resizeObserver = new ResizeObserverConstructor(syncCanvasSize);
  resizeObserver.observe(canvasWrap);
} else {
  window.addEventListener('resize', syncCanvasSize);
}

syncCanvasSize();
loadDefaultWindow();
updateModeButtons();
updateAnimationButton();
window.requestAnimationFrame(animationLoop);
