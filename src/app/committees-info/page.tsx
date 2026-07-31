"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadPublicDirectory, type PublicCommittee } from "@/lib/db/data";
import { PublicHeader } from "@/components/PublicHeader";

export default function CommitteesInfoPage() {
  useEffect(() => { document.title = "اللجان — معالي محافظة بلّسمر"; }, []);
  const [committees, setCommittees] = useState<PublicCommittee[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadPublicDirectory()
      .then(d => setCommittees(d.committees))
      .catch(() => setError(true));
  }, []);

  return (
    <main className="relative min-h-screen">
      <PublicHeader />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 text-center">
          <div className="mb-3 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-accent-warm" />
            <span className="eyebrow" style={{ fontSize: "0.9rem", letterSpacing: ".18em" }}>لجانُ الرحلة</span>
            <span className="h-px w-10 bg-accent-warm" />
          </div>
          <h1 className="tracking-tight" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 600 }}>
            اللجان التي تُدير الرحلة
          </h1>
          <p className="mx-auto mt-4 text-text-2" style={{ maxWidth: "52ch", lineHeight: 1.95 }}>
            كلُّ لجنةٍ تتكفّل بجانبٍ من تفاصيل السفرة. تعرَّف على مهامها وفريقها وعدد شبابها.
          </p>
        </div>

        {error && <p className="text-center text-[14px] text-critical">تعذّر تحميل البيانات، حاول لاحقاً.</p>}
        {!committees && !error && <p className="text-center text-[14px] text-text-3">جارٍ التحميل…</p>}

        {committees && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {committees.map(c => (
              <Link
                key={c.id}
                href={`/committees-info/${c.id}`}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-accent-warm"
              >
                <div className="relative h-40 w-full overflow-hidden" style={{ background: c.color }}>
                  {c.imageDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageDataUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                    <h2 className="text-[17px] font-semibold text-text">{c.name}</h2>
                  </div>
                  <p className="mt-2 flex-1 text-[13.5px] leading-[1.85] text-text-2">{c.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[12px] text-text-3">
                    <span>{c.supervisorIds.length} مشرفاً · {c.studentCount} شاباً</span>
                    <span className="text-accent transition-colors group-hover:text-accent-warm">التفاصيل ←</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
