"use client";
import { Card } from "@/components/ui/Card";
import { useStore } from "@/lib/store/StoreProvider";

/**
 * عرضُ «جدول السفرة» للطلاب والمشرفين.
 *
 * المصدر: scheduleUrl (معاينةٌ فوريّة بعد الرفع مباشرةً) وإلّا /api/schedule?v=version
 * الذي يُخدَم بكامل الدقّة دون أيّ ضغط. لا يظهر شيءٌ إن لم يرفع الأمير جدولاً بعد.
 *
 * «المربّع يتكيّف مع مقاسات الصورة»: لا ارتفاعَ ثابت ولا اقتصاص — نعرضها بعرضٍ
 * كامل وارتفاعٍ تلقائيّ (height:auto)، فيتبع الإطارُ نسبةَ الصورة الأصليّة.
 */
export function TripSchedule() {
  const { scheduleUrl, scheduleVersion } = useStore();
  const src = (scheduleUrl ?? "").trim() || (scheduleVersion > 0 ? `/api/schedule?v=${scheduleVersion}` : "");
  if (!src) return null;

  return (
    <Card title="جدول السفرة" padded={false}>
      <a href={src} target="_blank" rel="noopener noreferrer" title="فتحُ الجدول بالدقّة الكاملة">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="جدول السفرة"
          className="block w-full rounded-b-md"
          style={{ height: "auto" }}
        />
      </a>
    </Card>
  );
}
