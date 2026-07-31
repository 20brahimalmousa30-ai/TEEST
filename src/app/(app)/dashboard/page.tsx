"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useStore } from "@/lib/store/StoreProvider";
import { useSession } from "@/lib/auth/session";
import { sar, teamLabel } from "@/lib/format";

export default function DashboardPage() {
  useEffect(() => { document.title = "لوحة الأمير — معالي محافظة بلّسمر"; }, []);
  const { teams, students, supervisors, invoices } = useStore();
  const { session } = useSession();
  const canEditFee = session?.role === "PRINCE" || session?.role === "DEPUTY_PRINCE";

  const summary = useMemo(() => ({
    total: students.length,
    paid: students.filter(s => s.paymentStatus === "PAID").length,
    collected: students.reduce((s, x) => s + x.paidAmount, 0),
    target: students.reduce((s, x) => s + x.totalAmount, 0),
  }), [students]);

  const invSummary = useMemo(() => ({
    pending: invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.amount, 0),
    overdue: invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0),
    pendingCount: invoices.filter(i => i.status === "pending").length,
    overdueCount: invoices.filter(i => i.status === "overdue").length,
  }), [invoices]);

  const topTeams = useMemo(() => [...teams].sort((a, b) => b.points - a.points).slice(0, 4), [teams]);
  const recentInvoices = useMemo(() => invoices.slice(0, 5), [invoices]);
  const collectedPct = summary.target ? Math.round((summary.collected / summary.target) * 100) : 0;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="لوحة الأمير · نظرةٌ عامّة"
        title="نظرةٌ عامّة على الرحلة"
        subtitle="مؤشّراتٌ حيّة تُلخّص أربعةَ أدوارٍ، ومئات الشباب، وحسابات الرحلة — في مكانٍ واحد."
        action={<Pill variant="ok">اليومُ الرابع من ثمانية</Pill>}
      />

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="الشباب" value={summary.total} sub={summary.total ? `${summary.paid} مسدَّد` : "لا مسجّلين بعد"} />
        <KpiCard label="نسبة السداد" value={`${collectedPct}%`} sub={`${sar(summary.collected)} / ${sar(summary.target)} SAR`} variant="ok" />
        <KpiCard label="فواتير معلّقة" value={invSummary.pendingCount} sub={`${sar(invSummary.pending)} SAR`} variant="warn" />
        <KpiCard label="فواتير متأخّرة" value={invSummary.overdueCount} sub={`${sar(invSummary.overdue)} SAR`} variant="critical" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card title="الأسر النشطة" action={<Link href="/teams" className="text-[13px] text-accent hover:underline">كلّها ←</Link>} padded={false}>
            <ul>
              {topTeams.map(t => {
                const sup = supervisors.find(s => s.id === t.supervisorId);
                const roster = students.filter(s => s.teamId === t.id);
                const paid = roster.filter(s => s.paymentStatus === "PAID").length;
                const pct = roster.length ? Math.round((paid / roster.length) * 100) : 0;
                return (
                  <li key={t.id} className="border-b border-line px-5 py-3 last:border-b-0" style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", alignItems: "center", gap: "1rem" }}>
                    <TeamBadge letters={t.badge} color={t.color} />
                    <div>
                      <div className="text-[14.5px] font-medium text-text">
                        <Link href={`/teams/${t.id}`} className="hover:text-accent">{teamLabel(t.name)}</Link>
                      </div>
                      <div className="text-[12px] text-text-3">مشرف: {sup?.name ?? "—"} · {roster.length} طالباً</div>
                    </div>
                    <span className="num text-[13px] text-text-2">{t.points} نقطة</span>
                    <Pill variant={pct >= 90 ? "ok" : pct >= 60 ? "warn" : "critical"}>السداد {pct}٪</Pill>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="آخر النشاط" action={<span className="text-[12px] text-text-3">تحديثٌ مباشر</span>} padded={false}>
            <div className="px-5 py-10 text-center text-[13px] text-text-3">لا نشاطَ بعد — ستظهر آخر العمليّات هنا.</div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {canEditFee && <FeeEditor />}

          <Card title="آخر الفواتير" action={<Link href="/invoices" className="text-[13px] text-accent hover:underline">الكلّ ←</Link>} padded={false}>
            <ul>
              {recentInvoices.map(inv => (
                <li key={inv.id} className="border-b border-line px-5 py-3 last:border-b-0" style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "baseline", gap: "0.5rem" }}>
                  <div>
                    <div className="text-[13.5px] text-text">
                      <Link href={`/invoices/${inv.id}`} className="hover:text-accent">{inv.vendor}</Link>
                    </div>
                    <div className="text-[11.5px] text-text-3">{inv.purpose}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="num text-[11px] text-text-3">{inv.code}</span>
                      {inv.extractedByAI && <Pill variant="info">↺ AI</Pill>}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="num text-[14px] text-text">{sar(inv.amount)}</div>
                    <div className="mt-1">
                      <Pill variant={inv.status === "paid" ? "ok" : inv.status === "pending" ? "warn" : "critical"}>
                        {inv.status === "paid" ? "مدفوعة" : inv.status === "pending" ? "معلّقة" : "متأخّرة"}
                      </Pill>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="قائمة الصدارة">
            <ol>
              {topTeams.map((t, i) => (
                <li key={t.id} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span className={`lat text-[15px] italic ${i === 0 ? "text-accent-warm font-semibold" : "text-text-3"}`}>{i + 1}</span>
                  <div className="text-[13.5px] text-text">
                    {teamLabel(t.name)}
                    <span className="ms-1.5 text-[11.5px] text-text-3">— {t.tagline.split("—")[0]?.trim() ?? ""}</span>
                  </div>
                  <span className="num text-[13.5px] text-text">{t.points}<span className="ms-1 text-[10px] text-text-3">pt</span></span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** البند ٢: تعديل قيمة الرسوم الافتراضيّة — تُطبَّق على جميع الطلاب (للأمير/نائبه). */
function FeeEditor() {
  const { defaultFee, students, setDefaultFee } = useStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  function start() { setValue(String(defaultFee)); setEditing(true); }
  function save() {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    setDefaultFee(Math.round(n));
    setEditing(false);
  }

  return (
    <Card title="قيمة الرسوم" action={<span className="text-[11.5px] text-text-3">تُطبَّق على {students.length} شاباً</span>}>
      {editing ? (
        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={value}
              onChange={e => setValue(e.target.value)}
              className="num w-40 rounded border border-line-strong bg-surface px-3 py-2 text-[15px]"
            />
            <span className="text-[13px] text-text-3">ر.س</span>
          </div>
          <p className="text-[11.5px] text-text-3">سيُحدَّث إجماليّ الرسوم لجميع الطلاب إلى هذه القيمة، ويُحفَظ التغيير في السجلّ.</p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={save}>حفظ وتطبيق</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>إلغاء</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] tracking-[.14em] text-text-3">الرسوم الحاليّة لكلّ شاب</div>
            <div className="num mt-1 text-[24px] text-text">{sar(defaultFee)} <span className="text-[12px] text-text-3">SAR</span></div>
          </div>
          <Button variant="outline" onClick={start}>تعديل</Button>
        </div>
      )}
    </Card>
  );
}
