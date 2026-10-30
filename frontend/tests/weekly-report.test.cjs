const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, AbortController, require: name => imports[name] ?? (name === 'react/jsx-runtime' ? require(name) : { default: () => null }) });
  return exports;
}
const dates = load('lib/weekly-report.ts');
for (const [time, monday] of [
  ['2026-10-25T14:59:59Z', '2026-10-19'], ['2026-10-25T15:00:00Z', '2026-10-26'],
  ['2026-11-01T14:59:59Z', '2026-10-26'], ['2026-11-01T15:00:00Z', '2026-11-02'],
  ['2027-01-01T00:00:00Z', '2026-12-28'], ['2028-02-29T12:00:00Z', '2028-02-28'],
]) test(`Seoul week for ${time}`, () => assert.equal(dates.currentSeoulWeek(new Date(time)), monday));
test('week navigation crosses month/year boundaries without host timezone conversion', () => {
  assert.equal(dates.shiftDate('2026-12-28', 6), '2027-01-03');
  assert.equal(dates.shiftDate('2026-12-28', 7), '2027-01-04');
  assert.equal(dates.formatReportDate('2027-01-03'), '2027년 1월 3일');
});

function harness(file, api, initial = [], autoEffects = true) {
  let si, ri, ei;
  const values = initial.slice(), refs = [], effects = [];
  const react = {
    useState(value) { const i = si++; if (!(i in values)) values[i] = typeof value === 'function' ? value() : value;
      return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useRef(value) { return refs[ri++] ??= { current: value }; },
    useCallback: fn => fn,
    useEffect(fn, deps) { const i = ei++, previous = effects[i];
      if (!previous || deps.some((value, j) => value !== previous.deps[j])) effects[i] = { fn, deps, previous, pending: true }; },
  };
  const component = load(file, { react, '@/lib/api': { api }, '@/lib/weekly-report': dates, '@/lib/profanity': { containsProfanity: () => false } }).default;
  return { values,
    render(props = {}) {
      si = ri = ei = 0;
      const tree = component(props);
      if (autoEffects) for (const effect of effects) if (effect.pending) {
        effect.previous?.cleanup?.(); effect.cleanup = effect.fn(); effect.pending = false;
      }
      return tree;
    },
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
const button = (tree, label) => find(tree, n => n.type === 'button' && text(n) === label);
const flush = () => new Promise(resolve => setImmediate(resolve));
const pending = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const props = { token: 'token', studentId: 'student', categoryNames: { SPACING: '띄어쓰기' }, onReview() {} };
const week = dates.currentSeoulWeek();
function report(start = week) {
  return { weekStart: start, weekEnd: dates.shiftDate(start, 6), currentWeekStart: week,
    learningDays: 0, uniqueQuestions: 0, reviewedClues: null, completedClues: null, reviewActivityAvailable: false,
    previousWeekUniqueQuestions: 0, previousWeekActivityAvailable: true,
    days: Array.from({ length: 7 }, (_, i) => ({ date: dates.shiftDate(start, i), questions: 0 })), weaknesses: [], noRecordedActivity: true };
}
test('pending request shows shared loading; empty report renders seven zeros and a zero comparison', async () => {
  const request = pending(); const h = harness('components/weekly-report.tsx', () => request.promise);
  assert.ok(find(h.render(props), n => n.props?.message?.includes('활동을 모으고')));
  request.resolve(report()); await flush();
  const tree = h.render(props);
  assert.ok(text(tree).includes('0일')); assert.ok(text(tree).includes('0개'));
  assert.ok(text(tree).includes('변화 없음')); assert.ok(text(tree).includes('아직 문제 풀이와 글쓰기 기록이 없어요.'));
  assert.equal(find(tree, n => n.props?.role === 'list').props.children.length, 7);
  assert.equal(button(tree, '다음 주').props.disabled, true);
});
test('failure ends loading, exposes retry and subsequent success replaces error', async () => {
  let calls = 0;
  const h = harness('components/weekly-report.tsx', async () => { if (++calls === 1) throw new Error('offline'); return report(); });
  h.render(props); await flush();
  let tree = h.render(props); assert.ok(find(tree, n => n.props?.role === 'alert'));
  button(tree, '다시 불러오기').props.onClick(); h.render(props); await flush();
  tree = h.render(props); assert.equal(find(tree, n => n.props?.role === 'alert'), undefined); assert.equal(calls, 2);
});
test('week switch aborts stale request and late response cannot replace selected week', async () => {
  const calls = [];
  const h = harness('components/weekly-report.tsx', (url, options) => { const task = pending(); calls.push({ url, options, ...task }); return task.promise; });
  button(h.render(props), '이전 주').props.onClick(); h.render(props);
  assert.equal(calls[0].options.signal.aborted, true);
  calls[1].resolve({ ...report(dates.shiftDate(week, -7)), uniqueQuestions: 3 }); await flush();
  calls[0].resolve({ ...report(), uniqueQuestions: 999 }); await flush();
  const tree = h.render(props); assert.ok(text(tree).includes('3개')); assert.ok(!text(tree).includes('999개'));
  assert.equal(button(tree, '다음 주').props.disabled, false);
  h.unmount(); assert.equal(calls[1].options.signal.aborted, true);
});
test('student or token change hides previous data before the next request completes', async () => {
  let first = true;
  const h = harness('components/weekly-report.tsx', () => first ? (first = false, Promise.resolve({ ...report(), uniqueQuestions: 77 })) : new Promise(() => {}));
  h.render(props); await flush(); assert.ok(text(h.render(props)).includes('77개'));
  assert.ok(!text(h.render({ ...props, token: 'other', studentId: 'other' })).includes('77개'));
});
test('recommendation uses actual category and review action stays connected', async () => {
  let opened = false;
  const h = harness('components/weekly-report.tsx', async () => ({ ...report(), noRecordedActivity: false, weaknesses: [{ category: 'SPACING', count: 2 }] }));
  const p = { ...props, onReview: () => { opened = true; } }; h.render(p); await flush();
  const tree = h.render(p); assert.ok(text(tree).includes('띄어쓰기 단서'));
  button(tree, '복습 노트로 이동').props.onClick(); assert.equal(opened, true);
});
test('sidebar inserts report between review and mypage; notebook shortcut reaches the same screen', () => {
  const state = [];
  Object.assign(state, { 0: 'token', 1: 'owner', 2: [{ id: 'student' }], 3: { id: 'student', name: '탐정', grade: 1 }, 4: 'write', 5: false });
  const h = harness('components/app-shell.tsx', () => new Promise(() => {}), state, false);
  let tree = h.render(); const navigation = find(tree, n => n.type === 'nav');
  assert.ok(text(navigation).indexOf('복습') < text(navigation).indexOf('주간 리포트'));
  assert.ok(text(navigation).indexOf('주간 리포트') < text(navigation).indexOf('마이페이지'));
  button(tree, '주간 리포트').props.onClick(); assert.equal(h.values[4], 'weeklyReport');
  tree = h.render(); assert.equal(button(tree, '주간 리포트').props['aria-current'], 'page');
  const notebook = harness('components/learning-notebook.tsx', null);
  let opened = false;
  button(notebook.render({ records: [], onQuestions() {}, onWeeklyReport: () => { opened = true; } }), '주간 리포트 보기').props.onClick();
  assert.equal(opened, true);
});

test('learning and quest entry points use the same question endpoint and student', async () => {
  const state = [];
  Object.assign(state, { 0: 'token', 1: 'owner', 2: [{ id: 'student' }], 3: { id: 'student', name: '탐정', grade: 1 },
    4: 'today', 5: false, 9: { daily: 'ready', review: 'ready' } });
  const calls = [];
  const h = harness('components/app-shell.tsx', async (url, options, token) => {
    calls.push({ url, token }); return [{ id: 'same-question', category: 'SPACING', choices: ['답'] }];
  }, state, false);
  await find(h.render(), n => n.props?.onWeeklyReport).props.onQuestions();
  h.values[4] = 'quests';
  await find(h.render(), n => n.props?.onWrite && n.props?.onQuestions && n.props?.onReview).props.onQuestions();
  assert.equal(calls.length, 2);
  for (const call of calls) { assert.equal(call.url, '/students/student/questions/today'); assert.equal(call.token, 'token'); }
});

test('previous-week comparison renders increase, decrease, no change, and unavailable distinctly', async () => {
  const cases = [
    [{ ...report(), uniqueQuestions: 19, previousWeekUniqueQuestions: 14 }, '+5개', '지난주보다 5문제 더 풀었어요!'],
    [{ ...report(), uniqueQuestions: 11, previousWeekUniqueQuestions: 14 }, '-3개', '지난주보다 3문제 적게 풀었어요.'],
    [{ ...report(), uniqueQuestions: 14, previousWeekUniqueQuestions: 14 }, '변화 없음', '이번 주와 지난주 모두 14문제를 풀었어요.'],
    [{ ...report(), previousWeekActivityAvailable: false }, '집계할 수 없어요', '지난주 학습 기록을 확인할 수 없어요.'],
  ];
  for (const [value, expectedValue, expectedMessage] of cases) {
    const h = harness('components/weekly-report.tsx', async () => value);
    h.render(props); await flush();
    const tree = h.render(props);
    assert.ok(text(tree).includes(expectedValue));
    assert.ok(text(tree).includes(expectedMessage));
  }
});
