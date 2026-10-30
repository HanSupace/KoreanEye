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
  const dates = load('lib/weekly-report.ts', {}), start = dates.currentSeoulWeek();
  const report = { weekStart: start, weekEnd: dates.shiftDate(start, 6), currentWeekStart: start,
    learningDays: 5, uniqueQuestions: 9, reviewedClues: null, completedClues: null, reviewActivityAvailable: false,
    days: [0, 1, 3, 2, 0, 5, 1].map((questions, i) => ({ date: dates.shiftDate(start, i), questions })),
    weaknesses: [{ category: 'SPACING', count: 2 }], noRecordedActivity: false };
  const state = [start, 0, { key: JSON.stringify(['test-token', 'test-student', start, 0]), report }];
  let i = 0;
  const Component = load('components/weekly-report.tsx', {
    react: { useState: () => [state[i++], () => {}], useEffect() {} }, '@/lib/api': {},
    '@/lib/weekly-report': dates, './loading-indicator': { default: () => null },
  }).default;
  const markup = renderToStaticMarkup(Component({ token: 'test-token', studentId: 'test-student', categoryNames: { SPACING: '띄어쓰기' }, onReview() {} }));
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
          check(Array.from(doc.querySelectorAll('button')).find(button=>button.textContent==='다음 주').disabled,'future week disabled');
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
