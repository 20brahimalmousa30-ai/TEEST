"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useSession } from "@/lib/auth/session";
import { useStore } from "@/lib/store/StoreProvider";
import { exportXlsx } from "@/lib/xlsx";
import { useExportSelection } from "@/lib/useExportSelection";
import { ExportSelectToggle, SelectCheckbox } from "@/components/ExportSelect";
import { teamLabel } from "@/lib/format";
import { TripSchedule } from "@/components/TripSchedule";

const dayLabels = ["اليوم ١", "اليوم ٢", "اليوم ٣", "اليوم ٤", "اليوم ٥", "اليوم ٦", "اليوم ٧", "اليوم ٨"];

export default function MyTeamPage() {
  const { session, ready } = useSession();
  const router = useRouter();
  const { teams, students, supervisors, attendance, toggleAttendance } = useStore();
  const [attOpen, setAttOpen] = useState(false);
  const [dayIdx, setDayIdx] = useState(3); // "اليوم الرابع"
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace("/login");
    else if (session.role === "PRINCE" || session.role === "DEPUTY_PRINCE") router.replace("/dashboard");
    else if (session.role === "BENEFICIARY") router.replace("/me");
  }, [ready, session, router]);
  useEffect(() => { document.title = "أسرتي — معالي محافظة بلّسمر"; }, []);

  const sup = session ? supervisors.find(s => s.id === session.supervisorId) : undefined;
  const activeTeam = sup && sup.teamIds.length > 0 ? teams.find(t => t.id === sup.teamIds[0]) : undefined;
  const roster = activeTeam ? students.filter(s => s.teamId === activeTeam.id) : [];
  const sel = useExportSelection(roster);

  if (!hydrated || !ready || !session || session.role !== "SUPERVISOR") return null;

  if (!sup || sup.teamIds.length === 0 || !activeTeam) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader eyebrow="أسرتي" title="لا أسرةٌ معيَّنة لك بعد" subtitle="راجع الإدارة إن كنتَ تتوقّع الظهور كمشرفِ أسرة." />
      </div>
    );
  }

  const team = activeTeam;
  const paid = roster.filter(s => s.paymentStatus === "PAID").length;
  const partial = roster.filter(s => s.paymentStatus === "PARTIAL").length;
  const pending = roster.filter(s => s.paymentStatus === "PENDING").length;
  const avgAtt = roster.length ? Math.round(roster.reduce((s, x) => s + x.attendance, 0) / roster.length) : 0;

  async function exportRoster() {
    const data = sel.exportRows;
    const rows = data.map(s => [s.name, s.phone, s.grade, s.section,
      s.paymentStatus === "PAID" ? "مسدَّد" : s.paymentStatus === "PARTIAL" ? "جزئي" : "معلّق"]);
    await exportXlsx({
      filename: `أسرتي_${team.name}`,
      sheetName: "أسرتي",
      title: `${teamLabel(team.name)} — معالي محافظة بلّسمر`,
      subtitle: `${data.length} عضو`,
      columns: [
        { header: "الاسم", width: 26, align: "right" },
        { header: "الجوّال", width: 16, align: "center" },
        { header: "الصف", width: 14, align: "center" },
        { header: "القسم", width: 12, align: "center" },
        { header: "السداد", width: 13, align: "center" },
      ],
      rows,
    });
  }
  function whatsappParents() {
    const msg = encodeURIComponent(`السلام عليكم أولياء أمور ${teamLabel(team.name)} — تذكير باللقاء المسائي غداً في الساعة السابعة.`);
    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener");
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="أسرتي · نطاقُ المشرف"
        title={teamLabel(team.name)}
        subtitle="أنت تشرف على هذه الأسرة. لا ترى بيانات الأسر الأخرى."
        action={<TeamBadge letters={team.badge} color={team.color} size={44} />}
      />

      <div className="mb-6 rounded-md border border-accent-warm/40 bg-accent-warm/5 px-4 py-3 text-[13px] text-text-2">
        ↺ <span className="font-medium text-text">حدود صلاحيّتك:</span> تعديل بيانات أعضاء أسرتك، تسجيل الحضور، ورفع فواتير خاصّة بالأسرة فقط.
      </div>

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="الأعضاء" value={roster.length} sub={`${team.studentCount || roster.length} مسجّل`} />
        <KpiCard label="نقاط الأسرة" value={team.points} variant="ok" sub={team.tagline.split("—")[0]?.trim()} />
        <KpiCard label="السداد" value={`${paid}/${roster.length}`} sub={partial > 0 ? `+ ${partial} جزئي · ${pending} معلّق` : "لا معلّقات"} variant={pending > roster.length * 0.2 ? "warn" : "ok"} />
        <KpiCard label="متوسّط الحضور" value={`${avgAtt}%`} variant={avgAtt >= 90 ? "ok" : "warn"} />
      </section>

      <div className="mb-6">
        <TripSchedule />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card
          title={`أعضاء أسرتي (${roster.length})`}
          action={
            <div className="flex gap-2">
              <ExportSelectToggle sel={sel} />
              <Button variant="outline" onClick={() => setAttOpen(true)}>✓ تسجيل الحضور</Button>
              <Button variant="outline" onClick={exportRoster}>⬇ تصدير إكسل</Button>
            </div>
          }
          padded={false}
        >
          <div className="max-h-[540px] overflow-y-auto">
            {roster.slice(0, 30).map(st => (
              <div key={st.id} className={`grid ${sel.active ? "grid-cols-[auto_auto_1fr_auto_auto]" : "grid-cols-[auto_1fr_auto_auto]"} items-center gap-4 border-b border-line px-5 py-3 last:border-b-0`}>
                {sel.active && (
                  <SelectCheckbox checked={sel.isSelected(st.id)} onChange={() => sel.toggle(st.id)} label={`تحديد ${st.name}`} />
                )}
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
          <Card title="إجراءات سريعة">
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => setAttOpen(true)}>✓ تسجيل الحضور لليوم</Button>
              <Button variant="outline" onClick={whatsappParents}>↗ رسالة لأولياء الأمور</Button>
              <Link href={`/teams/${team.id}`} className="rounded border border-line px-4 py-2 text-center text-[13px] text-text hover:border-accent">
                عرض تفاصيل الأسرة
              </Link>
            </div>
          </Card>

          {sup.committeeIds.length > 0 && (
            <Card title="لجنتي">
              <Link href="/my-committee" className="flex items-baseline justify-between rounded border border-line bg-bg-raised px-3 py-2.5 text-[13.5px] hover:border-accent">
                <span className="text-text">اذهب إلى صفحة لجنتي</span>
                <span className="text-[11.5px] text-text-3">←</span>
              </Link>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={attOpen}
        onClose={() => setAttOpen(false)}
        title={`تسجيل حضور ${teamLabel(team.name)}`}
        subtitle="اضغط على أيّ عضوٍ لتبديل حالة حضوره في اليوم المُختار."
        size="lg"
        footer={<Button onClick={() => setAttOpen(false)}>تم</Button>}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {dayLabels.map((d, i) => (
            <button key={d} onClick={() => setDayIdx(i)}
              className={`rounded-full px-3 py-1.5 text-[12px] ${i === dayIdx ? "bg-accent text-[#F4EEE2]" : "border border-line text-text-2"}`}>
              {d}
            </button>
          ))}
        </div>
        <div className="grid gap-1">
          {roster.map(s => {
            const rec = attendance[s.id] ?? [true, true, true, true, true, false, false, false];
            const present = rec[dayIdx] ?? false;
            return (
              <button
                key={s.id}
                onClick={() => toggleAttendance(s.id, dayIdx)}
                className={`flex items-center justify-between rounded border px-3 py-2 text-[13px] transition-colors ${
                  present ? "border-ok/40 bg-ok/5" : "border-critical/40 bg-critical/5"
                }`}
              >
                <span className="text-text">{s.name}</span>
                <Pill variant={present ? "ok" : "critical"}>{present ? "حاضر" : "غائب"}</Pill>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
