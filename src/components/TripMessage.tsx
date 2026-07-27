"use client";
import { useStore } from "@/lib/store/StoreProvider";

/** رسالة السفرة — نصٌّ يحرّره الأمير من الإعدادات، يظهر في الصفحة الرئيسة
 *  مكان قسم الأدوار المحذوف. عند الفراغ تُعرض رسالةٌ افتراضيّة. */
const DEFAULT_MESSAGE =
  "أبناءنا الشباب، أهلاً بكم في رحلة «معالي محافظة بلّسمر». رحلةٌ نصعد فيها معاً من القاع إلى القمم، " +
  "نغرسُ فيها القيم، ونبني الإخوة، ونصنع ذكرى تبقى. سدّدكم الله وبارك في خطاكم.";

export function TripMessage() {
  const { tripMessage } = useStore();
  const text = (tripMessage ?? "").trim() || DEFAULT_MESSAGE;
  return (
    <section id="message" className="relative border-t border-line bg-bg-raised/40 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 flex items-baseline justify-center gap-4">
          <span className="h-px w-10 bg-accent-warm" />
          <h2 className="text-2xl font-medium" style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}>
            رسالة السفرة
          </h2>
          <span className="h-px w-10 bg-accent-warm" />
        </div>
        <p className="whitespace-pre-line text-center text-[17px] leading-[2.1] text-text-2">
          {text}
        </p>
      </div>
    </section>
  );
}
