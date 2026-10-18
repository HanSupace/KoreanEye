"use client";
import { DetectiveMark, NavIcon } from "./detective-art";

import LearningNotebook, { DayRecord } from "./learning-notebook";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, ApiError, Question, Student, Writing, WritingError } from "@/lib/api";

type Page = "home" | "today" | "questions" | "write" | "review" | "quests" | "ranking" | "addStudent";
type AuthResult = { token: string; email: string; expiresAt: string };
type AttemptResult = { correct: boolean; message: string; answer?: string | null; correctExpression?: string | null; attemptCount?: number };
type Daily = { questionsDone: boolean; writingDone: boolean; reviewDone: boolean; completedCount: number };

const STORE = "hangul-detective-session";
const GUEST_STORE = "hangul-detective-local-guest";
const categoryNames: Record<string, string> = { SPACING: "띄어쓰기", FINAL_CONSONANT: "받침", DOE_DWAE: "돼 / 되", AN_ANH: "안 / 않", PRONUNCIATION_SPELLING: "발음과 표기", PARTICLE: "조사", PUNCTUATION: "문장 부호", CHARACTER_OMISSION: "글자 빠뜨림", CHARACTER_CONFUSION: "글자 혼동", OTHER: "기타" };
const LOCAL_WORD_QUESTIONS: Question[] = [
  { id: "local-spacing-school", category: "SPACING", prompt: "나는 학교에 ___ 친구를 만났어요.", choices: ["가서", "가 서"], answer: "가서" },
  { id: "local-together", category: "PRONUNCIATION_SPELLING", prompt: "친구와 ___ 놀았어요.", choices: ["가치", "같이"], answer: "같이" },
  { id: "local-final-consonant", category: "FINAL_CONSONANT", prompt: "비가 오니까 우산을 ___ 가요.", choices: ["갖고", "갇고"], answer: "갖고" },
  { id: "local-doe-dwae", category: "DOE_DWAE", prompt: "오늘은 숙제를 다 해도 ___.", choices: ["되요", "돼요"], answer: "돼요" },
  { id: "local-spacing-home", category: "SPACING", prompt: "집에 ___ 손을 씻었어요.", choices: ["와서", "와 서"], answer: "와서" },
];

let localGuestAuthPromise: Promise<AuthResult> | null = null;

function getLocalGuestAuth(): Promise<AuthResult> {
  if (!localGuestAuthPromise) {
    localGuestAuthPromise = (async () => {
      let guest: { email: string; password: string };
      try {
        const stored = localStorage.getItem(GUEST_STORE);
        guest = stored ? JSON.parse(stored) : (() => {
          const id = crypto.randomUUID().replaceAll("-", "");
          const credentials = { email: `guest-${id}@local.hangul`, password: crypto.randomUUID() };
          localStorage.setItem(GUEST_STORE, JSON.stringify(credentials));
          return credentials;
        })();
      } catch {
        const id = crypto.randomUUID().replaceAll("-", "");
        guest = { email: `guest-${id}@local.hangul`, password: crypto.randomUUID() };
        localStorage.setItem(GUEST_STORE, JSON.stringify(guest));
      }
      try {
        return await api<AuthResult>("/auth/signup", { method: "POST", body: JSON.stringify(guest) });
      } catch (signupError) {
        try {
          return await api<AuthResult>("/auth/login", { method: "POST", body: JSON.stringify(guest) });
        } catch {
          throw signupError;
        }
      }
    })();
    localGuestAuthPromise.catch(() => { localGuestAuthPromise = null; });
  }
  return localGuestAuthPromise;
}

function QuestionPrompt({ prompt, selected }: { prompt: string; selected: string }) {
  const parts = prompt.split("___");
  return <>{parts.map((part, index) => {
    const sharedEnding = index > 0 ? part.match(/^[가-힣]+/)?.[0] ?? "" : "";
    const visiblePart = sharedEnding && selected.endsWith(sharedEnding) ? part.slice(sharedEnding.length) : part;
    return <span key={index}>{visiblePart}{index < parts.length - 1 && <span className={`answer-blank ${selected ? "filled" : ""}`}>{selected || "　　"}</span>}</span>;
  })}</>;
}

