"use client";
import Image from "next/image";
import { useStore } from "@/lib/store/StoreProvider";

/** Large showcase logo for the landing hero. Respects the Prince's
 *  site-wide logoDisplayMode (VISIBLE / BLURRED / HIDDEN). */
export function HeroLogo() {
  const { logoDisplayMode } = useStore();
  if (logoDisplayMode === "HIDDEN") return null;

  const blurred = logoDisplayMode === "BLURRED";
  return (
    <div className="relative mx-auto" style={{ width: "min(56vmin, 320px)", height: "min(56vmin, 320px)" }}>
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(184,149,90,.28) 0%, rgba(184,149,90,.06) 45%, transparent 70%)",
          filter: "blur(4px)",
        }}
      />
      <Image
        src="/logo.png"
        alt="معالي أبها ١٤٤٨هـ"
        fill
        priority
        sizes="(max-width: 640px) 60vw, 340px"
        style={{
          objectFit: "contain",
          filter: blurred
            ? "blur(14px) drop-shadow(0 8px 24px rgba(30,70,53,.18))"
            : "drop-shadow(0 8px 24px rgba(30,70,53,.18))",
        }}
      />
    </div>
  );
}
