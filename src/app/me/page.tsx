"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useSession, clearSession, announceSessionChange } from "@/lib/auth/session";
import { useStore } from "@/lib/store/StoreProvider";
import { LoadErrorBanner } from "@/components/LoadErrorBanner";
import { VersionWatcher } from "@/components/VersionWatcher";
import { sar } from "@/lib/format";

export default function MePage() {
  const { session, ready } = useSession();
  const router = useRouter();
  const { students, teams, studentTasks, submitReceipt, setStudentPhoto, hydrated, loadError } = useStore();
  const [payOpen, setPayOpen] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const receiptRef = useRef<HTMLInputElement | null>(null);
  const [receiptErr, setReceiptErr] = useState("");
  const [receiptDraft, setReceiptDraft] = useState<string>("");

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoErr("الملف يجب أن يكون صورة."); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoErr("الحدّ الأقصى ٥ ميغابايت."); return; }
    setPhotoErr("");
    const reader = new FileReader();
    reader.onload = () => { if (student) setStudentPhoto(student.id, String(reader.result)); };
    reader.readAsDataURL(file);
  }

  function onReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setReceiptErr("الإيصال يجب أن يكون صورة."); return; }
    if (file.size > 5 * 1024 * 1024) { setReceiptErr("الحدّ الأقصى ٥ ميغابايت."); return; }
    setReceiptErr("");
    const reader = new FileReader();
    reader.onload = () => setReceiptDraft(String(reader.result));
    reader.readAsDataURL(file);
  }

  function sendReceipt() {
    if (!student || !receiptDraft) { setReceiptErr("أرفِق صورة الإيصال أولاً."); return; }
    // الطالب يرسل صورة الإيصال فقط؛ الأمير يتحقّق من المبلغ ويعتمده يدويّاً.
    submitReceipt(student.id, receiptDraft);
    setReceiptDraft(""); setReceiptErr("");
    setPayOpen(false);
  }

  useEffect(() => {
    if (!ready) return;
    if (!session) { router.replace("/login"); return; }
    if (session.role !== "BENEFICIARY") { router.replace("/dashboard"); return; }
  }, [ready, session, router]);

  const student = session?.studentId ? students.find(s => s.id === session.studentId) : null;
  useEffect(() => { document.title = student ? `${student.name.split(" ")[0]} — معالي` : "معالي محافظة بلّسمر"; }, [student]);

  // فشلُ تحميل البيانات (نسخةٌ قديمة/شبكة/خادم) يجب ألّا يظهر كـ«تحميلٍ» أبديّ صامت.
  if (!student && hydrated && loadError) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <LoadErrorBanner />
        </div>
        <VersionWatcher />
      </main>
    );
  }
  // لم تُحمَّل بعد (الجلسة أو اللقطة قيدَ الوصول) → مؤشّر تحميلٍ مؤقّت.
  if (!ready || !hydrated || !student) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="text-[13px] text-text-3">جارٍ التحميل...</div>
      </main>
    );
  }

  const team = teams.find(t => t.id === student.teamId);
  const paidPct = Math.round((student.paidAmount / student.totalAmount) * 100);
  // مهامّي: اللقطة الخاصّة بالمستفيد تُحمّل مهامّه المرئيّة فقط.
  const myTasks = studentTasks.filter(t => t.studentId === student.id);
  const myPoints = myTasks.filter(t => t.done).reduce((sum, t) => sum + t.points, 0);

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-bg-raised">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Logo size={72} priority />
          <button
            onClick={async () => { await clearSession(); announceSessionChange(); router.push("/login"); }}
            className="rounded border border-line-strong px-3 py-1.5 text-[12px] text-text-2 hover:border-accent hover:text-text"
          >
            خروج
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl"><LoadErrorBanner /></div>
      <VersionWatcher />

      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="h-px w-8 bg-accent-warm" />
          <span className="eyebrow">صفحةُ الشاب</span>
        </div>
        <h1 className="text-balance text-[34px] font-medium leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>
          أهلاً بك يا <span className="text-accent">{student.name.split(" ")[0]}</span>
        </h1>
        <p className="mt-2 max-w-[54ch] text-[15px] text-text-2">
          هذه صفحتُك الشخصيّة في رحلة معالي ١٤٤٨هـ — بياناتُك، أسرتُك، وحالة سدادك.
        </p>

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="أسرتك"    value={team?.name ?? "—"} sub={`المشرف ينتظر رسالتك`} />
          <KpiCard label="نقاطك"    value={student.points} sub={`ضمن ${team?.name ?? "—"}`} variant="ok" />
          <KpiCard label="حضورك"    value={`${student.attendance}%`} variant={student.attendance >= 90 ? "ok" : "warn"} />
          <KpiCard label="حالة سدادك" value={student.paymentStatus === "PAID" ? "مكتمل" : student.paymentStatus === "PARTIAL" ? "جزئي" : "معلّق"}
            variant={student.paymentStatus === "PAID" ? "ok" : student.paymentStatus === "PARTIAL" ? "warn" : "critical"} />
        </section>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card title="صورتك الشخصيّة">
            <div className="flex items-center gap-4">
              {student.photoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={student.photoDataUrl} alt={student.name} className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-full bg-accent text-[28px] font-semibold" style={{ color: "#F4EEE2" }}>
                  {student.name.split(" ")[0]?.[0]}
                </div>
              )}
              <div className="flex-1">
                <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  {student.photoDataUrl ? "تغيير الصورة" : "رفع صورتك"}
                </Button>
                <p className="mt-2 text-[12px] text-text-3">صورةٌ واضحة لوجهك — بحدٍّ أقصى ٥ ميغابايت.</p>
                {photoErr && <p className="mt-1 text-[12px] text-critical">{photoErr}</p>}
              </div>
            </div>
          </Card>

          <Card title="بياناتك">
            <dl className="grid gap-3 text-[13.5px]">
              <Row k="الاسم"   v={student.name} />
              <Row k="الهويّة"  v={<span className="num">{student.nationalIdMasked}</span>} />
              <Row k="الجوّال"  v={<span className="num">{student.phone}</span>} />
              <Row k="الصف"    v={student.grade} />
              <Row k="القسم"   v={student.section} />
            </dl>
          </Card>

          <Card title="السداد">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[11px] tracking-[.14em] text-text-3">المسدَّد</div>
                <div className="num mt-1 text-[22px] text-text">{sar(student.paidAmount)} <span className="text-[12px] text-text-3">/ {sar(student.totalAmount)} SAR</span></div>
              </div>
              <Pill variant={student.paymentStatus === "PAID" ? "ok" : student.paymentStatus === "PARTIAL" ? "warn" : "critical"}>
                {student.paymentStatus === "PAID" ? "مسدَّد" : student.paymentStatus === "PARTIAL" ? "جزئي" : "معلّق"}
              </Pill>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-alt/40">
              <div className="h-full transition-[width] duration-500" style={{ width: `${paidPct}%`, background: student.paymentStatus === "PAID" ? "var(--ok)" : "var(--accent-warm)" }} />
            </div>
            {student.receiptStatus === "PENDING" ? (
              <div className="mt-5 rounded border border-accent-warm/40 bg-accent-warm/10 px-3 py-2.5 text-[12.5px] text-accent-warm-2">
                إيصالك قيد المراجعة من الأمير — ستُحدَّث حالتك بعد الاعتماد.
              </div>
            ) : student.paymentStatus !== "PAID" && (
              <>
                {student.receiptStatus === "REJECTED" && (
                  <p className="mt-4 text-[12.5px] text-critical">تعذّر اعتماد إيصالك السابق — يُرجى رفع إيصالٍ صحيح.</p>
                )}
                <Button className="mt-5 w-full" onClick={() => setPayOpen(true)}>
                  رفع إيصال السداد ({sar(student.totalAmount - student.paidAmount)} SAR)
                </Button>
              </>
            )}
          </Card>

          <Card title="بيانات الطوارئ">
            <dl className="grid gap-3 text-[13.5px]">
              <Row k="جهة الاتصال" v={student.emergencyContact} />
              <Row k="الرقم"       v={<span className="num">{student.emergencyPhone}</span>} />
            </dl>
            <p className="mt-4 text-[12px] text-text-3">إن تغيّرت بيانات الطوارئ، أخبر مشرف أسرتك.</p>
          </Card>
        </div>

        <section className="mt-6">
          <Card title="مهامي" action={<span className="text-[11.5px] text-text-3">{myTasks.filter(t => !t.done).length} مفتوحة · {myPoints} نقطة</span>}>
            {myTasks.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-text-3">لا مهامّ مرصودة لك بعد — تابع مشرفك.</p>
            ) : (
              <ul className="grid gap-2">
                {myTasks.map(t => (
                  <li key={t.id} className="flex items-start gap-3 rounded border border-line px-3 py-2.5">
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${t.done ? "bg-ok text-[#F4EEE2]" : "border border-line-strong text-text-3"}`}>
                      {t.done ? "✓" : ""}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[13.5px] ${t.done ? "text-text-3 line-through" : "text-text"}`}>{t.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Pill variant={t.done ? "ok" : "info"}>{t.points} نقطة</Pill>
                        {t.dueDate && <span className="num text-[11px] text-text-3">حتى {t.dueDate}</span>}
                        {t.done && <span className="text-[11px] text-ok">تم الإنجاز</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[12px] text-text-3">هذه مهامّك التحفيزيّة — يعتمد مشرفك إنجازها فتُضاف نقاطها إلى رصيدك.</p>
          </Card>
        </section>

        <p className="mt-10 text-center text-[12.5px] text-text-3">
          <Link href="/login" className="hover:text-accent">بدّل الحساب →</Link>
        </p>
      </div>

      <Modal
        open={payOpen}
        onClose={() => { setPayOpen(false); setReceiptDraft(""); setReceiptErr(""); }}
        title="رفع إيصال السداد"
        subtitle="حوّل المبلغ إلى حساب الرحلة، ثم أرفِق صورةً واضحة للإيصال — يعتمدها الأمير ثم تُحدَّث حالتك."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setPayOpen(false); setReceiptDraft(""); setReceiptErr(""); }}>إلغاء</Button>
            <Button onClick={sendReceipt} disabled={!receiptDraft}>إرسال للمراجعة</Button>
          </>
        }
      >
        <div className="grid gap-4 text-[13.5px] text-text-2">
          <div className="flex justify-between border-b border-line pb-2"><span>الطالب</span><span className="text-text">{student.name}</span></div>
          <div className="flex justify-between border-b border-line pb-2"><span>المسدَّد سابقاً</span><span className="num text-text">{sar(student.paidAmount)}</span></div>
          <div className="flex justify-between text-[15px] font-semibold"><span>المبلغ المتبقّي</span><span className="num text-accent">{sar(student.totalAmount - student.paidAmount)} SAR</span></div>

          <p className="text-[12px] text-text-3">أرفِق صورة الإيصال فقط — يتحقّق الأمير من المبلغ ويعتمده.</p>

          <div>
            <input ref={receiptRef} type="file" accept="image/*" onChange={onReceiptFile} className="hidden" />
            {receiptDraft ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptDraft} alt="معاينة الإيصال" className="h-20 w-20 rounded border border-line object-cover" />
                <Button variant="outline" onClick={() => receiptRef.current?.click()}>تغيير الصورة</Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => receiptRef.current?.click()}>أرفِق صورة الإيصال</Button>
            )}
            {receiptErr && <p className="mt-2 text-[12px] text-critical">{receiptErr}</p>}
          </div>
        </div>
      </Modal>
    </main>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-b-0">
      <dt className="text-text-3">{k}</dt>
      <dd className="text-text">{v}</dd>
    </div>
  );
}
