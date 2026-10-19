"use client";

export type DayRecord = { date: string; questionsSolved: number; attempts: number; writingCount: number; remaining: number; completedCount: number; chaptersCompleted?: number; notes: { id: string; text: string; remaining: number }[] };

export default function LearningNotebook({ records, onQuestions }: {
  records: DayRecord[]; onQuestions: () => void;
}) {
  const completedChapters = records.reduce((count, record) => count + (record.chaptersCompleted ?? (record.questionsSolved >= 5 ? 1 : 0)), 0);
  const activeIndex = completedChapters;
  const nodes = Array.from({ length: Math.max(10, activeIndex + 2) }, (_, index) => index);

  return <div className="content notebook-content learning-path-page">
    <header className="notebook-heading compact-notebook-heading"><h1>오늘의 학습</h1></header>

    <section className="today-case simple-learning-path" aria-label="학습 세트">
      <div className="duo-path">
        {nodes.map(index => {
          const completed = index < activeIndex;
          const active = index === activeIndex;
          const locked = !completed && !active;
          const row = Math.floor(index / 5);
          const slot = index % 5;
          const column = row % 2 === 0 ? slot + 1 : 5 - slot;
          const turn = slot === 4 && index < nodes.length - 1;
          const title = `챕터 ${index + 1}`;
          return <div className={`duo-step ${row % 2 ? "is-reversed" : ""} ${index < nodes.length - 1 ? "has-next" : ""} ${turn ? "is-turn" : ""} ${completed ? "has-completed-next" : ""}`} key={index} style={{ gridColumn: column, gridRow: row + 1 }}>
            <button
              className={`duo-node ${completed ? "is-complete" : active ? "is-active" : "is-locked"}`}
              disabled={locked || completed}
              onClick={onQuestions}
              aria-label={`${title}${completed ? " 완료" : active ? " 시작" : " 잠김"}`}
            >
              {completed ? <svg className="duo-node-check" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : <svg className="duo-node-notebook" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9 5.5h17v22H9z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12.5 5.5v22M6 10h4M6 16h4M6 22h4M16 12h6M16 16h6M16 20h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
            </button>
            <span className={`duo-step-label ${active ? "is-current" : ""}`}>
              {active ? "단어 찾기" : completed ? "완료" : "잠김"}
            </span>
          </div>;
        })}
      </div>
    </section>
  </div>;
}
