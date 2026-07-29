"use client";
import Image from "next/image";
import { useStore } from "@/lib/store/StoreProvider";

/** Large showcase logo for the landing hero. Respects the Prince's
 *  site-wide logoDisplayMode (VISIBLE / BLURRED / HIDDEN). */
export function HeroLogo() {
  const { logoDisplayMode, logoUrl, logoVersion, hydrated } = useStore();

  // نحجز المساحة حتى تُحمَّل إعدادات الأمير، لمنع وميض الشعار الواضح قبل التغبيش/الإخفاء.
  if (!hydrated) {
    return <div aria-hidden className="relative mx-auto" style={{ width: "min(56vmin, 320px)", height: "min(56vmin, 320px)" }} />;
  }
  if (logoDisplayMode === "HIDDEN") return null;

  const blurred = logoDisplayMode === "BLURRED";
  const animated = logoDisplayMode === "ANIMATED";
  // معاينةٌ فوريّة أو الشعار المخصّص عند الطلب عبر المسار (لا base64 في التحميل).
  const custom = (logoUrl ?? "").trim() || (logoVersion > 0 ? `/api/logo?v=${logoVersion}` : "");
  const filter = blurred
    ? "blur(14px) drop-shadow(0 8px 24px rgba(44,107,121,.18))"
    : "drop-shadow(0 8px 24px rgba(44,107,121,.18))";
  return (
    <div className="relative mx-auto" style={{ width: "min(56vmin, 320px)", height: "min(56vmin, 320px)" }}>
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(194,160,99,.28) 0%, rgba(194,160,99,.06) 45%, transparent 70%)",
          filter: "blur(4px)",
        }}
      />
      {custom ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={custom}
          alt="معالي محافظة بلّسمر ١٤٤٨هـ"
          className={`absolute inset-0 h-full w-full${animated ? " logo-animated" : ""}`}
          style={{ objectFit: "contain", filter }}
        />
      ) : (
        <Image
          src="/logo.png"
          alt="معالي محافظة بلّسمر ١٤٤٨هـ"
          fill
          priority
          sizes="(max-width: 640px) 60vw, 340px"
          className={animated ? "logo-animated" : undefined}
          style={{ objectFit: "contain", filter }}
        />
      )}
    </div>
  );
}
