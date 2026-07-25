import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">{label}</span>
      <input
        {...props}
        className={`w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px] text-text placeholder:text-text-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-warm ${props.className ?? ""}`}
      />
      {hint && <span className="mt-1 block text-[11px] text-text-3">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">{label}</span>
      <textarea
        rows={3}
        {...props}
        className={`w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px] text-text placeholder:text-text-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-warm ${props.className ?? ""}`}
      />
      {hint && <span className="mt-1 block text-[11px] text-text-3">{hint}</span>}
    </label>
  );
}
