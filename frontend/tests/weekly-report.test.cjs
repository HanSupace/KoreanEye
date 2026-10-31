const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const fixedTime = '2026-11-01T03:00:00Z'; // Sunday in Seoul; do not depend on the test host's date.
function frozenDate(time) {
  return class extends Date {
    constructor(...args) { super(...(args.length ? args : [typeof time === 'function' ? time() : time])); }
    static now() { return new Date(typeof time === 'function' ? time() : time).getTime(); }
  };
}
function load(file, imports = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, AbortController, Date: frozenDate(fixedTime), ...globals, require: name => imports[name] ?? (name === 'react/jsx-runtime' ? require(name) : { default: () => null }) });
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

function harness(file, api, initial = [], autoEffects = true, globals = {}, extraImports = {}) {
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
  const component = load(file, { react, '@/lib/api': { api }, '@/lib/weekly-report': dates, '@/lib/profanity': { containsProfanity: () => false }, ...extraImports }, globals).default;
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
const props = { token: 'token', studentId: 'student', categoryNames: { SPACING: '띄어쓰기' }, onReview() {}, onContinueLearning() {} };
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
  assert.ok(text(tree).includes('변화 없음')); assert.ok(text(tree).includes('이번 주 학습 기록이 아직 없어요.'));
  assert.equal(find(tree, n => n.props?.role === 'list').props.children.length, 7);
  const goal = find(tree, n => n.props?.className === 'weekly-report-goal-comparison');
  assert.equal(goal.props.children.length, 1);
  assert.equal(goal.props.children.filter(n => n.props.className.includes('is-learned')).length, 0);
  assert.equal(button(tree, '다음 주').props.disabled, true);
});
test('failure ends loading, exposes retry and subsequent success replaces error', async () => {
  let calls = 0;
  const h = harness('components/weekly-report.tsx', async () => { if (++calls === 1) throw new Error('offline'); return report(); });
  h.render(props); await flush();
  let tree = h.render(props); assert.ok(find(tree, n => n.props?.role === 'alert'));
  assert.equal(find(tree, n => n.props?.className === 'panel weekly-report-feedback'), undefined);
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
  const tree = h.render(p); assert.ok(text(tree).includes('띄어쓰기 단서를 다시 살펴볼까요?'));
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

test('weekly report continue action uses the existing app-shell today route', () => {
  const state = [];
  Object.assign(state, { 0: 'token', 1: 'owner', 2: [{ id: 'student' }], 3: { id: 'student', name: '탐정', grade: 1 }, 4: 'weeklyReport', 5: false });
  const h = harness('components/app-shell.tsx', async () => [], state, false);
  const tree = h.render();
  const reportElement = find(tree, node => node.props?.studentId === 'student' && node.props?.onContinueLearning);
  assert.equal(typeof reportElement.props.onContinueLearning, 'function');
  assert.equal(typeof reportElement.props.onReview, 'function');
  reportElement.props.onContinueLearning();
  assert.equal(h.values[4], 'today');
  assert.equal(h.values[3].id, 'student');
  assert.equal(h.values[1], 'owner');
});

for (const [label, date, start, learningDays, noActivity, initialGoal, visible] of [
  ['Monday', '2026-10-26T03:00:00Z', week, 0, true, undefined, true],
  ['Friday', '2026-10-30T14:59:59Z', week, 3, false, undefined, true],
  ['Saturday midnight', '2026-10-30T15:00:00Z', week, 4, false, undefined, false],
  ['Sunday', '2026-11-01T03:00:00Z', week, 5, false, undefined, false],
  ['past week on weekday', '2026-10-30T03:00:00Z', dates.shiftDate(week, -7), 3, false, undefined, false],
  ['past week on weekend', '2026-11-01T03:00:00Z', dates.shiftDate(week, -7), 3, false, undefined, false],
  ['weekday target already reached', '2026-10-29T03:00:00Z', week, 4, false, 4, true],
]) test(`continue-learning button ${label}`, async () => {
  const now = date, selectedWeek = start;
  const current = report(selectedWeek);
  const payload = { ...current, currentWeekStart: week, learningDays, uniqueQuestions: learningDays ? 8 : 0, noRecordedActivity: noActivity };
  const resultState = initialGoal === undefined ? null : {
    key: JSON.stringify(['token', 'student', selectedWeek, 0]), report: payload,
    goalScope: JSON.stringify(['token', 'student', selectedWeek]), goalDays: initialGoal,
  };
  let clicks = 0, reviews = 0;
  const args = resultState ? [selectedWeek, 0, resultState, dates.seoulReportDay(new Date(now)).date] : [];
  const h = harness('components/weekly-report.tsx', async () => payload, args, true, { Date: frozenDate(now) });
  const p = { ...props, onContinueLearning() { clicks++; }, onReview() { reviews++; } };
  const tree = h.render(p);
  if (!resultState) { await flush(); }
  const rendered = h.render(p);
  const continueButton = button(rendered, '오늘 학습 계속하기');
  assert.equal(!!continueButton, visible);
  assert.ok(button(rendered, '복습 노트로 이동'));
  if (continueButton) {
    continueButton.props.onClick(); continueButton.props.onClick();
    assert.equal(clicks, 1);
    assert.equal(reviews, 0);
  }
  button(rendered, '복습 노트로 이동').props.onClick();
  assert.equal(reviews, 1);
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
    const card = find(tree, n => n.props?.className === 'panel weekly-report-comparison');
    const delta = value.uniqueQuestions - value.previousWeekUniqueQuestions;
    const kind = !value.previousWeekActivityAvailable || delta === 0 ? 'neutral' : delta > 0 ? 'up' : 'down';
    assert.ok(find(card, n => n.props?.kind === kind));
  }
});

test('feedback follows actual weekly activity, with no inferred comparison or skill assessment', () => {
  const active = { ...report(), learningDays: 3, uniqueQuestions: 19, noRecordedActivity: false };
  const weekday = new Date('2026-10-28T03:00:00Z');
  const encouraging = dates.weeklyLearningFeedback(active, weekday);
  assert.equal(encouraging.description, '3일 동안 19개의 문제를 풀었어요. 이번 주가 끝나기 전에 조금 더 도전해 볼까요?');
  const weekend = dates.weeklyLearningFeedback(active, new Date(fixedTime));
  assert.equal(weekend.description, '이번 주에는 3일 동안 19개의 문제를 풀었어요. 다음 주에도 새로운 단서를 찾아봐요!');
  const past = dates.weeklyLearningFeedback({ ...active, weekStart: dates.shiftDate(week, -7) }, weekday);
  assert.equal(past.description, weekend.description);
  const empty = dates.weeklyLearningFeedback(report(), weekday);
  assert.equal(empty.description, '이번 주 첫 학습을 시작해 볼까요?');
  assert.doesNotMatch(JSON.stringify(empty), /\d/);
  const writingOnly = dates.weeklyLearningFeedback({ ...active, uniqueQuestions: 0 }, weekday);
  assert.equal(writingOnly.description, '3일 동안 글쓰기 활동을 했어요. 이번 주가 끝나기 전에 새로운 문제도 살펴볼까요?');
});

test('recommended days increase by one from zero through six, and seven days are maintained', () => {
  for (let days = 0; days <= 7; days++) {
    const goal = dates.weeklyLearningGoal(days, week, new Date(fixedTime));
    assert.equal(goal.targetDays, Math.min(7, days + 1));
    assert.ok(goal.targetDays >= 1 && goal.targetDays <= 7);
    assert.ok(goal.description.includes(days === 7 ? '매일 학습' : `${days}일 학습`));
    assert.ok(goal.description.includes(`${goal.targetDays}일`));
  }
  assert.equal(dates.weeklyLearningGoal(3, week, new Date('2026-10-28T03:00:00Z')).description, '3일 학습했어요 · 목표까지 1일 남았어요!');
  assert.equal(dates.weeklyLearningGoal(4, week, new Date('2026-10-28T03:00:00Z'), 4).description, '이번 주 추천 목표를 달성했어요!');
  assert.equal(dates.weeklyLearningGoal(7, week, new Date('2026-10-28T03:00:00Z'), 4).description, '이번 주 추천 목표를 달성했어요!');
  assert.equal(dates.weeklyLearningGoal(0, week, new Date('2026-10-28T03:00:00Z')).description, '이번 주 첫 학습을 시작해 봐요! 1일 학습에 도전해 볼까요?');
});

test('review wording only names error types supported by this selected week', () => {
  const base = report('2026-10-19');
  assert.equal(dates.weeklyLearningReviewRecommendation({ ...base, weaknesses: [{ category: 'SPACING', count: 2 }] }), '띄어쓰기 단서를 다시 살펴볼까요?');
  assert.equal(dates.weeklyLearningReviewRecommendation({ ...base, weaknesses: [{ category: 'PRONUNCIATION_SPELLING', count: 1 }] }), '이번 주에 헷갈렸던 맞춤법을 다시 확인해 볼까요?');
  assert.equal(dates.weeklyLearningReviewRecommendation({ ...base, weaknesses: [{ category: 'FINAL_CONSONANT', count: 1 }] }), '이번 주에 헷갈렸던 맞춤법을 다시 확인해 볼까요?');
  assert.equal(dates.weeklyLearningReviewRecommendation({ ...base, weaknesses: [{ category: 'GRAMMAR_EXPRESSION', count: 2 }] }), '새로운 단서를 찾아보며 한글 실력을 키워 봐요!');
  assert.equal(dates.weeklyLearningReviewRecommendation({ ...base, weaknesses: [] }), '새로운 단서를 찾아보며 한글 실력을 키워 봐요!');
  assert.equal(dates.weeklyLearningReviewRecommendation({ ...base, reviewedClues: 4, reviewActivityAvailable: true, weaknesses: [] }), '새로운 단서를 찾아보며 한글 실력을 키워 봐요!');
  assert.equal(dates.weeklyLearningReviewRecommendation({ ...base, weaknesses: [{ category: 'SPACING', count: 0 }] }), '새로운 단서를 찾아보며 한글 실력을 키워 봐요!');
});

test('daily peaks include ties, exclude zero weeks, and preserve original counts and heights', async () => {
  for (const counts of [[1, 2, 3, 2, 17, 0, 1], [4, 4, 0, 1, 2, 0, 0], [0, 0, 0, 0, 0, 0, 0]]) {
    const value = { ...report(), days: report().days.map((day, i) => ({ ...day, questions: counts[i] })) };
    const before = JSON.stringify(value);
    const h = harness('components/weekly-report.tsx', async () => value);
    h.render(props); await flush();
    const tree = h.render(props);
    const columns = find(tree, n => n.props?.role === 'list').props.children;
    const max = Math.max(1, ...counts);
    assert.equal(columns.length, 7);
    columns.forEach((column, index) => {
      const peak = counts[index] > 0 && counts[index] === max;
      assert.equal(column.props.className.includes('is-peak'), peak);
      assert.equal(column.props['aria-label'].includes('가장 많이 학습한 날'), peak);
      assert.equal(find(column, n => n.props?.className === 'weekly-report-bar').props.style.height, `${counts[index] / max * 100}%`);
    });
    assert.equal(JSON.stringify(value), before);
  }
});

test('historical feedback and goal follow selected week and stay hidden while loading or retrying', async () => {
  const calls = [];
  const h = harness('components/weekly-report.tsx', () => { const task = pending(); calls.push(task); return task.promise; });
  h.render(props);
  calls[0].resolve({ ...report(), learningDays: 7, uniqueQuestions: 19, noRecordedActivity: false }); await flush();
  let tree = h.render(props);
  assert.ok(text(tree).includes('7일 동안 19개'));
  assert.ok(text(tree).includes('매일 학습'));
  const fullGoal = find(tree, n => n.props?.className === 'weekly-report-goal-comparison');
  assert.equal(fullGoal.props.children.length, 7);
  assert.equal(fullGoal.props.children.filter(n => n.props.className.includes('is-learned')).length, 7);
  button(tree, '이전 주').props.onClick(); tree = h.render(props);
  assert.equal(find(tree, n => n.props?.className === 'panel weekly-report-feedback'), undefined);
  calls[1].resolve({ ...report(dates.shiftDate(week, -7)), learningDays: 2, uniqueQuestions: 8, previousWeekUniqueQuestions: 10, noRecordedActivity: false }); await flush();
  tree = h.render(props);
  assert.ok(text(tree).includes('2일 동안 8개'));
  assert.ok(text(tree).includes('다음 주에는 3일 학습'));
  assert.ok(!text(tree).includes('7일 동안 19개'));
  const comparison = find(tree, n => n.props?.className === 'weekly-report-goal-comparison');
  assert.equal(comparison.props.children.length, 3);
  assert.equal(comparison.props.children.filter(n => n.props.className.includes('is-learned')).length, 2);
  assert.ok(text(tree).includes('집계 기준 안내'));
  const feedback = find(tree, n => n.props?.className === 'panel weekly-report-feedback');
  assert.ok(!text(feedback).includes('비교 예시'));
  assert.ok(!text(feedback).includes('목표는 저장되지 않아요'));
  assert.ok(!text(feedback).includes('날짜를 알 수 없는 복습 활동'));
  button(tree, '이전 주').props.onClick(); h.render(props);
  calls[2].reject(new Error('offline')); await flush(); tree = h.render(props);
  assert.equal(find(tree, n => n.props?.className === 'panel weekly-report-feedback'), undefined);
  button(tree, '다시 불러오기').props.onClick(); tree = h.render(props);
  assert.equal(find(tree, n => n.props?.className === 'panel weekly-report-feedback'), undefined);
});

for (const day of [26, 27, 28, 29, 30]) test(`weekday ${day}: current goal and ongoing encouragement`, async () => {
  const now = new Date(`2026-10-${day}T03:00:00Z`);
  const learningDays = Math.min(3, day - 25);
  const value = { ...report(), learningDays, uniqueQuestions: 8, noRecordedActivity: false };
  const goal = dates.weeklyLearningGoal(learningDays, week, now);
  assert.equal(goal.period, 'current');
  assert.equal(goal.targetDays, learningDays + 1);
  assert.equal(goal.achieved, false);
  assert.ok(goal.description.includes(learningDays === 0 ? '첫 학습을 시작' : `${learningDays}일 학습했어요 · 목표까지 1일 남았어요!`));
  const feedback = dates.weeklyLearningFeedback(value, now);
  assert.ok(feedback.description.includes('이번 주가 끝나기 전에'));
  assert.ok(!feedback.description.includes('다음 주'));
  const h = harness('components/weekly-report.tsx', async () => value, [], true, { Date: frozenDate(now) });
  h.render(props); await flush();
  const card = find(h.render(props), n => n.props?.className === 'panel weekly-report-feedback');
  assert.ok(text(card).includes('이번 주 추천 목표'));
  assert.ok(!text(card).includes('다음 주 추천 목표'));
});

test('weekday goal reached celebrates without raising the goal or asking for more learning', () => {
  const now = new Date('2026-10-30T09:00:00Z');
  const goal = dates.weeklyLearningGoal(5, week, now);
  assert.equal(goal.targetDays, 5);
  assert.equal(goal.achieved, true);
  assert.equal(goal.description, '이번 주 추천 목표를 달성했어요!');
  assert.ok(!goal.description.includes('도전'));
  const feedback = dates.weeklyLearningFeedback({ ...report(), learningDays: 5, uniqueQuestions: 10, noRecordedActivity: false }, now);
  assert.ok(feedback.title.includes('달성'));
  assert.ok(!feedback.description.includes('도전해'));
  assert.equal(dates.weeklyLearningGoal(4, week, now, 4).achieved, true);
});

test('refreshed records reaching the suggested goal celebrate instead of moving the goal again', async () => {
  const now = '2026-10-29T03:00:00Z';
  let learningDays = 3, fail = false;
  const h = harness('components/weekly-report.tsx', async () => {
    if (fail) throw new Error('offline');
    return { ...report(), learningDays, uniqueQuestions: 8, noRecordedActivity: false };
  }, [], true, { Date: frozenDate(now) });
  h.render(props); await flush();
  assert.ok(text(h.render(props)).includes('3일 학습했어요 · 목표까지 1일 남았어요!'));
  learningDays = 4; h.values[1]++; h.render(props); await flush();
  let card = find(h.render(props), n => n.props?.className === 'panel weekly-report-feedback');
  assert.ok(text(card).includes('이번 주 추천 목표를 달성했어요!'));
  assert.ok(!text(card).includes('목표까지 1일 남았어요!'));
  fail = true; h.values[1]++; h.render(props); await flush();
  assert.ok(find(h.render(props), n => n.props?.role === 'alert'));
  fail = false; button(h.render(props), '다시 불러오기').props.onClick(); h.render(props); await flush();
  card = find(h.render(props), n => n.props?.className === 'panel weekly-report-feedback');
  assert.ok(text(card).includes('이번 주 추천 목표를 달성했어요!'));
  learningDays = 1; const other = { ...props, studentId: 'other' };
  h.render(other); await flush();
  assert.ok(text(h.render(other)).includes('1일 학습했어요 · 목표까지 1일 남았어요!'));
});

test('weekday zero activity invites first learning; writing-only activity is not an empty week', () => {
  const now = new Date('2026-10-28T03:00:00Z');
  const feedback = dates.weeklyLearningFeedback(report(), now);
  assert.ok(feedback.description.includes('이번 주 첫 학습'));
  const goal = dates.weeklyLearningGoal(0, week, now);
  assert.equal(goal.targetDays, 1);
  assert.equal(goal.achieved, false);
  assert.ok(goal.description.includes('첫 학습'));
  const writing = dates.weeklyLearningFeedback({ ...report(), learningDays: 2, noRecordedActivity: false }, now);
  assert.ok(writing.description.includes('2일 동안 글쓰기'));
  assert.ok(!writing.description.includes('아직 문제 풀이'));
});

for (const time of ['2026-10-31T03:00:00Z', '2026-11-01T03:00:00Z']) test(`weekend ${time}: next goal and all seven daily records remain live`, async () => {
  const now = new Date(time);
  const value = { ...report(), learningDays: 3, uniqueQuestions: 8, noRecordedActivity: false,
    days: report().days.map((day, i) => ({ ...day, questions: [1, 0, 0, 0, 0, 3, 4][i] })) };
  const before = JSON.stringify(value);
  const goal = dates.weeklyLearningGoal(3, week, now);
  assert.equal(goal.period, 'next');
  assert.equal(goal.targetDays, 4);
  assert.ok(goal.description.includes('다음 주에는 4일'));
  assert.ok(dates.weeklyLearningFeedback(value, now).description.includes('3일 동안 8개'));
  const h = harness('components/weekly-report.tsx', async () => value, [], true, { Date: frozenDate(now) });
  h.render(props); await flush(); const tree = h.render(props);
  assert.ok(text(tree).includes('다음 주 추천 목표'));
  const columns = find(tree, n => n.props?.role === 'list').props.children;
  assert.ok(text(columns[5]).includes('3개'));
  assert.ok(text(columns[6]).includes('4개'));
  assert.ok(columns[6].props.className.includes('is-peak'));
  assert.equal(JSON.stringify(value), before);
  assert.equal(dates.weeklyLearningGoal(0, week, now).targetDays, 1);
  assert.equal(dates.weeklyLearningGoal(7, week, now).targetDays, 7);
});

test('past report feedback and next goal stay identical on weekdays, weekends and subsequent weeks', () => {
  const value = { ...report('2026-10-19'), learningDays: 3, uniqueQuestions: 8, noRecordedActivity: false };
  const times = ['2026-10-26T03:00:00Z', '2026-10-30T03:00:00Z', '2026-11-01T03:00:00Z', '2026-11-02T03:00:00Z'];
  const baseline = JSON.stringify([dates.weeklyLearningFeedback(value, new Date(times[0])), dates.weeklyLearningGoal(3, value.weekStart, new Date(times[0]))]);
  for (const time of times) {
    const goal = dates.weeklyLearningGoal(3, value.weekStart, new Date(time));
    assert.equal(goal.period, 'next');
    assert.equal(goal.targetDays, 4);
    assert.equal(JSON.stringify([dates.weeklyLearningFeedback(value, new Date(time)), goal]), baseline);
  }
});

test('Seoul Friday/Saturday and Sunday/Monday midnight switch exactly at UTC 15:00', () => {
  for (const [time, start, weekday, period, delay] of [
    ['2026-10-30T14:59:59.999Z', '2026-10-26', 5, 'current', 1],
    ['2026-10-30T15:00:00.000Z', '2026-10-26', 6, 'next', 86400000],
    ['2026-11-01T14:59:59.999Z', '2026-10-26', 0, 'next', 1],
    ['2026-11-01T15:00:00.000Z', '2026-11-02', 1, 'current', 86400000],
  ]) {
    const now = new Date(time);
    assert.equal(dates.currentSeoulWeek(now), start);
    assert.equal(dates.seoulReportDay(now).weekday, weekday);
    assert.equal(dates.weeklyLearningGoal(0, start, now).period, period);
    assert.equal(dates.millisecondsUntilSeoulMidnight(now), delay);
  }
});

test('report period is independent of UTC, American and Asian host timezones', () => {
  const { spawnSync } = require('node:child_process');
  const file = path.join(__dirname, '../lib/weekly-report.ts');
  const script = `const ts=require('typescript'),fs=require('node:fs');
    const code=ts.transpileModule(fs.readFileSync(${JSON.stringify(file)},'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
    const lib={};new Function('exports',code)(lib);
    process.stdout.write(JSON.stringify(['2026-10-30T14:59:59Z','2026-10-30T15:00:00Z','2026-11-01T15:00:00Z'].map(time=>{
      const now=new Date(time);return [lib.currentSeoulWeek(now),lib.seoulReportDay(now).weekday,lib.weeklyLearningGoal(0,lib.currentSeoulWeek(now),now).period];
    })));`;
  const outputs = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo'].map(TZ => {
    const run = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ }, encoding: 'utf8', windowsHide: true });
    assert.equal(run.status, 0, run.stderr); return run.stdout;
  });
  assert.ok(outputs.every(output => output === outputs[0]));
  assert.deepEqual(JSON.parse(outputs[0]), [['2026-10-26', 5, 'current'], ['2026-10-26', 6, 'next'], ['2026-11-02', 1, 'current']]);
});

