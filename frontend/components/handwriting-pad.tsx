"use client";

import { PointerEvent, useRef, useState } from "react";

export type InputMode = "TYPE" | "HANDWRITING";

export function InputModePicker({ value, onChange, label = "입력 방식" }: { value: InputMode; onChange: (mode: InputMode) => void; label?: string }) {
  return <div className="input-mode-picker" role="group" aria-label={label}>
    <button type="button" className={value === "TYPE" ? "selected" : ""} aria-pressed={value === "TYPE"} onClick={() => onChange("TYPE")}>⌨ 타자</button>
    <button type="button" className={value === "HANDWRITING" ? "selected" : ""} aria-pressed={value === "HANDWRITING"} onClick={() => onChange("HANDWRITING")}>✎ 손글씨</button>
  </div>;
}

export default function HandwritingPad({ onRecognize, disabled = false }: { onRecognize: (image: string) => Promise<string>; disabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [recognizing, setRecognizing] = useState(false);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * canvas.width / bounds.width, y: (event.clientY - bounds.top) * canvas.height / bounds.height };
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(event); drawing.current = true; setHasInk(true);
    if (!hasInk) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, event.currentTarget.width, event.currentTarget.height); }
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#3e342f";
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = event.currentTarget.getContext("2d"); if (!ctx) return;
    const p = point(event); ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const clear = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); setHasInk(false);
  };
  const recognize = async () => {
    const canvas = canvasRef.current; if (!canvas || !hasInk || recognizing) return;
    setRecognizing(true);
    try { await onRecognize(canvas.toDataURL("image/png").split(",")[1]); }
    finally { setRecognizing(false); }
  };

  return <div className="handwriting-pad-wrap">
    <p className="handwriting-help">아래 칸에 천천히 써 주세요. 줄을 바꾸어 여러 문장도 쓸 수 있어요.</p>
    <canvas ref={canvasRef} className="handwriting-canvas" width={1000} height={440} aria-label="손글씨 쓰기 칸"
      onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} />
    <div className="handwriting-actions"><button type="button" className="example-btn" onClick={clear} disabled={disabled || recognizing}>지우기</button><button type="button" className="btn small" onClick={recognize} disabled={disabled || recognizing || !hasInk}>{recognizing ? "글씨를 읽고 있어요…" : "글씨를 텍스트로 바꾸기"}</button></div>
  </div>;
}
