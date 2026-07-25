"use client";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useStore } from "@/lib/store/StoreProvider";

const sar = (n: number) => new Intl.NumberFormat("ar-SA-u-nu-latn").format(n);

export default function DashboardPage() {
  useEffect(() => { document.title = "لوحة الأمير — معالي أبها"; }, []);
  const { teams, students, supervisors, invoices } = useStore();

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
    <div className="mx-auto max-w-[1180px] px-6 py-8">
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
          <Card title="الفرق النشطة" action={<Link href="/teams" className="text-[13px] text-accent hover:underline">كلّها ←</Link>} padded={false}>
            <ul>
              {topTeams.map(t => {
                const sup = supervisors.find(s => s.id === t.supervisorId);
                const roster = students.filter(s => s.teamId === t.id);
                const paid = roster.filter(s => s.paymentStatus === "PAID").length;
                const pct = roster.length ? Math.round((paid / roster.length) * 100) : 0;
                return (
                  <li key={t.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-line px-5 py-3 last:border-b-0">
                    <TeamBadge letters={t.badge} color={t.color} />
                    <div>
                      <div className="text-[14.5px] font-medium text-text">
                        <Link href={`/teams/${t.id}`} className="hover:text-accent">فريق {t.name}</Link>
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
          <Card title="آخر الفواتير" action={<Link href="/invoices" className="text-[13px] text-accent hover:underline">الكلّ ←</Link>} padded={false}>
            <ul>
              {recentInvoices.map(inv => (
                <li key={inv.id} className="grid grid-cols-[1fr_auto] items-baseline gap-2 border-b border-line px-5 py-3 last:border-b-0">
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
                    فريق {t.name}
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
