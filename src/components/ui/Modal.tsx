"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const sizeClass = {
  sm: "max-w-[420px]",
  md: "max-w-[560px]",
  lg: "max-w-[760px]",
};

export function Modal({ open, onClose, title, subtitle, size = "md", children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className={`modal-in relative w-full ${sizeClass[size]} rounded-lg border border-line bg-surface shadow-2xl`}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>{title}</h2>
            {subtitle && <p className="mt-1 text-[12.5px] text-text-3">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-8 w-8 place-items-center rounded text-text-3 hover:bg-surface-alt/40 hover:text-text"
          >
            ×
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-bg-raised px-6 py-3">
            {footer}
          </div>
        )}
      </div>
      <style>{`
        .modal-in { animation: modal-in .18s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes modal-in { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .modal-in { animation: none; } }
      `}</style>
    </div>,
    document.body
  );
}

/* ─────────── Confirm dialog ─────────── */
export function Confirm({
  open, onClose, onConfirm, title, message, confirmLabel = "تأكيد", cancelLabel = "إلغاء", danger = false,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string;
  confirmLabel?: string; cancelLabel?: string; danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="rounded border border-line px-4 py-2 text-[13px] text-text-2 hover:border-accent hover:text-text">
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`rounded px-4 py-2 text-[13px] font-semibold ${danger ? "bg-critical text-[#F4EEE2] hover:bg-[#963d25]" : "bg-accent text-[#F4EEE2] hover:bg-accent-hover"}`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[14px] leading-[1.85] text-text-2">{message}</p>
    </Modal>
  );
}
