"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { useSession } from "@/lib/auth/session";
import { useStore } from "@/lib/store/StoreProvider";
import { downloadCSV } from "@/lib/download";
import type { PaymentStatus, Student } from "@/lib/mock/types";

const grades = ["الأول ثانوي", "الثاني ثانوي", "الثالث ثانوي"];
const sections = ["ريادة", "علو", "قيادة"] as const;

const sar = (n: number) => new Intl.NumberFormat("ar-SA-u-nu-latn").format(n);
const isApproved = (s: Student) => (s.approvalStatus ?? "APPROVED") === "APPROVED";
const isWaiting  = (s: Student) => s.approvalStatus === "PENDING";

export default function StudentsPage() {
  useEffect(() => { document.title = "الشباب — معالي أبها"; }, []);
  const { session } = useSession();
  const { students, teams, addStudent, approveStudent, rejectStudent } = useStore();

  // Only PRINCE / DEPUTY_PRINCE can approve/reject
  const canApprove = session?.role === "PRINCE" || session?.role === "DEPUTY_PRINCE";

  const [q, setQ] = useState("");
  const [teamFilter, setTeamFilter] = useState<"ALL" | string>("ALL");
  const [payFilter, setPayFilter] = useState<"ALL" | PaymentStatus>("ALL");
  const [openAdd, setOpenAdd] = useState(false);
  const [openWaitlist, setOpenWaitlist] = useState(false);
  const [openUnpaid, setOpenUnpaid] = useState(false);
  const [approveFor, setApproveFor] = useState<Student | null>(null);
  const [approveTeamId, setApproveTeamId] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", grade: grades[0], section: sections[0] as (typeof sections)[number],
    teamId: teams[0]?.id ?? "", emergencyContact: "", emergencyPhone: "",
  });

  // Main list = APPROVED students (paid + unpaid), filtered
  const approvedAll = useMemo(() => students.filter(isApproved), [students]);
  const filtered = useMemo(() => approvedAll.filter(s => {
    if (teamFilter !== "ALL" && s.teamId !== teamFilter) return false;
    if (payFilter !== "ALL" && s.paymentStatus !== payFilter) return false;
    if (q.trim()) {
      const needle = q.trim();
      if (!s.name.includes(needle) && !s.nationalIdMasked.includes(needle) && !s.phone.includes(needle)) return false;
    }
    return true;
  }), [approvedAll, teamFilter, payFilter, q]);

  const waitlist = useMemo(
    () => students.filter(isWaiting).sort((a, b) => (a.registeredAt ?? "").localeCompare(b.registeredAt ?? "")),
    [students],
  );
  const unpaid = useMemo(
    () => approvedAll.filter(s => s.paymentStatus !== "PAID"),
    [approvedAll],
  );

  const summary = useMemo(() => ({
    total: approvedAll.length,
    paid: approvedAll.filter(s => s.paymentStatus === "PAID").length,
    partial: approvedAll.filter(s => s.paymentStatus === "PARTIAL").length,
    pending: approvedAll.filter(s => s.paymentStatus === "PENDING").length,
    collected: approvedAll.reduce((s, x) => s + x.paidAmount, 0),
    target: approvedAll.reduce((s, x) => s + x.totalAmount, 0),
  }), [approvedAll]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.teamId) return;
    const st: Omit<Student, "id" | "nationalIdMasked" | "points" | "attendance"> = {
      name: form.name.trim(),
      phone: form.phone.trim() || "—",
      grade: form.grade,
      section: form.section,
      teamId: form.teamId,
      paymentStatus: "PENDING",
      paidAmount: 0,
      totalAmount: 2500,
      emergencyContact: form.emergencyContact.trim() || "—",
      emergencyPhone: form.emergencyPhone.trim() || "—",
    };
    addStudent(st);
    setForm({ name: "", phone: "", grade: grades[0], section: sections[0], teamId: teams[0]?.id ?? "", emergencyContact: "", emergencyPhone: "" });
    setOpenAdd(false);
  }

  function exportFiltered() {
    const rows: (string | number)[][] = [
      ["الاسم", "الهويّة", "الجوّال", "الصف", "القسم", "الفريق", "الحضور %", "النقاط", "السداد"],
      ...filtered.map(s => {
        const t = teams.find(t => t.id === s.teamId);
        return [s.name, s.nationalIdMasked, s.phone, s.grade, s.section, t?.name ?? "—",
          s.attendance, s.points,
          s.paymentStatus === "PAID" ? "مسدَّد" : s.paymentStatus === "PARTIAL" ? "جزئي" : "معلّق"];
      }),
    ];
    downloadCSV(`الشباب_${filtered.length}`, rows);
  }

  function openApproveDialog(st: Student) {
    setApproveFor(st);
    setApproveTeamId(teams[0]?.id ?? "");
  }

  function confirmApprove() {
    if (!approveFor || !approveTeamId) return;
    approveStudent(approveFor.id, approveTeamId);
    setApproveFor(null);
  }

  function whatsappCredentials(st: Student) {
    // Placeholder for real WhatsApp API — opens wa.me pre-filled for the guardian
    const url = typeof window !== "undefined" ? window.location.origin + "/login" : "/login";
    const msg =
      `أهلاً بك في «معالي أبها ١٤٤٨هـ» 🌿%0A%0A` +
      `اسم المستخدم: ${st.phone}%0A` +
      `رمز الدخول: ${st.accessCode ?? "—"}%0A` +
      `رابط الدخول: ${url}%0A%0A` +
      `في أوّل دخول أضف صورتك الشخصيّة.`;
    const phone = st.phone.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank", "noopener");
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8">
      <PageHeader
        eyebrow="الشباب"
        title="الشباب"
        subtitle={`${summary.total} شاباً معتمداً موزَّعون على ${teams.length} فريقاً. البحث والفلترة تعملان مباشرةً على القائمة أدناه.`}
        action={<Button variant="primary" onClick={() => setOpenAdd(true)}>+ شابٌّ جديد</Button>}
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="المعتمدون"     value={summary.total} />
        <KpiCard label="مكتمل السداد" value={summary.paid} sub={`${sar(summary.collected)} SAR محصّلة`} variant="ok" />
        <KpiCard label="سدادٌ جزئي"    value={summary.partial} variant="warn" />
        <KpiCard label="بانتظار السداد" value={summary.pending} sub="يتطلّب متابعة" variant="critical" />
      </section>

      {/* ── Two collapsible sub-lists (Waitlist + Unpaid) ── */}
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <details open={openWaitlist} onToggle={e => setOpenWaitlist((e.target as HTMLDetailsElement).open)}
          className="group rounded-md border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
            <span className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-warm/15 text-[13px] text-accent-warm-2">⏳</span>
              <span>
                <span className="text-[14px] font-medium text-text">قائمة الانتظار</span>
                <span className="ms-2 num text-[12px] text-text-3">{waitlist.length}</span>
              </span>
            </span>
            <span className="text-[12px] text-text-3 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="border-t border-line">
            {waitlist.length === 0 ? (
              <div className="px-5 py-6 text-center text-[12.5px] text-text-3">لا توجد طلبات انتظار حالياً.</div>
            ) : (
              <ul className="divide-y divide-line">
                {waitlist.map(s => (
                  <li key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3">
                    <div>
                      <div className="text-[13.5px] text-text">{s.name}</div>
                      <div className="num text-[11.5px] text-text-3">{s.grade} · {s.section} · {s.phone}</div>
                    </div>
                    {canApprove ? (
                      <div className="flex gap-2 text-[12px]">
                        <button onClick={() => openApproveDialog(s)} className="rounded border border-ok/40 bg-ok/10 px-3 py-1 text-ok hover:bg-ok/20">اعتماد</button>
                        <button onClick={() => rejectStudent(s.id)} className="rounded border border-critical/40 bg-critical/10 px-3 py-1 text-critical hover:bg-critical/20">رفض</button>
                      </div>
                    ) : (
                      <Pill variant="warn">بانتظار الاعتماد</Pill>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>

        <details open={openUnpaid} onToggle={e => setOpenUnpaid((e.target as HTMLDetailsElement).open)}
          className="group rounded-md border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
            <span className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-critical/15 text-[13px] text-critical">﷼</span>
              <span>
                <span className="text-[14px] font-medium text-text">غير المسدَّدين</span>
                <span className="ms-2 num text-[12px] text-text-3">{unpaid.length}</span>
              </span>
            </span>
            <span className="text-[12px] text-text-3 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="border-t border-line">
            {unpaid.length === 0 ? (
              <div className="px-5 py-6 text-center text-[12.5px] text-text-3">الجميع سدَّدوا 🎉</div>
            ) : (
              <ul className="divide-y divide-line">
                {unpaid.map(s => {
                  const team = teams.find(t => t.id === s.teamId);
                  return (
                    <li key={s.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3">
                      <div>
                        <Link href={`/students/${s.id}`} className="text-[13.5px] text-text hover:text-accent">{s.name}</Link>
                        <div className="num text-[11.5px] text-text-3">{team?.name ?? "—"} · {sar(s.paidAmount)}/{sar(s.totalAmount)}</div>
                      </div>
                      <Pill variant={s.paymentStatus === "PARTIAL" ? "warn" : "critical"}>
                        {s.paymentStatus === "PARTIAL" ? "جزئي" : "معلّق"}
                      </Pill>
                      <button
                        onClick={() => whatsappCredentials(s)}
                        className="rounded border border-accent-warm/40 bg-accent-warm/10 px-3 py-1 text-[12px] text-accent-warm-2 hover:bg-accent-warm/20"
                      >↗ تذكير</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </details>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="ابحث باسم الشاب، رقم الهويّة، أو الجوّال..."
          className="min-w-[220px] flex-1 rounded border border-line-strong bg-surface px-4 py-2 text-[14px] placeholder:text-text-3"
        />
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value as "ALL" | string)} className="rounded border border-line-strong bg-surface px-3 py-2 text-[13px] text-text-2">
          <option value="ALL">كلّ الفرق</option>
          {teams.map(t => <option key={t.id} value={t.id}>فريق {t.name}</option>)}
        </select>
        <select value={payFilter} onChange={e => setPayFilter(e.target.value as "ALL" | PaymentStatus)} className="rounded border border-line-strong bg-surface px-3 py-2 text-[13px] text-text-2">
          <option value="ALL">كلّ حالات السداد</option>
          <option value="PAID">مسدَّد</option>
          <option value="PARTIAL">جزئي</option>
          <option value="PENDING">معلّق</option>
        </select>
        <Button variant="outline" onClick={exportFiltered}>⬇ تصدير CSV</Button>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead className="text-[11px] tracking-[.14em] text-text-3">
            <tr className="border-b border-line">
              <th className="px-5 py-3 text-start font-normal">الاسم</th>
              <th className="px-5 py-3 text-start font-normal">الفريق</th>
              <th className="px-5 py-3 text-start font-normal">الصف · القسم</th>
              <th className="px-5 py-3 text-end font-normal">الحضور</th>
              <th className="px-5 py-3 text-end font-normal">النقاط</th>
              <th className="px-5 py-3 text-end font-normal">السداد</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-text-3">لا نتائج مطابقة.</td></tr>
            )}
            {filtered.slice(0, 100).map(s => {
              const team = teams.find(t => t.id === s.teamId);
              return (
                <tr key={s.id} className="border-b border-line hover:bg-bg-raised">
                  <td className="px-5 py-3">
                    <Link href={`/students/${s.id}`} className="text-text hover:text-accent">{s.name}</Link>
                    <span className="num ms-2 text-[11px] text-text-3">{s.nationalIdMasked}</span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/teams/${s.teamId}`} className="text-text-2 hover:text-accent">فريق {team?.name ?? "—"}</Link>
                  </td>
                  <td className="px-5 py-3 text-text-2">{s.grade} · {s.section}</td>
                  <td className="num px-5 py-3 text-end text-text-2">{s.attendance}%</td>
                  <td className="num px-5 py-3 text-end text-text-2">{s.points}</td>
                  <td className="px-5 py-3 text-end">
                    <Pill variant={s.paymentStatus === "PAID" ? "ok" : s.paymentStatus === "PARTIAL" ? "warn" : "critical"}>
                      {s.paymentStatus === "PAID" ? "مسدَّد" : s.paymentStatus === "PARTIAL" ? "جزئي" : "معلّق"}
                    </Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {filtered.length > 100 && (
          <div className="border-t border-line px-5 py-3 text-center text-[12.5px] text-text-3">
            عُرضت أوّل ١٠٠ من {filtered.length} — استخدم البحث لتقليصها.
          </div>
        )}
      </Card>

      {/* Add-student modal (admin manual entry) */}
      <Modal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        title="إضافة شابٍّ جديد"
        subtitle="إدخالٌ يدويٌّ من الإدارة — سيُعتمد مباشرةً بلا مرورٍ على قائمة الانتظار."
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setOpenAdd(false)}>إلغاء</Button>
            <Button type="submit" form="add-student">تسجيل الشاب</Button>
          </>
        }
      >
        <form id="add-student" onSubmit={submit} className="grid gap-4">
          <Field label="الاسم الرباعي" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="الجوّال" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0555 000 000" />
            <label className="block">
              <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">الفريق</span>
              <select value={form.teamId} onChange={e => setForm({ ...form, teamId: e.target.value })} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                {teams.map(t => <option key={t.id} value={t.id}>فريق {t.name}</option>)}
              </select>
            </label>
          </div>
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
                {sections.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم جهة الطوارئ" value={form.emergencyContact} onChange={e => setForm({ ...form, emergencyContact: e.target.value })} placeholder="والد الطالب" />
            <Field label="رقم الطوارئ" value={form.emergencyPhone} onChange={e => setForm({ ...form, emergencyPhone: e.target.value })} placeholder="0555 000 000" />
          </div>
        </form>
      </Modal>

      {/* Approve-from-waitlist modal (pick a team, then send WA) */}
      <Modal
        open={approveFor !== null}
        onClose={() => setApproveFor(null)}
        title={approveFor ? `اعتماد الشاب ${approveFor.name}` : ""}
        subtitle="اختر الفريق الذي ينضمّ إليه. عند التأكيد سيُنقل إلى قائمة «غير المسدَّدين» وسيُولَّد له رمز دخول."
        footer={
          <>
            <Button variant="outline" onClick={() => setApproveFor(null)}>إلغاء</Button>
            <Button onClick={confirmApprove} disabled={!approveTeamId}>اعتماد وتوليد رمز</Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">الفريق</span>
          <select value={approveTeamId} onChange={e => setApproveTeamId(e.target.value)}
            className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
            {teams.map(t => <option key={t.id} value={t.id}>فريق {t.name}</option>)}
          </select>
        </label>
        {approveFor?.phone && (
          <p className="mt-3 text-[12px] text-text-3">
            سيُرسَل الرمز إلى <span className="num">{approveFor.phone}</span> عبر واتساب بعد الاعتماد (زر «↗ تذكير» في قائمة غير المسدَّدين).
          </p>
        )}
      </Modal>
    </div>
  );
}

