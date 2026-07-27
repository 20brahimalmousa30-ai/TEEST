type Variant = "ok" | "warn" | "critical" | "info" | "neutral";

const styles: Record<Variant, string> = {
  ok:       "bg-[rgba(95,138,92,.12)]  text-ok        border-[rgba(95,138,92,.35)]",
  warn:     "bg-[rgba(194,160,99,.14)] text-accent-warm-2 border-[rgba(194,160,99,.40)]",
  critical: "bg-[rgba(181,74,46,.12)]  text-critical  border-[rgba(181,74,46,.35)]",
  info:     "bg-[rgba(44,107,121,.10)]   text-accent    border-[rgba(44,107,121,.30)]",
  neutral:  "bg-surface-alt/40         text-text-2    border-line-strong",
};

export function Pill({ variant = "neutral", children }: { variant?: Variant; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[12px] font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}
