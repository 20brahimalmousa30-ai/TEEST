"use client";
import { useStore } from "@/lib/store/StoreProvider";

/**
 * شريطُ «تعذّر تحميل البيانات» — مبدأٌ ثابتٌ في المشروع: أيّ فشلٍ في جلب اللقطة
 * (نسخة عميلٍ قديمة بعد نشر، انقطاع شبكة، أو خطأ خادم) يجب أن يُظهر رسالةً واضحة
 * تؤكّد أن البيانات غير مفقودة، بدل قائمةٍ فارغةٍ صامتة توحي بالحذف.
 *
 * الزرّ الأساسيّ «تحديث الصفحة» (إعادة تحميلٍ كامل) لأنّه يجلب أحدث حزمةٍ من
 * الخادم فيحلّ سبب النسخة القديمة؛ أمّا «إعادة المحاولة» فتُعيد الجلب فقط (تنفع
 * لانقطاعٍ عابر، وقد تفشل لنفس السبب إن كانت النسخة القديمة لا تزال محمّلة).
 *
 * يُستعمَل في AppShell (كلّ صفحات الطاقم) وفي أيّ صفحةٍ حسّاسةٍ خارجه (مثل /me).
 */
export function LoadErrorBanner() {
  const { hydrated, loadError, retry } = useStore();
  if (!hydrated || !loadError) return null;
  return (
    <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
      <span>
        تعذّر الاتصال بالخادم، ولم تُحمَّل البيانات.{" "}
        <span className="text-text-2">بياناتك محفوظةٌ وسليمة — لم يُفقد شيء.</span>{" "}
        حدِّث الصفحة لجلب أحدث نسخة.
      </span>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => window.location.reload()}
          className="rounded border border-critical/50 bg-critical/15 px-3 py-1 font-medium text-critical hover:bg-critical/25"
        >
          تحديث الصفحة
        </button>
        <button
          onClick={retry}
          className="rounded border border-line-strong px-3 py-1 text-text-2 hover:border-accent hover:text-text"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
