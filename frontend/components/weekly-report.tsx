"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { currentSeoulWeek, formatReportDate, shiftDate, seoulReportDay, millisecondsUntilSeoulMidnight, weeklyLearningFeedback, weeklyLearningGoal, weeklyLearningReviewRecommendation, WeeklyLearningReport } from "@/lib/weekly-report";
import LoadingIndicator from "./loading-indicator";

function ReportIcon({ kind }: { kind: "calendar" | "book" | "up" | "down" | "neutral" | "search" }) {
  const paths = {
    calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Zm3 11 3 3 5-5",
    book: "M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z",
    up: "M5 17 19 3M7 3h12v12",
    down: "M5 7 19 21M7 21h12V9",
    neutral: "M5 12h14",
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  };
  return <svg className="weekly-report-icon" data-icon={kind} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

export default function WeeklyReport({ token, studentId, onReview, onContinueLearning }: {
  token: string; studentId: string;
  onReview: () => void; onContinueLearning: () => void;
}) {
  const [weekStart, setWeekStart] = useState(() => currentSeoulWeek(new Date()));
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; report?: WeeklyLearningReport; error?: string; goalScope?: string; goalDays?: number } | null>(null);
  const [today, setToday] = useState(() => seoulReportDay(new Date()).date);
  const continueNavigation = useRef(false);
  // Keep an open report correct across Seoul midnight, including sleeping tabs.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const date = seoulReportDay(new Date()).date;
      if (date !== today) {
        setToday(date);
        const previousWeek = currentSeoulWeek(new Date(`${today}T00:00:00+09:00`));
        const nextWeek = currentSeoulWeek(new Date(`${date}T00:00:00+09:00`));
        setWeekStart(value => value === previousWeek ? nextWeek : value);
      }
      setRetry(value => value + 1);
    };
    const timer = window.setTimeout(update, millisecondsUntilSeoulMidnight(new Date()));
    const onVisible = () => { if (document.visibilityState === "visible") update(); };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [today]);
  const key = JSON.stringify([token, studentId, weekStart, retry]);
  const goalScope = JSON.stringify([token, studentId, weekStart]);
  useEffect(() => {
    const controller = new AbortController();
    api<WeeklyLearningReport>(`/students/${studentId}/reports/weekly-learning?weekStart=${weekStart}`, { signal: controller.signal }, token)
      .then(report => { if (!controller.signal.aborted) setResult(previous => {
        // Keep this view's suggestion when refreshed records reach it; do not
        // move the goal again. This is transient UI state, never persisted.
        const goal = weeklyLearningGoal(report.learningDays, report.weekStart, new Date(), previous?.goalScope === goalScope ? previous.goalDays : undefined);
        return { key, report, goalScope, goalDays: goal.period === "current" ? goal.targetDays : undefined };
      }); })
      .catch(() => { if (!controller.signal.aborted) setResult(previous => ({ key, goalScope,
        goalDays: previous?.goalScope === goalScope ? previous.goalDays : undefined,
        error: "리포트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." })); });
    return () => controller.abort();
  }, [token, studentId, weekStart, key, goalScope]);
  const report = result?.key === key ? result.report : undefined;
  const error = result?.key === key ? result.error : undefined;
  const now = new Date(`${today}T00:00:00+09:00`);
  const currentWeek = currentSeoulWeek(now);
  const maxQuestions = Math.max(1, ...(report?.days.map(day => day.questions) ?? []));
  const difference = report && report.previousWeekActivityAvailable ? report.uniqueQuestions - report.previousWeekUniqueQuestions : null;
  const feedback = report ? weeklyLearningFeedback(report, now, result?.goalDays) : null;
  const goal = report ? weeklyLearningGoal(report.learningDays, report.weekStart, now, result?.goalDays) : null;
  const canContinueLearning = !!report && report.weekStart === currentWeek && goal?.period === "current";
  const continueLearning = () => {
    if (continueNavigation.current) return;
    continueNavigation.current = true;
    onContinueLearning();
  };
  const recommendation = report ? weeklyLearningReviewRecommendation(report) : "";

  return <div className="content weekly-report">
    <div className="section-head"><div><h1>이번 주 탐정 리포트</h1><p>이번 주에 어떤 단서를 찾았는지 살펴볼까요?</p></div></div>
    <div className="panel weekly-report-period" aria-label="조회 주간">
      <button type="button" className="btn small secondary" onClick={() => setWeekStart(value => shiftDate(value, -7))}>이전 주</button>
      <strong aria-live="polite">{formatReportDate(weekStart)} ~ {formatReportDate(shiftDate(weekStart, 6))}</strong>
      <button type="button" className="btn small secondary" disabled={shiftDate(weekStart, 7) > currentWeek} onClick={() => setWeekStart(value => {
        const next = shiftDate(value, 7); return next <= currentWeek ? next : value;
      })}>다음 주</button>
    </div>
    {error ? <div className="panel" role="alert"><p>{error}</p><button className="btn" onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></div>
      : !report ? <div className="panel"><LoadingIndicator message="이번 주 탐정 활동을 모으고 있어요…" /></div> : <>
        <div className="weekly-report-cards">
          <section className="panel"><h2 className="weekly-report-card-title"><ReportIcon kind="calendar" />학습한 날</h2><strong className="weekly-report-value">{report.learningDays}일</strong><p>문제 풀이와 글쓰기로 확인된 날짜예요.</p><small>복습만 한 날짜는 확인할 수 없어 포함하지 않았어요.</small></section>
          <section className="panel"><h2 className="weekly-report-card-title"><ReportIcon kind="book" />해결한 문제</h2><strong className="weekly-report-value">{report.uniqueQuestions}개</strong><p>정답·오답 모두 포함해, 같은 문제는 한 번만 세었어요.</p><small>건너뛰기와 문제 화면만 연 활동은 제외해요.</small></section>
          <section className="panel weekly-report-comparison"><h2 className="weekly-report-card-title"><ReportIcon kind={difference === null || difference === 0 ? "neutral" : difference > 0 ? "up" : "down"} />지난주 대비</h2>{difference !== null ? (() => {
            if (difference > 0) return <><strong className="weekly-report-value">+{difference}개</strong><p>지난주보다 {difference}문제 더 풀었어요!</p></>;
            if (difference < 0) return <><strong className="weekly-report-value">{difference}개</strong><p>지난주보다 {Math.abs(difference)}문제 적게 풀었어요.</p></>;
            return <><strong className="weekly-report-unavailable">변화 없음</strong><p>이번 주와 지난주 모두 {report.uniqueQuestions}문제를 풀었어요.</p></>;
          })() : <><strong className="weekly-report-unavailable">집계할 수 없어요</strong><p>지난주 학습 기록을 확인할 수 없어요.</p></>}
          </section>
        </div>
        <section className="panel weekly-report-chart" aria-labelledby="weekly-activity-title">
          <h2 id="weekly-activity-title">이번 주 학습 활동</h2><p className="muted">날짜별로 답을 제출한 서로 다른 문제 수예요.</p>
          <div className="weekly-report-plot">
            <div className="weekly-report-axis" aria-hidden="true"><span>{maxQuestions}개</span><span>0개</span></div>
            <div className="weekly-report-bars" role="list" aria-label="요일별 고유 문제 수">
              {report.days.map((day, index) => {
                const isPeak = day.questions > 0 && day.questions === maxQuestions;
                return <div className={`weekly-report-column${isPeak ? " is-peak" : ""}`} role="listitem" key={day.date} aria-label={`${formatReportDate(day.date)} ${day.questions}개${isPeak ? ", 가장 많이 학습한 날" : ""}`}>
                  <span>{day.questions}개</span><div className="weekly-report-track"><div className="weekly-report-bar" style={{ height: `${day.questions / maxQuestions * 100}%` }} /></div><b>{["월", "화", "수", "목", "금", "토", "일"][index]}{isPeak && <span aria-hidden="true"> ·</span>}</b>
                </div>;
              })}
            </div>
          </div>
          {report.days.some(day => day.questions > 0) && <p className="weekly-report-peak-note">● 가장 많이 학습한 날: {report.days.filter(day => day.questions === maxQuestions).map(day => `${formatReportDate(day.date)}`).join(", ")}</p>}
          <p className="muted">다른 날 같은 문제를 다시 풀면 각 날짜에 표시돼요. 그래서 막대의 합과 주간 문제 수는 다를 수 있어요.</p>
        </section>
        <section className="panel weekly-report-feedback" aria-labelledby="weekly-feedback-title">
          <h2 id="weekly-feedback-title" className="weekly-report-card-title"><ReportIcon kind="search" />이번 주 탐정의 한마디</h2>
          <h3>{feedback!.title}</h3><p>{feedback!.description}</p>
          <div className="weekly-report-goal" aria-labelledby="weekly-goal-title">
            <h3 id="weekly-goal-title">{goal!.title}</h3><p>{goal!.description}</p>
            <div className="weekly-report-goal-comparison" role="img" aria-label={`이번 주 학습 ${report.learningDays}일, ${goal!.period === "current" ? "이번" : "다음"} 주 추천 ${goal!.targetDays}일`}>
              {Array.from({ length: goal!.targetDays }, (_, index) => <span key={index} className={`weekly-report-goal-day${index < report.learningDays ? " is-learned" : ""}`} />)}
            </div>
            <p className="muted">{recommendation}</p>
            <div className="weekly-report-actions">
              {canContinueLearning && <button type="button" className="btn weekly-report-continue-button" onClick={continueLearning}>오늘 학습 계속하기</button>}
              <button type="button" className="btn secondary" onClick={onReview}>복습 노트로 이동</button>
            </div>
          </div>
        </section>
        <details className="weekly-report-guidance"><summary>집계 기준 안내</summary><p>학습일은 문제 풀이와 글쓰기를 기록한 날짜로 셌어요. 복습만 한 날짜는 기록에서 확인할 수 없어 학습일에 포함하지 않았어요.</p></details>
      </>}
  </div>;
}
