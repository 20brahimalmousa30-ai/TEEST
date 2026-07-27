"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store/StoreProvider";

/** البند ٦: يطبّق ألوان الهوية المشتقّة من الشعار على متغيّرات الثيم في :root.
 *  عند غياب ألوانٍ مخصّصة تُستعاد قيم globals.css الافتراضيّة تلقائياً. */
export function BrandTheme() {
  const { brandColors } = useStore();

  useEffect(() => {
    const root = document.documentElement;
    const vars = ["--accent", "--accent-hover", "--accent-warm", "--accent-warm-2"];
    if (brandColors) {
      root.style.setProperty("--accent", brandColors.accent);
      root.style.setProperty("--accent-hover", brandColors.accent);
      root.style.setProperty("--accent-warm", brandColors.accentWarm);
      root.style.setProperty("--accent-warm-2", brandColors.accentWarm);
    } else {
      for (const v of vars) root.style.removeProperty(v);
    }
  }, [brandColors]);

  return null;
}
