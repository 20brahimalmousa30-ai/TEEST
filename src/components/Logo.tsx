"use client";
import Image from "next/image";
import { useStore } from "@/lib/store/StoreProvider";

type LogoProps = {
  /** Height in px. Width scales with the natural aspect ratio. */
  size?: number;
  /** Kept for API compat — the JPG already includes the wordmark. */
  withText?: boolean;
  className?: string;
  priority?: boolean;
};

export function Logo({ size = 48, className, priority = false }: LogoProps) {
  const { logoDisplayMode, logoUrl } = useStore();

  // Prince-controlled, site-wide: hide the mark entirely.
  if (logoDisplayMode === "HIDDEN") return null;

  const blurred = logoDisplayMode === "BLURRED";
  const animated = logoDisplayMode === "ANIMATED";
  const custom = (logoUrl ?? "").trim();

  // Source is a square-cropped image; render as square, use object-contain
  // so the actual mark centres cleanly inside whatever height is asked.
  return (
    <span
      className={`inline-flex items-center justify-center ${className ?? ""}`}
      style={{ height: size, width: size }}
      aria-label="معالي محافظة بلّسمر ١٤٤٨هـ"
    >
      {custom ? (
        // شعارٌ مخصّص (Data URL) — يُعرض بوسم img عادي لتجنّب تحسين next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={custom}
          alt="معالي محافظة بلّسمر ١٤٤٨هـ"
          className={`h-full w-full object-contain${animated ? " logo-animated" : ""}`}
          style={blurred ? { filter: "blur(7px)", opacity: 0.85 } : undefined}
        />
      ) : (
        <Image
          src="/logo.png"
          alt="معالي محافظة بلّسمر ١٤٤٨هـ"
          width={size}
          height={size}
          priority={priority}
          className={`h-full w-full object-contain${animated ? " logo-animated" : ""}`}
          style={blurred ? { filter: "blur(7px)", opacity: 0.85 } : undefined}
        />
      )}
    </span>
  );
}
