import Link from "next/link";
import { HeroLogo } from "@/components/HeroLogo";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ── Layer 1 · Aurora gradients ─────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-30"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 0%,   rgba(184,149,90,.22) 0%, transparent 60%)," +
            "radial-gradient(ellipse 90% 60% at 50% 110%, rgba(30,70,53,.16)  0%, transparent 60%)," +
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
            className="text-[22px] font-semibold tracking-tight text-text hover:text-accent-warm-2 transition-colors"
            style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}
          >
            معالي
          </Link>
          <nav className="flex items-center gap-6 text-sm text-text-2">
            <Link href="/register" className="hidden hover:text-accent-warm-2 sm:inline">تسجيل شاب</Link>
            <a href="#roles" className="hidden hover:text-text sm:inline">الأدوار</a>
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
          <span className="eyebrow">منصّةُ معالي · الإصدار الأوّل</span>
          <span className="h-px w-10 bg-accent-warm" />
        </div>

        <h1
          className="mx-auto mt-5 max-w-[20ch] text-balance text-[clamp(2.1rem,5vw,3.8rem)] font-medium leading-[1.12] tracking-tight"
          style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}
        >
          رحلةٌ من <span className="text-accent">مرتفعات عَسير</span>،
          تُدارُ من مكانٍ واحد.
        </h1>

        <p className="mx-auto mt-6 max-w-[50ch] text-[16px] leading-[2] text-text-2">
          منصّةُ «معالي» تجمعُ الأميرَ ونائبَه، والمشرفين والشباب، والفواتيرَ والحضورَ والنقاط،
          في واجهةٍ عربيّةٍ راقية، مبنيّةٍ على هوية جهة الرحلة نفسها — لا على قالبٍ عام.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded bg-accent px-6 py-3 text-[15px] font-semibold hover:bg-accent-hover transition-colors"
            style={{ color: "#F4EEE2" }}
          >
            اختر دورك وابدأ التجربة
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
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded border border-line-strong px-6 py-3 text-[15px] font-medium text-text hover:border-accent transition-colors"
          >
            ادخل مباشرةً كأمير
          </Link>
        </div>
      </section>

      {/* ── Stats bar (facts) ──────────────────────────────────────── */}
      <section className="relative mx-auto mb-4 max-w-5xl px-6">
        <div className="rounded-lg border border-line bg-surface/60 px-6 py-5 backdrop-blur">
          <dl className="grid grid-cols-3 gap-4">
            {[
              ["الاسم", "معالي أبها"],
              ["السنة", "١٤٤٨هـ"],
              ["الأيام", "٨"],
            ].map(([k, v]) => (
              <div key={k} className="text-center">
                <dt className="mb-1 text-[11.5px] tracking-[.14em] text-text-3">{k}</dt>
                <dd className="text-[15.5px] font-medium text-text" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Roles ──────────────────────────────────────────────────── */}
      <section id="roles" className="relative border-t border-line bg-bg-raised/40 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-10 flex items-baseline gap-4">
            <span className="text-2xl font-medium text-accent-warm" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>٠١</span>
            <h2 className="text-2xl font-medium">أربعةُ أدوارٍ، حدودٌ واضحة</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["الأمير", "صلاحيّةٌ كاملة على الفعاليّة. يمكن وجود أكثر من أمير، وأحدهم هو «الأصل» صاحب الصلاحيّة الجذريّة."],
              ["نائب الأمير", "إدارةٌ كاملةٌ للفعاليّة، عدا القرارات المحصورة بالأصل (تعيين/إزالة الأمراء)."],
              ["المشرف", "يدير نطاقَه فقط — فريقه و/أو لجنته. قد ينتمي لأكثر من فريقٍ ولجنةٍ معاً."],
              ["الشاب", "الطالب. عرضٌ فقط لبياناته وفريقه وحالة سداده، عبر رابطٍ خاصٍّ بدون حسابٍ كامل."],
            ].map(([name, desc]) => (
              <article
                key={name}
                className="relative overflow-hidden rounded-md border border-line bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-accent-warm hover:shadow-sm"
              >
                <span className="absolute inset-y-0 right-0 w-[3px] bg-accent-warm" />
                <h3 className="mb-2 text-[17px] font-semibold text-text">{name}</h3>
                <p className="text-[14px] leading-[1.8] text-text-2">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-3 px-6 text-[13px] text-text-3">
          <span>نموذجٌ تجريبيٌّ يعمل ببياناتٍ افتراضيّة — لا يُخزَّن شيء على خادم.</span>
          <span>الإصدار الأوّل · نموذج تجريبي</span>
        </div>
      </footer>
    </main>
  );
}