test('open tab updates Saturday text, refetches weekend records, follows Monday, and cleans up', async () => {
  let time = '2026-10-30T14:59:59Z', timer, cleared = 0;
  const events = new Map(), documentEvents = new Map(), calls = [];
  const browser = { setTimeout(fn, delay) { timer = { fn, delay }; return 1; }, clearTimeout() { cleared++; },
    addEventListener(name, fn) { events.set(name, fn); }, removeEventListener(name) { events.delete(name); } };
  const doc = { visibilityState: 'visible', addEventListener(name, fn) { documentEvents.set(name, fn); }, removeEventListener(name) { documentEvents.delete(name); } };
  const h = harness('components/weekly-report.tsx', (url, options) => { const task = pending(); calls.push({ url, options, ...task }); return task.promise; }, [], true,
    { Date: frozenDate(() => time), window: browser, document: doc });
  h.render(props); calls[0].resolve({ ...report(), learningDays: 3, uniqueQuestions: 8, noRecordedActivity: false }); await flush();
  assert.ok(text(h.render(props)).includes('이번 주 추천 목표'));
  assert.equal(timer.delay, 1000);
  time = '2026-10-30T15:00:00Z'; timer.fn();
  assert.equal(find(h.render(props), n => n.props?.className === 'panel weekly-report-feedback'), undefined);
  calls[1].resolve({ ...report(), learningDays: 4, uniqueQuestions: 11, noRecordedActivity: false }); await flush();
  assert.ok(text(h.render(props)).includes('다음 주 추천 목표'));
  time = '2026-11-01T03:00:00Z'; events.get('focus')(); h.render(props);
  calls[2].resolve({ ...report(), learningDays: 5, uniqueQuestions: 15, noRecordedActivity: false }); await flush();
  assert.ok(text(h.render(props)).includes('5일 동안 15개'));
  time = '2026-11-01T15:00:00Z'; documentEvents.get('visibilitychange')();
  assert.equal(find(h.render(props), n => n.props?.className === 'panel weekly-report-feedback'), undefined);
  assert.equal(h.values[0], '2026-11-02');
  assert.ok(calls[3].url.includes('weekStart=2026-11-02'));
  calls[3].resolve({ ...report('2026-11-02'), currentWeekStart: '2026-11-02' }); await flush();
  assert.ok(text(h.render(props)).includes('이번 주 첫 학습'));
  h.unmount(); assert.equal(events.size, 0); assert.equal(documentEvents.size, 0); assert.ok(cleared >= 3);
  assert.equal(calls[3].options.signal.aborted, true);
});

test('midnight leaves a manually selected historical week selected', () => {
  let time = '2026-11-01T14:59:59Z', tick;
  const h = harness('components/weekly-report.tsx', () => new Promise(() => {}), ['2026-10-19'], true, {
    Date: frozenDate(() => time),
    window: { setTimeout(fn) { tick = fn; }, clearTimeout() {}, addEventListener() {}, removeEventListener() {} },
    document: { addEventListener() {}, removeEventListener() {} },
  });
  h.render(props); time = '2026-11-01T15:00:00Z'; tick();
  assert.equal(h.values[0], '2026-10-19');
  assert.equal(button(h.render(props), '다음 주').props.disabled, false);
  h.unmount();
});
