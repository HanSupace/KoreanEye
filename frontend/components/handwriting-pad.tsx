"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";
import LoadingIndicator from "./loading-indicator";

export type InputMode = "TYPE" | "HANDWRITING";
type InkPoint = { x: number; y: number };
type InkTool = "pen" | "eraser";
type InkStroke = { points: InkPoint[]; tool: InkTool; width: number };
const PEN_WIDTH = 3.5;
const ERASER_WIDTH = 24;

function drawStroke(ctx: CanvasRenderingContext2D, { points, tool, width }: InkStroke) {
  if (!points.length) return;
  ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = ctx.fillStyle = "#3e342f";
  ctx.lineWidth = width;
  ctx.lineCap = ctx.lineJoin = "round";
  // A tap from a finger or pen should leave a dot, too.
  if (points.length === 1) {
    ctx.beginPath(); ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

export function InputModePicker({ value, onChange, label = "입력 방식" }: { value: InputMode; onChange: (mode: InputMode) => void; label?: string }) {
  return <div className="input-mode-picker" role="group" aria-label={label}>
    <button type="button" className={value === "TYPE" ? "selected" : ""} aria-pressed={value === "TYPE"} onClick={() => onChange("TYPE")}>⌨ 타자</button>
    <button type="button" className={value === "HANDWRITING" ? "selected" : ""} aria-pressed={value === "HANDWRITING"} onClick={() => onChange("HANDWRITING")}>✎ 손글씨</button>
  </div>;
}

export default function HandwritingPad({ onRecognize, disabled = false, allowErasing = false }: { onRecognize: (image: string) => Promise<string>; disabled?: boolean; allowErasing?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activePointer = useRef<number | null>(null);
  const strokes = useRef<InkStroke[]>([]);
  const surface = useRef({ width: 0, height: 0, documentWidth: 0, documentHeight: 0, scale: 1 });
  const [hasInk, setHasInk] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const recognizeRequest = useRef(false);
  const [tool, setTool] = useState<InkTool>("pen");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return; // Hidden elements must not reset existing ink.
      const ratio = window.devicePixelRatio || 1;
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      const previous = surface.current;
      if (previous.width === width && previous.height === height && canvas.width === pixelWidth && canvas.height === pixelHeight) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const documentWidth = previous.documentWidth || width;
      const documentHeight = previous.documentHeight || height;
      // Fit the whole page uniformly, so rotation never crops or stretches ink.
      const scale = Math.min(width / documentWidth, height / documentHeight);
      surface.current = { width, height, documentWidth, documentHeight, scale };
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, pixelWidth, pixelHeight);
      ctx.setTransform(pixelWidth / width * scale, 0, 0, pixelHeight / height * scale, 0, 0);
      for (const stroke of strokes.current) drawStroke(ctx, stroke);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    // Moving between displays can change DPR without changing the CSS size.
    let resolution: MediaQueryList;
    const watchResolution = () => {
      resolution?.removeEventListener("change", onResolutionChange);
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      resolution.addEventListener("change", onResolutionChange);
    };
    const onResolutionChange = () => { resize(); watchResolution(); };
    watchResolution();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      resolution.removeEventListener("change", onResolutionChange);
    };
  }, []);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    // Border coordinates are excluded; DPR is handled by the context transform.
    const x = (event.clientX - bounds.left - canvas.clientLeft) * surface.current.width / (bounds.width - canvas.clientLeft * 2);
    const y = (event.clientY - bounds.top - canvas.clientTop) * surface.current.height / (bounds.height - canvas.clientTop * 2);
    return { x: Math.max(0, Math.min(x, surface.current.width)) / surface.current.scale, y: Math.max(0, Math.min(y, surface.current.height)) / surface.current.scale };
  };
  const rememberPoint = (p: InkPoint) => {
    // New ink in space exposed by a wider/taller viewport joins the saved page.
    surface.current.documentWidth = Math.max(surface.current.documentWidth, p.x + PEN_WIDTH / 2);
    surface.current.documentHeight = Math.max(surface.current.documentHeight, p.y + PEN_WIDTH / 2);
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (disabled || recognizing || activePointer.current !== null || event.button !== 0) return;
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx || !surface.current.width) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    const stroke: InkStroke = { points: [point(event)], tool, width: tool === "eraser" ? ERASER_WIDTH / surface.current.scale : PEN_WIDTH };
    if (tool === "pen") rememberPoint(stroke.points[0]);
    strokes.current.push(stroke);
    drawStroke(ctx, stroke);
    if (tool === "pen") setHasInk(true);
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId || disabled || recognizing) return;
    const ctx = event.currentTarget.getContext("2d"); if (!ctx) return;
    event.preventDefault();
    const stroke = strokes.current[strokes.current.length - 1];
    const p = point(event);
    if (stroke.tool === "pen") rememberPoint(p);
    drawStroke(ctx, { ...stroke, points: [stroke.points[stroke.points.length - 1], p] });
    stroke.points.push(p);
  };
  const stop = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const clear = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    activePointer.current = null;
    strokes.current = [];
    ctx.save(); ctx.resetTransform();
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    const { width, height } = surface.current;
    surface.current = { width, height, documentWidth: width, documentHeight: height, scale: 1 };
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    setHasInk(false);
  };
  const recognize = async () => {
    const canvas = canvasRef.current; if (!canvas || !hasInk || disabled || recognizeRequest.current) return;
    recognizeRequest.current = true;
    setRecognizing(true);
    try {
      let image = canvas;
      if (allowErasing) {
        // Flatten only for export: the visible canvas keeps genuinely erased pixels.
        image = document.createElement("canvas");
        image.width = canvas.width; image.height = canvas.height;
        const ctx = image.getContext("2d");
        if (!ctx) throw new Error("손글씨 이미지를 준비하지 못했어요. 다시 시도해 주세요.");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, image.width, image.height);
        ctx.drawImage(canvas, 0, 0);
      }
      await onRecognize(image.toDataURL("image/png").split(",")[1]);
    }
    finally { recognizeRequest.current = false; setRecognizing(false); }
  };

  return <div className="handwriting-pad-wrap">
    <p className="handwriting-help">아래 칸에 천천히 써 주세요. 줄을 바꾸어 여러 문장도 쓸 수 있어요.</p>
    <div className="handwriting-surface">
      <canvas ref={canvasRef} className={`handwriting-canvas${allowErasing && tool === "eraser" ? " is-erasing" : ""}`} aria-label="손글씨 쓰기 칸"
        onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} />
    </div>
    <p className="handwriting-resize-hint">오른쪽 아래 모서리를 위아래로 끌어 높이를 조절해요.</p>
    <div className="handwriting-actions">{allowErasing ? <div className="handwriting-tools" role="group" aria-label="손글씨 도구">
      <button type="button" className="example-btn" aria-pressed={tool === "pen"} onClick={() => setTool("pen")} disabled={disabled || recognizing}>펜</button>
      <button type="button" className="example-btn" aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")} disabled={disabled || recognizing}>부분 지우개</button>
      <button type="button" className="example-btn" onClick={clear} disabled={disabled || recognizing}>전체 지우기</button>
    </div> : <button type="button" className="example-btn" onClick={clear} disabled={disabled || recognizing}>지우기</button>}<button type="button" className="btn small" onClick={recognize} disabled={disabled || recognizing || !hasInk}>{recognizing ? "글씨를 읽고 있어요…" : "글씨를 텍스트로 바꾸기"}</button></div>
    {recognizing && <LoadingIndicator message="글씨를 읽고 있어요…" />}
  </div>;
}
