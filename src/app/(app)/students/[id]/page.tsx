"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Modal, Confirm } from "@/components/ui/Modal";
import { Field, TextArea } from "@/components/ui/Field";
import { useStore } from "@/lib/store/StoreProvider";
import { useSession } from "@/lib/auth/session";
import { copyText } from "@/lib/download";
import { sar, arDate as fmtDate } from "@/lib/format";

const grades = ["الأول ثانوي", "الثاني ثانوي", "الثالث ثانوي"];
const sections = ["ريادة", "علو", "قيادة"] as const;

/** مفاتيح حقول التسجيل التي يقابلها عمودٌ ثابت (تُعرَض في رأس الصفحة/بطاقاتها)،
 *  فلا تُكرَّر في قسم «تفاصيل التسجيل» المخصّص لبقيّة الإجابات. */
const STANDARD_KEYS = new Set(["name", "phone", "grade", "section", "photo", "emergN", "emergP", "nid"]);

export default function StudentDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  // رقم الهوية الكامل للإدارة فقط (الأمير/نائبه)؛ غيرهم يرى القناع.
  const canApprove = session?.role === "PRINCE" || session?.role === "DEPUTY_PRINCE";
  const { students, teams, supervisors, regFields, updateStudent, deleteStudent, moveStudent, setPayment } = useStore();
  // صلاحيّة إدارة الطلاب: الإدارة، أو مشرفٌ مُنِح صلاحيّة «students» — بنفس منطق
  // requirePermission("students") في الخادم. تُخفي أزرار التعديل عمّن لا يملكها.
  const canManage = canApprove || (
    session?.role === "SUPERVISOR" && !!session.supervisorId &&
    (supervisors.find(x => x.id === session.supervisorId)?.permissions ?? []).includes("students")
  );
  // حقول التسجيل المخصّصة (غير الثابتة) النشطة — تُعرَض وتُحرَّر كإجابات.
  const customFields = regFields.filter(f => f.active && !STANDARD_KEYS.has(f.key));
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receiptImgError, setReceiptImgError] = useState(false);

  const s = students.find(x => x.id === params.id);
  const [form, setForm] = useState({
    name: s?.name ?? "", phone: s?.phone ?? "",
    grade: s?.grade ?? grades[0], section: (s?.section ?? sections[0]) as (typeof sections)[number],
    emergencyContact: s?.emergencyContact ?? "", emergencyPhone: s?.emergencyPhone ?? "",
    nationalId: s?.nationalId ?? "",
  });
  // إجابات الحقول المخصّصة أثناء التحرير (مفتاح الحقل → القيمة).
  const [answers, setAnswers] = useState<Record<string, string>>(s?.regAnswers ?? {});
  const [moveTo, setMoveTo] = useState(s?.teamId ?? "");
  const [payAmt, setPayAmt] = useState(s?.paidAmount ?? 0);

  useEffect(() => {
    if (s) {
      document.title = `${s.name} — معالي محافظة بلّسمر`;
      setForm({
        name: s.name, phone: s.phone, grade: s.grade, section: s.section,
        emergencyContact: s.emergencyContact, emergencyPhone: s.emergencyPhone,
        nationalId: s.nationalId ?? "",
      });
      setAnswers(s.regAnswers ?? {});
      setMoveTo(s.teamId); setPayAmt(s.paidAmount);
    }
  }, [s]);

  if (!s) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-text-2">لم أعثر على هذا الشاب. قد يكون قد حُذف.</p>
        <Link href="/students" className="mt-4 inline-block text-accent hover:underline">عودة للقائمة →</Link>
      </div>
    );
  }

  const team = teams.find(t => t.id === s.teamId);
  const parentLink = `${typeof window !== "undefined" ? window.location.origin : ""}/parent/${s.id}?token=demo`;

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const { nationalId, ...base } = form;
    const patch: Partial<typeof s> = {
      ...base,
      // نُبقي فقط إجابات الحقول المخصّصة النشطة (بعد قصّ الفراغات).
      regAnswers: Object.fromEntries(
        customFields.map(f => [f.key, (answers[f.key] ?? "").trim()]).filter(([, v]) => v),
      ),
    };
    // رقم الهوية حسّاسٌ — يُعدّله الأمير/نائبه فقط، ونشتقّ القناع منه.
    if (canApprove) {
      const nid = nationalId.trim();
      patch.nationalId = nid;
      patch.nationalIdMasked = nid ? "••••••" + nid.slice(-4) : "";
    }
    updateStudent(s!.id, patch);
    setEditOpen(false);
  }
  function saveMove(e: React.FormEvent) {
    e.preventDefault();
    if (moveTo !== s!.teamId) moveStudent(s!.id, moveTo);
    setMoveOpen(false);
  }
  function savePay(e: React.FormEvent) {
    e.preventDefault();
    const amt = Math.max(0, Math.min(s!.totalAmount, payAmt));
    const status = amt >= s!.totalAmount ? "PAID" : amt > 0 ? "PARTIAL" : "PENDING";
    setPayment(s!.id, status, amt);
    setPayOpen(false);
  }
  async function copyLink() {
    const ok = await copyText(parentLink);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="الشاب · بطاقةٌ شخصيّة"
        crumbs={[{ href: "/students", label: "الشباب" }, { label: s.name }]}
        title={s.name}
        subtitle={`${s.grade} · ${s.section} · ينتمي لفريق ${team?.name ?? "—"}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-6">
          <Card padded={false}>
            <div className="flex items-center gap-4 border-b border-line p-6">
              {/* الحرف الأوّل كخلفيّة، والصورة فوقه تُجلَب عند الطلب؛ إن لم توجد صورة
                  (404) يُخفى الـ img فيظهر الحرفُ تلقائياً. */}
              <div className="relative h-16 w-16 shrink-0">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-accent text-[24px] font-semibold" style={{ color: "#F4EEE2" }}>
                  {s.name.split(" ")[0]?.[0]}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/students/${s.id}/image?kind=photo`}
                  alt={s.name}
                  loading="lazy"
                  className="absolute inset-0 h-16 w-16 rounded-full object-cover"
                  onError={e => { e.currentTarget.style.display = "none"; }}
                />
              </div>
              <div>
                <div className="text-[18px] font-semibold text-text">{s.name}</div>
                <div className="mt-1 text-[12.5px] text-text-3">الهويّة: {canApprove
                  ? (s.nationalId?.trim()
                      ? <span className="num text-text-2">{s.nationalId}</span>
                      : <span className="italic text-text-3">غير مسجَّل</span>)
                  : <span className="num text-text-2">{s.nationalIdMasked}</span>}</div>
              </div>
            </div>
            <dl className="divide-y divide-line">
              {[
                ["الجوّال", <span key="p" className="num">{s.phone}</span>],
                ["رمز الدخول", s.accessCode
                  ? <span key="c" className="num rounded bg-bg-raised px-2 py-0.5 text-accent tracking-wider">{s.accessCode}</span>
                  : <span key="c" className="text-text-3">—</span>],
                ["الصف", s.grade],
                ["القسم", s.section],
                ["الفريق", <Link key="t" href={`/teams/${s.teamId}`} className="text-accent hover:underline">فريق {team?.name ?? "—"}</Link>],
                ["نقاطه", <span key="pt" className="num">{s.points}</span>],
                ["نسبة الحضور", <span key="a" className="num">{s.attendance}%</span>],
                ["حالة الاعتماد", <Pill key="st" variant={s.approvalStatus === "REJECTED" ? "critical" : s.approvalStatus === "PENDING" ? "warn" : "ok"}>
                  {s.approvalStatus === "REJECTED" ? "مرفوض" : s.approvalStatus === "PENDING" ? "قيد المراجعة" : "معتمد"}
                </Pill>],
                ["تاريخ التسجيل", <span key="rd" className="num">{fmtDate(s.registeredAt)}</span>],
              ].map(([k, v]) => (
                <div key={k as string} className="grid grid-cols-[110px_1fr] gap-4 px-6 py-3 text-[13.5px]">
                  <dt className="text-text-3">{k}</dt>
                  <dd className="text-text">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="بيانات الطوارئ">
            <div className="grid gap-3 text-[13.5px]">
              <div className="flex items-baseline justify-between border-b border-line pb-2">
                <span className="text-text-3">جهة الاتصال</span><span className="text-text">{s.emergencyContact}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-text-3">الرقم</span><span className="num text-text">{s.emergencyPhone}</span>
              </div>
            </div>
          </Card>

          {/* إيصال السداد: يراه الطاقم في أيّ وقت — حتى بعد الاعتماد/الرفض. الصورة
              تُجلَب عند الطلب عبر المسار الآمن (للطاقم فقط). */}
          {canManage && s.receiptStatus && (
            <Card title="إيصال السداد">
              <div className="grid gap-3">
                {!receiptImgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/students/${s.id}/image?kind=receipt`}
                    alt="إيصال السداد"
                    onError={() => setReceiptImgError(true)}
                    className="w-full rounded border border-line"
                  />
                ) : (
                  <p className="text-[13px] text-text-3">تعذّر تحميل صورة الإيصال.</p>
                )}
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="text-text-3">الحالة</span>
                  <Pill variant={s.receiptStatus === "APPROVED" ? "ok" : s.receiptStatus === "REJECTED" ? "critical" : "warn"}>
                    {s.receiptStatus === "APPROVED" ? "معتمد" : s.receiptStatus === "REJECTED" ? "مرفوض" : "قيد المراجعة"}
                  </Pill>
                </div>
                {s.receiptStatus === "APPROVED" && s.receiptAmount != null && (
                  <div className="flex items-center justify-between text-[13.5px]">
                    <span className="text-text-3">المبلغ المعتمد</span><span className="num text-text">{sar(s.receiptAmount)}</span>
                  </div>
                )}
                {s.receiptSubmittedAt && (
                  <div className="flex items-center justify-between text-[13.5px]">
                    <span className="text-text-3">تاريخ الرفع</span><span className="num text-text-2">{fmtDate(s.receiptSubmittedAt)}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* تفاصيل التسجيل: إجابات الحقول المخصّصة التي لا تظهر في رأس الصفحة/بطاقاتها.
              نعرض كلّ حقلٍ نشط، و«لم يُجب» للاختياريّ الذي تركه الطالب فارغاً. */}
          {customFields.length > 0 && (
            <Card title="تفاصيل التسجيل">
              <dl className="grid gap-3 text-[13.5px]">
                {customFields.map(f => {
                  const ans = (s.regAnswers?.[f.key] ?? "").trim();
                  return (
                    <div key={f.key} className="grid gap-1 border-b border-line pb-3 last:border-0 last:pb-0">
                      <dt className="text-[12px] text-text-3">{f.label}</dt>
                      <dd className={ans ? "text-text leading-[1.8]" : "italic text-text-3"} style={{ whiteSpace: "pre-line" }}>
                        {ans || "لم يُجب"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card title="حالة السداد">
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <div className="text-[12px] text-text-3">المسدَّد من الإجمالي</div>
                <div className="num mt-1 text-[24px] text-text">{sar(s.paidAmount)} <span className="text-[13px] text-text-3">/ {sar(s.totalAmount)} SAR</span></div>
              </div>
              <Pill variant={s.paymentStatus === "PAID" ? "ok" : s.paymentStatus === "PARTIAL" ? "warn" : "critical"}>
                {s.paymentStatus === "PAID" ? "مسدَّد بالكامل" : s.paymentStatus === "PARTIAL" ? "سدادٌ جزئي" : "بانتظار السداد"}
              </Pill>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-alt/40">
              <div className="h-full transition-[width]" style={{
                width: `${(s.paidAmount / s.totalAmount) * 100}%`,
                background: s.paymentStatus === "PAID" ? "var(--ok)" : "var(--accent-warm)"
              }} />
            </div>
            {canManage && (
              <div className="mt-4">
                <Button variant="outline" onClick={() => setPayOpen(true)}>تعديل المبلغ المسدَّد</Button>
              </div>
            )}
          </Card>

          <Card title="الإجراءات">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setLinkOpen(true)}>🔗 إرسال رابط ولي الأمر</Button>
              {/* أزرار التعديل/النقل/الإخراج لمن يملك صلاحيّة إدارة الطلاب فقط —
                  والخادم يتحقّق من الصلاحيّة ذاتها في كلّ عمليّة (لا يكفي إخفاء الزر). */}
              {canManage && <>
                <Button variant="outline" onClick={() => setEditOpen(true)}>✎ تعديل البيانات</Button>
                <Button variant="outline" onClick={() => setMoveOpen(true)}>↔ نقل إلى فريقٍ آخر</Button>
                <Button variant="danger"  onClick={() => setDelOpen(true)}>🗑 إخراجٌ من الرحلة</Button>
              </>}
            </div>
          </Card>
        </div>
      </div>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="تعديل بيانات الشاب"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button type="submit" form="edit-student">حفظ التعديلات</Button>
          </>
        }
      >
        <form id="edit-student" onSubmit={saveEdit} className="grid gap-4">
          <Field label="الاسم" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Field label="الجوّال" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">الصف</span>
              <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                {grades.map(g => <option key={g}>{g}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">القسم</span>
              <select value={form.section} onChange={e => setForm({ ...form, section: e.target.value as (typeof sections)[number] })} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                {sections.map(x => <option key={x}>{x}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="جهة الطوارئ" value={form.emergencyContact} onChange={e => setForm({ ...form, emergencyContact: e.target.value })} />
            <Field label="رقم وليّ الأمر" value={form.emergencyPhone} onChange={e => setForm({ ...form, emergencyPhone: e.target.value })} />
          </div>
          {/* رقم الهوية حقلٌ حسّاس — يظهر للأمير/نائبه فقط، والخادم يمنع تعديله من غيرهم. */}
          {canApprove && (
            <Field
              label="رقم الهويّة"
              inputMode="numeric"
              value={form.nationalId}
              onChange={e => setForm({ ...form, nationalId: e.target.value })}
              placeholder="غير مسجَّل"
            />
          )}
          {/* إجابات الحقول المخصّصة القابلة للتحرير. */}
          {customFields.length > 0 && (
            <div className="grid gap-3 border-t border-line pt-4">
              <span className="text-[12px] tracking-[.12em] text-text-3">تفاصيل التسجيل</span>
              {customFields.map(f => (
                f.type === "نص طويل"
                  ? <TextArea key={f.key} label={f.label} value={answers[f.key] ?? ""} onChange={e => setAnswers({ ...answers, [f.key]: e.target.value })} />
                  : <Field key={f.key} label={f.label} value={answers[f.key] ?? ""} onChange={e => setAnswers({ ...answers, [f.key]: e.target.value })} />
              ))}
            </div>
          )}
        </form>
      </Modal>

      {/* Move modal */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="نقلٌ إلى فريقٍ آخر"
        size="sm"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setMoveOpen(false)}>إلغاء</Button>
            <Button type="submit" form="move-student" disabled={moveTo === s.teamId}>نقل الشاب</Button>
          </>
        }
      >
        <form id="move-student" onSubmit={saveMove} className="grid gap-3">
          <p className="text-[13px] text-text-2">اختر الفريق الجديد لـ<b>{s.name}</b>:</p>
          <div className="grid gap-2">
            {teams.map(t => (
              <label key={t.id} className={`flex cursor-pointer items-center gap-3 rounded border p-3 ${moveTo === t.id ? "border-accent bg-accent/5" : "border-line hover:border-accent-warm"}`}>
                <input type="radio" name="team" value={t.id} checked={moveTo === t.id} onChange={() => setMoveTo(t.id)} className="accent-[color:var(--accent)]" />
                <span className="h-3 w-3 rounded" style={{ background: t.color }} />
                <span className="text-[13.5px] text-text">فريق {t.name}</span>
                {t.id === s.teamId && <span className="ms-auto text-[11px] text-text-3">(الحالي)</span>}
              </label>
            ))}
          </div>
        </form>
      </Modal>

      {/* Payment modal */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="تعديل مبلغ السداد"
        size="sm"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setPayOpen(false)}>إلغاء</Button>
            <Button type="submit" form="pay-form">حفظ</Button>
          </>
        }
      >
        <form id="pay-form" onSubmit={savePay} className="grid gap-3">
          <Field
            label={`المبلغ المسدَّد (بحد أقصى ${sar(s.totalAmount)})`}
            type="number" min={0} max={s.totalAmount}
            value={payAmt} onChange={e => setPayAmt(Number(e.target.value))}
          />
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={() => setPayAmt(0)}>صفر</Button>
            <Button variant="outline" type="button" onClick={() => setPayAmt(Math.round(s.totalAmount / 2))}>نصف</Button>
            <Button variant="outline" type="button" onClick={() => setPayAmt(s.totalAmount)}>كامل</Button>
          </div>
          <p className="mt-2 text-[12px] text-text-3">
            الحالة الجديدة: <b className="text-text">{payAmt >= s.totalAmount ? "مسدَّد بالكامل" : payAmt > 0 ? "سدادٌ جزئي" : "بانتظار السداد"}</b>
          </p>
        </form>
      </Modal>

      {/* Parent link modal */}
      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="رابط ولي الأمر"
        subtitle="رابطٌ خاصٌّ يفتح بطاقةَ الشاب فقط، بدون حسابٍ كامل."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>إغلاق</Button>
            <Button onClick={copyLink}>{copied ? "✓ تم النسخ" : "نسخ الرابط"}</Button>
          </>
        }
      >
        <div className="rounded border border-line bg-bg-raised px-3 py-2 text-[12px]">
          <code className="lat text-accent break-all">{parentLink}</code>
        </div>
        <p className="mt-3 text-[12px] text-text-3">أرسله لولي الأمر عبر واتساب أو الرسائل — لا يحتاج تسجيل دخول.</p>
      </Modal>

      {/* Delete confirm */}
      <Confirm
        open={delOpen}
        onClose={() => setDelOpen(false)}
        onConfirm={() => { deleteStudent(s!.id); router.push("/students"); }}
        title={`إخراج ${s.name} من الرحلة؟`}
        message="سيُحذف الشاب وكلّ نقاطه وسجلّات حضوره. هذا الإجراء لا يمكن التراجع عنه في النسخة التجريبية."
        confirmLabel="نعم، أخرِجه"
        danger
      />
    </div>
  );
}
