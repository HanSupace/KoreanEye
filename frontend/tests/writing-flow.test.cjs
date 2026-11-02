const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');

function harness(file, initial, api) {
  const values = initial.slice();
  let cursor = 0;
  let refCursor = 0;
  const refs = [];
  const inputs = new Map();
  const effects = [];
  const hooks = {
    useState(value) { const i = cursor++; if (!(i in values)) values[i] = value; return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useRef(value) { const i = refCursor++; return refs[i] ??= { current: value }; }, useCallback: fn => fn,
    useEffect: fn => effects.push(fn),
  };
  const filename = path.join(__dirname, '../components', file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, AbortController, Error, document: { getElementById: id => inputs.get(id) },
    require(name) {
      if (name === '@/lib/profanity') return loadProfanity();
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '@/lib/api') return { api, ApiError: class ApiError extends Error {} };
      return new Proxy({}, { get: () => () => null });
    },
  }, { filename });
  return { values, effects, inputs, render(props = {}) { cursor = 0; refCursor = 0; effects.length = 0; return exports.default(props); } };
}
function find(node, predicate) {
  if (Array.isArray(node)) { for (const child of node) { const hit = find(child, predicate); if (hit) return hit; } }
  else if (node && typeof node === 'object') { if (predicate(node)) return node; return find(node.props?.children, predicate); }
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  if (node && typeof node === 'object') return text(node.props?.children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
function shell(api) {
  const state = [];
  Object.assign(state, { 0: 'mock-token', 1: 'owner', 2: [{ id: 'student' }], 3: { id: 'student', name: '??', grade: 1 }, 4: 'write', 5: false, 23: '오늘 친구랑 가치 놀았다. 집에와서 밥을 먹었다.' });
  return harness('app-shell.tsx', state, api);
}
const writing = { id: 'writing-id', text: '오늘 친구랑 가치 놀았다.', createdAt: '2026-10-27T00:00:00Z', analysisProvider: 'rules', errors: [{ id: 'error-id', original: '가치', correct: '같이', category: 'PRONUNCIATION_SPELLING', solved: false }] };

const writingMode = h => find(h.render(), n => n.props?.label === '글쓰기 입력 방식');
const handwriting = h => find(h.render(), n => n.props?.onRecognize && !n.props?.onSubmit);

test('handwriting OCR sends image to existing endpoint, appends recognized text and preserves text across input modes', async () => {
  const calls = [];
  const h = shell(async (...args) => { calls.push(args); return { text: '손으로 쓴 이야기' }; });
  const original = h.values[23];
  writingMode(h).props.onChange('HANDWRITING');
  assert.equal(find(h.render(), n => n.type === 'textarea'), undefined);
  await handwriting(h).props.onRecognize('encoded-png');
  assert.equal(calls[0][0], '/ocr/recognize');
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(JSON.parse(calls[0][1].body).image, 'encoded-png');
  assert.equal(calls[0][2], 'mock-token');
  writingMode(h).props.onChange('TYPE');
  assert.equal(find(h.render(), n => n.type === 'textarea').props.value, `${original}\n손으로 쓴 이야기`);
});

for (const response of ['empty', 'failure']) {
  test(`handwriting OCR ${response} preserves story and displays existing error`, async () => {
    const h = shell(async () => { if (response === 'failure') throw new Error('network'); return { text: ' ' }; });
    const original = h.values[23];
    writingMode(h).props.onChange('HANDWRITING');
    assert.equal(await handwriting(h).props.onRecognize('encoded-png'), '');
    assert.equal(h.values[23], original);
    assert.ok(find(h.render(), n => n.props?.className === 'form-error' && n.props?.role === 'alert'));
  });
}

test('recognized profanity uses the existing warning and blocks clue finding', async () => {
  let posts = 0;
  const h = shell(async url => { if (url !== '/ocr/recognize') posts++; return { text: '씨발' }; });
  writingMode(h).props.onChange('HANDWRITING');
  await handwriting(h).props.onRecognize('encoded-png');
  const button = find(h.render(), n => n.type === 'button' && text(n) === '단서 찾기');
  assert.equal(button.props.disabled, true);
  await button.props.onClick(); assert.equal(posts, 0);
});

test('analysis success opens result, preserves input, and only explicit action opens review', async () => {
  const calls = [];
  const h = shell(async (url, options) => { calls.push([url, options]); return options?.method === 'POST' ? writing : []; });
  await find(h.render(), n => n.type === 'button' && text(n) === '단서 찾기').props.onClick();
  assert.equal(h.values[4], 'writingResult');
  assert.ok(h.values[23].includes('가치'));
  assert.equal(h.values[24].errors[0].id, 'error-id');
  assert.equal(calls[0][0], '/students/student/writings');
  assert.ok(JSON.parse(calls[0][1].body).text.includes('집에와서'));
  const result = h.render();
  assert.ok(text(result).includes('글쓰기 분석 결과'));
  assert.ok(text(result).includes('기본 규칙 검사 결과'));
  find(result, n => n.type === 'button' && text(n) === '복습 노트에서 확인').props.onClick();
  assert.equal(h.values[4], 'review');
});

test('analysis failure keeps writing page and full input, with visible error', async () => {
  const h = shell(async () => { throw new Error('mock failure'); });
  const input = h.values[23];
  await find(h.render(), n => n.type === 'button' && text(n) === '단서 찾기').props.onClick();
  assert.equal(h.values[4], 'write');
  assert.equal(h.values[23], input);
  assert.ok(find(h.render(), n => n.props?.kind === 'error' && n.props?.title));
  assert.ok(find(h.render(), n => n.type === 'button' && text(n) === '다시 시도'));
});

test('zero errors displays a real empty analysis result', async () => {
  const h = shell(async (_, options) => options?.method === 'POST' ? { ...writing, errors: [] } : []);
  await find(h.render(), n => n.type === 'button' && text(n) === '단서 찾기').props.onClick();
  assert.equal(h.values[4], 'writingResult');
  assert.ok(text(h.render()).includes('오류 후보는 0개'));
});

test('review loads saved IDs and fields and marks complete only after API success', async () => {
  const calls = [];
  const h = harness('writing-review-list.tsx', [], async (url, options) => { calls.push([url, options]); return options?.method === 'POST' ? undefined : [writing]; });
  const props = { token: 'mock-token', studentId: 'student', categoryNames: {}, onWrite() {} };
  h.render(props); h.effects[0](); await new Promise(resolve => setImmediate(resolve));
  const list = h.render(props);
  for (const value of ['가치', '같이', writing.text, '작성 날짜']) assert.ok(text(list).includes(value));
  await find(list, n => n.type === 'button' && text(n) === '복습 완료').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[0][0], '/students/student/writings');
  assert.equal(calls[1][0], '/writing-errors/error-id/review-complete');
  assert.equal(h.values[0][0].errors[0].solved, true);
});

test('empty review shows guidance without 0/0', async () => {
  const h = harness('writing-review-list.tsx', [[], false, false], async () => []);
  const result = text(h.render({ token: 'mock-token', studentId: 'student', categoryNames: {}, onWrite() {} }));
  assert.ok(result.includes('아직 복습할 글쓰기 표현이 없어요.'));
  assert.ok(!result.includes('0 / 0'));
});

function loadProfanity() {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/profanity.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => require('../lib/profanity-policy.json') });
  return exports;
}
for (const item of require('../lib/profanity-policy.json').cases) {
  test(`shared language policy: ${item.text}`, () => assert.equal(loadProfanity().containsProfanity(item.text), item.blocked));
}
for (const [key, blocked] of [['blockedExpressions', true], ['allowedExpressions', false]]) {
  for (const expression of require('../lib/profanity-policy.json')[key]) {
    test(`language morphology (${blocked ? 'block' : 'allow'}): ${expression}`, () => {
      const filter = loadProfanity();
      for (const input of [expression, `오늘 ${expression} 그리고 집에 갔다.`, `오늘 ${expression}`]) {
        assert.equal(filter.containsProfanity(input), blocked, input);
      }
    });
  }
}
for (const expression of ['ㅅㄲ', 'ㄱㅅㄲ', 'ㅈㅅㄲ', 'ㅋㅋㅅㄲ', 'ㄱㄴㄷㅅㄲ', 'ㅅㄲ야', 'ㅅㄲ네', 'ㅅㅂ', 'ㅂㅅ', 'ㅈ같네', '좆같네', '게병신', '병신아', '좆 같은', 'ㄱ병신', 'ㅈ병신', 'ㅂㅅ병신', 'ㄱㄴㄷ시발', 'ㅎ새끼', 'ㅋㅋ씹새']) {
test(`profanity warns, preserves input, blocks handler and allows correction: ${expression}`, async () => {
  let calls = 0;
  const h = shell(async (_, options) => { if (options?.method === 'POST') { calls++; return writing; } return []; });
  h.values[23] = `오늘 ${expression}`;
  let view = h.render();
  assert.ok(text(find(view, n => n.props?.role === 'alert')).includes('바른 언어를 사용해 주세요.'));
  const button = find(view, n => n.type === 'button' && text(n) === '단서 찾기');
  assert.equal(button.props.disabled, true);
  await button.props.onClick();
  assert.equal(calls, 0);
  assert.equal(h.values[23], `오늘 ${expression}`);
  find(view, n => n.type === 'textarea' && n.props.id === 'story').props.onChange({ target: { value: '친구와 같이 놀았다.' } });
  view = h.render();
  const corrected = find(view, n => n.type === 'button' && text(n) === '단서 찾기');
  assert.equal(corrected.props.disabled, false);
  await corrected.props.onClick();
  assert.equal(calls, 1);
  assert.equal(h.values[4], 'writingResult');
});
}

