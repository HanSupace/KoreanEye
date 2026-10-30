const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual component handlers and resize lifecycle without a DOM.
function harness(onRecognize = async () => '인식한 글', allowErasing = false) {
  const values = [], refs = [], effects = [], operations = [], listeners = new Map();
  let stateIndex = 0, refIndex = 0, resize, resolutionChange, cleanup;
  const captured = new Set();
  const context = Object.fromEntries(['fillRect', 'setTransform', 'beginPath', 'arc', 'fill', 'moveTo', 'lineTo', 'stroke', 'save', 'resetTransform', 'restore'].map(method =>
    [method, (...args) => operations.push([method, ...args])]));
  let composite = 'source-over';
  Object.defineProperty(context, 'globalCompositeOperation', {
    get: () => composite,
    set(value) { composite = value; operations.push(['composite', value]); },
  });
  const canvas = {
    width: 300, height: 150, clientWidth: 798, clientHeight: 558, clientLeft: 1, clientTop: 1,
    getBoundingClientRect() { return { left: 10, top: 20, width: this.clientWidth + 2, height: this.clientHeight + 2 }; },
    getContext: () => context,
    setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id), releasePointerCapture: id => captured.delete(id),
    toDataURL(type) { assert.equal(type, 'image/png'); return 'data:image/png;base64,cG5n'; },
  };
  const window = {
    devicePixelRatio: 2,
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
    matchMedia: () => ({ addEventListener: (_, fn) => { resolutionChange = fn; }, removeEventListener() {} }),
  };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/handwriting-pad.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, window,
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} disconnect() { listeners.set('disconnected', true); } },
    require(name) {
      if (name === 'react') return {
        useRef(value) { const i = refIndex++; return refs[i] ??= { current: value }; },
        useState(value) { const i = stateIndex++; if (!(i in values)) values[i] = value; return [values[i], next => { values[i] = next; }]; },
        useEffect(fn) { if (!cleanup) effects.push(fn); },
      };
      if (name === 'react/jsx-runtime') return require(name);
      return { default: () => null };
    },
  });
  const h = {
    canvas, context, operations, window, listeners,
    render(disabled = false) { stateIndex = refIndex = 0; return exports.default({ onRecognize, disabled, allowErasing }); },
    resize(width, height) { canvas.clientWidth = width; canvas.clientHeight = height; resize(); },
    dpr(ratio) { window.devicePixelRatio = ratio; resolutionChange(); },
    unmount() { cleanup(); },
    event(x = 100, y = 100, pointerId = 1, pointerType = 'mouse', button = 0) {
      return { currentTarget: canvas, clientX: x + 11, clientY: y + 21, pointerId, pointerType, button, preventDefault() {} };
    },
  };
  const view = h.render();
  find(view, n => n.type === 'canvas').props.ref.current = canvas;
  cleanup = effects[0]();
  return h;
}
function find(node, predicate) {
  if (Array.isArray(node)) { for (const child of node) { const hit = find(child, predicate); if (hit) return hit; } }
  else if (node && typeof node === 'object') { if (predicate(node)) return node; return find(node.props?.children, predicate); }
}
const pad = h => find(h.render(), n => n.type === 'canvas').props;
const buttons = h => find(h.render(), n => n.props?.className === 'handwriting-actions').props.children;
const last = (h, name) => h.operations.filter(op => op[0] === name).at(-1);
function write(h, pointerType = 'mouse') {
  const handlers = pad(h);
  handlers.onPointerDown(h.event(100, 120, 1, pointerType));
  handlers.onPointerMove(h.event(300, 320, 1, pointerType));
  handlers.onPointerUp(h.event(300, 320, 1, pointerType));
}

test('backing pixels match CSS content size × DPR and start with an opaque white background', () => {
  const h = harness();
  assert.equal(h.canvas.width, 1596); assert.equal(h.canvas.height, 1116);
  assert.deepEqual(last(h, 'fillRect'), ['fillRect', 0, 0, 1596, 1116]);
  assert.equal(h.context.fillStyle, '#fff');
  assert.deepEqual(last(h, 'setTransform'), ['setTransform', 2, 0, 0, 2, 0, 0]);
});

