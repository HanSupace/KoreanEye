"use client";
import Image from "next/image";
import { containsProfanity, profanityTitle, profanityMessage } from "@/lib/profanity";
import LoadingIndicator from "./loading-indicator";
import ActivityModal from "./activity-modal";
import WritingReviewList from "./writing-review-list";
import WeeklyReport from "./weekly-report";
import { Quests, Ranking } from "./activity-panels";
import { NavIcon } from "./detective-art";

import LearningNotebook, { DayRecord } from "./learning-notebook";
import HandwritingPad, { InputMode, InputModePicker } from "./handwriting-pad";
import HandwritingConfirmation from "./handwriting-confirmation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, Question, QuestionReviewChapter, QuestionReviewItem, Student, Writing, WritingError } from "@/lib/api";

type Page = "weeklyReport" | "home" | "today" | "questions" | "write" | "writingResult" | "review" | "quests" | "ranking" | "addStudent" | "mypage";
type AuthResult = { token: string; username: string; expiresAt: string };
type AttemptResult = { correct: boolean; message: string; answer?: string | null; correctExpression?: string | null; attemptCount?: number };
type Daily = { questionsDone: boolean; writingDone: boolean; reviewDone: boolean; completedCount: number };
type LearningProgress = { chapterNumber: number; remaining: number; total: number };

const STORE = "hangul-detective-session";
const STUDENT_DATA_CACHE_TTL_MS = 15_000;
const categoryNames: Record<string, string> = { SPACING: "띄어쓰기", FINAL_CONSONANT: "받침", DOE_DWAE: "돼 / 되", AN_ANH: "안 / 않", PRONUNCIATION_SPELLING: "맞춤법", VOCABULARY: "낱말", PARTICLE: "조사", PUNCTUATION: "문장 부호", CHARACTER_OMISSION: "글자 빠뜨림", CHARACTER_CONFUSION: "글자 혼동", GRAMMAR_EXPRESSION: "문법·표현", OTHER: "기타" };

function QuestionPrompt({ prompt, selected }: { prompt: string; selected: string }) {
  const parts = prompt.split("___");
  return <>{parts.map((part, index) => {
    const sharedEnding = index > 0 ? part.match(/^[가-힣]+/)?.[0] ?? "" : "";
    const visiblePart = sharedEnding && selected.endsWith(sharedEnding) ? part.slice(sharedEnding.length) : part;
    return <span key={index}>{visiblePart}{index < parts.length - 1 && <span className={`answer-blank ${selected ? "filled" : ""}`}>{selected || "　　"}</span>}</span>;
  })}</>;
}

function speakKorean(text: string) {
  if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = "ko-KR";
  utterance.rate = 0.92;
  utterance.pitch = 1;
  const koreanVoices = window.speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith("ko"));
  utterance.voice = koreanVoices.find(voice => /natural|neural|google.*한국|google.*korean|sunhi|inhoon|heami/i.test(voice.name))
    ?? koreanVoices.find(voice => voice.localService)
    ?? koreanVoices[0]
    ?? null;
  window.speechSynthesis.speak(utterance);
}

function QuestionExercise({ question, index, total, selected, onSelect, result, offline, busy, onSubmit, onNext, onLater, inputMode, onInputMode, onRecognize, onRecognized }: {
  question?: Question; index: number; total: number; selected: string; onSelect: (value: string) => void;
  result: AttemptResult | null; offline: boolean; busy: boolean; onSubmit: () => void; onNext: () => void;
  onLater: () => void; inputMode: InputMode; onInputMode: (mode: InputMode) => void; onRecognize: (image: string) => Promise<string>; onRecognized: (text: string) => void;
}) {
  const listening = question?.questionType === "LISTEN_AND_TYPE";
  return <div className="content">
    <div className="section-head"><div><h1>{listening ? "잘 듣고 단어를 써봐요." : "빈칸에 알맞은 말을 찾아봐요."}</h1><p>{listening ? "들리는 단어를 적어요." : "문장을 읽고 빠진 단어를 골라요."}</p></div><span className="qcategory">{listening ? "듣고 쓰기" : "단어 찾기"}</span></div>
    {offline && <p className="offline-note">연결이 불안정해 임시 문제를 보여줘요. 기록은 저장되지 않아요.</p>}
    {!question ? <div className="panel">문제를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.</div> : <div className="question-card">
      <div className="qtop"><span>문제 {index + 1} / {total}</span><span>{categoryNames[question.category] ?? question.category}</span></div>
      <div className="qprogress"><span style={{ width: `${total ? (index + 1) / total * 100 : 0}%` }} /></div>
      <div className="qcategory">{listening ? "단어를 듣고 그대로 적어요" : "문장 속 빈칸을 채워요"}</div>
      <div className="question"><QuestionPrompt prompt={question.prompt} selected={selected} /></div>
      {listening ? <div className="dictation-answer">
        <button type="button" className="listen-button" onClick={() => speakKorean(question.audioText ?? "")} aria-label="단어 다시 듣기">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          단어 다시 듣기
        </button>
        <InputModePicker value={inputMode} onChange={onInputMode} label="받아쓰기 입력 방식" />
        {inputMode === "HANDWRITING" ? <>{selected && <div className="recognized-text">읽은 글씨: <b>{selected}</b></div>}<HandwritingPad onRecognize={onRecognize} onRecognized={text => onRecognized(text.replace(/\s+/g, "").trim())} disabled={!!result || busy} /></> : <input className={`field-input dictation-input ${result && !result.correct ? "is-incorrect" : result?.correct ? "is-correct" : ""}`} value={selected} onChange={event => onSelect(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && selected.trim() && !result && !busy) onSubmit(); }} disabled={!!result} autoComplete="off" autoCapitalize="off" aria-label="들은 단어 입력" placeholder="들은 단어를 써보세요" />}
      </div> : <div className="choices">{question.choices.map((choice, choiceIndex) => <button key={choice} className={`choice ${selected === choice ? "selected" : ""} ${result?.correct && selected === choice ? "correct" : ""} ${result && !result.correct && selected === choice ? "incorrect" : ""}`} onClick={() => !result && onSelect(choice)} disabled={!!result}><span className="choice-letter">{String(choiceIndex + 1).padStart(2, "0")}</span>{choice}</button>)}</div>}
      {result && <div className={`feedback ${result.correct ? "" : "incorrect"}`}>{result.message}</div>}
      <div className="row-actions question-actions">{!result && <button className="btn secondary" onClick={onLater} disabled={busy}>건너뛰기</button>}{result ? <button className="btn" onClick={onNext}>{index === total - 1 ? "결과 보기" : "다음 문제"}</button> : <button className="btn" disabled={!selected.trim() || busy} onClick={() => onSubmit()}>{busy ? "확인 중…" : "정답 확인"}</button>}</div>
    </div>}
  </div>;
}

