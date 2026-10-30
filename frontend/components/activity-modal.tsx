"use client";

import { ReactNode, useEffect, useRef } from "react";
import LoadingIndicator from "./loading-indicator";

export default function ActivityModal({ kind, title, message, children }: {
  kind: "loading" | "success" | "failure" | "error"; title: string; message?: string; children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousOverflow = useRef<string | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    return () => {
      element?.close();
      if (previousOverflow.current !== null) {
        document.body.style.overflow = previousOverflow.current;
        if (previous?.isConnected) previous.focus();
      }
    };
  }, []);
  useEffect(() => {
    const show = () => {
      if (!dialog.current || dialog.current.open) return;
      previousOverflow.current = document.body.style.overflow;
      dialog.current.showModal();
      document.body.style.overflow = "hidden";
    };
    // Delay only the initial display; completion never waits for this timer.
    if (kind !== "loading") { show(); return; }
    const timer = window.setTimeout(show, 150);
    return () => window.clearTimeout(timer);
  }, [kind]);
  return <dialog ref={dialog} className={`activity-modal is-${kind}`} aria-labelledby="activity-modal-title" aria-describedby={message ? "activity-modal-message" : undefined} aria-busy={kind === "loading"} onCancel={event => event.preventDefault()}>
    <div className="activity-modal-content" role="status" aria-live="polite" aria-atomic="true">
      <h2 id="activity-modal-title">{title}</h2>
      {kind === "loading" ? <LoadingIndicator message={title} /> : <span className="activity-modal-symbol" aria-hidden="true">{kind === "success" ? "✓" : kind === "failure" ? "↻" : "!"}</span>}
      {message && <p id="activity-modal-message">{message}</p>}
    </div>
    {children && <div className="row-actions">{children}</div>}
  </dialog>;
}
