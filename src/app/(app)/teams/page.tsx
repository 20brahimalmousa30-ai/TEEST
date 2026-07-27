"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { useStore } from "@/lib/store/StoreProvider";

const swatches = ["#1E4635", "#6B7A3E", "#8C5A3C", "#4E6B7A", "#7A5B2E", "#3F5B4E", "#5A4A7A", "#6B4A3E", "#2E5A5A", "#4A6B2E", "#7A4A5A", "#5A6B3E"];

export default function TeamsPage() {
  useEffect(() => { document.title = "الفرق — معالي محافظة بلّسمر"; }, []);
  const { teams, students, supervisors, addTeam } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [badge, setBadge] = useState("");
  const [color, setColor] = useState(swatches[0]);
  const [tagline, setTagline] = useState("");
  const [supervisorId, setSupervisorId] = useState(supervisors[0]?.id ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !badge.trim()) return;
    addTeam(name.trim(), color, badge.trim(), supervisorId, tagline.trim() || "فريقٌ جديد لم يبدأ رحلته بعد.");
    setName(""); setBadge(""); setTagline(""); setColor(swatches[0]);
    setOpen(false);
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={`الفرق · ${teams.length} فريقاً`}
        title="الفرق"
        subtitle="اثنا عشر فريقاً، لكلٍّ منها مشرفٌ ولونٌ خاص. اضغط أيّ فريقٍ لعرض قائمة أعضائه وتفاصيل نقاطه."
        action={<Button variant="primary" onClick={() => setOpen(true)}>+ فريقٌ جديد</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map(t => {
          const sup = supervisors.find(s => s.id === t.supervisorId);
          const roster = students.filter(s => s.teamId === t.id);
          const paid = roster.filter(s => s.paymentStatus === "PAID").length;
          const payPct = roster.length ? Math.round((paid / roster.length) * 100) : 0;
          return (
            <Link
              key={t.id}
              href={`/teams/${t.id}`}
              className="group relative overflow-hidden rounded-md border border-line bg-surface p-5 transition-colors hover:border-accent-warm"
            >
              <span className="absolute inset-y-0 right-0 w-1" style={{ background: t.color }} />
              <div className="flex items-start gap-3">
                <TeamBadge letters={t.badge} color={t.color} size={44} image={t.imageDataUrl} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16.5px] font-semibold text-text group-hover:text-accent">فريق {t.name}</h3>
                  <p className="mt-0.5 text-[12px] text-text-3">مشرف: {sup?.name ?? "—"}</p>
                </div>
                <span className="num text-[13.5px] text-accent-warm-2 whitespace-nowrap">{t.points} نقطة</span>
              </div>
              <p className="mt-3 line-clamp-2 text-[13px] leading-[1.75] text-text-2">{t.tagline}</p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[12px] text-text-3">
                <span>{roster.length} طالباً</span>
                <Pill variant={payPct >= 90 ? "ok" : payPct >= 60 ? "warn" : "critical"}>السداد {payPct}٪</Pill>
              </div>
            </Link>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="إضافة فريقٍ جديد"
        subtitle="ستُنشأ ببيانات فارغة — أضف أعضاءها لاحقاً من صفحة الفريق."
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" form="new-team">إنشاء الفريق</Button>
          </>
        }
      >
        <form id="new-team" onSubmit={submit} className="grid gap-4">
          <Field label="اسم الفريق" value={name} onChange={e => setName(e.target.value)} placeholder="مثال: القمم" required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="حرف/رمز (١-٢ حرف)" value={badge} onChange={e => setBadge(e.target.value.slice(0, 2))} placeholder="Q" maxLength={2} required />
            <label className="block">
              <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">المشرف</span>
              <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <div>
            <div className="mb-2 text-[12px] tracking-[.12em] text-text-3">اللون المميّز</div>
            <div className="flex flex-wrap gap-2">
              {swatches.map(sw => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => setColor(sw)}
                  aria-label={`اختيار اللون ${sw}`}
                  className={`h-8 w-8 rounded ${color === sw ? "ring-2 ring-offset-2 ring-accent-warm" : ""}`}
                  style={{ background: sw }}
                />
              ))}
            </div>
          </div>
          <Field label="وصف قصير (اختياري)" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="فريقٌ يتميّز بـ..." />
        </form>
      </Modal>
    </div>
  );
}
