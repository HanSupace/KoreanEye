"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DayRecord } from "./learning-notebook";
import LoadingIndicator from "./loading-indicator";

export function Quests({ records, reviewDone, onQuestions, onWrite, onReview }: {
  records: DayRecord[]; reviewDone: boolean; onQuestions: () => void; onWrite: () => void; onReview: () => void;
}) {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const record = records.find(item => item.date === today);
  const quests = [
    { title: "챕터 하나 끝내기", description: "단어 찾기 7개와 받아쓰기 3개에 도전해요. 건너뛴 문제는 복습 노트에 담겨요.", done: (record?.chaptersCompleted ?? 0) > 0, progress: Math.min(record?.questionsSolved ?? 0, 10), total: 10, action: onQuestions, label: "학습 시작" },
    { title: "오늘의 이야기 쓰기", description: "오늘 있었던 일을 한 문장 이상 남겨요.", done: (record?.writingCount ?? 0) > 0, progress: Math.min(record?.writingCount ?? 0, 1), total: 1, action: onWrite, label: "글쓰기" },
    { title: "내 글의 단서 해결하기", description: "오늘 쓴 글의 단서를 모두 고쳐요. 오류가 없는 글도 완료로 인정해요.", done: reviewDone, progress: reviewDone ? 1 : 0, total: 1, action: onReview, label: "복습하기" },
  ];
  const completed = quests.filter(item => item.done).length;
  return <div className="content"><div className="section-head"><div><h1>오늘의 퀘스트</h1><p>매일 자정, 한국 시간 기준으로 새로 시작해요.</p></div><span className="qcategory">{completed} / 3 완료</span></div>
    <div className="panel quest-summary"><b>{completed === 3 ? "오늘의 탐정 활동을 모두 마쳤어요!" : "작은 도전을 하나씩 완성해요."}</b><progress aria-label="오늘의 퀘스트 완료" value={completed} max={3} /></div>
    <div className="activity-quests">{quests.map((quest, index) => <section className={`panel activity-quest ${quest.done ? "is-done" : ""}`} key={quest.title}><span className="quest-number">{quest.done ? "✓" : `0${index + 1}`}</span><div><h2>{quest.title}</h2><p>{quest.description}</p><progress aria-label={`${quest.title} 진행률`} value={quest.done ? quest.total : quest.progress} max={quest.total} /><small>{quest.done ? "완료" : `${quest.progress} / ${quest.total}`}</small></div><button className="btn small secondary" onClick={quest.action}>{quest.done ? "더 연습하기" : quest.label}</button></section>)}</div></div>;
}

type RankingRow = { student: { id: string; nickname: string | null }; score: number; chapters: number; writings: number; days: number; rank: number };
export function Ranking({ token, selectedId }: { token: string; selectedId: string }) {
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api<RankingRow[]>(`/rankings?period=${period}&studentId=${selectedId}`, { signal: controller.signal }, token)
      .then(items => { if (!controller.signal.aborted) setRows(items); })
      .catch(() => { if (!controller.signal.aborted) setError("랭킹 기록을 불러오지 못했어요. 다시 시도해 주세요."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, selectedId, period, retry]);
  const myRow = rows.find(row => row.student.id === selectedId);
  const rankOf = (score: number) => rows.find(row => row.score === score)?.rank ?? 1;
  const podium = [2, 1, 3].map(rank => rows.find(row => row.rank === rank)).filter((row): row is RankingRow => !!row);
  return <div className="content"><div className="section-head"><div><h1>전체 탐정 랭킹</h1><p>다른 계정의 탐정들과 함께 도전해요.</p></div></div>
    <div className="ranking-period" role="group" aria-label="랭킹 기간"><button aria-pressed={period === "week"} onClick={() => setPeriod("week")}>최근 7일</button><button aria-pressed={period === "all"} onClick={() => setPeriod("all")}>전체 기록</button></div>
    <p className="muted">챕터 완료 100점 · 글쓰기 1편 30점 · 동점은 공동 순위</p>
    {loading ? <div className="panel"><LoadingIndicator message="탐정들의 기록을 모으고 있어요…" /></div> : error ? <div className="panel" role="alert"><p>{error}</p><button className="btn" onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></div> : <>
      {myRow && <section className="panel ranking-highlight" aria-label="나의 순위"><div className="ranking-me-summary"><span>나의 순위</span><strong>{rankOf(myRow.score)}위</strong><span>{myRow.score.toLocaleString()}점 · 활동 {myRow.days}일</span></div><div className="ranking-podium">{podium.map(row => <div key={row.student.id} className={`podium-place place-${row.rank} ${row.student.id === selectedId ? "is-me" : ""}`}><span className="podium-medal" aria-hidden="true">{row.rank === 1 ? "👑" : row.rank === 2 ? "🥈" : "🥉"}</span><b>{row.student.nickname || "이름 없음"}{row.student.id === selectedId && <small> 나</small>}</b><span>{row.score.toLocaleString()}점</span><strong>{row.rank}</strong></div>)}</div></section>}
      <div className="panel ranking-table-wrap"><table className="ranking-table"><caption>{period === "week" ? "최근 7일" : "전체"} 탐정 활동 순위</caption><thead><tr><th scope="col">순위</th><th scope="col">탐정</th><th scope="col">완료 챕터</th><th scope="col">글쓰기</th><th scope="col">점수</th></tr></thead><tbody>{rows.map(row => <tr key={row.student.id} className={row.student.id === selectedId ? "is-me" : ""}><td>{rankOf(row.score)}</td><th scope="row">{row.student.nickname || "이름 없음"}{row.student.id === selectedId && <small> 나</small>}</th><td>{row.chapters}</td><td>{row.writings}</td><td>{row.score.toLocaleString()}</td></tr>)}</tbody></table></div>
      {rows.every(row => row.score === 0) && <p className="panel">아직 점수가 없어요. 첫 챕터나 글쓰기를 완료해 보세요!</p>}{rows.length === 1 && <p className="muted">현재 등록된 탐정은 한 명이에요. 나의 활동 점수를 쌓아보세요.</p>}
    </>}
  </div>;
}
