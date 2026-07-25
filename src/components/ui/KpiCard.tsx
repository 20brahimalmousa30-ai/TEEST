type Variant = "default" | "ok" | "warn" | "critical";
const barColor: Record<Variant, string> = {
  default:  "bg-accent-warm",
  ok:       "bg-ok",
  warn:     "bg-accent-warm-2",
  critical: "bg-critical",
};

export function KpiCard({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  variant?: Variant;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border border-line bg-bg-raised px-4 py-4">
      <span className={`absolute inset-y-0 right-0 w-[3px] ${barColor[variant]}`} />
      <div className="text-[11px] tracking-[.14em] text-text-3">{label}</div>
      <div className="num mt-1.5 text-[22px] leading-none text-text">{value}</div>
      {sub && <div className="mt-2 text-[12px] text-text-3">{sub}</div>}
    </div>
  );
}