export default function AppShell() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [daily, setDaily] = useState<Daily>({ questionsDone: false, writingDone: false, reviewDone: false, completedCount: 0 });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [offlineQuestions, setOfflineQuestions] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [qSelected, setQSelected] = useState("");
  const [qResult, setQResult] = useState<AttemptResult | null>(null);
  const [story, setStory] = useState("");
  const [writing, setWriting] = useState<Writing | null>(null);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const fail = useCallback((e: unknown) => setError(e instanceof ApiError ? e.message : "서버에 연결하지 못했어요. API와 데이터베이스 상태를 확인해 주세요."), []);

  const refreshStudentData = useCallback(async (currentToken: string, currentStudent: Student) => {
    const [dailyResult, questionsResult, historyResult] = await Promise.allSettled([
      api<Daily>(`/students/${currentStudent.id}/daily-learning`, {}, currentToken),
      api<Question[]>(`/students/${currentStudent.id}/questions/today`, {}, currentToken),
      api<DayRecord[]>(`/students/${currentStudent.id}/learning-history`, {}, currentToken),
    ]);
    setDaily(dailyResult.status === "fulfilled" ? dailyResult.value : { questionsDone: false, writingDone: false, reviewDone: false, completedCount: 0 });
    setRecords(historyResult.status === "fulfilled" ? historyResult.value : []);
    if (questionsResult.status === "fulfilled" && questionsResult.value.length > 0) {
      setQuestions(questionsResult.value); setOfflineQuestions(false);
    } else {
      setQuestions(LOCAL_WORD_QUESTIONS); setOfflineQuestions(true);
    }
  }, []);

  const loadSession = useCallback(async (currentToken: string, currentEmail: string, savedStudentId?: string) => {
    const list = await api<Student[]>("/students", {}, currentToken);
    setToken(currentToken); setEmail(currentEmail); setStudents(list);
    const selected = list.find(s => s.id === savedStudentId) ?? list[0] ?? null;
    setStudent(selected);
    if (selected) {
      setPage("today");
      localStorage.setItem(STORE, JSON.stringify({ token: currentToken, email: currentEmail, studentId: selected.id }));
      await refreshStudentData(currentToken, selected);
    } else {
      setPage("addStudent");
      localStorage.setItem(STORE, JSON.stringify({ token: currentToken, email: currentEmail }));
    }
  }, [refreshStudentData]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const saved = localStorage.getItem(STORE);
        if (saved) {
          try {
            const session = JSON.parse(saved);
            if (session.token) {
              await loadSession(session.token, session.email ?? "", session.studentId);
              return;
            }
          } catch (e) {
            if (e instanceof ApiError && e.status !== 401) throw e;
            localStorage.removeItem(STORE);
          }
        }

        const result = await getLocalGuestAuth();
        if (!cancelled) await loadSession(result.token, "", undefined);
      } catch (e) {
        if (!cancelled) fail(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    initialize();
    return () => { cancelled = true; };
  }, [loadSession, fail]);

  const createStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!token) return; setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const created = await api<Student>("/students", { method: "POST", body: JSON.stringify({ name: form.get("name"), grade: Number(form.get("grade")), nickname: form.get("nickname") }) }, token);
      await loadSession(token, email, created.id); notify("탐정 프로필을 만들었어요!");
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const switchStudent = async (id: string) => {
    const selected = students.find(s => s.id === id); if (!selected || !token) return;
    setWriting(null); setHints({}); setStory(""); setRecords([]); setQIndex(0); setQResult(null); setQSelected(""); setPage("today");
    setStudent(selected); localStorage.setItem(STORE, JSON.stringify({ token, email, studentId: selected.id }));
    try { await refreshStudentData(token, selected); } catch (e) { fail(e); }
  };

  useEffect(() => {
    if (page === "review" && token && student && !writing) {
      api<Writing[]>(`/students/${student.id}/writings`, {}, token).then(items => setWriting(items[0] ?? null)).catch(fail);
    }
  }, [page, token, student, writing, fail]);

  const submitQuestion = async () => {
    if (!token || !student || !questions[qIndex] || !qSelected) return;
    if (offlineQuestions) {
      const correct = questions[qIndex].answer === qSelected;
      setQResult({ correct, message: correct ? "정답이에요! 다음 문장도 풀어봐요." : "거의 맞았어요. 다른 단어를 골라봐요.", answer: correct ? qSelected : null });
      if (correct) setQuestions(items => items.map((item, index) => index === qIndex ? { ...item, correct: true } : item));
      return;
    }
    setBusy(true); setError("");
    try {
      const result = await api<AttemptResult>(`/questions/${questions[qIndex].id}/attempt`, { method: "POST", body: JSON.stringify({ studentId: student.id, answer: qSelected }) }, token);
      setQResult(result); if (result.correct) await refreshStudentData(token, student);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const nextQuestion = () => {
    if (qIndex >= questions.length - 1) { setPage("write"); setQIndex(0); setQResult(null); setQSelected(""); notify("문제를 마쳤어요! 다음은 나의 이야기를 쓰는 시간이에요."); return; }
    setQIndex(n => n + 1); setQResult(null); setQSelected("");
  };

  const analyzeWriting = async () => {
    if (!token || !student || !story.trim()) { setError("한 문장만 적어도 좋아요."); return; }
    setBusy(true); setError("");
    try {
      const result = await api<Writing>(`/students/${student.id}/writings`, { method: "POST", body: JSON.stringify({ text: story }) }, token);
      setWriting(result); setHints({}); setPage("review"); setStory(""); notify("내 글에서 다음 복습 학습을 만들었어요!"); await refreshStudentData(token, student);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const submitRewrite = async (errorItem: WritingError, input: HTMLInputElement) => {
    if (!token || !writing) return; setBusy(true);
    try {
      const result = await api<AttemptResult>(`/writing-errors/${errorItem.id}/attempt`, { method: "POST", body: JSON.stringify({ answer: input.value }) }, token);
      setWriting(w => w ? { ...w, errors: w.errors.map(e => e.id === errorItem.id ? { ...e, attemptCount: result.attemptCount ?? e.attemptCount + 1, solved: result.correct } : e) } : w);
      if (result.correct) { notify("정답이에요! 스스로 잘 찾아냈어요"); if (student) await refreshStudentData(token, student); } else notify("거의 맞았어요. 힌트를 보고 다시 해봐요!");
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const showHint = async (item: WritingError) => {
    if (!token) return; setBusy(true);
    try {
      const result = await api<{ level: number; hint: string }>(`/writing-errors/${item.id}/hint`, { method: "POST", body: "{}" }, token);
      setHints(h => ({ ...h, [item.id]: result.hint }));
      setWriting(w => w ? { ...w, errors: w.errors.map(e => e.id === item.id ? { ...e, hintLevelUsed: result.level } : e) } : w);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const renderAddStudent = () => <div className="content"><div className="section-head"><div><h1>탐정 프로필 만들기</h1><p>아이의 이름과 학년만 적어주세요.</p></div><span className="qcategory">학생 등록</span></div><form className="panel" onSubmit={createStudent} style={{ maxWidth: 520, marginInline: "auto" }}><label className="field-label">이름<input className="field-input" name="name" required maxLength={40} placeholder="민수" /></label><label className="field-label">학년<select className="field-input" name="grade" defaultValue="2"><option value="1">초등학교 1학년</option><option value="2">초등학교 2학년</option><option value="3">초등학교 3학년</option></select></label><label className="field-label">별명 <span className="muted">(선택)</span><input className="field-input" name="nickname" maxLength={40} placeholder="꼬마 탐정" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn" disabled={busy}>{busy ? "저장 중…" : "프로필 저장"}</button></form></div>;

  const openReview = async (id: string) => {
    if (!token) return;
    setBusy(true); setError("");
    try { setWriting(await api<Writing>(`/writings/${id}`, {}, token)); setHints({}); setPage("review"); }
    catch (e) { fail(e); } finally { setBusy(false); }
  };
  const renderToday = () => <LearningNotebook key={student?.id} records={records}
    onQuestions={() => { setQIndex(Math.max(0, questions.findIndex(q => !q.correct))); setQResult(null); setQSelected(""); setPage("questions"); }}
    onWrite={() => { setStory(""); setPage("write"); }} />;

  const renderQuestions = () => { const q=questions[qIndex]; return <div className="content"><div className="section-head"><div><h1>빈칸에 알맞은 말을 찾아봐요.</h1><p>문장을 읽고 빠진 단어를 골라요.</p></div><span className="qcategory">단어 찾기</span></div>{offlineQuestions&&<p className="offline-note">연결이 불안정해 임시 문제를 보여줘요. 기록은 저장되지 않아요.</p>}{!q ? <div className="panel">문제를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.</div> : <div className="question-card"><div className="qtop"><span>문제 {qIndex+1} / {questions.length}</span><span>{categoryNames[q.category] ?? q.category}</span></div><div className="qprogress"><span style={{ width: `${(qIndex+1)/questions.length*100}%` }} /></div><div className="qcategory">문장 속 빈칸을 채워요</div><div className="question">{<QuestionPrompt prompt={q.prompt} selected={qSelected} />}</div><div className="choices">{q.choices.map((choice, index) => <button key={choice} className={`choice ${qSelected===choice?"selected":""} ${qResult?.correct&&qSelected===choice?"correct":""}`} onClick={() => !qResult&&setQSelected(choice)} disabled={!!qResult}><span className="choice-letter">{String(index+1).padStart(2,"0")}</span>{choice}</button>)}</div>{qResult&&<div className="feedback">{qResult.message}</div>}<div className="row-actions"><button className="btn secondary" onClick={() => setPage("today")}>나중에 하기</button>{qResult && !qResult.correct ? <button className="btn" onClick={() => { setQResult(null); setQSelected(""); }}>다시 도전</button> : qResult ? <button className="btn" onClick={nextQuestion}>{qIndex===questions.length-1?"다음 학습 · 글쓰기":"다음 문제"}</button> : <button className="btn" disabled={!qSelected||busy} onClick={submitQuestion}>{busy?"확인 중…":"정답 확인"}</button>}</div></div>}</div>; };

  const renderWrite = () => <div className="content"><div className="section-head"><div><h1>오늘의 이야기를 남겨요.</h1><p>오늘 있었던 일, 좋아하는 것… 무엇이든 써봐요.</p></div><span className="qcategory">글감 자유</span></div><div className="panel writing-paper"><div className="paper-meta"><span>탐정의 관찰 일지</span><span>자유 기록</span></div><label htmlFor="story" style={{ fontSize: 18, fontWeight: 800 }}>나의 이야기</label><textarea id="story" className="textarea" maxLength={5000} value={story} onChange={e=>setStory(e.target.value)} placeholder="오늘 어떤 일이 있었나요? 생각나는 대로 써봐요!" /><div className="write-tools"><span>{story.length}자 · 짧은 글도 좋아요</span><button className="example-btn" onClick={() => setStory("오늘 친구랑 가치 놀았다. 집에와서 밥을 먹었다.")}>예시 문장 넣기</button></div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="row-actions"><button className="btn secondary" onClick={() => setPage("today")}>돌아가기</button><button className="btn" onClick={analyzeWriting} disabled={busy}>{busy?"단서를 찾고 있어요…":"단서 찾기"}</button></div></div></div>;

  const renderReview = () => { const list=writing?.errors??[]; return <div className="content"><div className="section-head"><div><h1>다시 보면, 보이는 것들.</h1><p>정답을 먼저 알려주지 않을게요. 직접 다시 써봐요!</p></div><span className="qcategory">{list.filter(e=>e.solved).length} / {list.length} 해결</span></div>{!writing?<div className="panel">최근 글을 불러오지 못했어요. 자유 글쓰기에서 다시 시작해 주세요.</div>:<><div className="panel"><div style={{fontSize:17,lineHeight:1.9,whiteSpace:"pre-wrap"}}>{writing.text}</div></div>{list.length ? <div className="error-list">{list.map(item=><div className="error-item" key={item.id}><span className="qcategory">{categoryNames[item.category]??item.category}</span><p style={{fontSize:17,fontWeight:800,margin:"13px 0"}}>“{item.original}” 부분을 다시 생각해 써볼까요?</p>{item.solved?<div className="feedback">잘 고쳤어요! 직접 단서를 찾았네요</div>:<><div className="answer-row"><input id={`answer-${item.id}`} placeholder="바르게 고쳐 써보기" aria-label={`${item.original} 고쳐 쓰기`} /><button className="btn small" disabled={busy} onClick={e=>{const input=document.getElementById(`answer-${item.id}`) as HTMLInputElement|null;if(input)submitRewrite(item,input);}}>확인</button><button className="btn small secondary" disabled={busy} onClick={()=>showHint(item)}>힌트 보기</button></div>{hints[item.id]&&<div className="hint-box">힌트 — {hints[item.id]}</div>}<div className="muted" style={{marginTop:8}}>다시 도전 {item.attemptCount}회 · 힌트 {item.hintLevelUsed}단계</div></>}</div>)}</div>:<div className="panel" style={{textAlign:"center"}}><div className="completion-seal">확인 완료</div><h2>찾을 단서가 없어요!</h2><p>글을 멋지게 썼네요. 다음에도 편하게 써봐요.</p></div>}<div className="row-actions"><button className="btn secondary" onClick={()=>setPage("write")}>다음 학습 만들기</button><button className="btn green" onClick={async()=>{if(token&&student)try{await refreshStudentData(token,student);}catch{}setPage("today");notify("오늘의 탐정 활동을 기록했어요!");}}>{list.every(e=>e.solved)?"복습 마치고 노트로":"저장하고 나중에 이어하기"}</button></div></>}</div>; };

  if (loading) return <main><div className="content panel">한글탐정대를 준비하고 있어요…</div></main>;
  if (!token) return <><header className="top"><div className="brand"><span className="mark" />한글탐정대</div></header><main><div className="panel" style={{maxWidth:560,margin:"70px auto",textAlign:"center"}}><div className="connection-mark"><DetectiveMark /></div><h1>탐정 본부에 연결할 수 없어요</h1><p className="muted">백엔드 서버가 실행 중인지 확인한 뒤 다시 시도해 주세요.</p>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn" onClick={()=>window.location.reload()}>다시 연결</button></div></main></>;
  if (!student) return <><header className="top"><div className="brand"><span className="mark" />한글탐정대</div></header><main>{renderAddStudent()}</main></>;
  const menuItems: { id: Page; icon: string; label: string; group?: string }[] = [
    { id: "today", icon: "today", label: "나의 학습" },
    { id: "quests", icon: "quests", label: "퀘스트" },
    { id: "ranking", icon: "ranking", label: "랭킹" },
    { id: "review", icon: "review", label: "복습" },
  ];
  const navigate = (target: Page) => {
    if (target === "questions") { setQIndex(Math.max(0, questions.findIndex(q => !q.correct))); setQResult(null); setQSelected(""); }
    setPage(target); setSidebarOpen(false);
  };
  const renderQuests = () => <div className="content"><div className="section-head"><div><h1>오늘의 퀘스트</h1><p>두 가지 단서를 찾아요.</p></div></div><div className="quest-list"><button onClick={() => navigate("questions")}><span>01</span><b>문장 속 빈칸 채우기</b><small>{daily.questionsDone ? "완료" : "5문제"}</small></button><button onClick={() => navigate("write")}><span>02</span><b>탐정의 관찰 일지</b><small>{daily.writingDone ? "완료" : "글쓰기"}</small></button></div></div>;
  const renderRanking = () => { const doneDays = records.filter(r => r.questionsSolved >= 5 && r.writingCount > 0).length; return <div className="content"><div className="section-head"><div><h1>탐정 랭킹</h1><p>나의 기록을 모아봐요.</p></div></div><div className="ranking-card"><span>나의 수사 기록</span><strong>{doneDays}<small>일</small></strong><p>두 미션을 모두 마친 날</p><div className="ranking-stamp">{doneDays >= 7 ? "베테랑 탐정" : doneDays >= 3 ? "수습 탐정" : "새싹 탐정"}</div></div></div>; };
  return <div className="app-layout">
    {sidebarOpen && <button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <button className="sidebar-brand" onClick={() => navigate("today")} aria-label="한글탐정대 홈으로">
        <span className="brand-mark"><DetectiveMark /></span><span>한글탐정대</span>
      </button>
      <div className="sidebar-student"><span className="sidebar-avatar">{student.name.slice(0,1)}</span><span><b>{student.name} 탐정</b><small>초등학교 {student.grade}학년</small></span><span className="student-star">대원증</span></div>
      <nav className="side-nav" aria-label="주요 메뉴">
        {menuItems.map(item => <div key={item.id}>
          {item.group && <div className="nav-group-label">{item.group}</div>}
          <button className={`side-nav-item ${page === item.id || (item.id === "today" && page === "home") ? "active" : ""}`} onClick={() => navigate(item.id)} aria-current={page === item.id ? "page" : undefined}>
            <span className="side-nav-icon" aria-hidden="true"><NavIcon name={item.id} /></span><span>{item.label}</span>{item.id === "today" && daily.questionsDone && daily.writingDone && <span className="nav-check">✓</span>}
          </button>
        </div>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><small>탐정의 약속 · 01</small><p>틀린 글자에도<br />발견할 것이 있어요.</p><span>천천히, 내 힘으로.</span></div><div className="sidebar-local-note"><span>↳</span><span><b>탐정의 기록을 차곡차곡</b><small>로그인 없이 바로 이용해요</small></span></div></div>
    </aside>
    <div className="app-main-column">
      <header className="app-topbar"><button className="mobile-menu-button" aria-label="메뉴 열기" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(v => !v)}>☰</button><div className="mobile-brand"><span className="mark" />한글탐정대</div><div className="topbar-title"><span className="breadcrumb">한글탐정대</span><span className="breadcrumb-slash">/</span> {menuItems.find(item => item.id === page)?.label ?? "나의 학습"}</div><div className="topbar-right">{students.length > 1 && <label className="topbar-student">탐정<select aria-label="탐정 선택" value={student.id} onChange={e => switchStudent(e.target.value)}>{students.map(s => <option key={s.id} value={s.id}>{s.name} · 초{s.grade}</option>)}</select></label>}<span className="topbar-streak">오늘의 미션 {Number(daily.questionsDone)+Number(daily.writingDone)} / 2 완료</span></div></header>
      <main className="app-main-content">{page === "addStudent" ? renderAddStudent() : page === "home" ? renderToday() : page === "today" ? renderToday() : page === "questions" ? renderQuestions() : page === "write" ? renderWrite() : page === "quests" ? renderQuests() : page === "ranking" ? renderRanking() : renderReview()}</main>
    </div>{toast && <div className="toast" role="status">{toast}</div>}{error && token && <div className="toast error-toast" role="alert" onClick={() => setError("")}>{error}　×</div>}
  </div>;
}
