export type WeeklyLearningReport = {
  weekStart: string; weekEnd: string; currentWeekStart: string;
  learningDays: number; uniqueQuestions: number;
  reviewedClues: number | null; completedClues: number | null; reviewActivityAvailable: boolean;
  previousWeekUniqueQuestions: number; previousWeekActivityAvailable: boolean;
  days: { date: string; questions: number }[];
  weaknesses: { category: string; count: number }[];
  noRecordedActivity: boolean;
};

const spellingCategories = new Set(["PRONUNCIATION_SPELLING", "FINAL_CONSONANT", "DOE_DWAE", "AN_ANH"]);

// These counts come from wrong weekly question submissions and corrections
// recorded on this week's writing entries, never from old review items.
export function weeklyLearningReviewRecommendation(report: WeeklyLearningReport) {
  const category = report.weaknesses.find(item => item.count > 0)?.category;
  if (category === "SPACING") return "띄어쓰기 단서를 다시 살펴볼까요?";
  if (category && spellingCategories.has(category)) return "이번 주에 헷갈렸던 맞춤법을 다시 확인해 볼까요?";
  return "새로운 단서를 찾아보며 한글 실력을 키워 봐요!";
}

// Presentation only: all counts come from the selected week's existing report.
export function weeklyLearningFeedback(report: WeeklyLearningReport, now = new Date(), currentTargetDays?: number) {
  const goal = weeklyLearningGoal(report.learningDays, report.weekStart, now, currentTargetDays);
  if (goal.period === "current") {
    if (report.noRecordedActivity) return {
      title: "첫 단서를 기다리고 있어요!",
      description: "이번 주 첫 학습을 시작해 볼까요?",
    };
    const activity = report.uniqueQuestions === 0
      ? `${report.learningDays}일 동안 글쓰기 활동을 했어요.`
      : `${report.learningDays}일 동안 ${report.uniqueQuestions}개의 문제를 풀었어요.`;
    return {
      title: goal.achieved ? "이번 주 추천 목표를 달성했어요!" : "이번 주에도 차근차근 단서를 찾아봐요!",
      description: goal.achieved
        ? `${activity} 이번 주 추천 목표를 달성했어요!`
        : report.uniqueQuestions === 0
          ? `${activity} 이번 주가 끝나기 전에 새로운 문제도 살펴볼까요?`
          : `${activity} 이번 주가 끝나기 전에 조금 더 도전해 볼까요?`,
    };
  }
  if (report.noRecordedActivity) return {
    title: "이번 주에도 멋지게 단서를 찾아봐요!",
    description: "이번 주 학습 기록이 아직 없어요. 다음 주에는 첫 단서를 찾아봐요!",
  };
  // Writing can contribute learning days even when no questions were submitted.
  if (report.uniqueQuestions === 0) return {
    title: "이번 주에도 탐정 활동을 이어갔어요!",
    description: `이번 주에는 ${report.learningDays}일 동안 글쓰기 활동을 했어요. 다음 주에도 새로운 단서를 찾아봐요!`,
  };
  return {
    title: "이번 주에도 멋지게 단서를 찾았어요!",
    description: `이번 주에는 ${report.learningDays}일 동안 ${report.uniqueQuestions}개의 문제를 풀었어요. 다음 주에도 새로운 단서를 찾아봐요!`,
  };
}

export function weeklyLearningGoal(learningDays: number, weekStart: string, now = new Date(), currentTargetDays?: number) {
  const day = seoulReportDay(now);
  const period = weekStart === currentSeoulWeek(now) && day.weekday >= 1 && day.weekday <= 5 ? "current" : "next";
  // No saved goal exists. Weekday suggestions stop at five days so the
  // recommendation does not keep moving after a full weekday of learning.
  const targetDays = period === "current"
    ? Math.min(5, Math.max(1, currentTargetDays ?? learningDays + 1))
    : Math.min(7, learningDays + 1);
  const achieved = period === "current" && learningDays >= targetDays;
  if (period === "current") return {
    period, targetDays, achieved, title: "이번 주 추천 목표",
    description: achieved
      ? "이번 주 추천 목표를 달성했어요!"
      : learningDays === 0 ? "이번 주 첫 학습을 시작해 봐요! 1일 학습에 도전해 볼까요?"
      : `${learningDays}일 학습했어요 · 목표까지 ${Math.max(0, targetDays - learningDays)}일 남았어요!`,
  };
  return {
    period, targetDays, achieved, title: "다음 주 추천 목표",
    description: learningDays === 7
      ? "이번 주에는 매일 학습했어요. 다음 주에도 7일 동안 꾸준히 단서를 찾아봐요!"
      : `이번 주에는 ${learningDays}일 학습했어요. 다음 주에는 ${targetDays}일 학습에 도전해 볼까요?`,
  };
}

export function seoulReportDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  return { date, weekday: new Date(`${date}T00:00:00Z`).getUTCDay() };
}

export function millisecondsUntilSeoulMidnight(now = new Date()) {
  const tomorrow = shiftDate(seoulReportDay(now).date, 1);
  return new Date(`${tomorrow}T00:00:00+09:00`).getTime() - now.getTime();
}

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function currentSeoulWeek(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDate(date, -((day + 6) % 7));
}

export function formatReportDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}
