const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const ts = require('typescript');

const browser = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(candidate => candidate && fs.existsSync(candidate));

test('real browser: vertical drag, responsive layout, pen/eraser pixels, DPR, OCR PNG and clear', { skip: !browser, timeout: 30000 }, async () => {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/handwriting-pad.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const cssUrl = pathToFileURL(path.join(__dirname, '../app/globals.css')).href;
  const fixture = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${cssUrl}">
    <style>body{margin:0}.writing-paper{box-sizing:border-box;width:100%;padding:24px}</style>
    <div class="writing-paper"><div id="pad"></div></div><script>
    const refs=[], values=[]; let ri=0,si=0,effect,initialized=false;
    const exports={};
    const require=name=>name==='react'?{
      useRef(value){const i=ri++;return refs[i]??={current:value}},
      useState(value){const i=si++;if(!(i in values))values[i]=value;return [values[i],next=>values[i]=next]},
      useEffect(fn){if(!initialized)effect=fn},
    }:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:{default:()=>null};
    ${source}
    function mount(node){
      if(node==null||node===false)return document.createTextNode('');
      if(typeof node!=='object')return document.createTextNode(String(node));
      if(typeof node.type!=='string')return document.createTextNode('');
      const el=document.createElement(node.type),props=node.props||{};
      for(const [key,value]of Object.entries(props)){
        if(key==='ref')value.current=el;
        else if(key==='className')el.className=value;
        else if(key!=='children'&&!key.startsWith('on')&&value!=null)el.setAttribute(key,String(value));
      }
      for(const child of [props.children].flat())el.append(mount(child));return el;
    }
    let exportedImage;
    function render(){ri=si=0;return exports.default({allowErasing:true,onRecognize:async image=>{exportedImage=image;return '인식한 글'}})}
    function find(node,predicate){if(Array.isArray(node)){for(const child of node){const found=find(child,predicate);if(found)return found}}
      else if(node&&typeof node==='object'){if(predicate(node))return node;return find(node.props?.children,predicate)}}
    const tree=render();document.getElementById('pad').append(mount(tree));initialized=true;effect();
    const canvas=document.querySelector('canvas');
    const surface=document.querySelector('.handwriting-surface');
    function bind(){const props=find(render(),n=>n.type==='canvas').props;canvas.className=props.className;
      for(const event of ['PointerDown','PointerMove','PointerUp','PointerCancel','LostPointerCapture'])canvas['on'+event.toLowerCase()]=props['on'+event]}
    bind();
    function selectTool(label){
      find(render(),n=>n.type==='button'&&n.props.children===label).props.onClick();bind();
    }
    function pointer(type,x,y,pointerType='mouse'){
      const rect=canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent(type,{clientX:rect.left+canvas.clientLeft+x,clientY:rect.top+canvas.clientTop+y,
        pointerId:7,pointerType,button:0,bubbles:true,cancelable:true}));
    }
    // Synthetic pointer events have no browser-managed active pointer; emulate capture only.
    const captured=new Set();canvas.setPointerCapture=id=>captured.add(id);canvas.hasPointerCapture=id=>captured.has(id);canvas.releasePointerCapture=id=>captured.delete(id);
    const ctx=canvas.getContext('2d');
    function pixel(x,y){return Array.from(ctx.getImageData(Math.floor(x*devicePixelRatio),Math.floor(y*devicePixelRatio),1,1).data)}
    function check(condition,message){if(!condition)throw new Error(message)}
    const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,100)));
    window.run=async()=>{
      await frame();
      check(surface.getBoundingClientRect().height===400,'desktop height');
      check(getComputedStyle(surface).resize==='vertical','vertical-only resize handle');
      check(getComputedStyle(document.querySelector('.handwriting-resize-hint')).display!=='none','resize hint');
      check(canvas.width===Math.round(canvas.clientWidth*devicePixelRatio),'DPR width');
      check(canvas.height===Math.round(canvas.clientHeight*devicePixelRatio),'DPR height');
      check(pixel(2,2).join(',')==='255,255,255,255','opaque white background');
      const originalWidth=canvas.clientWidth,originalHeight=canvas.clientHeight;
      for(const [index,type]of ['mouse','touch','pen'].entries()){
        bind();pointer('pointerdown',100,100+index*40,type);pointer('pointermove',250,100+index*40,type);pointer('pointerup',250,100+index*40,type);
        check(pixel(170,100+index*40)[0]<150,type+' stroke pixel');
      }
      selectTool('부분 지우개');
      check(find(render(),n=>n.type==='button'&&n.props.children==='부분 지우개').props['aria-pressed'],'selected eraser');
      check(getComputedStyle(canvas).cursor.includes('data:image/svg+xml'),'eraser circle cursor');
      for(const [index,type]of ['mouse','touch','pen'].entries()){
        const y=100+index*40;
        pointer('pointerdown',170,y-8,type);pointer('pointermove',170,y+8,type);pointer('pointerup',170,y+8,type);
        check(pixel(170,y)[3]===0,type+' eraser removes actual pixels');
        check(pixel(120,y)[0]<150&&pixel(240,y)[0]<150,type+' eraser preserves other ink');
      }
      selectTool('펜');
      check(getComputedStyle(canvas).cursor==='crosshair','pen cursor restored');
      pointer('pointerdown',300,100,'pen');pointer('pointerup',300,100,'pen');
      check(pixel(300,100)[0]<150,'pen writes after erasing');
      pointer('pointerdown',170,180,'pen');pointer('pointerup',170,180,'pen');
      check(pixel(170,180)[0]<150,'pen can write inside an erased region');
      surface.style.height='360px';await frame();
      check(canvas.clientWidth===originalWidth,'vertical resize keeps width');
      let heightScale=Math.min(canvas.clientWidth/originalWidth,canvas.clientHeight/originalHeight);
      check(pixel(120*heightScale,100*heightScale)[0]<150,'manual height shrink preserves ink '+JSON.stringify({heightScale,height:canvas.clientHeight,pixels:canvas.height,originalHeight,transform:ctx.getTransform().toString()}));
      surface.style.height='9999px';await frame();
      check(surface.getBoundingClientRect().height<=720,'maximum height');
      surface.style.height='1px';await frame();
      check(surface.getBoundingClientRect().height===280,'minimum height');
      surface.style.height='';await frame();
      check(pixel(120,100)[0]<150,'restoring height preserves ink');
      check(pixel(170,100)[3]===0,'restoring height preserves erased pixels');
      check(pixel(170,180)[0]<150,'new pen stroke over erasure survives resize');
      check(getComputedStyle(canvas).touchAction==='none','touch scroll suppression');
      const setSize=async(width,height)=>{parent.document.querySelector('iframe').style.width=width+'px';parent.document.querySelector('iframe').style.height=height+'px';
        canvas.getBoundingClientRect();window.dispatchEvent(new Event('resize'));await frame()};
      await setSize(390,800);
      check(surface.getBoundingClientRect().height>=240&&surface.getBoundingClientRect().height<=380,'mobile height');
      check(document.documentElement.scrollWidth<=innerWidth,'mobile overflow');
      let scale=Math.min(canvas.clientWidth/originalWidth,canvas.clientHeight/originalHeight);
      check(pixel(120*scale,100*scale)[0]<150,'mobile replay pixel '+JSON.stringify({scale,width:canvas.clientWidth,pixels:canvas.width,originalWidth,originalHeight,pixel:pixel(120*scale,100*scale)}));
      for(let i=0;i<3;i++){await setSize(740,390);await setSize(390,800)}
      check(pixel(120*scale,100*scale)[0]<150,'orientation replay pixel');
      check(pixel(170*scale,100*scale)[3]===0,'rotation preserves erased pixels');
      bind();pointer('pointerdown',200*scale,240*scale,'pen');pointer('pointerup',200*scale,240*scale,'pen');
      check(pixel(200*scale,240*scale)[0]<150,'resized pointer coordinate');
      selectTool('부분 지우개');
      pointer('pointerdown',200*scale,240*scale,'pen');pointer('pointerup',200*scale,240*scale,'pen');
      check(pixel(200*scale,240*scale)[3]===0,'resized eraser coordinate at DPR '+devicePixelRatio);
      check(pixel(200*scale+10,240*scale)[3]===0,'eraser radius covers 10 CSS pixels after resize');
      check(pixel(200*scale+14,240*scale)[3]===255,'eraser radius stays below 14 CSS pixels after resize');
      check(pixel(120*scale,100*scale)[0]<150,'resized eraser preserves other ink');
      selectTool('펜');
      const actions=find(render(),n=>n.props?.className==='handwriting-actions').props.children;
      await actions[1].props.onClick();
      const png=Uint8Array.from(atob(exportedImage),c=>c.charCodeAt(0));const header=new DataView(png.buffer);
      check(png[0]===137&&String.fromCharCode(...png.slice(1,4))==='PNG','PNG signature');
      check(header.getUint32(16)===canvas.width&&header.getUint32(20)===canvas.height,'full PNG dimensions');
      check(pixel(2,2)[3]===255,'PNG source alpha');
      check(png.length<5000000,'backend image limit');
      const image=new Image();image.src='data:image/png;base64,'+exportedImage;await image.decode();
      const output=document.createElement('canvas');output.width=image.width;output.height=image.height;
      const outputCtx=output.getContext('2d');outputCtx.drawImage(image,0,0);
      const ocrPixel=(x,y)=>Array.from(outputCtx.getImageData(Math.floor(x*devicePixelRatio),Math.floor(y*devicePixelRatio),1,1).data);
      check(ocrPixel(170*scale,100*scale).join(',')==='255,255,255,255','OCR PNG has white erased region');
      check(ocrPixel(120*scale,100*scale)[0]<150,'OCR PNG retains un-erased ink');
      check(ocrPixel(200*scale,240*scale).join(',')==='255,255,255,255','OCR PNG includes resized erasure');
      await setSize(1000,850);
      check(pixel(120,100)[0]<150,'desktop restore pixel');
      check(pixel(170,100)[3]===0,'erased ink does not return on desktop');
      find(render(),n=>n.type==='button'&&n.props.children==='전체 지우기').props.onClick();await setSize(390,800);
      check(pixel(120*scale,100*scale).join(',')==='255,255,255,255','clear survives resize');
      bind();pointer('pointerdown',60,60,'touch');pointer('pointerup',60,60,'touch');
      check(pixel(60,60)[0]<150,'writing after clear all');
      surface.style.height='1px';await frame();
      check(surface.getBoundingClientRect().height===240,'mobile minimum height');
      surface.style.height='9999px';await frame();
      check(surface.getBoundingClientRect().height<=600,'mobile maximum height');
      surface.style.height='';
      document.querySelector('.writing-paper').classList.remove('writing-paper');await frame();
      check(getComputedStyle(surface).resize==='none','other pages do not gain resize');
      check(canvas.getBoundingClientRect().height===210,'other pages keep canvas height');
      check(getComputedStyle(document.querySelector('.handwriting-resize-hint')).display==='none','other pages hide resize hint');
      return 'PASS: desktop 400px, mobile 240–380px, vertical resize, height limits, pen/eraser pixels, other-page layout, mouse/touch/pen, DPR '+devicePixelRatio+', OCR PNG, clear';
    };
    </script>`;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'koreaneye-handwriting-'));
  let child, socket;
  try {
    const html = path.join(directory, 'test.html');
    fs.writeFileSync(html, `<!doctype html><iframe style="width:1000px;height:850px;border:0"></iframe><pre id="result">RUNNING</pre><script>
      const iframe=document.querySelector('iframe');iframe.srcdoc=${JSON.stringify(fixture).replace(/</g, '\\u003c')};
      iframe.onload=async()=>{try{document.getElementById('result').textContent=await iframe.contentWindow.run()}
        catch(error){document.getElementById('result').textContent='FAIL: '+error.message}};</script>`);
    child = spawn(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1200,1000',
      '--allow-file-access-from-files', '--force-device-scale-factor=2', `--user-data-dir=${path.join(directory, 'profile')}`,
      '--remote-debugging-port=0', '--disable-background-timer-throttling', pathToFileURL(html).href], { stdio: 'ignore', windowsHide: true });
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const deadline = Date.now() + 20000;
    const portFile = path.join(directory, 'profile', 'DevToolsActivePort');
    while (!fs.existsSync(portFile) && Date.now() < deadline) await delay(50);
    assert.ok(fs.existsSync(portFile), 'Browser debugging endpoint did not start');
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find(item => item.type === 'page');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let nextId = 0;
    const pending = new Map();
    socket.addEventListener('message', event => {
      const result = JSON.parse(event.data), task = pending.get(result.id);
      if (!task) return;
      pending.delete(result.id);
      if (result.error) task.reject(new Error(result.error.message)); else task.resolve(result.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    let message;
    do { await delay(100); message = await evaluate("document.getElementById('result')?.textContent"); }
    while ((!message || message === 'RUNNING') && Date.now() < deadline);
    assert.ok(message?.startsWith('PASS:'), message || 'Browser did not return a result');

    // Drive the native resize corner with actual browser mouse events.
    await evaluate(`(() => {
      const iframe=document.querySelector('iframe'), doc=iframe.contentDocument;
      iframe.style.width='1000px';iframe.style.height='850px';
      doc.querySelector('#pad').parentElement.classList.add('writing-paper');
      doc.querySelector('.handwriting-surface').style.height='500px';
    })()`);
    await delay(100);
    const before = await evaluate(`(() => {
      const iframe=document.querySelector('iframe'), box=iframe.contentDocument.querySelector('.handwriting-surface').getBoundingClientRect(), frame=iframe.getBoundingClientRect();
      return {x:frame.left+box.right-5,y:frame.top+box.bottom-5,width:box.width,height:box.height};
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.x, y: before.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: before.x, y: before.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.x + 40, y: before.y + 80, button: 'left', buttons: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: before.x + 40, y: before.y + 80, button: 'left', clickCount: 1 });
    await delay(100);
    const after = await evaluate(`(() => {
      const box=document.querySelector('iframe').contentDocument.querySelector('.handwriting-surface').getBoundingClientRect();
      return {width:box.width,height:box.height};
    })()`);
    assert.equal(after.width, before.width, 'native drag must not change width');
    assert.ok(after.height > before.height, `native drag must increase height: ${JSON.stringify({ before, after })}`);
    const handleY = before.y + after.height - before.height;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.x, y: handleY });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: before.x, y: handleY, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.x, y: handleY - 120, button: 'left', buttons: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: before.x, y: handleY - 120, button: 'left', clickCount: 1 });
    await delay(100);
    const shrunk = await evaluate(`(() => {
      const box=document.querySelector('iframe').contentDocument.querySelector('.handwriting-surface').getBoundingClientRect();
      return {width:box.width,height:box.height};
    })()`);
    assert.equal(shrunk.width, before.width, 'upward drag must not change width');
    assert.ok(shrunk.height < after.height, 'upward drag must decrease height');
  } finally {
    socket?.close();
    if (child && child.exitCode === null) {
      await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
    }
    // Only remove the unique temporary directory created by this test.
    if (path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
});