// Generate every modern consonant and every ordered pair, including double consonants.
const consonants = Array.from('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ');
const prefixes = [...consonants, ...consonants.flatMap(a => consonants.map(b => a + b)), 'ㄱㄴㄷ', 'ㅋㅋㅋ', 'ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ'];
test('all consonant prefixes preserve full, initial and mixed profanity detection', () => {
  const filter = loadProfanity();
  const policy = require('../lib/profanity-policy.json');
  for (const prefix of prefixes) {
    for (const term of [...policy.terms, ...policy.initialTerms, 'ㅈ같네', '개병신', 'ㅅㄲ야', 'ㅅㄲ네']) {
      for (const input of [prefix + term, `오늘 ${prefix}${term} 그리고`, (prefix + term).normalize('NFKC')]) {
        assert.equal(filter.containsProfanity(input), true, input);
      }
    }
  }
});
test('consonants do not turn ordinary Korean words into profanity', () => {
  const filter = loadProfanity();
  const normal = ['시발점', '등신대', '졸라매고', '병원에 갔다.', '친구와 같이 놀았다.', '씹새우를 관찰했다.'];
  for (const prefix of ['', ...prefixes]) {
    for (const word of normal) assert.equal(filter.containsProfanity(prefix + word), false, prefix + word);
  }
});

