"use client";

/* محرّك تقارير PDF احترافيّ عامّ بهُويّة «معالي» (RTL + تشكيل عربيّ صحيح).
 *
 * نفس النهج المُثبَت في تقرير الشباب: نبني كلّ صفحة HTML ثمّ نرسّمها عبر
 * SVG `foreignObject` (محرّك رسم النصّ الأصليّ في المتصفّح) فيُشكّل العربيّة
 * ويطبّق RTL بشكلٍ مثاليّ (بخلاف html2canvas)، ثمّ نجمّع الصور في PDF عبر jsPDF.
 * الشعار والخطّ مُضمّنان data URL كي لا يتلوّث الـ canvas. الأعمدة عامّة: يمرّر
 * المستدعي رؤوسها وخلاياها (HTML) فيصلح لأي جدول (مشتريات، طلاب، …). */

const BRAND = {
  petroleum: "#2C6B79",
  gold: "#C2A063",
  ink: "#22312F",
  sub: "#5B6B68",
  line: "#E3DED2",
  paper: "#FBF8F1",
  band: "#F4EEE2",
};

const PAGE_W = 794;
const PAGE_H = 1123;
const PAD = 40;
const ROW_H = 32;

export type ReportColumn = { header: string; width?: string; align?: "right" | "center" | "left" };

export type ReportInput = {
  title: string;
  subtitle?: string;
  filename: string;        // بلا امتداد
  footerLabel: string;
  columns: ReportColumn[];
  rows: string[][];        // كل خليّة HTML جاهز (استخدم esc للنصوص)
  summaryHtml?: string;    // كتلة اختياريّة أعلى الجدول (ملخّص/إجماليّات)
};

export function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/** خليّة رقميّة لاتينيّة بلا انعكاس (للأرقام والمبالغ). */
export function ltr(s: string): string {
  return `<span dir="ltr" style="unicode-bidi:plaintext">${esc(s)}</span>`;
}

/** شارة حالةٍ ملوّنة. */
export function pill(label: string, color: string): string {
  return `<span style="display:inline-block;min-width:60px;box-sizing:border-box;padding:3px 9px;` +
    `border-radius:6px;font-size:10px;font-weight:700;line-height:1.4;color:#fff;background:${color};` +
    `white-space:nowrap;text-align:center">${esc(label)}</span>`;
}

export const REPORT_COLORS = BRAND;

