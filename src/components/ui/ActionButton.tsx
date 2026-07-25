"use client";
import type { ButtonHTMLAttributes } from "react";
import { fireToast, type ToastKind } from "@/lib/toast";

type Variant = "primary" | "outline" | "ghost" | "danger" | "warm" | "raw";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Toast message to fire on click. If a function is provided, it runs instead. */
  toast?: string;
  toastKind?: ToastKind;
  toastSub?: string;
  variant?: Variant;
  /** When variant="raw", pass full className yourself. */
  className?: string;
};

const variants: Record<Variant, string> = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2 text-[13px] font-semibold text-[#F4EEE2] transition-colors hover:bg-accent-hover",
  outline:
    "rounded border border-line px-4 py-2 text-start text-[13px] text-text transition-colors hover:border-accent",
  ghost:
    "text-[13px] text-accent transition-colors hover:underline",
  danger:
    "rounded border border-line px-4 py-2 text-start text-[13px] text-critical transition-colors hover:bg-critical/5 hover:border-critical/40",
  warm:
    "rounded border border-line px-4 py-2 text-start text-[13px] text-text-2 transition-colors hover:border-accent-warm hover:text-text",
  raw: "",
};

export function ActionButton({
  toast,
  toastKind = "ok",
  toastSub,
  variant = "primary",
  className,
  onClick,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      onClick={e => {
        onClick?.(e);
        if (!e.defaultPrevented && toast) fireToast(toast, { kind: toastKind, sub: toastSub });
      }}
      className={`${variants[variant]} ${className ?? ""}`.trim()}
    >
      {children}
    </button>
  );
}
