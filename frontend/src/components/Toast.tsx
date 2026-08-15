import { useState } from "react";

export interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error";
}

let toastSeq = 0;
const TOAST_DURATION_MS = 3000;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function pushToast(message: string, tone: ToastItem["tone"]) {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_DURATION_MS);
  }

  return { toasts, pushToast };
}

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
