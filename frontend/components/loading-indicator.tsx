export default function LoadingIndicator({ message = "잠시만 기다려 주세요." }: { message?: string }) {
  return <div className="loading-indicator" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" /><span>{message}</span></div>;
}
