const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
  const filename = path.join(__dirname, '..', file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, AbortController, Error, ...mocks.globals,
    require(name) {
      if (name in mocks) return mocks[name];
      if (name === 'react/jsx-runtime') return require(name);
      return new Proxy({}, { get: () => () => null });
    },
  }, { filename });
  return exports;
}
function harness(file, initial = [], mocks = {}) {
  const values = initial.slice(), refs = [], effects = [];
  let si, ri, ei;
  const component = load(file, { ...mocks, react: {
    useState(value) { const i = si++; if (!(i in values)) values[i] = value;
      return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useRef(value) { return refs[ri++] ??= { current: value }; },
    useCallback: fn => fn,
    useEffect(fn, deps) {
      const i = ei++, old = effects[i];
      if (!old || deps.some((dep, j) => dep !== old.deps[j])) effects[i] = { fn, deps, old, pending: true };
    },
  } }).default;
  return { values,
    render(props = {}) {
      si = ri = ei = 0;
      const tree = component(props);
      for (const effect of effects) if (effect.pending) {
        effect.old?.cleanup?.(); effect.cleanup = effect.fn(); effect.pending = false;
      }
      return tree;
    },
    // Modal ref is assigned by React before effects run in the browser.
    refs,
    unmount() { effects.forEach(effect => effect.cleanup?.()); },
  };
}
function find(node, predicate) {
  if (Array.isArray(node)) { for (const child of node) { const found = find(child, predicate); if (found) return found; } }
  else if (node && typeof node === 'object') { if (predicate(node)) return node; return find(node.props?.children, predicate); }
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  if (node && typeof node === 'object') return text(node.props?.children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
const button = (tree, label) => find(tree, node => node.type === 'button' && text(node) === label);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function shell(api, page = 'questions') {
  const initial = [];
  Object.assign(initial, { 0: 'token', 1: 'owner', 2: [{ id: 'student' }], 3: { id: 'student', name: '탐정', grade: 1 },
    4: page, 5: false, 15: [{ id: 'q1', choices: ['a', 'b'] }, { id: 'q2', choices: [] }], 21: 'a', 23: '오늘 친구와 놀았다.' });
  return harness('components/app-shell.tsx', initial, {
    '@/lib/api': { api, ApiError: class extends Error {} },
    '@/lib/profanity': { containsProfanity: () => false },
    globals: { window: { setTimeout: () => 0 } },
  });
}

test('skip waits for server save, blocks duplicate clicks, and advances without waiting for history', async () => {
  const save = deferred(), calls = [];
  const h = shell((url) => { calls.push(url); return save.promise; });
  const exercise = find(h.render(), node => node.props?.onLater);
  const first = exercise.props.onLater();
  await exercise.props.onLater();
  assert.equal(h.values[20], 0);
  assert.equal(find(h.render(), node => node.props?.kind === 'loading').props.title, '복습 노트에 담고 있어요...');
  assert.equal(calls.length, 1);
  save.resolve(); await first;
  assert.equal(h.values[20], 1);
  assert.equal(h.values[6], false);
  assert.equal(find(h.render(), node => node.props?.kind === 'loading'), undefined);
  assert.deepEqual(calls, ['/questions/q1/skip']);
});

test('last skip shows the score before returning to learning and refreshes records once', async () => {
  const calls = [];
  const h = shell(async url => { calls.push(url); return []; });
  h.values[20] = 1;
  await find(h.render(), node => node.props?.onLater).props.onLater();
  await flush();
  assert.equal(h.values[4], 'questions');
  assert.equal(find(h.render(), node => node.props?.kind === 'failure')?.props.title, '이번 학습 결과');
  assert.match(find(h.render(), node => node.props?.kind === 'failure')?.props.message, /10문제 중 0문제/);
  button(h.render(), '오늘의 학습으로').props.onClick();
  await flush();
  assert.equal(h.values[4], 'today');
  for (const suffix of ['daily-learning', 'learning-history', 'question-reviews', 'learning-progress']) {
    assert.equal(calls.filter(url => url.endsWith(suffix)).length, 1);
  }
});

test('learning resumes untouched questions, then retries only wrong or skipped questions', async () => {
  const chapter = Array.from({ length: 10 }, (_, index) => ({
    id: `q${index + 1}`, choices: ['가', '나'], correct: index < 7, attempted: index < 9,
  }));
  const first = shell(async url => url.endsWith('/questions/today') ? chapter : [], 'today');
  await find(first.render(), node => node.props?.onQuestions).props.onQuestions();
  const firstExercise = find(first.render(), node => node.props?.onLater);
  assert.equal(firstExercise.props.question.id, 'q10');
  assert.equal(firstExercise.props.total, 1);

  const retry = shell(async url => url.endsWith('/questions/today') ? chapter.map(q => ({ ...q, attempted: true })) : [], 'today');
  await find(retry.render(), node => node.props?.onQuestions).props.onQuestions();
  const retryExercise = find(retry.render(), node => node.props?.onLater);
  assert.equal(retryExercise.props.question.id, 'q8');
  assert.equal(retryExercise.props.total, 3);
});

test('skip failure ends loading, keeps the question and allows retry', async () => {
  const h = shell(async () => { throw new Error('offline'); });
  await find(h.render(), node => node.props?.onLater).props.onLater();
  assert.equal(h.values[20], 0);
  assert.equal(h.values[6], false);
  assert.ok(find(h.render(), node => node.props?.kind === 'error'));
});

test('rapid menu navigation and repeated active menu clicks share in-flight record requests', async () => {
  const pending = deferred(), calls = [];
  const h = shell(url => { calls.push(url); return pending.promise; }, 'write');
  button(h.render(), '나의 학습').props.onClick();
  button(h.render(), '퀘스트').props.onClick();
  button(h.render(), '퀘스트').props.onClick();
  assert.equal(calls.length, 4);
  pending.resolve([]); await flush();
  assert.equal(h.values[7], false);
});

test('learning, quest, and review loading screens show page-specific copy', () => {
  const cases = [
    ['today', '학습 단계를 준비하고 있어요...', '탐정의 학습 기록을 확인하고 있어요.'],
    ['quests', '오늘의 퀘스트를 준비하고 있어요...', '도전할 미션을 확인하고 있어요.'],
    ['review', '복습 노트를 펼치고 있어요...', '다시 살펴볼 단서를 찾고 있어요.'],
  ];
  for (const [page, title, description] of cases) {
    const h = shell(async () => [], page);
    h.values[7] = true;
    const tree = h.render();
    assert.equal(find(tree, node => node.props?.message === title)?.props.message, title);
    assert.equal(text(find(tree, node => node.type === 'p' && node.props?.className === 'muted')), description);
  }
});

test('review waits for its own list without being blocked by unrelated learning history', () => {
  const h = shell(async () => [], 'review');
  h.values[7] = true;
  h.values[9] = { daily: 'ready', review: 'ready' };
  const tree = h.render();
  assert.equal(find(tree, node => node.props?.message === '복습 노트를 펼치고 있어요...'), undefined);
  assert.ok(find(tree, node => node.type === 'section' && node.props?.className === 'review-chapters'));
});

test('successful student data is reused across quick page visits, but failed responses are never cached', async () => {
  const calls = [];
  const h = shell(async url => { calls.push(url); return []; }, 'write');
  button(h.render(), '나의 학습').props.onClick();
  await flush();
  button(h.render(), '퀘스트').props.onClick();
  button(h.render(), '복습').props.onClick();
  await flush();
  assert.equal(calls.length, 4);

  const failedCalls = [];
  const failed = shell(async url => { failedCalls.push(url); if (url.endsWith('question-reviews')) throw new Error('offline'); return []; }, 'write');
  button(failed.render(), '나의 학습').props.onClick();
  await flush();
  button(failed.render(), '복습').props.onClick();
  await flush();
  assert.equal(failedCalls.filter(url => url.endsWith('question-reviews')).length, 2);
});

for (const outcome of ['success', 'failure']) {
  test(`late question ${outcome} cannot restore modal or navigate after leaving page`, async () => {
    const pending = deferred();
    const h = shell(() => pending.promise);
    const work = find(h.render(), node => node.props?.onSubmit).props.onSubmit();
    button(h.render(), '오늘의 글쓰기').props.onClick(); h.render();
    assert.equal(h.values[6], false);
    if (outcome === 'success') pending.resolve({ correct: true }); else pending.reject(new Error('late error'));
    await work;
    assert.equal(h.values[4], 'write');
    assert.equal(h.values[22], null);
    assert.equal(find(h.render(), node => node.props?.kind), undefined);
  });
}

test('failed record requests clear loading and show retry', async () => {
  const h = shell(async () => { throw new Error('offline'); }, 'write');
  button(h.render(), '나의 학습').props.onClick(); await flush();
  assert.equal(h.values[7], false);
  assert.ok(button(h.render(), '다시 불러오기'));
});

test('review completion locks immediately before React rerenders and unlocks after failure', async () => {
  const pending = deferred(); let calls = 0;
  const writing = { id: 'w', text: '원문', createdAt: '2026-10-30', errors: [{ id: 'e', original: '표현', solved: false }] };
  const h = harness('components/writing-review-list.tsx', [[writing], false, false], {
    '@/lib/api': { api: (_, options) => options.method === 'POST' ? (calls++, pending.promise) : new Promise(() => {}) },
  });
  const props = { token: 'token', studentId: 'student', categoryNames: {}, onWrite() {} };
  const complete = button(h.render(props), '복습 완료').props.onClick;
  complete(); complete(); assert.equal(calls, 1);
  pending.reject(new Error('offline')); await flush();
  assert.equal(h.values[4], null);
  assert.equal(h.values[0][0].errors[0].solved, false);
  assert.ok(h.values[3]);
});

function modalHarness() {
  const timers = new Map(); let id = 0;
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const document = { activeElement: null, body: { style: { overflow: 'auto' } } };
  const h = harness('components/activity-modal.tsx', [], { globals: { document, window: {
    setTimeout(fn, delay) { assert.equal(delay, 150); timers.set(++id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
  } } });
  // Pre-attach the dialog, matching commit order in React.
  h.refs[0] = { current: dialog };
  return { h, dialog, document, timers, tick() { for (const [id, fn] of timers) { timers.delete(id); fn(); } } };
}
test('fast modal completion cancels display timer and shows result immediately', () => {
  const m = modalHarness();
  m.h.render({ kind: 'loading', title: '대기' });
  assert.equal(m.dialog.open, false);
  m.h.render({ kind: 'success', title: '완료' });
  assert.equal(m.dialog.open, true);
  assert.equal(m.timers.size, 0);
  m.h.unmount(); assert.equal(m.document.body.style.overflow, 'auto');
});
test('fast loading removed before display never opens or locks scrolling', () => {
  const m = modalHarness(); m.h.render({ kind: 'loading', title: '대기' }); m.h.unmount(); m.tick();
  assert.equal(m.dialog.open, false);
  assert.equal(m.document.body.style.overflow, 'auto');
});
test('slow loading remains visible until real completion and closes without minimum duration', () => {
  const m = modalHarness(); m.h.render({ kind: 'loading', title: '대기' }); m.tick();
  assert.equal(m.dialog.open, true);
  assert.equal(m.document.body.style.overflow, 'hidden');
  m.h.unmount(); assert.equal(m.dialog.open, false);
  assert.equal(m.document.body.style.overflow, 'auto');
});

test('API preserves caller cancellation and does not impose a processing deadline', async () => {
  const pending = deferred(), controller = new AbortController(); let options;
  const { api } = load('lib/api.ts', { globals: { fetch: (_, init) => { options = init; return pending.promise; } } });
  const request = api('/ocr/recognize', { method: 'POST', signal: controller.signal }, 'token');
  assert.equal(options.signal, controller.signal);
  assert.equal(options.headers.Authorization, 'Bearer token');
  pending.resolve({ ok: true, status: 200, text: async () => '{"text":"손글씨"}' });
  assert.equal((await request).text, '손글씨');
});

test('OCR locks before rerender, retains loading until response, and releases it on failure', async () => {
  const pending = deferred(); let calls = 0;
  const h = harness('components/handwriting-pad.tsx', [], {});
  const props = { onRecognize: () => { calls++; return pending.promise; } };
  h.render(props);
  h.refs[0].current = { toDataURL: () => 'data:image/png;base64,cG5n' };
  h.values[0] = true;
  const recognize = button(h.render(props), '글씨를 텍스트로 바꾸기').props.onClick;
  const request = recognize(); await recognize();
  assert.equal(calls, 1);
  assert.equal(h.values[1], true);
  pending.reject(new Error('OCR offline'));
  await assert.rejects(request);
  assert.equal(h.values[1], false);
  assert.equal(h.values[0], true);
});
