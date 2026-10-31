const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');

const browser = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && fs.existsSync(file));

test('real browser: report cards and seven bars fit desktop and mobile without overflow', { skip: !browser }, () => {
  const load = (file, imports) => {
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(source, { exports, require: name => imports[name] ?? require(name) });
    return exports;
  };
  const dates = load('lib/weekly-report.ts', {}), start = '2026-10-26';
  const report = { weekStart: start, weekEnd: dates.shiftDate(start, 6), currentWeekStart: start,
    learningDays: 3, uniqueQuestions: 9, previousWeekUniqueQuestions: 4, previousWeekActivityAvailable: true,
    reviewedClues: null, completedClues: null, reviewActivityAvailable: false,
    days: [0, 1, 3, 2, 0, 5, 1].map((questions, i) => ({ date: dates.shiftDate(start, i), questions })),
    weaknesses: [{ category: 'SPACING', count: 2 }], noRecordedActivity: false };
  const state = [start, 0, { key: JSON.stringify(['test-token', 'test-student', start, 0]), report }, '2026-10-30'];
  let i = 0;
  const Component = load('components/weekly-report.tsx', {
    react: { useState: () => [state[i++], () => {}], useRef: value => ({ current: value }), useEffect() {} }, '@/lib/api': {},
    '@/lib/weekly-report': dates, './loading-indicator': { default: () => null },
  }).default;
  const markup = renderToStaticMarkup(Component({ token: 'test-token', studentId: 'test-student', categoryNames: { SPACING: '띄어쓰기' }, onReview() {}, onContinueLearning() {} }));
  const Notebook = load('components/learning-notebook.tsx', {}).default;
  const heading = renderToStaticMarkup(Notebook({ records: [], onQuestions() {}, onWeeklyReport() {} }).props.children[0]);
  const css = pathToFileURL(path.join(__dirname, '../app/globals.css')).href;
  const inner = `<link rel="stylesheet" href="${css}"><style>body{margin:0}</style>${markup}<div class="content learning-path-page">${heading}</div>`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koreaneye-weekly-'));
  try {
    const html = path.join(dir, 'test.html');
    fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><iframe style="width:1000px;height:1000px;border:0"></iframe><pre id="result">RUNNING</pre><script>
      const frame=document.querySelector('iframe');frame.srcdoc=${JSON.stringify(inner).replace(/</g, '\\u003c')};
      frame.onload=()=>{try{
        const doc=frame.contentDocument,win=frame.contentWindow;
        function check(value,message){if(!value)throw new Error(message)}
        for(const width of [1000,760,390,320]){
          frame.style.width=width+'px';void doc.body.offsetHeight;
          check(doc.documentElement.scrollWidth<=width,'horizontal overflow at '+width);
          check(doc.querySelectorAll('.weekly-report-column').length===7,'seven daily bars');
          const columns=win.getComputedStyle(doc.querySelector('.weekly-report-cards')).gridTemplateColumns.split(' ').length;
          check(columns===(width<=760?1:3),'responsive cards at '+width);
          const cards=Array.from(doc.querySelectorAll('.weekly-report-cards > section'));
          check(cards.every(card=>card.querySelector('.weekly-report-card-title svg')),'consistent stat icons');
          check(doc.querySelector('.weekly-report-comparison [data-icon="up"]'),'increase icon');
          if(width>760){
            const bounds=cards.map(card=>card.getBoundingClientRect());
            check(bounds.every(rect=>Math.abs(rect.height-bounds[0].height)<1),'equal card heights');
            const values=cards.map(card=>card.querySelector('.weekly-report-value').getBoundingClientRect().top);
            check(values.every(top=>Math.abs(top-values[0])<1),'aligned stat values');
          }
          check(doc.querySelectorAll('.weekly-report-column.is-peak').length===1,'single peak');
          check(doc.querySelector('.weekly-report-column.is-peak').textContent.includes('토'),'actual busiest day');
          check(doc.querySelector('.weekly-report-peak-note').textContent.includes('가장 많이 학습한 날'),'peak explanation');
          const feedback=doc.querySelector('.weekly-report-feedback');
          check(feedback.querySelector('#weekly-feedback-title').textContent==='이번 주 탐정의 한마디','feedback heading');
          check(feedback.querySelector('#weekly-goal-title').textContent==='이번 주 추천 목표','goal in feedback card');
          check(feedback.querySelectorAll('.weekly-report-goal-day').length===4,'recommended days');
          check(feedback.querySelectorAll('.weekly-report-goal-day.is-learned').length===3,'recorded days');
          check(feedback.textContent.includes('3일 학습했어요 · 목표까지 1일 남았어요!'),'child-friendly goal guidance');
          check(!feedback.textContent.includes('비교 예시')&&!feedback.textContent.includes('목표는 저장되지 않아요'),'no technical copy in feedback');
          check(doc.querySelector('.weekly-report-guidance summary').textContent==='집계 기준 안내','accuracy details separate from feedback');
          check(feedback.scrollWidth<=feedback.clientWidth,'feedback copy fits at '+width);
          check(Array.from(feedback.querySelectorAll('p')).every(paragraph=>paragraph.scrollWidth<=paragraph.clientWidth),'feedback paragraphs wrap at '+width);
          const surfaces=[doc.querySelector('.weekly-report-period'),...cards,doc.querySelector('.weekly-report-chart'),feedback];
          const styles=surfaces.map(node=>win.getComputedStyle(node));
          check(styles.every(style=>style.backgroundColor===styles[0].backgroundColor),'all report cards share surface');
          check(styles.every(style=>style.borderColor===styles[0].borderColor&&style.borderWidth===styles[0].borderWidth),'all report card borders match');
          check(styles.every(style=>style.boxShadow===styles[0].boxShadow&&style.borderRadius===styles[0].borderRadius),'all report card shadows and corners match');
          const actions=feedback.querySelector('.weekly-report-actions'),continueButton=actions.querySelector('.weekly-report-continue-button'),reviewButton=actions.querySelector('.btn.secondary');
          check(continueButton&&continueButton.textContent==='오늘 학습 계속하기','weekday continue action');
          check(reviewButton&&reviewButton.textContent==='복습 노트로 이동','review action remains');
          const swatch=doc.createElement('span');swatch.style.color='var(--blue)';doc.body.append(swatch);
          const sharedBrown=win.getComputedStyle(swatch).color;swatch.remove();
          check(win.getComputedStyle(continueButton).backgroundColor===sharedBrown,'continue uses shared brown');
          const buttonRect=continueButton.getBoundingClientRect(),actionRect=actions.getBoundingClientRect();
          check(buttonRect.left>=actionRect.left-1&&buttonRect.right<=actionRect.right+1,'continue fits action area');
          if(width<=760)check(win.getComputedStyle(actions).flexDirection==='column','mobile buttons stack');
          check(Array.from(doc.querySelectorAll('button')).find(button=>button.textContent==='다음 주').disabled,'future week stays disabled');
        }
        document.getElementById('result').textContent='PASS';
      }catch(error){document.getElementById('result').textContent='FAIL: '+error.message}};
    </script>`);
    const run = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--allow-file-access-from-files', `--user-data-dir=${path.join(dir, 'profile')}`, '--dump-dom', '--virtual-time-budget=1000', pathToFileURL(html).href],
      { encoding: 'utf8', timeout: 15000, windowsHide: true });
    assert.equal(run.error, undefined);
    const message = run.stdout?.match(/<pre id="result">([^<]*)<\/pre>/)?.[1];
    assert.equal(message, 'PASS', message || `Browser exited ${run.status}`);
  } finally {
    if (path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
});
