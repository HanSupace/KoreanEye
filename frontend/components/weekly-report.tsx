"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { currentSeoulWeek, formatReportDate, shiftDate, WeeklyLearningReport } from "@/lib/weekly-report";
import LoadingIndicator from "./loading-indicator";

export default function WeeklyReport({ token, studentId, categoryNames, onReview }: {
  token: string; studentId: string; categoryNames: Record<string, string>; onReview: () => void;
}) {
  const [weekStart, setWeekStart] = useState(() => currentSeoulWeek());
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; report?: WeeklyLearningReport; error?: string } | null>(null);
  const key = JSON.stringify([token, studentId, weekStart, retry]);
  useEffect(() => {
    const controller = new AbortController();
    api<WeeklyLearningReport>(`/students/${studentId}/reports/weekly-learning?weekStart=${weekStart}`, { signal: controller.signal }, token)
      .then(report => { if (!controller.signal.aborted) setResult({ key, report }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ key, error: "리포트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }); });
    return () => controller.abort();
  }, [token, studentId, weekStart, key]);
  const report = result?.key === key ? result.report : undefined;
  const error = result?.key === key ? result.error : undefined;
  const currentWeek = report?.currentWeekStart ?? currentSeoulWeek();
  const maxQuestions = Math.max(1, ...(report?.days.map(day => day.questions) ?? []));
  const topCategory = report?.weaknesses[0]?.category;
  const recommendation = !report ? "" : report.noRecordedActivity
    ? "아직 문제 풀이와 글쓰기 기록이 없어요. 오늘 첫 단서를 찾아볼까요?"
    : topCategory ? `이번 주에는 ${categoryNames[topCategory] ?? "맞춤법"} 단서를 만났어요. 한 번 더 복습해 볼까요?`
    : "이번 주에도 열심히 학습했어요! 찾은 단서를 다시 살펴보며 자신감을 키워요.";

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
          <section className="panel"><h2>학습한 날</h2><strong className="weekly-report-value">{report.learningDays}일</strong><p>문제 풀이와 글쓰기로 확인된 날짜예요.</p><small>복습만 한 날짜는 확인할 수 없어 포함하지 않았어요.</small></section>
          <section className="panel"><h2>해결한 문제</h2><strong className="weekly-report-value">{report.uniqueQuestions}개</strong><p>정답·오답 모두 포함해, 같은 문제는 한 번만 세었어요.</p><small>건너뛰기와 문제 화면만 연 활동은 제외해요.</small></section>
          <section className="panel"><h2>지난주 대비</h2>{report.previousWeekActivityAvailable ? (() => {
            const difference = report.uniqueQuestions - report.previousWeekUniqueQuestions;
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
              {report.days.map((day, index) => <div className="weekly-report-column" role="listitem" key={day.date} aria-label={`${formatReportDate(day.date)} ${day.questions}개`}>
                <span>{day.questions}개</span><div className="weekly-report-track"><div className="weekly-report-bar" style={{ height: `${day.questions / maxQuestions * 100}%` }} /></div><b>{["월", "화", "수", "목", "금", "토", "일"][index]}</b>
              </div>)}
            </div>
          </div>
          <p className="muted">다른 날 같은 문제를 다시 풀면 각 날짜에 표시돼요. 그래서 막대의 합과 주간 문제 수는 다를 수 있어요.</p>
        </section>
        <section className="panel weekly-report-goal"><h2>탐정의 다음 목표</h2><p>{recommendation}</p>
          <p className="muted">이번 주 문제 풀이와 글쓰기에서 찾은 단서를 참고했어요. 날짜를 알 수 없는 복습 활동은 추천에 포함하지 않았어요.</p>
          <button type="button" className="btn" onClick={onReview}>복습 노트로 이동</button>
        </section>
      </>}
  </div>;
}
