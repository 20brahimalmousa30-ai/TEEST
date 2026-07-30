"use client";

/* تصدير إكسل (.xlsx) احترافيّ بهُويّة «معالي»: ورقةٌ RTL، عنوانٌ مدموج، رأسٌ ملوّن،
 * عرضُ أعمدةٍ مضبوط، تنسيق أرقام/عملة، تجميد الرأس، وصفّ إجماليٍّ اختياريّ.
 * نُحمّل exceljs عند الطلب فقط (dynamic import) كي لا يثقل حزمة الصفحة. */

export type XlsxAlign = "right" | "center" | "left";
export type XlsxColumn = {
  header: string;
  width?: number;             // بالوحدات التقريبيّة لعرض عمود إكسل
  align?: XlsxAlign;          // محاذاة الخلايا (افتراض: center)
  numFmt?: string;            // تنسيق رقميّ، مثل "#,##0" أو "#,##0 \"ر.س\""
  total?: boolean;            // يُجمَع في صفّ الإجماليّ
};

const BRAND = {
  petroleum: "FF2C6B79",
  petroleumDark: "FF1F4E58",
  gold: "FFC2A063",
  band: "FFF4EEE2",
  ink: "FF22312F",
  line: "FFE3DED2",
  zebra: "FFFBF8F1",
  white: "FFFFFFFF",
};

export type XlsxOptions = {
  filename: string;                 // بلا امتداد
  sheetName?: string;
  title?: string;                   // عنوانٌ علويّ مدموج
  subtitle?: string;                // سطرٌ فرعيّ (تاريخ/عدد)
  columns: XlsxColumn[];
  rows: (string | number | null | undefined)[][];
  totalsLabel?: string;             // إن وُجد، يُضاف صفُّ إجماليٍّ يجمع أعمدة total
  serial?: boolean;                 // عمود تسلسل «#» (افتراض: نعم)
};

/** يُنشئ ملفّ إكسل منسّقاً واحترافيّاً (جدولٌ منظّم بفلترٍ وفرز) ويُنزّله. */
export async function exportXlsx(opts: XlsxOptions): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;

  // عمود تسلسلٍ «#» في المقدّمة (يظهر أقصى اليمين في ورقة RTL) — يُنظّم الجدول.
  const useSerial = opts.serial !== false;
  const columns: XlsxColumn[] = useSerial
    ? [{ header: "#", width: 5, align: "center" }, ...opts.columns]
    : opts.columns;
  const rows = useSerial ? opts.rows.map((row, i) => [i + 1, ...row]) : opts.rows;

  const wb = new ExcelJS.Workbook();
  wb.creator = "منصّة معالي محافظة بلّسمر";
  const ws = wb.addWorksheet(opts.sheetName || "بيانات", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 0 }],
    properties: { defaultRowHeight: 20 },
  });

  const nCols = columns.length;
  const lastColLetter = colLetter(nCols);
  let r = 1;

  // ── العنوان المدموج ──
  if (opts.title) {
    ws.mergeCells(`A${r}:${lastColLetter}${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = opts.title;
    c.font = { name: "Cairo", size: 16, bold: true, color: { argb: BRAND.white } };
    c.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.petroleum } };
    ws.getRow(r).height = 30;
    r++;
  }
  if (opts.subtitle) {
    ws.mergeCells(`A${r}:${lastColLetter}${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = opts.subtitle;
    c.font = { name: "Cairo", size: 10, color: { argb: BRAND.ink } };
    c.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.band } };
    ws.getRow(r).height = 20;
    r++;
  }
  if (opts.title || opts.subtitle) r++; // سطرٌ فاصل

  // ── رأس الأعمدة ──
  const headerRowIdx = r;
  const headerRow = ws.getRow(headerRowIdx);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: "Cairo", size: 11, bold: true, color: { argb: BRAND.white } };
    cell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.petroleum } };
    cell.border = thinBorder();
  });
  headerRow.height = 26;
  r++;

  // ── الصفوف ──
  rows.forEach((row, ri) => {
    const dataRow = ws.getRow(r);
    columns.forEach((col, ci) => {
      const cell = dataRow.getCell(ci + 1);
      const v = row[ci];
      cell.value = (v === null || v === undefined) ? "" : v;
      cell.font = { name: "Cairo", size: 10.5, color: { argb: BRAND.ink } };
      cell.alignment = { horizontal: col.align || "center", vertical: "middle", readingOrder: "rtl" };
      cell.border = thinBorder();
      if (col.numFmt && typeof v === "number") cell.numFmt = col.numFmt;
      if (ri % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.zebra } };
    });
    dataRow.height = 20;
    r++;
  });

  // ── صفّ الإجماليّ ──
  if (opts.totalsLabel && rows.length) {
    const totalRow = ws.getRow(r);
    let labelPlaced = false;
    columns.forEach((col, ci) => {
      const cell = totalRow.getCell(ci + 1);
      cell.font = { name: "Cairo", size: 11, bold: true, color: { argb: BRAND.white } };
      cell.alignment = { horizontal: col.align || "center", vertical: "middle", readingOrder: "rtl" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.petroleumDark } };
      cell.border = thinBorder();
      if (col.total) {
        const sum = rows.reduce((s, row) => s + (typeof row[ci] === "number" ? (row[ci] as number) : 0), 0);
        cell.value = sum;
        if (col.numFmt) cell.numFmt = col.numFmt;
      } else if (!labelPlaced) {
        cell.value = opts.totalsLabel;
        labelPlaced = true;
      }
    });
    totalRow.height = 24;
    r++;
  }

  // ── عرض الأعمدة (متكيّفٌ مع المحتوى: أطول قيمةٍ فعليّة، بحدٍّ أدنى/أقصى) ──
  columns.forEach((col, i) => {
    const contentMax = rows.reduce((m, row) => {
      const v = row[i];
      const len = v === null || v === undefined ? 0 : String(v).length;
      return Math.max(m, len);
    }, col.header.length);
    const w = Math.max(col.width ?? 0, contentMax + 3);
    ws.getColumn(i + 1).width = Math.max(6, Math.min(46, w));
  });

  // ── فلترٌ وفرزٌ على صفّ الرأس (يجعله جدولاً منظّماً قابلاً للتصفية) ──
  ws.autoFilter = { from: { row: headerRowIdx, column: 1 }, to: { row: headerRowIdx, column: nCols } };

  // ── تجميد العنوان + الرأس (يبقيان ظاهرَين عند التمرير) ──
  ws.views = [{ rightToLeft: true, state: "frozen", ySplit: headerRowIdx }];

  // ── التنزيل ──
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename.endsWith(".xlsx") ? opts.filename : `${opts.filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function thinBorder() {
  const c = { argb: BRAND.line };
  return {
    top: { style: "thin" as const, color: c },
    left: { style: "thin" as const, color: c },
    bottom: { style: "thin" as const, color: c },
    right: { style: "thin" as const, color: c },
  };
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** تنسيق مبلغٍ بالريال في إكسل. */
export const SAR_FMT = '#,##0 "ر.س"';
