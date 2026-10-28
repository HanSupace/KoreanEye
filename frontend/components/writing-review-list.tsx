"use client";

import { useEffect, useState } from "react";
import { api, Writing } from "@/lib/api";

export default function WritingReviewList({ token, studentId, categoryNames, onWrite }: {
  token: string; studentId: string; categoryNames: Record<string, string>; onWrite: () => void;
}) {
  const [writings, setWritings] = useState<Writing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    api<Writing[]>(`/students/${studentId}/writings`, { signal: controller.signal }, token)
      .then(items => { if (!controller.signal.aborted) setWritings(items); })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, studentId, retry]);

  const complete = async (id: string) => {
    if (saving) return;
    setSaving(id);
    setSaveError("");
    try {
      await api<void>(`/writing-errors/${id}/review-complete`, { method: "POST" }, token);
      setWritings(items => items.map(writing => ({ ...writing, errors: writing.errors.map(error => error.id === id ? { ...error, solved: true } : error) })));
    } catch {
      setSaveError("복습 완료를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally { setSaving(null); }
  };

  const groupsByText: Record<string, { text: string; writings: Writing[] }> = {};
  writings.forEach(writing => {
    const group = groupsByText[writing.text] ?? { text: writing.text, writings: [] };
    group.writings.push(writing);
    groupsByText[writing.text] = group;
  });
  const groups = Object.values(groupsByText);
  const items = writings.flatMap(writing => writing.errors.map(error => ({ writing, error })));
  return <section className="writing-review-section" aria-labelledby="writing-review-title">
    <div className="archive-heading"><h2 id="writing-review-title">글쓰기 복습</h2>{!loading && !loadError && items.length > 0 && <span>{items.filter(item => item.error.solved).length} / {items.length} 완료</span>}</div>
    {loading ? <div className="panel" role="status">글쓰기 복습을 불러오고 있어요…</div> : loadError ? <div className="panel" role="alert"><p>글쓰기 복습을 불러오지 못했어요.</p><button className="btn secondary" onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></div> : !items.length ? <div className="panel">아직 복습할 글쓰기 표현이 없어요.</div> : <div className="writing-review-groups">{groups.map(group => {
      const groupItems = group.writings.flatMap(writing => writing.errors.map(error => ({ writing, error })));
      return <details className="panel writing-review-group" key={group.text}><summary><span><b>{group.text}</b><small>복습 표현 {groupItems.length}개</small></span><span aria-hidden="true">⌄</span></summary>
        <div className="error-list">{groupItems.map(({ writing, error }) => <article className="error-item writing-review-item" key={error.id}>
          <span className="qcategory">{categoryNames[error.category] ?? error.category}</span>
          <dl className="writing-review-fields"><div><dt>원문</dt><dd>{writing.text}</dd></div><div><dt>틀린 표현</dt><dd>{error.original}</dd></div><div><dt>수정 표현</dt><dd>{error.correct}</dd></div><div><dt>작성 날짜</dt><dd><time dateTime={writing.createdAt}>{new Date(writing.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</time></dd></div></dl>
          {error.solved ? <div className="review-question-complete"><span aria-hidden="true">✓</span> 복습 완료</div> : <button className="btn small" disabled={saving !== null} onClick={() => void complete(error.id)} aria-label={`${error.original} 복습 완료`}>{saving === error.id ? "저장 중…" : "복습 완료"}</button>}
        </article>)}</div>
      </details>;
    })}</div>}
    {saveError && <p className="form-error" role="alert">{saveError}</p>}
    <div className="row-actions"><button className="btn secondary" onClick={onWrite}>다음 학습 만들기</button></div>
  </section>;
}
