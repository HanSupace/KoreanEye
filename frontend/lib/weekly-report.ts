export type WeeklyLearningReport = {
  weekStart: string; weekEnd: string; currentWeekStart: string;
  learningDays: number; uniqueQuestions: number;
  reviewedClues: number | null; completedClues: number | null; reviewActivityAvailable: boolean;
  previousWeekUniqueQuestions: number; previousWeekActivityAvailable: boolean;
  days: { date: string; questions: number }[];
  weaknesses: { category: string; count: number }[];
  noRecordedActivity: boolean;
};

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
