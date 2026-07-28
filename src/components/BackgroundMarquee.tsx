"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store/StoreProvider";
import { pageKeyFor, resolveMarquee } from "@/lib/pageMarquees";

/**
 * خلفيّةٌ تحفيزيّة متحرّكة تُعرض خلف محتوى كلّ صفحة.
 * لونُ النصّ شبه شفّاف لكنّه واضح، ولا يعترض النقر (pointer-events: none).
 * الجُملُ والنمطُ والتفعيل يحدّدها الأمير لكلّ صفحة من «إعدادات الموقع».
 */
export function BackgroundMarquee() {
  const pathname = usePathname();
  const { pageMarquees, hydrated } = useStore();

  const key = useMemo(() => pageKeyFor(pathname ?? "/"), [pathname]);
  const cfg = useMemo(() => resolveMarquee(pageMarquees, key), [pageMarquees, key]);

  // مؤشّر الجملة الظاهرة في نمط «النصّ الكبير الباهت».
  const [fadeIdx, setFadeIdx] = useState(0);
  useEffect(() => {
    if (cfg.style !== "fade" || cfg.phrases.length < 2) return;
    const t = setInterval(() => setFadeIdx(i => (i + 1) % cfg.phrases.length), 4500);
    return () => clearInterval(t);
  }, [cfg.style, cfg.phrases.length]);

  // لا نعرض شيئاً قبل التحميل، أو إن عطّل الأمير الخلفيّة، أو لا جُمل.
  if (!hydrated || !cfg.enabled || cfg.phrases.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {cfg.style === "slide" && <SlideLayer phrases={cfg.phrases} />}
      {cfg.style === "float" && <FloatLayer phrases={cfg.phrases} />}
      {cfg.style === "fade" && <FadeLayer phrase={cfg.phrases[fadeIdx % cfg.phrases.length]} idx={fadeIdx} />}

      <style jsx>{`
        @keyframes bm-slide-ltr {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
        @keyframes bm-slide-rtl {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes bm-float {
          0%   { transform: translateY(18vh); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(-22vh); opacity: 0; }
        }
        @keyframes bm-fade {
          0%   { opacity: 0; transform: scale(0.98); }
          20%  { opacity: 1; transform: scale(1); }
          80%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.02); }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.bm-anim) { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/** نمط «أشرطة منزلقة»: عدّة صفوفٍ تنزلق أفقياً بسرعاتٍ واتجاهاتٍ متبادلة. */
function SlideLayer({ phrases }: { phrases: string[] }) {
  const rows = 5;
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => {
        const line = phrases.join("   ·   ");
        const duration = 28 + r * 7;             // صفوفٌ أبطأ كلّما نزلنا
        const anim = r % 2 === 0 ? "bm-slide-rtl" : "bm-slide-ltr";
        return (
          <div
            key={r}
            style={{
              position: "absolute",
              top: `${8 + r * 20}%`,
              left: 0,
              width: "100%",
              whiteSpace: "nowrap",
              display: "flex",
            }}
          >
            <div
              className="bm-anim bm-ink"
              style={{
                display: "inline-flex",
                gap: "3rem",
                paddingInlineEnd: "3rem",
                animation: `${anim} ${duration}s linear infinite`,
                fontFamily: "var(--font-messiri), serif",
                fontWeight: 700,
                fontSize: "clamp(1.9rem, 5vw, 3.4rem)",
              }}
            >
              <span>{line}</span>
              <span>{line}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** نمط «كلماتٌ تطفو»: جُملٌ تصعد ببطءٍ وتتلاشى في مواضع متفرّقة. */
function FloatLayer({ phrases }: { phrases: string[] }) {
  return (
    <>
      {phrases.map((p, i) => {
        const left = 6 + ((i * 37) % 80);        // توزيعٌ أفقيٌّ شبه منتظم
        const duration = 16 + (i % 5) * 4;
        const delay = (i % 6) * 2.6;
        return (
          <div
            key={i}
            className="bm-anim bm-ink"
            style={{
              position: "absolute",
              bottom: 0,
              left: `${left}%`,
              transform: "translateY(18vh)",
              animation: `bm-float ${duration}s ease-in-out ${delay}s infinite`,
              fontFamily: "var(--font-messiri), serif",
              fontWeight: 600,
              fontSize: "clamp(1.7rem, 5vw, 2.4rem)",
              whiteSpace: "nowrap",
            }}
          >
            {p}
          </div>
        );
      })}
    </>
  );
}

/** نمط «نصٌّ كبيرٌ باهت»: جملةٌ واحدة ضخمة تتبدّل كلّ بضع ثوانٍ. */
function FadeLayer({ phrase, idx }: { phrase: string; idx: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 6vw",
      }}
    >
      <div
        key={idx}
        className="bm-anim bm-ink"
        style={{
          animation: "bm-fade 4.5s ease-in-out",
          textAlign: "center",
          lineHeight: 1.25,
          fontFamily: "var(--font-messiri), serif",
          fontWeight: 700,
          fontSize: "clamp(2.8rem, 10vw, 7rem)",
        }}
      >
        {phrase}
      </div>
    </div>
  );
}
