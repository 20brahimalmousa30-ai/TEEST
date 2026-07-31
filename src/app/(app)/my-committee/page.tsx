"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/session";
import { useStore } from "@/lib/store/StoreProvider";
import { CommitteeTasks } from "@/components/CommitteeTasks";

export default function MyCommitteePage() {
  const { session, ready } = useSession();
  const router = useRouter();
  const { supervisors, committees } = useStore();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace("/login");
    else if (session.role === "PRINCE" || session.role === "DEPUTY_PRINCE") router.replace("/committees");
    else if (session.role === "BENEFICIARY") router.replace("/me");
  }, [ready, session, router]);
  useEffect(() => { document.title = "لجنتي — معالي محافظة بلّسمر"; }, []);

  if (!hydrated || !ready || !session || session.role !== "SUPERVISOR") return null;

  const sup = supervisors.find(s => s.id === session.supervisorId);
  if (!sup || sup.committeeIds.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader eyebrow="لجنتي" title="لست عضواً في أيّ لجنة" subtitle="راجع الإدارة إن كنتَ تتوقّع الظهور." />
      </div>
    );
  }

  const committee = committees.find(c => c.id === sup.committeeIds[0])!;
  const peers = committee.supervisorIds.map(id => supervisors.find(s => s.id === id)).filter(Boolean);

  return (
    <div className="page-shell">
      <PageHeader eyebrow="لجنتي" title={committee.name} subtitle={committee.description} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="الأعضاء">
          <ul className="grid gap-3">
            {peers.map(p => (
              <li key={p!.id} className="flex items-center gap-3 border-b border-line pb-3 last:border-b-0">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-[13px] font-semibold" style={{ color: "#F4EEE2" }}>{p!.name[0]}</div>
                <div className="flex-1">
                  <div className="text-[13.5px] text-text">
                    {p!.name}
                    {p!.id === sup.id && <span className="ms-2 rounded-full bg-accent-warm/15 px-2 py-[1px] text-[10px] text-accent-warm-2">أنت</span>}
                  </div>
                  <div className="num text-[11.5px] text-text-3">{p!.phone}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <CommitteeTasks committeeId={committee.id} memberIds={committee.supervisorIds} />
      </div>
    </div>
  );
}
