"use client";

import { useEffect, useRef } from "react";

export default function HandwritingConfirmation({
  text, submitting, onChange, onSubmit, onRewrite,
}: {
  text: string;
  submitting: boolean;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onRewrite: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);

  return <dialog ref={dialog} className="activity-modal handwriting-confirmation" aria-labelledby="handwriting-confirmation-title" onCancel={event => event.preventDefault()}>
    <div className="activity-modal-content">
      <h2 id="handwriting-confirmation-title">이렇게 작성한 게 맞나요?</h2>
      <p>인식된 글을 확인한 뒤 제출해 주세요.</p>
      <label className="handwriting-confirmation-label" htmlFor="handwriting-confirmation-text">인식된 글</label>
      <textarea id="handwriting-confirmation-text" className="textarea handwriting-confirmation-text" value={text} onChange={event => onChange(event.target.value)} disabled={submitting} maxLength={5000} autoFocus />
    </div>
    <div className="row-actions">
      <button type="button" className="btn secondary" onClick={onRewrite} disabled={submitting}>다시 쓰기</button>
      <button type="button" className="btn" onClick={onSubmit} disabled={submitting || !text.trim()}>{submitting ? "제출 중…" : "제출하기"}</button>
    </div>
  </dialog>;
}
