"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Confetti } from "@/components/Confetti";
import { Field, TextArea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store/StoreProvider";
import type { RegField } from "@/lib/store/StoreProvider";

const grades = ["الأول ثانوي", "الثاني ثانوي", "الثالث ثانوي"];
const sections = ["ريادة", "علو", "قيادة"] as const;

/** The public registration experience — rendered dynamically from the
 *  Prince-controlled `regFields`, so enabling/disabling/reordering a field
 *  in settings is reflected here immediately. Reused by both `/register`
 *  and the vanity link `/register/[code]`. */
export function RegisterExperience() {
  const { registerStudent, regFields, regOpen, motivations } = useStore();

  // Only the active fields, in their configured order.
  const activeFields = useMemo(() => regFields.filter(f => f.active), [regFields]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [error, setError] = useState("");
  const [motivIdx, setMotivIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const set = (key: string, v: string) => setValues(prev => ({ ...prev, [key]: v }));
  const get = (key: string) => (values[key] ?? "").trim();

  // Rotate motivations after submission
  useEffect(() => {
    if (!submitted || motivations.length === 0) return;
    timerRef.current = setInterval(() => setMotivIdx(i => (i + 1) % motivations.length), 3500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [submitted, motivations.length]);

  const bannerBg = useMemo(() => ({
    background:
      "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(194,160,99,.20) 0%, transparent 60%), " +
      "radial-gradient(ellipse 90% 60% at 50% 110%, rgba(44,107,121,.14) 0%, transparent 60%)",
  }), []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // Validate every active + required recognized field.
    for (const f of activeFields) {
      if (f.required && !get(f.key)) {
        setError(`الحقل «${f.label}» مطلوب.`);
        return;
      }
    }
    const name = get("name");
    const phone = get("phone");
    if (!name || !phone) { setError("الاسم والجوّال مطلوبان."); return; }

    registerStudent({
      name,
      phone,
      grade: get("grade") || grades[0],
      section: (get("section") || sections[0]) as (typeof sections)[number],
      emergencyContact: get("emergN") || "—",
      emergencyPhone: get("emergP") || "—",
    });
    setSubmittedName(name);
    setSubmitted(true);
  }

  /* ---------- Registration closed ---------- */
  if (!regOpen) {
    return (
      <main className="relative overflow-hidden px-6 py-12" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={bannerBg} />
        <div className="w-full max-w-lg" style={{ textAlign: "center" }}>
          <Logo size={84} priority />
          <div className="mt-6 mb-3 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-accent-warm" />
            <span className="eyebrow">التسجيل مُغلق</span>
            <span className="h-px w-8 bg-accent-warm" />
          </div>
          <h1 className="text-balance text-[clamp(1.6rem,3.6vw,2.3rem)] font-medium leading-tight"
              style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>
            بابُ التسجيل مُغلقٌ حاليّاً
          </h1>
          <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-[1.9] text-text-2">
            اكتمل العددُ المطلوب أو أُغلق التسجيل مؤقّتاً. تابعنا — سيُفتح البابُ في الموسم القادم بإذن الله.
          </p>
          <div className="mt-8">
            <Link href="/" className="rounded border border-line-strong px-5 py-2 text-[13px] text-text-2 hover:border-accent hover:text-text">للصفحة الرئيسة</Link>
          </div>
        </div>
      </main>
    );
  }

  /* ---------- Post-submission motivational screen ---------- */
  if (submitted) {
    return (
      <main className="relative overflow-hidden px-6 py-12" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <Confetti />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={bannerBg} />

        <div className="w-full max-w-2xl" style={{ textAlign: "center" }}>
          <Logo size={92} priority />
          <div className="mt-6 mb-3 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-accent-warm" />
            <span className="eyebrow">قيد المراجعة</span>
            <span className="h-px w-8 bg-accent-warm" />
          </div>
          <h1 className="text-balance text-[clamp(1.8rem,4vw,2.8rem)] font-medium leading-tight"
              style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>
            وصَلَنا طلبُك يا <span className="text-accent">{submittedName.split(" ")[0] || "صديقنا"}</span>
          </h1>

          <p key={motivIdx} className="mt-6 min-h-[3.2rem] text-[17px] leading-[1.9] text-text-2 motiv-fade">
            {motivations[motivIdx]}
          </p>

          <div className="mt-8 mx-auto max-w-md rounded-md border border-line bg-surface/70 px-5 py-4 text-start text-[13px] text-text-2 backdrop-blur">
            <div className="mb-2 text-[11px] tracking-[.14em] text-text-3">ما التالي؟</div>
            <ol className="grid gap-3 leading-[1.9]">
              <li>١ · يراجع طلبَك <span className="text-text">الأميرُ</span> أو نائبُه.</li>
              <li>
                ٢ · لن يُعتمد قبولُك حتى تُسدِّد رسوم السفرة على حساب الجمعيّة:
                <div className="mt-2 rounded border border-line bg-bg-raised px-3 py-2 text-[12.5px] leading-[2]">
                  <div>رقم الحساب (IBAN): <span className="num text-accent">SA4480000585608011476325</span></div>
                  <div>البنك: <span className="text-text">مصرف الراجحي</span></div>
                  <div>المبلغ: <span className="text-text">٥٠٠ ريال</span></div>
                  <div>يُرسَل إيصالُ السداد إلى <span className="text-text">رئيس القسم</span>.</div>
                </div>
              </li>
              <li>٣ · عند الاعتماد ستصلك رسالةُ القبول متضمّنةً <span className="text-text">اسم المستخدم وكلمة المرور</span>.</li>
            </ol>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="rounded border border-line-strong px-5 py-2 text-[13px] text-text-2 hover:border-accent hover:text-text">للصفحة الرئيسة</Link>
            <button onClick={() => { setSubmitted(false); setValues({}); setError(""); }}
              className="rounded border border-line-strong px-5 py-2 text-[13px] text-text-2 hover:border-accent hover:text-text">
              تسجيلٌ آخر
            </button>
          </div>
        </div>

        <style jsx>{`
          .motiv-fade { animation: fade .55s ease; }
          @keyframes fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        `}</style>
      </main>
    );
  }

  /* ---------- The dynamic form ---------- */
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 sm:py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20" style={bannerBg} />

      {/* البند ١٤: أُلغيت الأشرطة النصّيّة المتحرّكة خلف نموذج التسجيل. */}

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
            سجّل رغبتَك بالانضمام إلى <span className="text-accent">محافظة بلّسمر ١٤٤٨هـ</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[52ch] text-[14.5px] text-text-2">
            بياناتك تُحفظ ثم تدخل قائمة الانتظار حتى يعتمدها الأمير — لن تُشارك مع أيّ طرف.
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 grid gap-4 rounded-md border border-line bg-surface/80 p-6 backdrop-blur">
          {activeFields.map(f => <DynamicField key={f.key} field={f} value={values[f.key] ?? ""} onChange={v => set(f.key, v)} />)}

          {error && <p className="text-[13px] text-critical">{error}</p>}

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

/** Renders a single registration field according to its configured `type`.
 *  `grade`/`section` get their known option lists; `ملف` (file) fields show an
 *  informational note since the photo is uploaded after approval (item 9). */
function DynamicField({ field, value, onChange }: { field: RegField; value: string; onChange: (v: string) => void }) {
  const { key, label, type, required } = field;

  if (key === "grade" || (type === "قائمة" && key !== "section")) {
    if (key === "grade") return <SelectField label={label} required={required} value={value} onChange={onChange} options={grades} />;
  }
  if (key === "section") {
    return <SelectField label={label} required={required} value={value} onChange={onChange} options={[...sections]} />;
  }
  if (type === "قائمة") {
    return <SelectField label={label} required={required} value={value} onChange={onChange} options={grades} />;
  }
  if (type === "نص طويل") {
    return <TextArea label={label} value={value} onChange={e => onChange(e.target.value)} />;
  }
  if (type === "ملف") {
    return (
      <div className="rounded border border-dashed border-line-strong bg-bg-raised px-4 py-3 text-[12.5px] text-text-3">
        {label}: تُرفع صورتُك من صفحتك الشخصيّة بعد قبول طلبك.
      </div>
    );
  }
  const inputType = type === "تاريخ" ? "date" : type === "هاتف" ? "tel" : type === "رقم" ? "text" : "text";
  const placeholder = type === "هاتف" ? "0555 000 000" : undefined;
  return (
    <Field
      label={label}
      type={inputType}
      inputMode={type === "رقم" ? "numeric" : undefined}
      value={value}
      onChange={e => onChange(e.target.value)}
      required={required}
      placeholder={placeholder}
    />
  );
}

function SelectField({ label, required, value, onChange, options }: {
  label: string; required: boolean; value: string; onChange: (v: string) => void; options: string[];
}) {
  // A native <select> shows its first option by default but never fires onChange,
  // so the parent's form state stays empty. Seed the default on mount so required
  // dropdowns (e.g. الصف الدراسي) don't block submission when left unchanged.
  useEffect(() => { if (!value && options.length) onChange(options[0]); }, []);
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">{label}{required && <span className="ms-1 text-critical">*</span>}</span>
      <select value={value || options[0]} onChange={e => onChange(e.target.value)} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}
