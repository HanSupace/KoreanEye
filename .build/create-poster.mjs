import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { importRuntimeModule } = await import(pathToFileURL('C:/Users/wagks/.codex/plugins/cache/openai-primary-runtime/presentations/26.1022.11436/skills/presentations/container_tools/runtime_helpers.mjs').href);
const { Presentation, PresentationFile } = await importRuntimeModule('@oai/artifact-tool');
const W=1323,H=2646;
const C={deep:'#08772C',green:'#22A63B',lime:'#69D247',mint:'#E6F5DF',pale:'#F3F9EA',ink:'#17251A',muted:'#657367',line:'#8DCB79',white:'#FFFFFF',cream:'#FAFFF7'};
const FONT='Malgun Gothic';
// Preserve the reference poster's 1:2 canvas size in PowerPoint (27.56 × 55.12 in).
const SCALE=2;
const p=Presentation.create({slideSize:{width:W*SCALE,height:H*SCALE}});
const s=p.slides.add();
s.background.fill=C.pale;
function shape(geometry,x,y,w,h,fill='none',stroke='none',sw=0,name=''){
 return s.shapes.add({geometry,name,position:{left:x*SCALE,top:y*SCALE,width:w*SCALE,height:h*SCALE},fill,line:{style:'solid',fill:stroke,width:sw*SCALE}});
}
function txt(text,x,y,w,h,size,color=C.ink,bold=false,align='left',name=''){
 const a=shape('textbox',x,y,w,h,'none','none',0,name);
 a.text=text;
 a.text.style={fontSize:size*SCALE,typeface:FONT,color,bold,alignment:align,verticalAlignment:'middle',wrap:'square',autoFit:'shrinkText',insets:0};
 return a;
}
function section(title,x,y,w){
 shape('ellipse',x,y+7,20,20,C.green);
 txt(title,x+34,y,w-34,48,35,C.deep,true);
}
function rule(x,y,w){ shape('rect',x,y,w,4,C.green); }
function card(x,y,w,h,heading,body,opts={}){
 shape('roundRect',x,y,w,h,opts.fill||C.cream,opts.stroke||C.line,2);
 if(opts.number) txt(opts.number,x+20,y+14,56,48,30,C.green,true,'center');
 const titleX=x+(opts.number?86:22);
 txt(heading,titleX,y+14,w-(titleX-x)-20,44,opts.titleSize||27,C.deep,true);
 txt(body,x+22,y+67,w-44,h-82,opts.bodySize||23,opts.bodyColor||C.ink,false,'left');
}
// Header band, echoing the reference deck's layered greens.
shape('rect',0,0,W,265,'linear(0deg, #075C27 0%, #0F8F2C 55%, #67D640 100%)');
shape('ellipse',-260,146,1060,260,'#45D33B/38');
shape('ellipse',670,120,900,270,'#8BEA4C/28');
shape('rect',0,240,W,26,'linear(0deg, #B9EE9B 0%, #EAF8D9 100%)');
// Header eyebrow and hero.
txt('AI·SW 신기술 전공 프로젝트',74,32,560,38,24,'#D8F6D3',true);
txt('한글탐정단',72,68,850,112,94,C.white,true);
txt('AI 맞춤법·글쓰기 학습 서비스',78,170,875,44,40,'#F4FFF0',true);
// Logo mark in a light round seal.
shape('ellipse',1060,52,180,180,'#F6FFE9');
s.images.add({blob:new Uint8Array(await fs.readFile('C:/Workspace/KoreanEye/frontend/public/logo-mark.png')),contentType:'image/png',alt:'한글탐정단 돋보기 로고',fit:'contain',position:{left:1080*SCALE,top:72*SCALE,width:140*SCALE,height:140*SCALE}});
txt('초등 1–3학년 맞춤 학습',78,218,500,30,21,'#E7F8D5',true);
// Main paper and thin green frame.
shape('rect',36,254,W-72,2310,C.white,C.green,2);
// Project headline.
shape('rect',64,286,W-128,176,'linear(0deg, #F5FBEF 0%, #FFFFFF 100%)',C.line,2);
txt('글을 쓰며 발견하고, 다시 쓰며 자라는',98,310,W-196,52,34,C.muted,false,'center');
txt('어린이 맞춤 한글 학습',96,358,W-192,66,52,C.green,true,'center');
// Project facts / visual identity row.
shape('rect',64,482,590,196,C.white,C.line,2);
txt('프로젝트 한눈에 보기',90,497,540,44,30,C.deep,true);
rule(90,548,536);
txt('대상',94,565,82,36,22,C.muted,true);
txt('초등학교 1–3학년',196,561,410,42,27,C.ink,true);
txt('분야',94,610,82,36,22,C.muted,true);
txt('AI · 맞춤법 · 학습 기록',196,606,420,42,26,C.ink,true);
shape('rect',674,482,585,196,C.pale,C.line,2);
txt('나의 글에서 시작하는 학습',702,497,532,44,29,C.deep,true,'center');
s.images.add({blob:new Uint8Array(await fs.readFile('C:/Workspace/KoreanEye/frontend/public/logo.png')),contentType:'image/png',alt:'탐정 수첩과 돋보기 일러스트',fit:'contain',position:{left:710*SCALE,top:540*SCALE,width:155*SCALE,height:128*SCALE}});
txt('오늘의 문제',880,544,322,34,25,C.green,true);
txt('내 글의 오류 찾기',880,583,322,34,25,C.green,true);
txt('고쳐 쓰고 기록하기',880,622,322,34,25,C.green,true);
// Overview.
section('프로젝트 소개',74,708,W-148);
txt('한글탐정단은 어린이가 푼 문제와 직접 쓴 글을 학습 기록으로 쌓고, 자주 헷갈리는 표현을 다시 연습하도록 돕는 웹 서비스입니다.',76,760,W-152,90,27,C.ink,false);
rule(76,866,W-152);
// Feature and outcomes columns.
section('주요 기능',74,894,560);
section('기대 효과',684,894,560);
card(76,952,548,116,'맞춤 문제와 받아쓰기','오늘의 문제를 풀고, 듣기·타자·손글씨로 답을 입력합니다.',{bodySize:22});
card(76,1082,548,116,'내 글 맞춤법 분석','글에서 오류 후보와 단계별 힌트를 확인하고 직접 고칩니다.',{bodySize:22});
card(684,952,548,116,'학습 이력과 복습','풀이·오류·다시 쓰기 기록으로 반복 학습을 이어갑니다.',{bodySize:22});
card(684,1082,548,116,'보호자와 자녀 프로필','보호자 계정에서 자녀별 학습 기록을 관리합니다.',{bodySize:22});
rule(76,1220,W-152);
// Learning journey.
section('학습 흐름',74,1244,W-148);
const flowY=1310, flowW=278, flowGap=34, flowX=76;
const steps=[
 ['01','문제 풀기','오늘의 맞춤 문제와\n받아쓰기 연습'],
 ['02','내 글 쓰기','직접 쓴 글을 저장하고\n오류 후보 살펴보기'],
 ['03','힌트로 고치기','정답을 먼저 말하지 않는\n단계별 힌트'],
 ['04','기록하고 복습','자주 틀린 유형을\n다시 연습하기']
];
steps.forEach((it,i)=>{
 const x=flowX+i*(flowW+flowGap);
 shape('roundRect',x,flowY,flowW,168,i%2?C.cream:C.pale,C.line,2);
 txt(it[0],x+18,flowY+14,56,44,30,C.green,true,'center');
 txt(it[1],x+82,flowY+14,flowW-100,44,27,C.deep,true);
 txt(it[2],x+22,flowY+70,flowW-44,78,21,C.ink,false,'center');
 if(i<3){
   shape('rect',x+flowW+5,flowY+78,22,6,C.green);
   shape('triangle',x+flowW+21,flowY+68,20,26,C.green,'none',0);
 }
});
// Product snapshots, all constructed from editable PowerPoint elements.
section('학습 화면 예시',74,1516,W-148);
const uiY=1580, uiH=278, uiW=365;
const uis=[
 {x:76,title:'오늘의 문제',tag:'맞춤 연습',body:'나는 학교에 ___ 친구를 만났어요.',foot:'가서     /     가 서'},
 {x:479,title:'내 글 다시 쓰기',tag:'단계별 힌트',body:'“오늘은 날씨가 좋아서\n친구와 공원에 갔다.”',foot:'띄어쓰기와 표현을 확인해요'},
 {x:882,title:'학습 기록',tag:'나의 성장',body:'이번 주 학습 기록\n문제 풀이 · 글쓰기 · 복습',foot:'기록을 보며 다시 연습해요'}
];
uis.forEach((u,i)=>{
 shape('roundRect',u.x,uiY,uiW,uiH,C.white,C.line,2);
 shape('rect',u.x,uiY,uiW,48,C.deep);
 txt(u.title,u.x+16,uiY+4,uiW-32,38,24,C.white,true,'center');
 txt(u.tag,u.x+22,uiY+62,uiW-44,34,20,C.green,true);
 shape('roundRect',u.x+20,uiY+108,uiW-40,90,C.pale,'none',0);
 txt(u.body,u.x+34,uiY+115,uiW-68,76,22,C.ink,true,'center');
 txt(u.foot,u.x+20,uiY+215,uiW-40,42,19,C.muted,false,'center');
});
txt('※ 화면은 서비스 기능을 설명하기 위한 예시입니다.',80,1868,1160,28,18,C.muted,false);
rule(76,1910,W-152);
// Architecture and MVP boundary.
section('기술 구성',74,1932,550);
section('현재 구현 범위',684,1932,550);
// Editable flow diagram, accurate to repo architecture.
const archY=1998;
const arch=[['웹 화면','Next.js'],['학습 API','Spring Boot'],['학습 기록','Supabase\nPostgreSQL']];
const ax=[78,270,462];
arch.forEach((a,i)=>{
 shape('roundRect',ax[i],archY,168,106,i===1?C.mint:C.cream,C.line,2);
 txt(a[0],ax[i]+10,archY+13,148,36,23,C.deep,true,'center');
 txt(a[1],ax[i]+10,archY+52,148,42,19,C.ink,false,'center');
 if(i<2){shape('rect',ax[i]+168,archY+50,22,5,C.green);shape('triangle',ax[i]+183,archY+40,20,24,C.green);}
});
txt('글 분석: 규칙 기반 · Gemini/OpenAI 선택형',80,2118,550,38,21,C.ink,true,'center');
txt('손글씨 인식: Google Cloud Vision',80,2156,550,34,19,C.muted,false,'center');
shape('rect',684,1998,548,202,C.pale,C.line,2);
txt('현재 MVP',708,2014,492,38,24,C.green,true);
txt('• 규칙 분석은 예시 표현 중심입니다.\n• AI 후보는 정답 검증을 대신하지 않습니다.\n• 어린이 글의 외부 전송 전 안내와 보호자 동의가 필요합니다.',708,2054,492,132,20,C.ink,false);
rule(76,2224,W-152);
// Next steps.
section('다음 발전 방향',74,2244,W-148);
const future=[['01','학습 콘텐츠 확장','학년·오류 유형별 문제와 예문 보강'],['02','학습 경험 개선','기록을 활용한 복습 추천과 피드백'],['03','안전한 서비스 준비','보호자 동의·개인정보 안내·보안 강화']];
const fy=2310, fw=365, fg=38;
future.forEach((f,i)=>{
 const x=76+i*(fw+fg);
 shape('roundRect',x,fy,fw,140,C.cream,C.line,2);
 txt(f[0],x+18,fy+13,48,40,25,C.green,true,'center');
 txt(f[1],x+75,fy+12,fw-94,42,23,C.deep,true);
 txt(f[2],x+20,fy+66,fw-40,60,19,C.ink,false,'center');
});
// Footer band.
shape('rect',0,2562,W,84,'linear(0deg, #075C27 0%, #18A337 55%, #62D23B 100%)');
shape('rect',0,2554,W,9,'#B5E995');
txt('한 글 자 씩, 나만의 자신감으로',76,2572,W-152,48,32,C.white,true,'center');
// Editable source note in speaker notes is not needed; content is based on local project source.
const buildDir='C:/Workspace/KoreanEye/.build';
const out='C:/Workspace/KoreanEye/.build/koreaneye-poster-draft.pptx';
await fs.mkdir(buildDir,{recursive:true});
const pptx=await PresentationFile.exportPptx(p);
await pptx.save(out);
const png=await p.export({slide:s,format:'png',scale:0.5});
await fs.writeFile(path.join(buildDir,'poster-preview.png'),new Uint8Array(await png.arrayBuffer()));
console.log(JSON.stringify({draft:out,preview:path.join(buildDir,'poster-preview.png'),slideSize:{width:W,height:H}}));