for (const pointerType of ['mouse', 'touch', 'pen']) {
  test(`${pointerType}: border-aware coordinates, pointer capture, dot, stroke and cancellation`, () => {
    const h = harness(); const handlers = pad(h);
    handlers.onPointerDown(h.event(100, 120, 1, pointerType));
    assert.equal(h.canvas.hasPointerCapture(1), true);
    assert.deepEqual(last(h, 'arc').slice(0, 4), ['arc', 100, 120, 1.75]);
    handlers.onPointerMove(h.event(300, 320, 2, pointerType));
    assert.equal(last(h, 'lineTo'), undefined); // A second finger cannot extend the stroke.
    handlers.onPointerMove(h.event(300, 320, 1, pointerType));
    assert.deepEqual(last(h, 'lineTo'), ['lineTo', 300, 320]);
    handlers.onPointerCancel(h.event());
    assert.equal(h.canvas.hasPointerCapture(1), false);
    const count = h.operations.length;
    handlers.onPointerMove(h.event(400, 400));
    assert.equal(h.operations.length, count);
    assert.equal(buttons(h)[1].props.disabled, false);
  });
}

test('resize and repeated orientation changes replay all ink without stretching, cropping or progressive shrinking', () => {
  const h = harness(); write(h);
  const original = last(h, 'lineTo');
  h.resize(318, 518);
  const scale = 318 / 798;
  assert.deepEqual(last(h, 'lineTo'), original);
  assert.equal(last(h, 'setTransform')[1], 2 * scale);
  assert.equal(last(h, 'setTransform')[4], 2 * scale);
  for (let i = 0; i < 4; i++) { h.resize(698, 358); h.resize(318, 518); }
  assert.equal(last(h, 'setTransform')[1], 2 * scale);
  const handlers = pad(h);
  handlers.onPointerDown(h.event(200 * scale, 400 * scale));
  assert.deepEqual(last(h, 'arc').slice(0, 4), ['arc', 200, 400, 1.75]);
  handlers.onPointerUp(h.event());
  h.resize(798, 558);
  assert.deepEqual(last(h, 'setTransform'), ['setTransform', 2, 0, 0, 2, 0, 0]);
  assert.deepEqual(last(h, 'arc').slice(0, 4), ['arc', 200, 400, 1.75]);
});

test('ink written in newly exposed space remains on the page after resizing', () => {
  const h = harness(); write(h); h.resize(318, 518);
  const handlers = pad(h);
  handlers.onPointerDown(h.event(200, 490)); handlers.onPointerUp(h.event());
  h.resize(798, 558);
  const transform = last(h, 'setTransform')[1];
  const dot = last(h, 'arc');
  assert.ok((dot[1] + dot[3]) * transform <= h.canvas.width);
  assert.ok((dot[2] + dot[3]) * transform <= h.canvas.height);
});

test('unchanged size and hidden canvas do not reset ink; DPR changes redraw; observers clean up', () => {
  const h = harness(); write(h);
  const count = h.operations.length;
  h.resize(798, 558); h.resize(0, 0);
  assert.equal(h.operations.length, count);
  h.resize(798, 558); h.dpr(3);
  assert.equal(h.canvas.width, 2394); assert.equal(h.canvas.height, 1674);
  assert.deepEqual(last(h, 'lineTo'), ['lineTo', 300, 320]);
  h.unmount();
  assert.equal(h.listeners.has('resize'), false); assert.equal(h.listeners.get('disconnected'), true);
});

test('clear removes stored strokes, prevents later resurrection, resets pen scale and disables OCR', () => {
  const h = harness(); write(h); h.resize(318, 518);
  buttons(h)[0].props.onClick();
  assert.equal(buttons(h)[1].props.disabled, true);
  assert.deepEqual(last(h, 'setTransform'), ['setTransform', 2, 0, 0, 2, 0, 0]);
  h.operations.length = 0; h.resize(798, 558);
  assert.equal(last(h, 'lineTo'), undefined); assert.equal(last(h, 'arc'), undefined);
});

test('OCR exports the full PNG after resizing, blocks input during recognition and retains ink', async () => {
  let finish; const images = [];
  const h = harness(image => { images.push(image); return new Promise(resolve => { finish = resolve; }); });
  write(h); h.resize(318, 518);
  const pending = buttons(h)[1].props.onClick();
  assert.deepEqual(images, ['cG5n']);
  assert.ok(buttons(h).every(button => button.props.disabled));
  const count = h.operations.length;
  pad(h).onPointerDown(h.event()); assert.equal(h.operations.length, count);
  finish('오늘의 이야기'); await pending;
  assert.equal(buttons(h)[1].props.disabled, false);
  h.resize(798, 558); assert.deepEqual(last(h, 'lineTo'), ['lineTo', 300, 320]);
});