async function loadLogo(): Promise<string> {
  try {
    const res = await fetch("/logo.png");
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch { return ""; }
}

function headerHtml(logo: string, title: string, subtitle: string, dateStr: string): string {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
      <div style="text-align:right">
        <div style="font-size:21px;font-weight:800;color:${BRAND.petroleum};line-height:1.2">${esc(title)}</div>
        <div style="font-size:12px;color:${BRAND.sub};margin-top:4px">منصّة معالي محافظة بلّسمر ١٤٤٨هـ${subtitle ? " · " + esc(subtitle) : ""}</div>
      </div>
      ${logo ? `<img src="${logo}" style="height:64px;width:auto;display:block" />` : ""}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
      <div style="font-size:11px;color:${BRAND.sub}">تاريخ التصدير: ${esc(dateStr)}</div>
      <div style="font-size:11px;color:${BRAND.gold};font-weight:700">تقريرٌ رسميّ — سرّي للإدارة</div>
    </div>
    <div style="height:4px;border-radius:3px;margin-top:10px;background:linear-gradient(90deg,${BRAND.petroleum} 0%,${BRAND.petroleum} 62%,${BRAND.gold} 62%,${BRAND.gold} 100%)"></div>`;
}

function theadHtml(columns: ReportColumn[]): string {
  // نسمح برؤوسٍ من سطرين ونقصّ أيّ فائض داخل الخليّة (overflow:hidden + word-break)
  // كي لا يطفح عنوانٌ طويل («المصروف على») على العمود المجاور فيتراكب النصّ.
  const th = (c: ReportColumn) =>
    `<th style="padding:9px 8px;font-size:11px;font-weight:700;color:${BRAND.band};` +
    `text-align:${c.align || "center"};width:${c.width || "auto"};` +
    `white-space:normal;overflow:hidden;word-break:break-word;line-height:1.3">${esc(c.header)}</th>`;
  return `<thead><tr style="background:${BRAND.petroleum}">${columns.map(th).join("")}</tr></thead>`;
}

function rowHtml(cells: string[], columns: ReportColumn[], idx: number): string {
  const zebra = idx % 2 === 0 ? "#FFFFFF" : BRAND.paper;
  const td = (inner: string, c: ReportColumn) =>
    `<td style="height:${ROW_H}px;padding:4px 8px;font-size:10.5px;color:${BRAND.ink};` +
    `text-align:${c.align || "center"};border-bottom:1px solid ${BRAND.line};vertical-align:middle;` +
    `overflow:hidden;word-break:break-word">${inner}</td>`;
  return `<tr style="background:${zebra}">${cells.map((cell, i) => td(cell, columns[i])).join("")}</tr>`;
}

function footerHtml(label: string, pageNo: number, pageCount: number): string {
  const num = (n: number) => `<span dir="ltr">${n}</span>`;
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;border-top:1.5px solid ${BRAND.gold};padding-top:8px;margin-top:6px">
      <div style="font-size:10.5px;color:${BRAND.sub}">معالي محافظة بلّسمر · ${esc(label)}</div>
      <div style="font-size:10.5px;color:${BRAND.petroleum};font-weight:700">صفحة ${num(pageNo)} من ${num(pageCount)}</div>
    </div>`;
}

function resolveArabicFontFamily(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-cairo").trim();
  return `${v || "Cairo"}, 'IBM Plex Sans Arabic', 'Tajawal', sans-serif`;
}

async function collectArabicFontFaceCss(): Promise<string> {
  type Face = { family: string; weight: string; style: string; url: string };
  const faces: Face[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue("font-family");
      if (!/cairo/i.test(family)) continue;
      const m = rule.style.getPropertyValue("src").match(/url\(\s*["']?([^"')]+\.woff2?)["']?\s*\)/i);
      if (!m) continue;
      faces.push({ family, weight: rule.style.getPropertyValue("font-weight") || "400", style: rule.style.getPropertyValue("font-style") || "normal", url: m[1] });
    }
  }
  const parts = await Promise.all(faces.map(async f => {
    try {
      const res = await fetch(f.url);
      const buf = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const rd = new FileReader();
        rd.onload = () => resolve(String(rd.result));
        rd.onerror = () => reject(rd.error);
        rd.readAsDataURL(buf);
      });
      return `@font-face{font-family:${f.family};font-style:${f.style};font-weight:${f.weight};font-display:block;src:url(${dataUrl}) format('woff2')}`;
    } catch { return ""; }
  }));
  return parts.join("");
}

function buildPageShell(stage: HTMLElement, logo: string, o: ReportInput, dateStr: string, fontFamily: string, withSummary: boolean) {
  const page = document.createElement("div");
  page.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;box-sizing:border-box;padding:${PAD}px;background:#fff;font-family:${fontFamily};direction:rtl;display:flex;flex-direction:column`;

  const header = document.createElement("div");
  header.innerHTML = headerHtml(logo, o.title, o.subtitle || "", dateStr);

  const summary = document.createElement("div");
  if (withSummary && o.summaryHtml) { summary.style.cssText = "margin-top:12px"; summary.innerHTML = o.summaryHtml; }

  const body = document.createElement("div");
  body.style.cssText = "flex:1 1 auto;margin-top:14px;overflow:hidden";
  const table = document.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse;table-layout:fixed";
  table.innerHTML = theadHtml(o.columns);
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  body.appendChild(table);

  const footerSlot = document.createElement("div");
  page.appendChild(header);
  page.appendChild(summary);
  page.appendChild(body);
  page.appendChild(footerSlot);
  stage.appendChild(page);

  const thead = table.querySelector("thead") as HTMLTableSectionElement;
  const probe = document.createElement("div");
  probe.innerHTML = footerHtml(o.footerLabel, 1, 1);
  footerSlot.appendChild(probe);
  const avail = PAGE_H - PAD * 2 - header.offsetHeight - (withSummary && o.summaryHtml ? summary.offsetHeight : 0) - 14 - thead.offsetHeight - footerSlot.offsetHeight - 6;
  footerSlot.innerHTML = "";

  return { page, tbody, footerSlot, avail };
}

async function rasterizePageViaSvg(page: HTMLElement, fontCss: string, scale = 2): Promise<HTMLCanvasElement> {
  const clone = page.cloneNode(true) as HTMLElement;
  const xhtml = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}">` +
    `<defs><style type="text/css">${fontCss}</style></defs>` +
    `<foreignObject x="0" y="0" width="${PAGE_W}" height="${PAGE_H}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${PAGE_W}px;height:${PAGE_H}px">${xhtml}</div>` +
    `</foreignObject></svg>`;
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const img = new Image();
  img.width = PAGE_W; img.height = PAGE_H;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("تعذّر رسم صفحة التقرير"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W * scale; canvas.height = PAGE_H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر إنشاء سياق canvas");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, PAGE_W, PAGE_H);
  return canvas;
}

/** يبني تقرير PDF جدوليّاً عامّاً ويُنزّله. */
export async function exportTableReportPdf(o: ReportInput): Promise<void> {
  const arDate = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { year: "numeric", month: "long", day: "numeric" });
  const dateStr = arDate.format(new Date());
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadLogo()]);
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* ignore */ } }
  const fontFamily = resolveArabicFontFamily();
  const fontCss = await collectArabicFontFaceCss();

  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1";
  document.body.appendChild(stage);

  const pages: HTMLDivElement[] = [];
  const footerSlots: HTMLDivElement[] = [];
  let first = true;
  let cur = buildPageShell(stage, logo, o, dateStr, fontFamily, first);

  o.rows.forEach(cells => {
    const wrap = document.createElement("tbody");
    wrap.innerHTML = rowHtml(cells, o.columns, cur.tbody.children.length);
    const row = wrap.firstElementChild as HTMLTableRowElement;
    cur.tbody.appendChild(row);
    if (cur.tbody.offsetHeight > cur.avail && cur.tbody.children.length > 1) {
      cur.tbody.removeChild(row);
      pages.push(cur.page); footerSlots.push(cur.footerSlot);
      first = false;
      cur = buildPageShell(stage, logo, o, dateStr, fontFamily, first);
      // نُعيد ترقيم الزيبرا داخل الصفحة الجديدة
      wrap.innerHTML = rowHtml(cells, o.columns, 0);
      cur.tbody.appendChild(wrap.firstElementChild as HTMLTableRowElement);
    }
  });
  pages.push(cur.page); footerSlots.push(cur.footerSlot);
  footerSlots.forEach((slot, i) => { slot.innerHTML = footerHtml(o.footerLabel, i + 1, pages.length); });

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < pages.length; i++) {
    const canvas = await rasterizePageViaSvg(pages[i], fontCss, 2);
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, 0, pw, ph, undefined, "FAST");
  }
  document.body.removeChild(stage);
  const stamp = new Date().toISOString().slice(0, 10);
  pdf.save(`${o.filename}_${stamp}.pdf`);
}
