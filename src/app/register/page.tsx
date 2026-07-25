"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Field, TextArea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store/StoreProvider";
import { motivations, tickerPhrases } from "@/lib/motivations";

const grades = ["الأول ثانوي", "الثاني ثانوي", "الثالث ثانوي"];
const sections = ["ريادة", "علو", "قيادة"] as const;

/** Reduced-motion probe: skip heavy animation for users who opt-out or low-end devices. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export default function RegisterPage() {
  useEffect(() => { document.title = "التسجيل — معالي أبها"; }, []);
  const { registerStudent } = useStore();
  const reduced = usePrefersReducedMotion();
  const [form, setForm] = useState({
    name: "", phone: "", grade: grades[0], section: sections[0] as (typeof sections)[number],
    emergencyContact: "", emergencyPhone: "", health: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [motivIdx, setMotivIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotate motivations after submission
  useEffect(() => {
    if (!submitted) return;
    timerRef.current = setInterval(() => setMotivIdx(i => (i + 1) % motivations.length), 3500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [submitted]);

  const bannerBg = useMemo(() => ({
    background:
      "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(184,149,90,.20) 0%, transparent 60%), " +
      "radial-gradient(ellipse 90% 60% at 50% 110%, rgba(30,70,53,.14) 0%, transparent 60%)",
  }), []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    registerStudent({
      name: form.name.trim(),
      phone: form.phone.trim(),
      grade: form.grade,
      section: form.section,
      emergencyContact: form.emergencyContact.trim() || "—",
      emergencyPhone: form.emergencyPhone.trim() || "—",
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden px-6 py-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={bannerBg} />
        {/* Moving stripes — hidden for reduced-motion */}
        {!reduced && (
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[.18]">
            <div className="stripe stripe-a" />
            <div className="stripe stripe-b" />
            <div className="stripe stripe-c" />
          </div>
        )}

        <div className="w-full max-w-2xl text-center">
          <Logo size={92} priority />
          <div className="mt-6 mb-3 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-accent-warm" />
            <span className="eyebrow">قيد المراجعة</span>
            <span className="h-px w-8 bg-accent-warm" />
          </div>
          <h1 className="text-balance text-[clamp(1.8rem,4vw,2.8rem)] font-medium leading-tight"
              style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>
            وصَلَنا طلبُك يا <span className="text-accent">{form.name.split(" ")[0] || "صديقنا"}</span>
          </h1>

          {/* Rotating motivation line */}
          <p key={motivIdx} className="mt-6 min-h-[3.2rem] text-[17px] leading-[1.9] text-text-2 motiv-fade">
            {motivations[motivIdx]}
          </p>

          <div className="mt-8 mx-auto max-w-md rounded-md border border-line bg-surface/70 px-5 py-4 text-start text-[13px] text-text-2 backdrop-blur">
            <div className="mb-2 text-[11px] tracking-[.14em] text-text-3">ما التالي؟</div>
            <ol className="grid gap-2 leading-[1.9]">
              <li>١ · يراجع طلبَك <span className="text-text">الأميرُ</span> أو نائبُه.</li>
              <li>٢ · عند الاعتماد ستصلك رسالةُ واتساب باسم المستخدم ورمز الدخول.</li>
              <li>٣ · من صفحتك الشخصيّة سترفع صورتك وتُتمّ السداد.</li>
            </ol>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="rounded border border-line-strong px-5 py-2 text-[13px] text-text-2 hover:border-accent hover:text-text">للصفحة الرئيسة</Link>
            <button onClick={() => { setSubmitted(false); setForm({ name: "", phone: "", grade: grades[0], section: sections[0], emergencyContact: "", emergencyPhone: "", health: "" }); }}
              className="rounded border border-line-strong px-5 py-2 text-[13px] text-text-2 hover:border-accent hover:text-text">
              تسجيلٌ آخر
            </button>
          </div>
        </div>

        <style jsx>{`
          .stripe { position: absolute; inset-inline-start: -20%; width: 140%; height: 8vh; background: linear-gradient(90deg, transparent, var(--accent-warm), transparent); }
          .stripe-a { top: 18%; animation: sweep 14s ease-in-out infinite; }
          .stripe-b { top: 48%; background: linear-gradient(90deg, transparent, var(--accent), transparent); animation: sweep 18s ease-in-out infinite reverse; }
          .stripe-c { top: 78%; background: linear-gradient(90deg, transparent, var(--ok), transparent); animation: sweep 22s ease-in-out infinite; }
          @keyframes sweep { 0%,100% { transform: translateX(-15%); } 50% { transform: translateX(15%); } }
          .motiv-fade { animation: fade .55s ease; }
          @keyframes fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        `}</style>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 sm:py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20" style={bannerBg} />

      {/* Animated motivational marquee bars — background layer, behind the form */}
      {!reduced && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <MarqueeBar top="8%"  duration={38} phrases={tickerPhrases} color="warm" />
          <MarqueeBar top="27%" duration={54} phrases={motivations}   color="green" reverse className="hidden sm:flex" />
          <MarqueeBar top="63%" duration={30} phrases={tickerPhrases} color="green" className="hidden sm:flex" />
          <MarqueeBar top="84%" duration={46} phrases={motivations}   color="warm" reverse />
        </div>
      )}

      <div className="relative mx-auto max-w-2xl">
        <div className="text-center">
          <Logo size={78} priority />
          <div className="mt-5 mb-2 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-accent-warm" />
            <span className="eyebrow">تسجيلُ الشباب</span>
            <span className="h-px w-8 bg-accent-warm" />
          </div>
          <h1 className="text-balance text-[clamp(1.7rem,3.6vw,2.4rem)] font-medium leading-tight"
              style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>
            سجّل رغبتَك بالانضمام إلى <span className="text-accent">معالي أبها ١٤٤٨هـ</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[52ch] text-[14.5px] text-text-2">
            بياناتك تُحفظ ثم تدخل قائمة الانتظار حتى يعتمدها الأمير — لن تُشارك مع أيّ طرف.
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 grid gap-4 rounded-md border border-line bg-surface/80 p-6 backdrop-blur">
          <Field label="الاسم الرباعي" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الجوّال (واتساب)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required placeholder="0555 000 000" />
            <label className="block">
              <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">الصف</span>
              <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                {grades.map(g => <option key={g}>{g}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">القسم المفضَّل</span>
              <select value={form.section} onChange={e => setForm({ ...form, section: e.target.value as (typeof sections)[number] })} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                {sections.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <Field label="اسم جهة الطوارئ" value={form.emergencyContact} onChange={e => setForm({ ...form, emergencyContact: e.target.value })} placeholder="الأب / الأم / الوليّ" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="رقم الطوارئ" value={form.emergencyPhone} onChange={e => setForm({ ...form, emergencyPhone: e.target.value })} placeholder="0555 000 000" />
          </div>
          <TextArea label="حالةٌ صحيّةٌ أو ملاحظات (اختياري)" value={form.health} onChange={e => setForm({ ...form, health: e.target.value })} />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-text-3">بالضغط على «إرسال» تدخل قائمة الانتظار مباشرةً.</p>
            <Button type="submit" variant="primary">إرسال الطلب</Button>
          </div>
        </form>

        <div className="mt-6 text-center text-[12.5px] text-text-3">
          <Link href="/" className="hover:text-accent">عودة للصفحة الرئيسة →</Link>
        </div>
      </div>
    </main>
  );
}

/** One horizontally-scrolling background bar. Content is duplicated so the
 *  keyframe (translateX -50%) loops seamlessly. Kept subtle & behind the form. */
function MarqueeBar({
  top, duration, phrases, color, reverse = false, className = "",
}: {
  top: string;
  duration: number;
  phrases: string[];
  color: "warm" | "green";
  reverse?: boolean;
  className?: string;
}) {
  const items = [...phrases, ...phrases];
  return (
    <div className={`marquee-row ${className}`} style={{ top }}>
      <div
        className="marquee-track"
        style={{ animationDuration: `${duration}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {items.map((p, i) => (
          <span key={i} className={`marquee-item marquee-${color}`}>{p}</span>
        ))}
      </div>
    </div>
  );
}
