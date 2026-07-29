"use client";
import { useCallback, useEffect, useState } from "react";

// المعرّف المخبوز في هذه الحزمة وقتَ البناء (يُحقن عبر next.config).
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/**
 * يكتشف تلقائياً وصولَ نشرٍ جديد: يقارن معرّف حزمته المخبوز بمعرّف الخادم الحيّ
 * (/api/version) دورياً وعند عودة التبويب للواجهة. فإن اختلفا عرَض شريطاً لطيفاً
 * «توفّرت نسخة محدَّثة — تحديث الآن»، فيتجنّب المستخدم فشلَ الإجراءات بسبب النسخة
 * القديمة دون حاجةٍ لتحديثٍ قسريّ يدويّ. مُعطَّلٌ في التطوير (BUILD_ID = "dev").
 */
export function VersionWatcher() {
  const [updateReady, setUpdateReady] = useState(false);

  const check = useCallback(async () => {
    if (BUILD_ID === "dev" || updateReady) return;
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { id } = (await res.json()) as { id?: string };
      if (id && id !== BUILD_ID) setUpdateReady(true);
    } catch {
      /* أخطاء الشبكة العابرة تُتجاهَل — سنعيد الفحص لاحقاً */
    }
  }, [updateReady]);

  useEffect(() => {
    if (BUILD_ID === "dev") return;
    check();
    const timer = setInterval(check, 2 * 60 * 1000); // فحصٌ كل دقيقتين
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  if (!updateReady) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4" role="status">
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-accent/40 bg-accent px-4 py-3 text-[13px] shadow-lg" style={{ color: "#F4EEE2" }}>
        <span>توفّرت نسخةٌ محدَّثة من الموقع.</span>
        <button
          onClick={() => window.location.reload()}
          className="rounded border border-white/40 bg-white/15 px-3 py-1 font-medium hover:bg-white/25"
        >
          تحديث الآن
        </button>
      </div>
    </div>
  );
}
