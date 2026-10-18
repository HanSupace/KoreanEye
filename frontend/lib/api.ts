export type Student = { id: string; name: string; grade: number; nickname?: string };
export type Question = { id: string; category: string; prompt: string; choices: string[]; answer?: string; explanation?: string; correct?: boolean };
export type WritingError = {
  id: string; original: string; correct: string; startIndex: number; endIndex: number; category: string;
  explanation: string; hintLevel1: string; hintLevel2: string; choices: string[]; attemptCount: number; hintLevelUsed: number; solved: boolean;
};
export type Writing = { id: string; text: string; createdAt: string; errors: WritingError[] };
export type WeeklyReport = {
  learningDays: number; writingCount: number; spellingAccuracy: number; spacingAccuracy: number;
  weaknesses: { category: string; errorCount: number; weaknessScore: number; accuracyRate: number }[];
  repeatedErrors: { original: string; correct: string; count: number }[]; summary: string;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.message ?? "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.", response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
