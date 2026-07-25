"use client";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "raw";

const variants: Record<Variant, string> = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2 text-[13px] font-semibold text-[#F4EEE2] transition-colors hover:bg-accent-hover disabled:opacity-60",
  outline:
    "inline-flex items-center gap-2 rounded border border-line px-4 py-2 text-[13px] text-text transition-colors hover:border-accent",
  ghost:
    "text-[13px] text-accent transition-colors hover:underline",
  danger:
    "inline-flex items-center gap-2 rounded border border-line px-4 py-2 text-[13px] text-critical transition-colors hover:bg-critical/5 hover:border-critical/40",
  raw: "",
};

export function Button({
  variant = "primary", className, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...rest} className={`${variants[variant]} ${className ?? ""}`.trim()} />;
}