test('question success waits for next action and suppresses corner loading', async () => {
  let resolve;
  const h = shell(() => new Promise(done => { resolve = done; }));
  h.values[4] = 'questions'; h.values[15] = [{ id: 'q1', choices: ['a', 'b'] }, { id: 'q2', choices: [] }]; h.values[21] = 'a';
  const exercise = find(h.render(), n => n.props?.onSubmit && n.props?.onNext);
  const pending = exercise.props.onSubmit();
  assert.equal(find(h.render(), n => n.props?.kind === 'loading').props.kind, 'loading');
  assert.equal(find(h.render(), n => n.props?.className === 'busy-status'), undefined);
  resolve({ correct: true, message: 'correct' }); await pending;
  assert.equal(h.values[20], 0);
  const modal = find(h.render(), n => n.props?.kind === 'success');
  find(modal, n => n.type === 'button').props.onClick();
  assert.equal(h.values[20], 1);
  assert.equal(h.values[22], null);
});

test('wrong answer retry keeps question and does not advance completion', async () => {
  const h = shell(async () => ({ correct: false, message: 'wrong' }));
  h.values[4] = 'questions'; h.values[15] = [{ id: 'q1', choices: ['a', 'b'] }]; h.values[21] = 'a';
  await find(h.render(), n => n.props?.onSubmit).props.onSubmit();
  const modal = find(h.render(), n => n.props?.kind === 'failure');
  find(modal, n => n.type === 'button' && n.props.className === 'btn secondary').props.onClick();
  assert.equal(h.values[20], 0); assert.equal(h.values[22], null); assert.equal(h.values[4], 'questions');
});

