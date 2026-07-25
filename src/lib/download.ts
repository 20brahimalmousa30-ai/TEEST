// Small helpers that trigger real browser downloads / clipboard writes.

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map(row => row.map(cell => {
      const s = String(cell ?? "");
      // quote fields that contain a comma, quote, or newline
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\r\n");

  // UTF-8 BOM so Excel opens Arabic correctly
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for old browsers
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    document.body.removeChild(ta);
    return ok;
  }
}

export function printPage() {
  if (typeof window !== "undefined") window.print();
}