export default function AppShell() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentLoadError, setStudentLoadError] = useState(false);
  const dataRequest = useRef(0);
  const studentDataCache = useRef<{ key: string; expiresAt: number } | null>(null);
  const sessionRequest = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const questionRequest = useRef(false);
  const answerRequest = useRef(false);
  const activeStudent = useRef<string | null>(null);
  activeStudent.current = token ? student?.id ?? null : null;
  const [detailStatus, setDetailStatus] = useState({ daily: "loading", review: "loading" });
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [daily, setDaily] = useState<Daily>({ questionsDone: false, writingDone: false, reviewDone: false, completedCount: 0 });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionReviewChapters, setQuestionReviewChapters] = useState<QuestionReviewChapter[]>([]);
  const [reviewSelections, setReviewSelections] = useState<Record<string, string>>({});
  const [reviewResults, setReviewResults] = useState<Record<string, AttemptResult>>({});
  const [offlineQuestions, setOfflineQuestions] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [qSelected, setQSelected] = useState("");
  const [qResult, setQResult] = useState<AttemptResult | null>(null);
  const [story, setStory] = useState("");
  const [handwritingConfirmation, setHandwritingConfirmation] = useState<{ kind: "dictation" | "writing"; text: string } | null>(null);
  const [writing, setWriting] = useState<Writing | null>(null);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [preferredInputMode, setPreferredInputMode] = useState<InputMode>("TYPE");
  const [writingInputMode, setWritingInputMode] = useState<InputMode>("TYPE");
  const [dictationInputMode, setDictationInputMode] = useState<InputMode>("TYPE");
  const [editingProfile, setEditingProfile] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountError, setAccountError] = useState("");

  const [modal, setModal] = useState<{ kind: "loading" | "success" | "failure" | "error"; title: string; message?: string; retry?: () => void; action?: { label: string; run: () => void } } | null>(null);
  const [learningProgress, setLearningProgress] = useState<LearningProgress | null>(null);
  const [chapterTotal, setChapterTotal] = useState(10);
  const [chapterCorrectCount, setChapterCorrectCount] = useState(0);
  const [firstPass, setFirstPass] = useState(true);
  const writingRequest = useRef(false);
  const skipRequest = useRef(false);
  const rewriteRequest = useRef(false);
  const reviewRequest = useRef(false);
  const hintRequest = useRef(false);
  const openReviewRequest = useRef(false);
  const refreshRequest = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const activityScope = useRef({ token, studentId: student?.id, page });
  if (activityScope.current.token !== token || activityScope.current.studentId !== student?.id || activityScope.current.page !== page) {
    activityScope.current = { token, studentId: student?.id, page };
  }
  useEffect(() => () => {
    activityScope.current = { ...activityScope.current };
    setHandwritingConfirmation(null);
    setModal(null); setBusy(false);
  }, [token, student?.id, page]);
  const modalError = (e: unknown, retry: () => void) => setModal({ kind: "error", title: "잠시 문제가 생겼어요", message: e instanceof Error ? e.message : "연결을 확인하고 다시 시도해 주세요.", retry });

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!token || !student) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setAccountError("");
    try {
      const updated = await api<Student>(`/students/${student.id}`, { method: "PUT", body: JSON.stringify({ name: String(form.get("name")).trim(), grade: Number(form.get("grade")), nickname: String(form.get("nickname") ?? "").trim() }) }, token);
      setStudent(updated); setStudents(list => list.map(item => item.id === updated.id ? updated : item));
      setEditingProfile(false); notify("회원정보를 저장했어요.");
    } catch (e) { setAccountError(e instanceof Error ? e.message : "회원정보를 저장하지 못했어요."); }
    finally { setBusy(false); }
  };

  const deleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!token) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setAccountError("");
    try {
      await api<void>("/account", { method: "DELETE", body: JSON.stringify({ password: form.get("password") }) }, token);
      logout(); notify("회원탈퇴가 완료되었어요.");
    } catch (e) { setAccountError(e instanceof Error ? e.message : "회원탈퇴를 처리하지 못했어요."); }
    finally { setBusy(false); }
  };

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const fail = useCallback((e: unknown) => setError(e instanceof ApiError ? e.message : "서버에 연결하지 못했어요. API와 데이터베이스 상태를 확인해 주세요."), []);

  const refreshStudentData = useCallback((currentToken: string, currentStudent: Student, force = false): Promise<void> => {
    const key = `${currentToken}:${currentStudent.id}`;
    if (!force && refreshRequest.current?.key === key) return refreshRequest.current.promise;
    if (!force && studentDataCache.current?.key === key && studentDataCache.current.expiresAt > Date.now()) return Promise.resolve();
    studentDataCache.current = null;
    const request = ++dataRequest.current;
    setStudentLoading(true); setStudentLoadError(false);
    setDetailStatus({ daily: "loading", review: "loading" });
    const current = () => request === dataRequest.current;
    let succeeded = true;
    const promise = Promise.all([
      api<Daily>(`/students/${currentStudent.id}/daily-learning`, {}, currentToken)
        .then(value => { if (current()) { setDaily(value); setDetailStatus(status => ({ ...status, daily: "ready" })); } })
        .catch(() => { succeeded = false; if (current()) setDetailStatus(status => ({ ...status, daily: "error" })); }),
      api<DayRecord[]>(`/students/${currentStudent.id}/learning-history`, {}, currentToken)
        .then(value => { if (current()) setRecords(value); })
        .catch(() => { succeeded = false; if (current()) setStudentLoadError(true); })
        .finally(() => { if (current()) setStudentLoading(false); }),
      api<QuestionReviewChapter[]>(`/students/${currentStudent.id}/question-reviews`, {}, currentToken)
        .then(value => { if (current()) { setQuestionReviewChapters(value); setDetailStatus(status => ({ ...status, review: "ready" })); } })
        .catch(() => { succeeded = false; if (current()) setDetailStatus(status => ({ ...status, review: "error" })); }),
      api<LearningProgress>(`/students/${currentStudent.id}/learning-progress`, {}, currentToken)
        .then(value => { if (current()) setLearningProgress(value); })
        .catch(() => { succeeded = false; if (current()) setLearningProgress(null); }),
    ]).then(() => {}).finally(() => {
      if (current() && succeeded) studentDataCache.current = { key, expiresAt: Date.now() + STUDENT_DATA_CACHE_TTL_MS };
      if (refreshRequest.current?.promise === promise) refreshRequest.current = null;
    });
    refreshRequest.current = { key, promise };
    return promise;
  }, []);

  const loadSession = useCallback((currentToken: string, currentUsername: string, savedStudentId?: string): Promise<void> => {
    if (sessionRequest.current?.key === currentToken) return sessionRequest.current.promise;
    let promise!: Promise<void>;
    promise = (async () => {
      const [list, preferences] = await Promise.all([
        api<Student[]>("/students", {}, currentToken),
        api<{ preferredInputMode: InputMode }>("/preferences", {}, currentToken).catch(() => ({ preferredInputMode: "TYPE" as InputMode })),
      ]);
      if (sessionRequest.current?.promise !== promise) return;
      setPreferredInputMode(preferences.preferredInputMode);
      setWritingInputMode(preferences.preferredInputMode);
      setDictationInputMode(preferences.preferredInputMode);
      setToken(currentToken); setUsername(currentUsername); setStudents(list);
      const selected = list.find(s => s.id === savedStudentId) ?? list[0] ?? null;
      setStudent(selected);
      if (selected) {
        setPage("today");
        localStorage.setItem(STORE, JSON.stringify({ token: currentToken, username: currentUsername, studentId: selected.id }));
        void refreshStudentData(currentToken, selected);
      } else {
        setPage("addStudent");
        localStorage.setItem(STORE, JSON.stringify({ token: currentToken, username: currentUsername }));
      }
    })();
    sessionRequest.current = { key: currentToken, promise };
    void promise.finally(() => { if (sessionRequest.current?.promise === promise) sessionRequest.current = null; }).catch(() => {});
    return promise;
  }, [refreshStudentData]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const saved = localStorage.getItem(STORE);
        if (saved) {
          let session: { token?: string; username?: string; email?: string; studentId?: string } | null = null;
          try { session = JSON.parse(saved); } catch { localStorage.removeItem(STORE); }
          const savedUsername = session?.username ?? session?.email ?? "";
          if (session?.token && !savedUsername.endsWith("@local.hangul")) {
            try { await loadSession(session.token, savedUsername, session.studentId); }
            catch (e) {
              if (e instanceof ApiError && e.status === 401) localStorage.removeItem(STORE);
              else throw e;
            }
          } else if (session) localStorage.removeItem(STORE);
        }
      } catch (e) {
        if (!cancelled) fail(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    initialize();
    return () => { cancelled = true; };
  }, [loadSession, fail]);

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const credentials = { username: String(form.get("username") ?? "").trim(), password: String(form.get("password") ?? "") };
    try {
      const result = await api<AuthResult>(`/auth/${authMode}`, { method: "POST", body: JSON.stringify(credentials) });
      await loadSession(result.token, result.username);
      notify(authMode === "signup" ? "탐정 계정을 만들었어요!" : "다시 만나 반가워요!");
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const logout = () => {
    setEditingProfile(false); setDeletingAccount(false); setAccountError(""); setStory(""); setHints({}); setQuestionReviewChapters([]); setReviewSelections({}); setReviewResults({}); setLearningProgress(null);
    dataRequest.current++; setStudentLoading(false); setStudentLoadError(false);
    refreshRequest.current = null; studentDataCache.current = null; sessionRequest.current = null;
    localStorage.removeItem(STORE); setToken(null); setUsername(""); setStudents([]); setStudent(null); setRecords([]); setQuestions([]); setWriting(null); setPreferredInputMode("TYPE"); setPage("home"); setError("");
  };

  const createStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!token) return; setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const created = await api<Student>("/students", { method: "POST", body: JSON.stringify({ name: form.get("name"), grade: Number(form.get("grade")), nickname: form.get("nickname") }) }, token);
      await loadSession(token, username, created.id); notify("탐정 프로필을 만들었어요!");
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const switchStudent = async (id: string) => {
    const selected = students.find(s => s.id === id); if (!selected || !token) return;
    setReviewSelections({}); setReviewResults({}); setLearningProgress(null);
    setWriting(null); setHints({}); setStory(""); setRecords([]); setQIndex(0); setQResult(null); setQSelected(""); setPage("today");
    setStudent(selected); localStorage.setItem(STORE, JSON.stringify({ token, username, studentId: selected.id }));
    try { await refreshStudentData(token, selected); } catch (e) { fail(e); }
  };

  const submitQuestion = async (answer: string) => {
    if (typeof answer !== "string" || !answer.trim()) return;
    if (!token || !student || !questions[qIndex] || qResult || busy || answerRequest.current) return;
    const currentQuestion = questions[qIndex];
    if (offlineQuestions) {
      const correct = currentQuestion.answer === answer;
      setHandwritingConfirmation(null);
      if (qSelected !== answer) setQSelected(answer);
      setQResult({ correct, message: correct ? "정답이에요! 다음 문장도 풀어봐요." : "거의 맞았어요. 다른 단어를 골라봐요.", answer: correct ? answer : null });
      if (correct) { setQuestions(items => items.map((item, index) => index === qIndex ? { ...item, correct: true } : item)); setChapterCorrectCount(count => count + 1); }
      if (qIndex >= questions.length - 1) showChapterSummary(chapterCorrectCount + (correct ? 1 : 0));
      return;
    }
    answerRequest.current = true; setBusy(true); setError("");
    const scope = activityScope.current;
    setModal({ kind: "loading", title: "정답을 확인하고 있어요..." });
    try {
      const result = await api<AttemptResult>(`/questions/${currentQuestion.id}/attempt`, { method: "POST", body: JSON.stringify({ studentId: student.id, answer }) }, token);
      studentDataCache.current = null;
      if (activityScope.current !== scope) return;
      setHandwritingConfirmation(null);
      if (qSelected !== answer) setQSelected(answer);
      setQResult(result);
      if (result.correct) {
        studentDataCache.current = null;
        setQuestions(items => items.map(item => item.id === currentQuestion.id ? { ...item, correct: true } : item));
        setChapterCorrectCount(count => count + 1);
      }
      if (qIndex >= questions.length - 1) {
        showChapterSummary(chapterCorrectCount + (result.correct ? 1 : 0));
      } else {
        setModal(result.correct ? { kind: "success", title: "정답이에요!", message: "멋지게 단서를 찾았어요!" } : { kind: "failure", title: "다시 도전해 봐요!", message: "조금만 더 생각해 볼까요?" });
      }
    } catch (e) { if (activityScope.current === scope) modalError(e, () => void submitQuestion(answer)); } finally { answerRequest.current = false; if (activityScope.current === scope) setBusy(false); }
  };

  const submitQuestionReview = async (item: QuestionReviewItem) => {
    if (!token || !reviewSelections[item.id] || item.solved || busy || reviewRequest.current) return;
    reviewRequest.current = true;
    const scope = activityScope.current;
    setBusy(true); setError("");
    try {
      const result = await api<AttemptResult>(`/question-reviews/${item.id}/attempt`, { method: "POST", body: JSON.stringify({ answer: reviewSelections[item.id] }) }, token);
      studentDataCache.current = null;
      if (activityScope.current !== scope) return;
      setReviewResults(current => ({ ...current, [item.id]: result }));
      setQuestionReviewChapters(chapters => chapters.map(chapter => ({
        ...chapter,
        questions: chapter.questions.map(question => question.id === item.id
          ? { ...question, reviewAttempts: question.reviewAttempts + 1, solved: result.correct }
          : question),
      })));
      if (result.correct && student) {
        const progress = await api<LearningProgress>(`/students/${student.id}/learning-progress`, {}, token);
        if (activityScope.current !== scope) return;
        setLearningProgress(progress);
        if (questionReviewChapters.some(chapter => chapter.chapterNumber < progress.chapterNumber && chapter.questions.some(question => question.id === item.id))) {
          setModal({ kind: "success", title: "챕터 완료!", message: "틀린 문제를 모두 해결했어요.", action: { label: "확인", run: () => { setModal(null); void refreshStudentData(token, student, true); } } });
        }
      }
    } catch (e) { if (activityScope.current === scope) fail(e); } finally { reviewRequest.current = false; if (activityScope.current === scope) setBusy(false); }
  };

  const showChapterSummary = (correctCount: number) => {
    const remaining = Math.max(0, chapterTotal - correctCount);
    if (remaining === 0) {
      setLearningProgress(current => current
        ? { ...current, chapterNumber: current.chapterNumber + 1, remaining: 10, total: 10 }
        : { chapterNumber: records.reduce((count, record) => count + (record.chaptersCompleted ?? 0), 0) + 2, remaining: 10, total: 10 });
    }
    setModal({ kind: remaining === 0 ? "success" : "failure", title: remaining === 0 ? "챕터 완료!" : "이번 학습 결과", message: firstPass
      ? `${chapterTotal}문제 중 ${correctCount}문제를 맞혔어요.${remaining ? ` ${remaining}문제 남았어요.` : ""}`
      : remaining ? `${remaining}문제 남았어요. 다시 누르면 남은 문제만 나와요.` : "틀린 문제를 모두 해결했어요.",
      action: { label: "오늘의 학습으로", run: () => { setModal(null); setPage("today"); setQIndex(0); setQResult(null); setQSelected(""); if (token && student) void refreshStudentData(token, student, true); } } });
  };

  const nextQuestion = () => {
    setModal(null);
    if (qIndex >= questions.length - 1) {
      showChapterSummary(chapterCorrectCount);
      return;
    }
    setQIndex(n => n + 1); setQResult(null); setQSelected("");
  };

  const skipQuestion = async () => {
    if (!token || !student || !questions[qIndex] || busy || skipRequest.current) return;
    if (offlineQuestions) { setError("복습 노트에 저장하려면 인터넷 연결이 필요해요."); return; }
    skipRequest.current = true; setBusy(true); setError("");
    const scope = activityScope.current;
    setModal({ kind: "loading", title: "복습 노트에 담고 있어요..." });
    try {
      await api<void>(`/questions/${questions[qIndex].id}/skip`, { method: "POST", body: JSON.stringify({ studentId: student.id }) }, token);
      studentDataCache.current = null;
      if (activityScope.current !== scope) return;
      notify("이 문제를 복습 노트에 담았어요.");
      nextQuestion();
    } catch (e) { if (activityScope.current === scope) modalError(e, skipQuestion); } finally { skipRequest.current = false; if (activityScope.current === scope) setBusy(false); }
  };

  const profanityBlocked = containsProfanity(story);
  const submitHandwritingConfirmation = () => {
    if (!handwritingConfirmation || busy) return;
    const { kind, text } = handwritingConfirmation;
    if (!text.trim()) return;
    setError("");
    if (kind === "dictation") {
      setQSelected(text);
      void submitQuestion(text);
    } else {
      setStory(text);
      if (containsProfanity(text)) { setError(profanityMessage); return; }
      void analyzeWriting(text);
    }
  };
  const rewriteHandwriting = () => {
    setHandwritingConfirmation(null);
    setError("");
  };
  const analyzeWriting = async (submittedStory = story) => {
    if (containsProfanity(submittedStory)) return;
    if (busy || writingRequest.current) return;
    if (!token || !student || !submittedStory.trim()) { setError("한 문장만 적어도 좋아요."); return; }
    const selectedId = student.id;
    const scope = activityScope.current;
    writingRequest.current = true;
    setBusy(true); setError("");
    setModal({ kind: "loading", title: "글 속 단서를 찾고 있어요..." });
    try {
      const result = await api<Writing>(`/students/${student.id}/writings`, { method: "POST", body: JSON.stringify({ text: submittedStory }) }, token);
      studentDataCache.current = null;
      if (activeStudent.current !== selectedId || activityScope.current !== scope) return;
      setHandwritingConfirmation(null);
      setStory("");
      setModal(null); setWriting(result); setHints({}); setPage("writingResult");
      void refreshStudentData(token, student, true);
    } catch (e) { if (activityScope.current === scope) modalError(e, () => void analyzeWriting(submittedStory)); } finally { writingRequest.current = false; if (activityScope.current === scope) setBusy(false); }
  };

  const recognizeHandwriting = async (image: string) => {
    if (!token) return "";
    const scope = activityScope.current;
    setHandwritingConfirmation(null);
    setError("");
    try {
      const result = await api<{ text: string }>("/ocr/recognize", { method: "POST", body: JSON.stringify({ image }) }, token);
      if (activityScope.current !== scope) return "";
      if (!result.text.trim()) { setError("글씨를 찾지 못했어요. 조금 더 크게 써서 다시 시도해 주세요."); return ""; }
      return result.text;
    } catch (e) { if (activityScope.current === scope) fail(e); return ""; }
  };

  const savePreferredInputMode = async (mode: InputMode) => {
    if (!token) return;
    setPreferredInputMode(mode);
    setWritingInputMode(mode); setDictationInputMode(mode);
    try { await api<{ preferredInputMode: InputMode }>("/preferences", { method: "PUT", body: JSON.stringify({ preferredInputMode: mode }) }, token); notify("기본 입력 방식을 저장했어요."); }
    catch (e) { fail(e); }
  };

  const submitRewrite = async (errorItem: WritingError, input: HTMLInputElement) => {
    if (!token || !writing || errorItem.solved || busy || rewriteRequest.current) return;
    rewriteRequest.current = true;
    const writingId = writing.id;
    const studentId = student?.id;
    const scope = activityScope.current;
    setBusy(true); setError("");
    setModal({ kind: "loading", title: "정답을 확인하고 있어요..." });
    try {
      const result = await api<AttemptResult>(`/writing-errors/${errorItem.id}/attempt`, { method: "POST", body: JSON.stringify({ answer: input.value }) }, token);
      studentDataCache.current = null;
      if (activeStudent.current !== studentId || activityScope.current !== scope) return;
      const applyResult = () => setWriting(w => w?.id === writingId ? { ...w, errors: w.errors.map(e => e.id === errorItem.id ? { ...e, attemptCount: result.attemptCount ?? e.attemptCount + 1, solved: result.correct } : e) } : w);
      if (result.correct) {
        setModal({ kind: "success", title: "정답이에요!", message: "복습을 완료했어요.", action: { label: "확인", run: () => {
          applyResult(); setModal(null);
          if (student) void refreshStudentData(token, student, true);
        } } });
      } else {
        applyResult();
        setModal({ kind: "failure", title: "다시 도전해 봐요!", message: "표현을 다시 생각해 보세요.", action: { label: "다시 풀기", run: () => { setModal(null); input.focus(); } } });
      }
    } catch (e) { if (activityScope.current === scope) modalError(e, () => void submitRewrite(errorItem, input)); }
    finally { rewriteRequest.current = false; if (activityScope.current === scope) setBusy(false); }
  };

  const showHint = async (item: WritingError) => {
    if (!token || busy || hintRequest.current) return;
    hintRequest.current = true;
    const scope = activityScope.current;
    setBusy(true);
    try {
      const result = await api<{ level: number; hint: string }>(`/writing-errors/${item.id}/hint`, { method: "POST", body: "{}" }, token);
      if (activityScope.current !== scope) return;
      setHints(h => ({ ...h, [item.id]: result.hint }));
      setWriting(w => w ? { ...w, errors: w.errors.map(e => e.id === item.id ? { ...e, hintLevelUsed: result.level } : e) } : w);
    } catch (e) { if (activityScope.current === scope) fail(e); } finally { hintRequest.current = false; if (activityScope.current === scope) setBusy(false); }
  };

  const renderAddStudent = () => <div className="content"><div className="section-head"><div><h1>탐정 프로필 만들기</h1><p>아이의 이름과 학년만 적어주세요.</p></div><button className="logout-button" onClick={logout}>로그아웃</button></div><form className="panel" onSubmit={createStudent} style={{ maxWidth: 520, marginInline: "auto" }}><label className="field-label">이름<input className="field-input" name="name" required maxLength={40} placeholder="민수" /></label><label className="field-label">학년<select className="field-input" name="grade" defaultValue="2"><option value="1">초등학교 1학년</option><option value="2">초등학교 2학년</option><option value="3">초등학교 3학년</option></select></label><label className="field-label">별명 <span className="muted">(선택)</span><input className="field-input" name="nickname" maxLength={40} placeholder="꼬마 탐정" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn" disabled={busy}>{busy ? "저장 중…" : "프로필 저장"}</button></form></div>;

  const renderAuth = () => <main className="auth-page"><div className="auth-card"><div className="auth-brand"><span className="auth-mark"><Image src="/logo-mark.png" alt="" width={52} height={58} priority /></span><span>한글탐정단</span></div><div className="auth-heading"><span className="auth-kicker">탐정 본부</span><h1>{authMode === "login" ? "다시 만나 반가워요" : "새 탐정 대원을 맞이해요"}</h1></div><div className="auth-tabs" role="tablist" aria-label="로그인 또는 회원가입"><button type="button" role="tab" aria-selected={authMode === "login"} className={authMode === "login" ? "selected" : ""} onClick={() => { setAuthMode("login"); setError(""); }}>로그인</button><button type="button" role="tab" aria-selected={authMode === "signup"} className={authMode === "signup" ? "selected" : ""} onClick={() => { setAuthMode("signup"); setError(""); }}>회원가입</button></div><form className="auth-form" onSubmit={authenticate}><label className="field-label">아이디<input className="field-input" type="text" name="username" autoComplete="username" required placeholder="사용할 아이디를 입력해 주세요" /></label><label className="field-label">비밀번호<input className="field-input" type="password" name="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} required placeholder="비밀번호를 입력해 주세요" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn auth-submit" disabled={busy}>{busy ? <LoadingIndicator message="확인하고 있어요…" /> : authMode === "login" ? "탐정 본부 들어가기" : "탐정 계정 만들기"}</button></form><p className="auth-footnote">학습 기록은 로그인한 탐정 계정에 안전하게 저장돼요.</p></div></main>;

  const openReview = async (id: string) => {
    if (!token || busy || openReviewRequest.current) return;
    openReviewRequest.current = true;
    const scope = activityScope.current;
    setBusy(true); setError("");
    try {
      const result = await api<Writing>(`/writings/${id}`, {}, token);
      if (activityScope.current !== scope) return;
      setWriting(result); setHints({}); setError(""); setPage("writingResult");
    }
    catch (e) { if (activityScope.current === scope) fail(e); } finally { openReviewRequest.current = false; if (activityScope.current === scope) setBusy(false); }
  };
  const startQuestions = async () => {
    if (!token || !student || questionRequest.current || busy) return;
    questionRequest.current = true;
    setModal({ kind: "loading", title: "단어 찾기를 준비하고 있어요..." });
    const selectedId = student.id;
    const scope = activityScope.current;
    setBusy(true); setError("");
    try {
      const chapterQuestions = await api<Question[]>(`/students/${student.id}/questions/today`, {}, token);
      if (activeStudent.current !== selectedId || activityScope.current !== scope) return;
      if (!chapterQuestions.length) throw new Error("Empty chapter");
      const untouched = chapterQuestions.filter(question => !question.attempted);
      const pending = chapterQuestions.filter(question => !question.correct);
      setModal(null); setQuestions(pending); setOfflineQuestions(false);
      setFirstPass(untouched.length > 0); setChapterTotal(chapterQuestions.length); setChapterCorrectCount(chapterQuestions.filter(question => question.correct).length);
      setQIndex(0); setQResult(null); setQSelected(""); setDictationInputMode(preferredInputMode); setPage("questions");
    } catch (e) { if (activityScope.current === scope) modalError(e, startQuestions); } finally { questionRequest.current = false; if (activityScope.current === scope) setBusy(false); }
  };
  const startWriting = () => {
    setStory(""); setWriting(null); setWritingInputMode(preferredInputMode); setPage("write"); setSidebarOpen(false); setError("");
  };
  const renderToday = () => <LearningNotebook key={student?.id} records={records} progress={learningProgress}
    onQuestions={startQuestions} onWeeklyReport={() => setPage("weeklyReport")} />;

  const renderQuestions = () => <QuestionExercise key={`${questions[qIndex]?.id ?? qIndex}:${qResult ? "submitted" : "draft"}`} question={questions[qIndex]} index={qIndex} total={questions.length} selected={qSelected} onSelect={setQSelected} result={qResult} offline={offlineQuestions} busy={busy} onSubmit={() => void submitQuestion(qSelected)} onNext={nextQuestion} onLater={skipQuestion} inputMode={dictationInputMode} onInputMode={setDictationInputMode} onRecognize={image => { setQSelected(""); return recognizeHandwriting(image); }} onRecognized={text => setHandwritingConfirmation({ kind: "dictation", text })} />;

  const renderWrite = () => <div className="content"><div className="section-head"><div><h1>오늘의 이야기를 남겨요.</h1><p>오늘 있었던 일, 좋아하는 것… 무엇이든 써봐요.</p></div><span className="qcategory">글감 자유</span></div><div className="panel writing-paper"><div className="paper-meta"><span>탐정의 관찰 일지</span><span>자유 기록</span></div><div className="writing-input-heading"><label htmlFor="story" style={{ fontSize: 18, fontWeight: 800 }}>나의 이야기</label><InputModePicker value={writingInputMode} onChange={setWritingInputMode} label="글쓰기 입력 방식" /></div>{writingInputMode === "HANDWRITING" ? <><HandwritingPad allowErasing onRecognize={recognizeHandwriting} onRecognized={text => setHandwritingConfirmation({ kind: "writing", text: text.slice(0, 5000) })} disabled={busy} />{story && <div className="recognized-text">인식한 글: <p>{story}</p></div>}</> : <textarea id="story" aria-invalid={profanityBlocked} aria-describedby={profanityBlocked ? "writing-language-warning" : undefined} className="textarea" maxLength={5000} value={story} onChange={e=>setStory(e.target.value)} placeholder="오늘 어떤 일이 있었나요? 생각나는 대로 써봐요!" />}<div className="write-tools"><span>{story.length}자 · 짧은 글도 좋아요</span><button className="example-btn" onClick={() => setStory("오늘 친구랑 가치 놀았다. 집에와서 밥을 먹었다.")}>예시 문장 넣기</button></div>{profanityBlocked && <div id="writing-language-warning" className="form-error" role="alert"><strong>{profanityTitle}</strong><p>{profanityMessage}</p></div>}{error&&<p className="form-error" role="alert">{error}</p>}<div className="row-actions"><button className="btn secondary" onClick={() => setPage("today")}>돌아가기</button><button className="btn" onClick={() => void analyzeWriting()} disabled={busy || profanityBlocked}>{busy?"단서를 찾고 있어요…":"단서 찾기"}</button></div></div></div>;

  const renderMyPage = () => <div className="content mypage">
    <div className="section-head"><div><h1>마이페이지</h1><p>내 정보와 학습 기록을 한곳에서 관리하세요.</p></div><button className="btn secondary" onClick={() => setPage("addStudent")}>탐정 추가</button></div>
    <section className="panel mypage-section" aria-labelledby="profile-heading">
      <h2 id="profile-heading">내 프로필</h2>
      <div className="mypage-profile">
        <span className="mypage-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg></span>
        <div className="mypage-identity"><h3>{student?.name}</h3><p>초등학교 {student?.grade}학년{student?.nickname ? ` · ${student.nickname}` : ""}</p><dl><div><dt>아이디</dt><dd>{username}</dd></div><div><dt>이메일</dt><dd>{username.includes("@") ? username : "등록된 이메일 없음"}</dd></div></dl></div>
        <button className="btn secondary" disabled={busy} aria-expanded={editingProfile} aria-controls="mypage-profile-form" onClick={() => { setEditingProfile(v => !v); setDeletingAccount(false); setAccountError(""); }}>회원정보 수정</button>
      </div>
      {editingProfile && <form id="mypage-profile-form" className="mypage-form" key={student?.id} onSubmit={saveProfile}>
        <p className="muted">현재 선택된 학습 프로필을 수정합니다. 로그인 아이디는 변경되지 않습니다.</p>
        <label className="field-label">이름<input className="field-input" name="name" defaultValue={student?.name} required pattern=".*\S.*" maxLength={40} disabled={busy} /></label>
        <label className="field-label">학년<select className="field-input" name="grade" defaultValue={student?.grade} disabled={busy}>{[1, 2, 3].map(grade => <option key={grade} value={grade}>초등학교 {grade}학년</option>)}</select></label>
        <label className="field-label">별명 (선택)<input className="field-input" name="nickname" defaultValue={student?.nickname ?? ""} maxLength={40} disabled={busy} /></label>
        {accountError && <p className="form-error" role="alert">{accountError}</p>}
        <div className="row-actions"><button type="button" className="btn secondary" disabled={busy} onClick={() => { setEditingProfile(false); setAccountError(""); }}>취소</button><button className="btn" disabled={busy}>{busy ? "저장 중…" : "저장"}</button></div>
      </form>}
    </section>
    <section className="panel mypage-section" aria-labelledby="learning-heading"><h2 id="learning-heading">나의 학습</h2>
      <div className="mypage-links"><button onClick={() => navigate("today")}><span><b>학습 기록</b><small>날짜별 학습 기록을 확인하세요.</small></span><span aria-hidden="true">›</span></button><button onClick={() => navigate("review")}><span><b>오답 및 복습</b><small>틀린 문제와 글쓰기를 다시 살펴보세요.</small></span><span aria-hidden="true">›</span></button></div>
    </section>
    <section className="panel mypage-section preference-card" aria-labelledby="input-heading"><h2 id="input-heading">기본 입력 방식</h2><p>글쓰기와 받아쓰기에서 먼저 사용할 방식을 선택하세요.</p><InputModePicker value={preferredInputMode} onChange={savePreferredInputMode} label="기본 입력 방식" /><div className="preference-detail"><b>{preferredInputMode === "TYPE" ? "타자로 입력" : "손글씨로 입력"}</b><span>{preferredInputMode === "TYPE" ? "화면 키보드나 연결한 키보드로 써요." : "손글씨를 Google Cloud Vision으로 읽어 텍스트로 바꿔요."}</span></div></section>
    <section className="panel mypage-section" aria-labelledby="account-heading"><h2 id="account-heading">계정 관리</h2>
      <div className="mypage-links"><button disabled={busy} onClick={logout}><span><b>로그아웃</b></span><span aria-hidden="true">›</span></button><button className="mypage-danger" disabled={busy} aria-expanded={deletingAccount} aria-controls="mypage-delete-form" onClick={() => { setDeletingAccount(v => !v); setEditingProfile(false); setAccountError(""); }}><span><b>회원탈퇴</b></span><span aria-hidden="true">›</span></button></div>
      {deletingAccount && <form id="mypage-delete-form" className="mypage-form" onSubmit={deleteAccount}><h3>정말 탈퇴하시겠어요?</h3><p>계정과 모든 학습 프로필, 글쓰기, 오답 및 학습 기록이 영구 삭제되며 복구할 수 없습니다.</p><label className="field-label">현재 비밀번호<input className="field-input" type="password" name="password" autoComplete="current-password" required disabled={busy} /></label><label className="mypage-confirm"><input type="checkbox" required disabled={busy} /> 모든 학습 기록 삭제와 회원탈퇴에 동의합니다.</label>{accountError && <p className="form-error" role="alert">{accountError}</p>}<div className="row-actions"><button type="button" className="btn secondary" disabled={busy} onClick={() => { setDeletingAccount(false); setAccountError(""); }}>취소</button><button className="btn mypage-delete-button" disabled={busy}>{busy ? "처리 중…" : "계정 영구 삭제"}</button></div></form>}
    </section>
  </div>;
  const renderWritingResult = () => <div className="content">
    <div className="section-head"><div><h1>글쓰기 분석 결과</h1><p>분석 결과를 확인하고 단서를 다시 써봐요.</p></div><span className="qcategory">단서 {writing?.errors.length ?? 0}개</span></div>
    {writing && <>
      <div className="panel"><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.9 }}>{writing.text}</p>
        <p className="muted">분석 결과와 오류 후보가 저장되었어요. 복습 노트에서 이어서 확인할 수 있어요.</p>
        {writing.analysisProvider === "rules" && <p className="offline-note">기본 규칙 검사 결과예요. 정해진 표현만 확인하므로 모든 맞춤법·문맥 오류를 찾지는 못해요.</p>}
      </div>
      {!writing.errors.length ? <div className="panel"><h2>이번 검사에서 찾은 단서가 없어요</h2><p>오류 후보는 0개예요. 검사에서 놓친 오류가 있을 수 있으니 글을 다시 읽어보세요.</p></div> : <div className="error-list">{writing.errors.map(item => <article className="error-item" key={item.id}>
        <span className="qcategory">{categoryNames[item.category] ?? item.category}</span>
        <p>{item.category === "GRAMMAR_EXPRESSION" ? "문장을 더 자연스럽게 바꿔볼까요?" : `“${item.original}” 부분을 다시 생각해 써볼까요?`}</p>
        {item.category === "GRAMMAR_EXPRESSION" && <div className="grammar-feedback"><b>추천 문장</b><p>{item.correct}</p><span>{item.explanation}</span></div>}
        {item.solved ? <div className="feedback">복습 완료 · 수정 표현: {item.correct}</div> : <>
          <div className="answer-row"><input id={`answer-${item.id}`} placeholder="바르게 고쳐 써보기" aria-label={`${item.original} 고쳐 쓰기`} /><button className="btn small" disabled={busy} onClick={() => { const input = document.getElementById(`answer-${item.id}`) as HTMLInputElement | null; if (input) void submitRewrite(item, input); }}>확인</button><button className="btn small secondary" disabled={busy} onClick={() => void showHint(item)}>힌트 보기</button></div>
          {hints[item.id] && <div className="hint-box">힌트 — {hints[item.id]}</div>}
          <p className="muted">다시 도전 {item.attemptCount}회 · 힌트 {item.hintLevelUsed}단계</p>
        </>}
      </article>)}</div>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="row-actions"><button className="btn secondary" disabled={busy} onClick={() => { setError(""); setPage("write"); }}>글 다시 보기</button><button className="btn" disabled={busy} onClick={() => setPage("review")}>복습 노트에서 확인</button></div>
  </div>;

  const renderReview = () => {
    const openQuestionReviews = questionReviewChapters.reduce((count, chapter) => count + chapter.questions.filter(question => !question.solved).length, 0);
    return <div className="content">
      <div className="section-head"><div><h1>복습 노트</h1><p>틀린 단어 문제를 챕터별로 다시 풀어봐요.</p></div><span className="qcategory">남은 문제 {openQuestionReviews}</span></div>
      <section className="review-chapters">
        <div className="archive-heading"><h2>빈칸 오답</h2><span>틀린 문제만 모았어요</span></div>
        {!questionReviewChapters.length ? <div className="panel review-empty">아직 모인 문제가 없어요. 틀리거나 건너뛴 문제는 이곳에 챕터별로 모여요.</div> : [...questionReviewChapters.reduce((groups, chapter) => {
          const group = groups.get(chapter.chapterNumber) ?? { chapterNumber: chapter.chapterNumber, questions: [] as QuestionReviewItem[] };
          group.questions.push(...chapter.questions); groups.set(chapter.chapterNumber, group); return groups;
        }, new Map<number, { chapterNumber: number; questions: QuestionReviewItem[] }>()).values()].sort((a, b) => a.chapterNumber - b.chapterNumber).map(chapter => <details className="panel review-chapter" key={chapter.chapterNumber}>
          <summary className="review-chapter-heading"><span className="review-chapter-title"><h3>챕터 {chapter.chapterNumber}</h3><small>복습 {chapter.questions.length}개</small></span><span className={`review-chapter-progress ${chapter.questions.every(question => question.solved) ? "is-complete" : ""}`}>{chapter.questions.every(question => question.solved) ? "✓ 완료" : `${chapter.questions.filter(question => question.solved).length} / ${chapter.questions.length} 완료`}</span><span className="review-chapter-chevron" aria-hidden="true">⌄</span></summary>
          <div className="error-list">{chapter.questions.map(item => {
            const result = reviewResults[item.id];
            return <div className="error-item review-question" key={item.id}>
              <span className="qcategory">{categoryNames[item.category] ?? item.category}</span>
              <p className="review-question-prompt"><QuestionPrompt prompt={item.prompt} selected={reviewSelections[item.id] ?? ""} /></p>
              {item.solved ? <div className="review-question-complete"><span aria-hidden="true">✓</span> 복습 완료</div> : <>
                {item.questionType === "LISTEN_AND_TYPE" ? <div className="dictation-answer">
                  <button type="button" className="listen-button" onClick={() => speakKorean(item.audioText ?? "")}>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    단어 다시 듣기
                  </button>
                  <InputModePicker value={dictationInputMode} onChange={setDictationInputMode} label="받아쓰기 복습 입력 방식" />
                  {dictationInputMode === "HANDWRITING" ? <>{reviewSelections[item.id] && <div className="recognized-text">읽은 글씨: <b>{reviewSelections[item.id]}</b></div>}<HandwritingPad onRecognize={async image => { const text = await recognizeHandwriting(image); if (text) setReviewSelections(current => ({ ...current, [item.id]: text.replace(/\s+/g, "").trim() })); return text; }} disabled={!!result || busy} /></> : <input className={`field-input dictation-input ${result && !result.correct ? "is-incorrect" : result?.correct ? "is-correct" : ""}`} value={reviewSelections[item.id] ?? ""} onChange={event => setReviewSelections(current => ({ ...current, [item.id]: event.target.value }))} disabled={!!result || busy} autoComplete="off" placeholder="들은 단어를 써보세요" aria-label="복습 단어 입력" />}
                </div> : <div className="choices">{item.choices.map((choice, index) => <button key={choice} className={`choice ${reviewSelections[item.id] === choice ? "selected" : ""} ${result && !result.correct && reviewSelections[item.id] === choice ? "incorrect" : ""}`} disabled={!!result || busy} onClick={() => setReviewSelections(current => ({ ...current, [item.id]: choice }))}><span className="choice-letter">{String(index + 1).padStart(2, "0")}</span>{choice}</button>)}</div>}
                {result && !result.correct && <div className="feedback incorrect">틀렸어요.</div>}
                {result?.correct && <div className="feedback">{result.message}</div>}
                <div className="row-actions">{result && !result.correct ? <button className="btn secondary" onClick={() => { setReviewSelections(current => ({ ...current, [item.id]: "" })); setReviewResults(current => { const next = { ...current }; delete next[item.id]; return next; }); }}>{item.questionType === "LISTEN_AND_TYPE" ? "다시 쓰기" : "다시 고르기"}</button> : <button className="btn" disabled={!reviewSelections[item.id]?.trim() || busy || !!result} onClick={() => submitQuestionReview(item)}>{busy ? "확인 중…" : "정답 확인"}</button>}{item.reviewAttempts > 0 && <span className="muted">복습 시도 {item.reviewAttempts}회</span>}</div>
              </>}
            </div>;
          })}</div>
        </details>)}
      </section>
      {token && student && <WritingReviewList key={student.id} token={token} studentId={student.id} categoryNames={categoryNames} onWrite={() => setPage("write")} /> }
    </div>;
  };
  if (loading) return <main><div className="content panel"><LoadingIndicator message="한글탐정단을 준비하고 있어요…" /></div></main>;
  if (!token) return renderAuth();
  if (!student) return <><header className="top"><div className="brand"><span className="mark"><Image src="/logo-mark.png" alt="" width={52} height={58} priority /></span>한글탐정단</div></header><main>{renderAddStudent()}</main></>;
  const menuItems: { id: Page; icon: string; label: string; group?: string; subitem?: boolean }[] = [
    { id: "today", icon: "today", label: "나의 학습" },
    { id: "write", icon: "write", label: "오늘의 글쓰기", subitem: true },
    { id: "quests", icon: "quests", label: "퀘스트" },
    { id: "ranking", icon: "ranking", label: "랭킹" },
    { id: "review", icon: "review", label: "복습" },
    { id: "weeklyReport", icon: "weeklyReport", label: "주간 리포트" },
    { id: "mypage", icon: "mypage", label: "마이페이지" },
  ];
  const navigate = (target: Page) => {
    if (target === "questions") { setQIndex(Math.max(0, questions.findIndex(q => !q.correct))); setQResult(null); setQSelected(""); }
    if (target === "write") { startWriting(); return; }
    if (["today", "home", "quests", "review"].includes(target) && token && student) void refreshStudentData(token, student);
    setPage(target); setSidebarOpen(false);
  };
  const pageDataLoading = page === "review" ? detailStatus.review === "loading" : studentLoading || (page === "quests" && detailStatus.daily === "loading");
  const pageDataError = page === "review" ? detailStatus.review === "error" : studentLoadError || (page === "quests" && detailStatus.daily === "error");
  const pageLoadingCopy = page === "quests"
    ? { title: "오늘의 퀘스트를 준비하고 있어요...", description: "도전할 미션을 확인하고 있어요." }
    : page === "review"
      ? { title: "복습 노트를 펼치고 있어요...", description: "다시 살펴볼 단서를 찾고 있어요." }
      : { title: "학습 단계를 준비하고 있어요...", description: "탐정의 학습 기록을 확인하고 있어요." };
  return <div className="app-layout">
    {sidebarOpen && <button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <button className="sidebar-brand" onClick={() => navigate("today")} aria-label="한글탐정단 홈으로">
        <span className="brand-mark"><Image src="/logo-mark.png" alt="" width={52} height={58} priority /></span><span>한글탐정단</span>
      </button>
      <div className="sidebar-student"><span className="sidebar-avatar">{student.name.slice(0,1)}</span><span><b>{student.name} 탐정</b><small>초등학교 {student.grade}학년</small></span><span className="student-star">대원증</span></div>
      <nav className="side-nav" aria-label="주요 메뉴">
        {menuItems.map(item => <div key={item.id}>
          {item.group && <div className="nav-group-label">{item.group}</div>}
          <button className={`side-nav-item ${item.subitem ? "side-nav-subitem" : ""} ${page === item.id || (item.id === "today" && page === "home") ? "active" : ""}`} onClick={() => navigate(item.id)} aria-current={page === item.id ? "page" : undefined}>
            <span className="side-nav-icon" aria-hidden="true"><NavIcon name={item.id} /></span><span>{item.label}</span>{item.id === "today" && daily.questionsDone && daily.writingDone && <span className="nav-check">✓</span>}{item.id === "write" && daily.writingDone && <span className="nav-check">✓</span>}
          </button>
        </div>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><small>탐정의 약속 · 01</small><p>틀린 글자에도<br />발견할 것이 있어요.</p><span>천천히, 내 힘으로.</span></div><div className="sidebar-local-note"><span>↳</span><span><b>탐정의 기록을 차곡차곡</b><small>나의 계정에 안전하게 저장해요</small></span></div></div>
    </aside>
    <div className="app-main-column">
      <header className="app-topbar"><button className="mobile-menu-button" aria-label="메뉴 열기" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(v => !v)}>☰</button><div className="mobile-brand"><span className="mark"><Image src="/logo-mark.png" alt="" width={52} height={58} priority /></span>한글탐정단</div><div className="topbar-title"><span className="breadcrumb">한글탐정단</span><span className="breadcrumb-slash">/</span> {menuItems.find(item => item.id === page)?.label ?? "나의 학습"}</div><div className="topbar-right">{students.length > 1 && <label className="topbar-student">탐정<select aria-label="탐정 선택" value={student.id} onChange={e => switchStudent(e.target.value)}>{students.map(s => <option key={s.id} value={s.id}>{s.name} · 초{s.grade}</option>)}</select></label>}<span className="topbar-streak">오늘의 미션 {Number(daily.questionsDone)+Number(daily.writingDone)} / 2 완료</span><button className="logout-button" onClick={logout} aria-label={`${username} 로그아웃`}>로그아웃</button></div></header>
      <main className="app-main-content">{pageDataLoading && ["home", "today", "quests", "review"].includes(page) ? <div className="learning-record-loading"><div className="panel"><LoadingIndicator message={pageLoadingCopy.title} /><p className="muted">{pageLoadingCopy.description}</p></div></div> : pageDataError && ["home", "today", "quests", "review"].includes(page) ? <div className="content panel" role="alert"><p>필요한 학습 기록을 불러오지 못했어요.</p><button className="btn" onClick={() => void refreshStudentData(token, student, true)}>다시 불러오기</button></div> : page === "addStudent" ? renderAddStudent() : page === "home" ? renderToday() : page === "today" ? renderToday() : page === "questions" ? renderQuestions() : page === "write" ? renderWrite() : page === "writingResult" ? renderWritingResult() : page === "quests" ? <Quests records={records} reviewDone={daily.reviewDone} onQuestions={startQuestions} onWrite={startWriting} onReview={() => setPage("review")} /> : page === "ranking" ? <Ranking token={token} selectedId={student.id} /> : page === "weeklyReport" ? <WeeklyReport key={`${token}:${student.id}`} token={token} studentId={student.id} onReview={() => navigate("review")} onContinueLearning={() => navigate("today")} /> : page === "mypage" ? renderMyPage() : renderReview()}</main>
    </div>{modal && <ActivityModal kind={modal.kind} title={modal.title} message={modal.message}>{modal.action ? <button className="btn" onClick={modal.action.run}>{modal.action.label}</button> : modal.kind === "success" ? <button className="btn" onClick={nextQuestion}>다음 문제</button> : modal.kind === "failure" ? <><button className="btn secondary" onClick={nextQuestion}>다음 문제</button><button className="btn" onClick={() => { setModal(null); setQResult(null); setQSelected(""); }}>다시하기</button></> : modal.kind === "error" ? <><button className="btn secondary" onClick={() => setModal(null)}>닫기</button><button className="btn" onClick={() => modal.retry?.()}>다시 시도</button></> : null}</ActivityModal>}{handwritingConfirmation && !busy && !modal && <HandwritingConfirmation text={handwritingConfirmation.text} submitting={busy} onChange={text => setHandwritingConfirmation(current => current ? { ...current, text } : current)} onSubmit={submitHandwritingConfirmation} onRewrite={rewriteHandwriting} />}{busy && !modal && <div className="busy-status"><LoadingIndicator message="처리하고 있어요…" /></div>}{toast && <div className="toast" role="status">{toast}</div>}{error && token && <div className="toast error-toast" role="alert" onClick={() => setError("")}>{error}　×</div>}
  </div>;
}
