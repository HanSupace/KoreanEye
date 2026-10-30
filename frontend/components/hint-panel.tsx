"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Hint = { level: number; hint: string; choices: string[] };
export default function HintPanel({ path, token, studentId, disabled = false, initialLevel = 0 }: {
  path: string; token: string; studentId?: string; disabled?: boolean; initialLevel?: number;
}) {
  const [hint, setHint] = useState<Hint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), [path, token]);
  const show = async () => {
    if (busy || disabled || hint?.level === 3 || activeRequest.current) return;
    const controller = new AbortController(); activeRequest.current = controller;
    setBusy(true); setError("");
    try {
      const value = await api<Hint>(path, { method: "POST", body: JSON.stringify({ studentId, level: Math.min(3, (hint?.level ?? initialLevel) + 1) }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }, token);
      if (!controller.signal.aborted) setHint(value);
    } catch {
      if (!controller.signal.aborted) setError("힌트를 불러오지 못했어요. 다시 눌러 주세요.");
    } finally {
      if (!controller.signal.aborted) { activeRequest.current = null; setBusy(false); }
    }
  };
  return <div className="hint-panel">
    <button type="button" className="btn small secondary" onClick={show} disabled={disabled || busy || hint?.level === 3}>
      {busy ? "힌트 불러오는 중…" : hint?.level === 3 ? "모든 힌트 확인 완료" : hint ? `다음 힌트 (${hint.level + 1}/3)` : "힌트 보기"}
    </button>
    {busy && <span className="hint-loading" role="status">잠시만 기다려 주세요.</span>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {hint && <div className="hint-box" aria-live="polite"><b>힌트 {hint.level} / 3 · {hint.level === 1 ? "생각할 단서" : hint.level === 2 ? "글자 단서" : "보기 비교"}</b><p>{hint.hint}</p>{hint.choices.length > 0 && <ul className="hint-options">{hint.choices.map(choice => <li key={choice}>{choice}</li>)}</ul>}</div>}
  </div>;
}
