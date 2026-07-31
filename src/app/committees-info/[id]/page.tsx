"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadPublicDirectory, type PublicCommittee, type PublicSupervisor } from "@/lib/db/data";
import { PublicHeader } from "@/components/PublicHeader";

export default function CommitteeDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [committee, setCommittee] = useState<PublicCommittee | null>(null);
  const [members, setMembers] = useState<PublicSupervisor[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "notfound" | "error">("loading");

  useEffect(() => {
    loadPublicDirectory()
      .then(d => {
        const c = d.committees.find(x => x.id === id);
        if (!c) { setState("notfound"); return; }
        setCommittee(c);
        setMembers(d.supervisors.filter(s => c.supervisorIds.includes(s.id)));
        setState("ready");
        document.title = `${c.name} — معالي محافظة بلّسمر`;
      })
      .catch(() => setState("error"));
  }, [id]);

  return (
    <main className="relative min-h-screen">
      <PublicHeader />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/committees-info" className="mb-6 inline-block text-[13px] text-text-3 hover:text-accent">→ عودة إلى اللجان</Link>

        {state === "loading" && <p className="text-center text-[14px] text-text-3">جارٍ التحميل…</p>}
        {state === "error" && <p className="text-center text-[14px] text-critical">تعذّر تحميل البيانات، حاول لاحقاً.</p>}
        {state === "notfound" && <p className="text-center text-[14px] text-text-3">لم يتم العثور على اللجنة.</p>}

        {state === "ready" && committee && (
          <>
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              <div className="relative h-52 w-full overflow-hidden" style={{ background: committee.color }}>
                {committee.imageDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={committee.imageDataUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-7">
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: committee.color }} />
                  <h1 className="text-[24px] font-semibold text-text" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>{committee.name}</h1>
                </div>
                <p className="mt-3 text-[14.5px] leading-[1.95] text-text-2">{committee.description}</p>
                <div className="mt-5 flex gap-3">
                  <div className="rounded-md border border-line bg-bg-raised px-4 py-3 text-center">
                    <div className="text-[22px] font-semibold text-text">{committee.supervisorIds.length}</div>
                    <div className="text-[11px] tracking-[.12em] text-text-3">مشرفاً</div>
                  </div>
                  <div className="rounded-md border border-line bg-bg-raised px-4 py-3 text-center">
                    <div className="text-[22px] font-semibold text-text">{committee.studentCount}</div>
                    <div className="text-[11px] tracking-[.12em] text-text-3">شاباً</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px w-8 bg-accent-warm" />
                <h2 className="text-[15px] font-semibold text-text">مشرفو اللجنة</h2>
              </div>
              {members.length === 0 ? (
                <p className="text-[13px] text-text-3">لا مشرفين بعد.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center gap-3 rounded-md border border-line bg-surface p-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-accent text-[15px] font-semibold" style={{ color: "#F4EEE2" }}>
                        {m.photoDataUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.photoDataUrl} alt="" className="h-full w-full object-cover" />
                          : (m.name.trim()[0] ?? "؟")}
                      </span>
                      <div>
                        <div className="text-[14.5px] font-medium text-text">{m.name}</div>
                        {m.specialty && <div className="text-[12px] text-text-3">{m.specialty}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
