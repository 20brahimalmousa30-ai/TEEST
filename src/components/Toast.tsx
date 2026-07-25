"use client";
import { useEffect, useState, useCallback } from "react";
import { TOAST_EVENT, type ToastDetail, type ToastKind } from "@/lib/toast";

type ToastItem = ToastDetail & { id: number };

const kindClass: Record<ToastKind, string> = {
  ok:       "border-ok/40 bg-[color:var(--bg-raised)]",
  info:     "border-accent/35 bg-[color:var(--bg-raised)]",
  warn:     "border-accent-warm/45 bg-[color:var(--bg-raised)]",
  critical: "border-critical/40 bg-[color:var(--bg-raised)]",
};

const kindDot: Record<ToastKind, string> = {
  ok:       "bg-ok",
  info:     "bg-accent",
  warn:     "bg-accent-warm",
  critical: "bg-critical",
};

const kindLabel: Record<ToastKind, string> = {
  ok:       "تمّ",
  info:     "معلومة",
  warn:     "تنبيه",
  critical: "حرج",
};

export function ToastMount() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems(cur => cur.filter(i => i.id !== id));
  }, []);

  useEffect(() => {
    let seq = 0;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      const id = ++seq;
      setItems(cur => [...cur, { ...detail, id }]);
      // Auto-dismiss after 3.6s
      window.setTimeout(() => setItems(cur => cur.filter(i => i.id !== id)), 3600);
    };
    window.addEventListener(TOAST_EVENT, handler as EventListener);
    return () => window.removeEventListener(TOAST_EVENT, handler as EventListener);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4"
    >
      {items.map(t => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto flex w-full max-w-[440px] items-start gap-3 rounded-md border px-4 py-3 shadow-lg backdrop-blur ${kindClass[t.kind]}`}
          role="status"
        >
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${kindDot[t.kind]}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] tracking-[.14em] text-text-3">{kindLabel[t.kind]}</span>
              <span className="text-[10.5px] text-text-3">·</span>
              <span className="text-[10.5px] text-text-3">نسخة تجريبيّة</span>
            </div>
            <div className="mt-0.5 text-[13.5px] leading-[1.6] text-text">{t.msg}</div>
            {t.sub && <div className="mt-0.5 text-[11.5px] text-text-3">{t.sub}</div>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="إغلاق"
            className="text-text-3 transition-colors hover:text-text"
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        .toast-in { animation: toast-in .22s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .toast-in { animation: none; }
        }
      `}</style>
    </div>
  );
}
