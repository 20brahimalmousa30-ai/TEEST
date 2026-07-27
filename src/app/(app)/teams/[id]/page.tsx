"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { Button } from "@/components/ui/Button";
import { Modal, Confirm } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { useStore } from "@/lib/store/StoreProvider";
import { downloadCSV } from "@/lib/download";
import { fileToDataUrl, extractDominantColor } from "@/lib/image";
import type { Student } from "@/lib/mock/types";

const grades = ["الأول ثانوي", "الثاني ثانوي", "الثالث ثانوي"];
const sections = ["ريادة", "علو", "قيادة"] as const;

export default function TeamDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { teams, students, supervisors, deleteTeam, addStudent, updateTeam } = useStore();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [imgErr, setImgErr] = useState("");
  const imgRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", grade: grades[0], section: sections[0] as (typeof sections)[number] });

  const team = teams.find(t => t.id === params.id);
  useEffect(() => { document.title = team ? `فريق ${team.name} — معالي محافظة بلّسمر` : "الفرق"; }, [team]);

  if (!team) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-text-2">لم أعثر على هذا الفريق. قد يكون قد حُذف.</p>
        <Link href="/teams" className="mt-4 inline-block text-accent hover:underline">عودة للفرق →</Link>
      </div>
    );
  }

  const sup = supervisors.find(s => s.id === team.supervisorId);
  const roster = students.filter(s => s.teamId === team.id);
  const filtered = search
    ? roster.filter(s => s.name.includes(search) || s.nationalIdMasked.includes(search) || s.phone.includes(search))
    : roster;
  const paid = roster.filter(s => s.paymentStatus === "PAID").length;
  const partial = roster.filter(s => s.paymentStatus === "PARTIAL").length;
  const pending = roster.filter(s => s.paymentStatus === "PENDING").length;
  const totalPts = roster.reduce((s, x) => s + x.points, 0);
  const avgAtt = roster.length ? Math.round(roster.reduce((s, x) => s + x.attendance, 0) / roster.length) : 0;

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const newStudent: Omit<Student, "id" | "nationalIdMasked" | "points" | "attendance"> = {
      name: form.name.trim(),
      phone: form.phone.trim() || "—",
      grade: form.grade,
      section: form.section,
      teamId: team!.id,
      paymentStatus: "PENDING",
      paidAmount: 0,
      totalAmount: 500,
      emergencyContact: "—",
      emergencyPhone: "—",
    };
    addStudent(newStudent);
    setForm({ name: "", phone: "", grade: grades[0], section: sections[0] });
    setAddOpen(false);
  }

  function exportRoster() {
    const rows: (string | number)[][] = [
      ["الاسم", "الجوّال", "الصف", "القسم", "الحضور %", "النقاط", "السداد"],
      ...roster.map(s => [s.name, s.phone, s.grade, s.section, s.attendance, s.points,
        s.paymentStatus === "PAID" ? "مسدَّد" : s.paymentStatus === "PARTIAL" ? "جزئي" : "معلّق"]),
    ];
    downloadCSV(`فريق_${team!.name}_${roster.length}_عضو`, rows);
  }

  function whatsappTeam() {
    // Real WhatsApp link — opens WhatsApp Web / app
    const msg = encodeURIComponent(`السلام عليكم، ${team!.name}: تذكيرٌ باللقاء المسائي غداً في القاعة الرئيسة.`);
    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener");
  }

  async function onTeamImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setImgErr("الملف يجب أن يكون صورة."); return; }
    if (file.size > 5 * 1024 * 1024) { setImgErr("الحدّ الأقصى ٥ ميغابايت."); return; }
    setImgErr("");
    try {
      const dataUrl = await fileToDataUrl(file);
      // البند ١٨: يُشتقّ اللون المميّز تلقائياً من الصورة المرفوعة.
      const color = await extractDominantColor(dataUrl).catch(() => team!.color);
      updateTeam(team!.id, { imageDataUrl: dataUrl, color });
    } catch {
      setImgErr("تعذّرت قراءة الصورة.");
    }
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="تفاصيلُ الفريق"
        crumbs={[{ href: "/teams", label: "الفرق" }, { label: `فريق ${team.name}` }]}
        title={`فريق ${team.name}`}
        subtitle={team.tagline}
        action={<TeamBadge letters={team.badge} color={team.color} size={44} image={team.imageDataUrl} />}
      />

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="الأعضاء" value={roster.length} sub={`${roster.length} من ${team.studentCount || roster.length} مسجّل`} />
        <KpiCard label="نقاط الفريق" value={team.points} sub={roster.length ? `متوسّط ${Math.round(totalPts / roster.length)} نقطة/عضو` : "—"} variant="ok" />
        <KpiCard label="السداد" value={`${paid}/${roster.length}`} sub={partial > 0 ? `+ ${partial} جزئي · ${pending} معلّق` : "لا سدادات معلّقة"} variant={pending > roster.length * 0.2 ? "warn" : "ok"} />
        <KpiCard label="متوسّط الحضور" value={`${avgAtt}%`} variant={avgAtt >= 90 ? "ok" : "warn"} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card
          title={`الأعضاء (${filtered.length}${filtered.length !== roster.length ? ` من ${roster.length}` : ""})`}
          action={
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث باسمٍ أو رقم..."
              className="rounded border border-line px-3 py-1.5 text-[13px]"
            />
          }
          padded={false}
        >
          <div className="max-h-[520px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-5 py-10 text-center text-[13px] text-text-3">لا نتائج مطابقة.</div>
            )}
            {filtered.map(st => (
              <div key={st.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-line px-5 py-3 last:border-b-0">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-surface-alt/60 text-[13px] font-semibold text-text-2">
                  {st.name.split(" ")[0]?.[0]}
                </div>
                <div>
                  <div className="text-[14px] text-text">
                    <Link href={`/students/${st.id}`} className="hover:text-accent">{st.name}</Link>
                  </div>
                  <div className="text-[11.5px] text-text-3">{st.grade} · {st.section} · <span className="num">{st.nationalIdMasked}</span></div>
                </div>
                <span className="num text-[12.5px] text-text-2">{st.points} نقطة</span>
                <Pill variant={st.paymentStatus === "PAID" ? "ok" : st.paymentStatus === "PARTIAL" ? "warn" : "critical"}>
                  {st.paymentStatus === "PAID" ? "مسدَّد" : st.paymentStatus === "PARTIAL" ? "جزئي" : "معلّق"}
                </Pill>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="المشرف المسؤول">
            {sup ? (
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-accent text-[14px] font-semibold" style={{ color: "#F4EEE2" }}>{sup.name[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-medium text-text">{sup.name}</div>
                  <div className="mt-1 text-[12px] text-text-3"><span className="num">{sup.phone}</span> · {sup.email}</div>
                  <div className="mt-3 text-[12px] text-text-2">
                    ينتمي أيضاً لـ: {sup.committeeIds.length ? `${sup.committeeIds.length} لجان` : "لا لجان"}
                  </div>
                </div>
              </div>
            ) : <p className="text-text-3">لا مشرفٌ معيّن</p>}
          </Card>

          <Card title="هُويّة الفريق">
            <div className="flex items-center gap-4">
              <TeamBadge letters={team.badge} color={team.color} size={56} image={team.imageDataUrl} />
              <div className="flex-1">
                <input ref={imgRef} type="file" accept="image/*" onChange={onTeamImage} className="hidden" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => imgRef.current?.click()}>
                    {team.imageDataUrl ? "تغيير الصورة" : "رفع صورة"}
                  </Button>
                  {team.imageDataUrl && (
                    <Button variant="ghost" onClick={() => updateTeam(team.id, { imageDataUrl: "" })}>إزالة</Button>
                  )}
                </div>
                <p className="mt-2 text-[12px] text-text-3">يُشتقّ لونُ الفريق تلقائياً من الصورة — بحدٍّ أقصى ٥ ميغابايت.</p>
                {imgErr && <p className="mt-1 text-[12px] text-critical">{imgErr}</p>}
              </div>
            </div>
          </Card>

          <Card title="الإجراءات">
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => setAddOpen(true)}>+ أضف عضواً جديداً</Button>
              <Button variant="outline" onClick={exportRoster}>⬇ تصدير قائمة الأعضاء (CSV)</Button>
              <Button variant="outline" onClick={whatsappTeam}>↗ فتح واتساب برسالةٍ جاهزة</Button>
              <Button variant="danger"  onClick={() => setDelOpen(true)}>🗑 إلغاء الفريق</Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={`إضافة عضوٍ إلى فريق ${team.name}`}
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button type="submit" form="add-member">إضافة العضو</Button>
          </>
        }
      >
        <form id="add-member" onSubmit={submitAdd} className="grid gap-4">
          <Field label="الاسم الرباعي" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Field label="الجوّال" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0555 000 000" />
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
        </form>
      </Modal>

      <Confirm
        open={delOpen}
        onClose={() => setDelOpen(false)}
        onConfirm={() => { deleteTeam(team!.id); router.push("/teams"); }}
        title={`إلغاء فريق ${team.name}؟`}
        message={`سيُحذف الفريق مع كلّ أعضائه (${roster.length} طالباً). هذا الإجراء لا يمكن التراجع عنه.`}
        confirmLabel="نعم، احذف الفريق"
        danger
      />
    </div>
  );
}