test('OCR failure releases loading state and keeps ink for retry', async () => {
  const h = harness(async () => { throw new Error('OCR unavailable'); }); write(h);
  await assert.rejects(buttons(h)[1].props.onClick(), /OCR unavailable/);
  assert.equal(buttons(h)[1].props.disabled, false);
  h.resize(318, 518); assert.deepEqual(last(h, 'lineTo'), ['lineTo', 300, 320]);
});

test('disabled input and secondary mouse buttons cannot start drawing', () => {
  const h = harness(); const count = h.operations.length;
  find(h.render(true), n => n.type === 'canvas').props.onPointerDown(h.event());
  pad(h).onPointerDown(h.event(100, 100, 1, 'mouse', 2));
  assert.equal(h.operations.length, count);
});

const toolButton = (h, label) => find(h.render(), n => n.type === 'button' && n.props.children === label);
for (const pointerType of ['mouse', 'touch', 'pen']) {
  test(`${pointerType}: partial eraser removes pixels with destination-out and switches back to pen`, () => {
    const h = harness(undefined, true); write(h, pointerType);
    toolButton(h, '부분 지우개').props.onClick();
    assert.equal(toolButton(h, '부분 지우개').props['aria-pressed'], true);
    assert.ok(pad(h).className.includes('is-erasing'));
    h.operations.length = 0;
    write(h, pointerType);
    assert.ok(h.operations.some(op => op[0] === 'composite' && op[1] === 'destination-out'));
    assert.deepEqual(last(h, 'arc').slice(0, 4), ['arc', 100, 120, 12]);
    assert.equal(h.context.lineWidth, 24);
    assert.equal(h.context.globalCompositeOperation, 'source-over');
    toolButton(h, '펜').props.onClick(); write(h, pointerType);
    assert.equal(toolButton(h, '펜').props['aria-pressed'], true);
    assert.equal(pad(h).className, 'handwriting-canvas');
    assert.deepEqual(last(h, 'arc').slice(0, 4), ['arc', 100, 120, 1.75]);
  });
}

test('eraser history replays in order and eraser width accounts for resized coordinates and DPR', () => {
  const h = harness(undefined, true); write(h); h.resize(318, 518);
  const scale = 318 / 798;
  toolButton(h, '부분 지우개').props.onClick();
  const handlers = pad(h);
  handlers.onPointerDown(h.event(200 * scale, 400 * scale)); handlers.onPointerUp(h.event());
  assert.deepEqual(last(h, 'arc').slice(0, 4), ['arc', 200, 400, 12 / scale]);
  h.operations.length = 0; h.resize(798, 558); h.dpr(3);
  const modes = h.operations.filter(op => op[0] === 'composite').map(op => op[1]);
  assert.ok(modes.indexOf('source-over') < modes.indexOf('destination-out'));
  assert.deepEqual(last(h, 'arc').slice(0, 4), ['arc', 200, 400, 12 / scale]);
  assert.deepEqual(last(h, 'setTransform'), ['setTransform', 3, 0, 0, 3, 0, 0]);
});

test('clear all removes pen and eraser history and permits fresh writing', () => {
  const h = harness(undefined, true); write(h);
  toolButton(h, '부분 지우개').props.onClick(); write(h);
  toolButton(h, '전체 지우기').props.onClick();
  assert.equal(buttons(h)[1].props.disabled, true);
  h.operations.length = 0; h.resize(318, 518);
  assert.equal(last(h, 'arc'), undefined);
  assert.equal(last(h, 'lineTo'), undefined);
  toolButton(h, '펜').props.onClick(); write(h);
  assert.equal(buttons(h)[1].props.disabled, false);
});

test('erasing an empty canvas does not enable OCR; other pages retain the original controls', () => {
  const h = harness(undefined, true);
  toolButton(h, '부분 지우개').props.onClick(); write(h);
  assert.equal(buttons(h)[1].props.disabled, true);
  for (const child of find(h.render(true), n => n.props?.className === 'handwriting-tools').props.children) {
    assert.equal(child.props.disabled, true);
  }
  const original = harness();
  assert.equal(toolButton(original, '부분 지우개'), undefined);
  assert.ok(toolButton(original, '지우기'));
});
