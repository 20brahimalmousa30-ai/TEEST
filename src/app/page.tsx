import Link from "next/link";
import { HeroLogo } from "@/components/HeroLogo";
import { TripMessage } from "@/components/TripMessage";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ── شريط نسخة العرض التجريبي ─────────────────────────────── */}
      <div
        className="relative z-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[13px] font-medium"
        style={{ background: "#B54A2E", color: "#F4EEE2" }}
      >
        <span>
          هذه <strong>نسخة عرض تجريبيّة</strong> من منصّة «معالي» — جميع البيانات وهميّة، ولا يوجد اتصال بقاعدة بيانات حقيقيّة.
        </span>
        <a
          href="https://wa.me/966559570829"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded px-3 py-1 text-[12px] font-semibold underline underline-offset-2 hover:opacity-90"
          style={{ background: "rgba(244,238,226,.18)" }}
        >
          للحصول على نسخةٍ حقيقيّة — تواصل معنا
        </a>
      </div>

      {/* ── Layer 1 · Aurora gradients ─────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-30"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 0%,   rgba(194,160,99,.22) 0%, transparent 60%)," +
            "radial-gradient(ellipse 90% 60% at 50% 110%, rgba(44,107,121,.16)  0%, transparent 60%)," +
            "radial-gradient(ellipse 55% 40% at 15% 60%,  rgba(95,138,92,.10) 0%, transparent 65%)," +
            "radial-gradient(ellipse 55% 40% at 85% 40%,  rgba(181,74,46,.06) 0%, transparent 65%)",
        }}
      />

      {/* ── Layer 3 · Vignette to soften edges ─────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(ellipse 100% 80% at 50% 30%, transparent 55%, rgba(15,21,18,.06) 100%)" }}
      />

      <header className="relative border-b border-line bg-bg-raised/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-baseline gap-2 tracking-tight text-text hover:text-accent-warm-2 transition-colors"
            style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}
          >
            <span className="text-[22px] font-semibold">معالي</span>
            <span className="text-[14px] font-medium text-accent-warm-2">١٤٤٨هـ</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-text-2">
            <Link href="/committees-info" className="hidden hover:text-accent-warm-2 sm:inline">اللجان</Link>
            <Link href="/supervisors-info" className="hidden hover:text-accent-warm-2 sm:inline">المشرفون</Link>
            <Link href="/register" className="hidden hover:text-accent-warm-2 sm:inline">تسجيل شاب</Link>
            <a href="#message" className="hidden hover:text-text sm:inline">رسالة السفرة</a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-[13px] font-semibold hover:bg-accent-hover transition-colors"
              style={{ color: "#F4EEE2" }}
            >
              الدخول
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero — centred large logo + tagline ─────────────────────── */}
      <section className="relative mx-auto max-w-5xl px-6 pt-9 pb-16 text-center">
        {/* Big showcase logo with subtle halo */}
        <HeroLogo />

        <div className="mt-6 flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-accent-warm" />
          <span className="eyebrow" style={{ fontSize: "0.9rem", letterSpacing: ".18em" }}>منصّةُ معالي · الإصدار الأوّل</span>
          <span className="h-px w-10 bg-accent-warm" />
        </div>

        <h1
          className="mx-auto mt-6 text-balance tracking-tight"
          style={{
            fontFamily: "var(--font-messiri), var(--font-cairo), serif",
            fontSize: "clamp(2.5rem, 6vw, 4.25rem)",
            lineHeight: 1.12,
            fontWeight: 600,
            maxWidth: "20ch",
          }}
        >
          رحلةٌ من <span style={{ color: "var(--accent)" }}>مرتفعات عَسير</span>،
          تُدارُ من مكانٍ واحد.
        </h1>

        <p
          className="mx-auto mt-7 text-text-2"
          style={{ fontSize: "clamp(1.0625rem, 2vw, 1.25rem)", lineHeight: 2.05, maxWidth: "54ch" }}
        >
          منصة «معالي» تجرِبةٌ ملهمة تجمعُ الأميرَ مع رعيته، في واجهة خلّابة، وتقانةٍ فريدة،
          حيثُ تدار الرحلة من خِلالها؛ فيا رب سدد وألهم.
        </p>
        <p
          className="mx-auto mt-8"
          style={{
            fontFamily: "var(--font-messiri), var(--font-cairo), serif",
            fontSize: "clamp(1.5rem, 3.4vw, 2.25rem)",
            lineHeight: 1.3,
            fontWeight: 600,
            maxWidth: "54ch",
            color: "var(--accent)",
          }}
        >
          مَعالي.. من القاعِ إلى القِمم!
        </p>

        <div className="flex flex-wrap justify-center gap-3" style={{ marginTop: "3rem" }}>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded bg-accent px-6 py-3 text-[15px] font-semibold hover:bg-accent-hover transition-colors"
            style={{ color: "#F4EEE2" }}
          >
            تسجيل الدخول
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded border border-accent-warm/60 bg-accent-warm/10 px-6 py-3 text-[15px] font-medium text-accent-warm-2 hover:bg-accent-warm/20 hover:border-accent-warm transition-colors"
          >
            سجّل كشابٍّ جديد
          </Link>
        </div>
      </section>

      {/* ── Stats bar (facts) — التاريخ الهجري ثمّ الميلادي + السفرة + عدد الأيّام ── */}
      <section className="relative mx-auto mb-4 max-w-5xl px-6" style={{ marginTop: "2.5rem" }}>
        <div className="rounded-lg border border-black/10 px-6 py-4 shadow-sm" style={{ background: "var(--bg-raised)" }}>
          <div className="mb-3 border-b border-black/10 pb-3 text-center">
            <div className="mb-1" style={{ fontSize: "0.72rem", letterSpacing: ".14em", color: "#7A857F" }}>التاريخ</div>
            <div className="font-medium" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif", fontSize: "1rem", color: "#1A211D" }}>
              من ٢١ صفر حتى ٢٥ صفر ١٤٤٨هـ
            </div>
            <div className="mt-1" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif", fontSize: "0.8rem", color: "#7A857F" }}>
              من ٤ أغسطس حتى ٨ أغسطس ٢٠٢٦م
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["السفرة", "محافظة بلّسمر"],
              ["الأيّام", "٥ أيّام"],
            ].map(([k, v]) => (
              <div key={k} className="text-center">
                <dt className="mb-1" style={{ fontSize: "0.72rem", letterSpacing: ".14em", color: "#7A857F" }}>{k}</dt>
                <dd className="font-medium" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif", fontSize: "1rem", color: "#1A211D" }}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── رسالة السفرة (يحرّرها الأمير) — مكان قسم الأدوار المحذوف ──── */}
      <TripMessage />
    </main>
  );
}
