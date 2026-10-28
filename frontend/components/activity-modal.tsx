"use client";

import { ReactNode, useEffect, useRef } from "react";
import LoadingIndicator from "./loading-indicator";

export default function ActivityModal({ kind, title, message, children }: {
  kind: "loading" | "success" | "failure" | "error"; title: string; message?: string; children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={dialog} className={`activity-modal is-${kind}`} aria-labelledby="activity-modal-title" aria-describedby={message ? "activity-modal-message" : undefined} aria-busy={kind === "loading"} onCancel={event => event.preventDefault()}>
    <div className="activity-modal-content" role="status" aria-live="polite" aria-atomic="true">
      <h2 id="activity-modal-title">{title}</h2>
      {kind === "loading" ? <LoadingIndicator message={title} /> : <span className="activity-modal-symbol" aria-hidden="true">{kind === "success" ? "✓" : kind === "failure" ? "↻" : "!"}</span>}
      {message && <p id="activity-modal-message">{message}</p>}
    </div>
    {children && <div className="row-actions">{children}</div>}
  </dialog>;
}