function rewriteShell(api) {
  const h = shell(api);
  h.values[4] = 'writingResult';
  h.values[24] = { ...writing, errors: [
    { ...writing.errors[0], attemptCount: 0, hintLevelUsed: 1 },
    { id: 'second-error', original: '집에와서', correct: '집에 와서', solved: false, attemptCount: 0, hintLevelUsed: 0 },
  ] };
  h.inputs.set('answer-error-id', { value: '같이', focus() { this.focused = true; } });
  h.inputs.set('answer-second-error', { value: '집에 와서', focus() {} });
  return h;
}
const confirmRewrite = h => find(h.render(), n => n.type === 'button' && text(n) === '확인');
const modalOf = (h, kind) => find(h.render(), n => n.props?.kind === kind);

test('writing rewrite loading blocks duplicate requests; success waits for confirmation and preserves other errors', async () => {
  let resolve;
  let posts = 0;
  const h = rewriteShell((url, options) => options?.method === 'POST'
    ? (posts++, new Promise(done => { resolve = done; })) : Promise.resolve([]));
  const submit = confirmRewrite(h).props.onClick;
  submit();
  confirmRewrite(h).props.onClick();
  assert.equal(posts, 1);
  assert.equal(modalOf(h, 'loading').props.title, '정답을 확인하고 있어요...');
  assert.equal(find(h.render(), n => n.props?.className === 'busy-status'), undefined);
  resolve({ correct: true, attemptCount: 1 });
  await new Promise(done => setImmediate(done));
  assert.equal(modalOf(h, 'success').props.message, '복습을 완료했어요.');
  assert.equal(h.values[24].errors[0].solved, false);
  find(modalOf(h, 'success'), n => n.type === 'button').props.onClick();
  assert.equal(h.values[24].errors[0].solved, true);
  assert.equal(h.values[24].errors[0].attemptCount, 1);
  assert.equal(h.values[24].errors[0].hintLevelUsed, 1);
  assert.equal(h.values[24].errors[1].solved, false);
  confirmRewrite(h).props.onClick();
  assert.equal(posts, 2);
  resolve({ correct: true, attemptCount: 1 });
  await new Promise(done => setImmediate(done));
  find(modalOf(h, 'success'), n => n.type === 'button').props.onClick();
  assert.ok(h.values[24].errors.every(error => error.solved));
});

test('writing rewrite wrong answer keeps input, updates attempts and offers retry without skipping', async () => {
  const h = rewriteShell(async () => ({ correct: false, attemptCount: 3 }));
  h.inputs.get('answer-error-id').value = '가치';
  confirmRewrite(h).props.onClick();
  await new Promise(done => setImmediate(done));
  assert.equal(modalOf(h, 'failure').props.message, '표현을 다시 생각해 보세요.');
  assert.equal(h.values[24].errors[0].solved, false);
  assert.equal(h.values[24].errors[0].attemptCount, 3);
  assert.equal(h.values[24].errors[0].hintLevelUsed, 1);
  const retry = find(modalOf(h, 'failure'), n => n.type === 'button');
  assert.equal(text(retry), '다시 풀기');
  retry.props.onClick();
  assert.equal(modalOf(h, 'failure'), undefined);
  assert.equal(h.inputs.get('answer-error-id').value, '가치');
  assert.equal(h.values[4], 'writingResult');
});

test('writing rewrite network error preserves state and retries through the existing modal', async () => {
  let posts = 0;
  const h = rewriteShell(async (url, options) => {
    if (options?.method !== 'POST') return [];
    posts++;
    if (posts === 1) throw new Error('connection failed');
    return { correct: true, attemptCount: 1 };
  });
  confirmRewrite(h).props.onClick();
  await new Promise(done => setImmediate(done));
  assert.equal(modalOf(h, 'error').props.message, 'connection failed');
  assert.equal(h.values[24].errors[0].solved, false);
  assert.equal(h.values[24].errors[0].attemptCount, 0);
  assert.equal(h.inputs.get('answer-error-id').value, '같이');
  find(modalOf(h, 'error'), n => n.type === 'button' && text(n) === '다시 시도').props.onClick();
  await new Promise(done => setImmediate(done));
  assert.equal(posts, 2);
  assert.ok(modalOf(h, 'success'));
  find(modalOf(h, 'success'), n => n.type === 'button').props.onClick();
  assert.equal(h.values[24].errors[0].solved, true);
});
