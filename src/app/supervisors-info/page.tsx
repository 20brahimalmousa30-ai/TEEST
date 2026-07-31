"use client";
import { useEffect, useMemo, useState } from "react";
import { loadPublicDirectory, type PublicCommittee, type PublicSupervisor } from "@/lib/db/data";
import { PublicHeader } from "@/components/PublicHeader";

export default function SupervisorsInfoPage() {
  useEffect(() => { document.title = "المشرفون — معالي محافظة بلّسمر"; }, []);
  const [supervisors, setSupervisors] = useState<PublicSupervisor[] | null>(null);
  const [committees, setCommittees] = useState<PublicCommittee[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadPublicDirectory()
      .then(d => { setSupervisors(d.supervisors); setCommittees(d.committees); })
      .catch(() => setError(true));
  }, []);

  const commName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of committees) m[c.id] = c.name;
    return m;
  }, [committees]);

  return (
    <main className="relative min-h-screen">
      <PublicHeader />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 text-center">
          <div className="mb-3 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-accent-warm" />
            <span className="eyebrow" style={{ fontSize: "0.9rem", letterSpacing: ".18em" }}>فريقُ الإشراف</span>
            <span className="h-px w-10 bg-accent-warm" />
          </div>
          <h1 className="tracking-tight" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 600 }}>
            مشرفو الرحلة
          </h1>
          <p className="mx-auto mt-4 text-text-2" style={{ maxWidth: "52ch", lineHeight: 1.95 }}>
            نُخبةٌ من القادة يتكفّلون بشبابِ الرحلة ولجانها. تعرَّف عليهم.
          </p>
        </div>

        {error && <p className="text-center text-[14px] text-critical">تعذّر تحميل البيانات، حاول لاحقاً.</p>}
        {!supervisors && !error && <p className="text-center text-[14px] text-text-3">جارٍ التحميل…</p>}

        {supervisors && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {supervisors.map(s => (
              <div key={s.id} className="flex flex-col items-center rounded-lg border border-line bg-surface p-6 text-center transition-colors hover:border-accent-warm">
                <span className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-line bg-accent text-[30px] font-semibold" style={{ color: "#F4EEE2" }}>
                  {s.photoDataUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.photoDataUrl} alt="" className="h-full w-full object-cover" />
                    : (s.name.trim()[0] ?? "؟")}
                </span>
                <h2 className="mt-4 text-[17px] font-semibold text-text">{s.name}</h2>
                {s.specialty && <p className="mt-1 text-[13px] text-accent-warm-2">{s.specialty}</p>}
                {s.committeeIds.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {s.committeeIds.map(cid => (
                      <span key={cid} className="rounded-full border border-line-strong bg-bg-raised px-2.5 py-1 text-[11.5px] text-text-2">
                        {commName[cid] ?? "لجنة"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
