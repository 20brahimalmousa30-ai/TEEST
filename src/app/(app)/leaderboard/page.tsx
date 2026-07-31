"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useStore } from "@/lib/store/StoreProvider";

export default function LeaderboardPage() {
  useEffect(() => { document.title = "قائمة الصدارة — معالي محافظة بلّسمر"; }, []);
  const { teams, students } = useStore();
  const [bigView, setBigView] = useState(false);

  const rankedTeams = [...teams].sort((a, b) => b.points - a.points);
  const rankedStudents = [...students].sort((a, b) => b.points - a.points).slice(0, 12);
  const maxPts = rankedTeams[0]?.points ?? 1;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="قائمة الصدارة · لحظيّة"
        title="قائمة الصدارة"
        subtitle="ترتيبٌ حيٌّ للأسر والأفراد. اضغط «العرض الكبير» لوضعٍ ملائمٍ لشاشات القاعة."
        action={<Button variant="primary" onClick={() => setBigView(true)}>↗ العرض الكبير</Button>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="ترتيب الأسر" padded={false}>
          <ol className="divide-y divide-line">
            {rankedTeams.map((t, i) => {
              const pct = (t.points / maxPts) * 100;
              return (
                <li key={t.id} className="grid grid-cols-[32px_44px_1fr_auto] items-center gap-4 px-5 py-3">
                  <span className={`lat text-center text-[17px] italic ${i === 0 ? "text-accent-warm font-semibold" : "text-text-3"}`}>{i + 1}</span>
                  <TeamBadge letters={t.badge} color={t.color} size={38} />
                  <div className="min-w-0">
                    <Link href={`/teams/${t.id}`} className="text-[14.5px] font-medium text-text hover:text-accent">أسرة {t.name}</Link>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-alt/40">
                      <div className="h-full" style={{ width: `${pct}%`, background: t.color }} />
                    </div>
                  </div>
                  <span className="num text-[15px] font-semibold text-text">{t.points}<span className="ms-1 text-[10px] font-normal text-text-3">pt</span></span>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card title="الأفراد الأعلى نقاطاً" padded={false}>
          <ol className="divide-y divide-line">
            {rankedStudents.map((s, i) => (
              <li key={s.id} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 px-5 py-2.5">
                <span className={`lat text-center text-[14px] italic ${i < 3 ? "text-accent-warm font-semibold" : "text-text-3"}`}>{i + 1}</span>
                <div>
                  <Link href={`/students/${s.id}`} className="text-[13.5px] text-text hover:text-accent">{s.name}</Link>
                  <div className="text-[11px] text-text-3">{s.section} · أسرة {teams.find(t => t.id === s.teamId)?.name ?? "—"}</div>
                </div>
                <span className="num text-[13.5px] text-text">{s.points}<span className="ms-1 text-[10px] text-text-3">pt</span></span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* Big screen mode */}
      <Modal open={bigView} onClose={() => setBigView(false)} title="عرضُ قاعة الفعاليّة" size="lg"
        footer={<Button variant="outline" onClick={() => setBigView(false)}>إغلاق</Button>}>
        <div className="grid gap-3">
          {rankedTeams.slice(0, 8).map((t, i) => {
            const pct = (t.points / maxPts) * 100;
            return (
              <div key={t.id} className="flex items-center gap-4 rounded-md border border-line bg-bg-raised p-4">
                <span className={`lat text-[32px] italic ${i === 0 ? "text-accent-warm font-semibold" : "text-text-3"}`}>{i + 1}</span>
                <TeamBadge letters={t.badge} color={t.color} size={56} />
                <div className="flex-1">
                  <div className="text-[20px] font-semibold text-text" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>أسرة {t.name}</div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-alt/40">
                    <div className="h-full" style={{ width: `${pct}%`, background: t.color }} />
                  </div>
                </div>
                <span className="num text-[32px] font-semibold text-text">{t.points}<span className="ms-1 text-[14px] text-text-3">pt</span></span>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
