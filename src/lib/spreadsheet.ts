/* أدوات جداول بسيطة (CSV متوافق مع Excel) — بلا اعتماديّات خارجيّة.
 * التصدير يضيف ترويسة BOM ليعرض Excel العربيّة بشكلٍ سليم. */

/** يُحوّل صفوفاً إلى نصّ CSV مع تهريب الفواصل وعلامات الاقتباس والأسطر. */
export function toCSV(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map(r => r.map(esc).join(",")).join("\r\n");
}

/** يُحلّل نصّ CSV إلى مصفوفة صفوف، مع دعم الحقول المُقتبَسة. */
export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, ""); // إزالة BOM إن وُجد
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(x => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some(x => x.trim() !== "")) rows.push(row); }
  return rows;
}

/** يُنزّل نصّاً كملفٍّ في المتصفّح (مع BOM لدعم العربيّة في Excel). */
export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
