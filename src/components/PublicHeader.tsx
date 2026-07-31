import Link from "next/link";

/** ترويسةٌ عامّة لصفحات التعريف (اللجان/المشرفون) — لا تتطلّب دخولاً. */
export function PublicHeader() {
  return (
    <header className="relative border-b border-line bg-bg-raised/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-2 tracking-tight text-text hover:text-accent-warm-2 transition-colors" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>
          <span className="text-[22px] font-semibold">معالي</span>
          <span className="text-[14px] font-medium text-accent-warm-2">١٤٤٨هـ</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-text-2">
          <Link href="/committees-info" className="hover:text-accent-warm-2">اللجان</Link>
          <Link href="/supervisors-info" className="hover:text-accent-warm-2">المشرفون</Link>
          <Link href="/login" className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-[13px] font-semibold hover:bg-accent-hover transition-colors" style={{ color: "#F4EEE2" }}>
            الدخول
          </Link>
        </nav>
      </div>
    </header>
  );
}
