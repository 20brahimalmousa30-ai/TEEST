/* تصدير تقرير الشباب إلى PDF احترافي بهُويّة «معالي» — للمدير/الأمير فقط.
 *
 * لماذا هذا النهج؟ مكتبات PDF في Node/المتصفّح (jsPDF, pdfkit…) لا تُشكّل
 * الحروف العربيّة ولا تدعم RTL افتراضياً — فتظهر الحروف مبعثرة/معكوسة.
 * الحلّ الأضمن: نبني التقرير كـ HTML (محرّك المتصفّح يُشكّل العربيّة بشكل
 * مثاليّ)، ثم نُحوّل كلّ صفحةٍ إلى صورةٍ عالية الدقّة عبر html2canvas،
 * ونجمّعها في ملفّ PDF عبر jsPDF. نستخدم أنماطاً داخليّة (ألوان hex صريحة)
 * لتفادي دوالّ ألوان Tailwind الحديثة (oklch) التي لا يفهمها html2canvas. */

import { sar, arDate } from "@/lib/format";
import type { Student, Team, Supervisor } from "@/lib/mock/types";

/** ألوان هُويّة «معالي» — مُطابقة لمتغيّرات الموقع (--jabal / --shams). */
const BRAND = {
  petroleum: "#2C6B79", // البترولي (--jabal)
  petroleumDark: "#1F4E58",
  gold: "#C2A063", // الذهبي (--shams)
  goldSoft: "#E7D9BC",
  ink: "#22312F",
  sub: "#5B6B68",
  line: "#E3DED2",
  paper: "#FBF8F1",
  band: "#F4EEE2",
  ok: "#2E7D5B",
  warn: "#B07A1E",
  crit: "#B23A48",
};

/** أبعاد A4 عموديّاً بوحدة البكسل عند 96dpi. */
const PAGE_W = 794;
const PAGE_H = 1123;
const PAD = 40; // هامش داخليّ

type Brand = { accent: string; accentWarm: string };

/** يقرأ شعار الموقع كـ data URL لتضمينه في كلّ صفحة (صورةً حقيقيّة لا نصاً). */
async function loadLogo(): Promise<string> {
  const res = await fetch("/logo.png");
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function statusMeta(s: Student): { label: string; color: string } {
  const st = s.approvalStatus ?? "APPROVED";
  if (st === "PENDING") return { label: "بانتظار الاعتماد", color: BRAND.warn };
  if (st === "REJECTED") return { label: "مرفوض", color: BRAND.crit };
  return { label: "معتمد", color: BRAND.ok };
}

/** خليّة الصورة الشخصيّة: صورةٌ دائريّة إن وُجدت، وإلّا الحرف الأوّل. */
function photoCell(s: Student): string {
  const initial = esc(s.name.trim().charAt(0) || "؟");
  if (s.photoDataUrl) {
    return `<img src="${s.photoDataUrl}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:1.5px solid ${BRAND.goldSoft};display:block" />`;
  }
  return `<div style="width:34px;height:34px;border-radius:50%;background:${BRAND.petroleum};color:${BRAND.band};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700">${initial}</div>`;
}

/** رأس الصفحة: الشعار + عنوان التقرير + تاريخ التصدير + شريط بترولي. */
function headerHtml(logo: string, title: string, dateStr: string): string {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
      <div style="text-align:right">
        <div style="font-size:21px;font-weight:800;color:${BRAND.petroleum};line-height:1.2">${esc(title)}</div>
        <div style="font-size:12px;color:${BRAND.sub};margin-top:4px">منصّة معالي محافظة بلّسمر ١٤٤٨هـ</div>
      </div>
      <img src="${logo}" style="height:66px;width:auto;display:block" />
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
      <div style="font-size:11px;color:${BRAND.sub}">تاريخ التصدير: ${esc(dateStr)}</div>
      <div style="font-size:11px;color:${BRAND.gold};font-weight:700">تقريرٌ رسميّ — سرّي للإدارة</div>
    </div>
    <div style="height:4px;border-radius:3px;margin-top:10px;background:linear-gradient(90deg,${BRAND.petroleum} 0%,${BRAND.petroleum} 62%,${BRAND.gold} 62%,${BRAND.gold} 100%)"></div>
  `;
}

/** رأس الجدول (thead) بألوان الهُويّة. */
function theadHtml(): string {
  const th = (t: string, align = "center", w = "auto") =>
    `<th style="padding:9px 8px;font-size:11.5px;font-weight:700;color:${BRAND.band};text-align:${align};width:${w};white-space:nowrap">${t}</th>`;
  return `
    <thead>
      <tr style="background:${BRAND.petroleum}">
        ${th("#", "center", "34px")}
        ${th("الصورة", "center", "44px")}
        ${th("الاسم", "right")}
        ${th("الجوّال", "center", "110px")}
        ${th("الحالة", "center", "96px")}
        ${th("الفريق", "center", "90px")}
        ${th("المشرف", "right", "120px")}
        ${th("الرسوم (مدفوع/متبقّي)", "center", "150px")}
        ${th("تاريخ التسجيل", "center", "110px")}
      </tr>
    </thead>`;
}

/** صفٌّ واحد في الجدول. */
function rowHtml(s: Student, idx: number, teams: Team[], supervisors: Supervisor[]): string {
  const team = teams.find(t => t.id === s.teamId);
  const supervisor = team ? supervisors.find(v => v.id === team.supervisorId) : undefined;
  const st = statusMeta(s);
  const remaining = Math.max(0, s.totalAmount - s.paidAmount);
  const zebra = idx % 2 === 0 ? "#FFFFFF" : BRAND.paper;
  const td = (inner: string, align = "center", extra = "") =>
    `<td style="padding:7px 8px;font-size:11.5px;color:${BRAND.ink};text-align:${align};border-bottom:1px solid ${BRAND.line};vertical-align:middle;${extra}">${inner}</td>`;

  return `
    <tr style="background:${zebra}">
      ${td(`<span style="color:${BRAND.sub};font-size:11px">${idx + 1}</span>`)}
      ${td(`<div style="display:flex;justify-content:center">${photoCell(s)}</div>`)}
      ${td(`<span style="font-weight:600">${esc(s.name)}</span>`, "right")}
      ${td(`<span dir="ltr" style="unicode-bidi:plaintext">${esc(s.phone)}</span>`)}
      ${td(`<span style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:10.5px;font-weight:700;color:#fff;background:${st.color}">${st.label}</span>`)}
      ${td(esc(team ? team.name : "—"))}
      ${td(esc(supervisor ? supervisor.name : "—"), "right")}
      ${td(`<span style="color:${BRAND.ok};font-weight:700">${sar(s.paidAmount)}</span> <span style="color:${BRAND.sub}">/</span> <span style="color:${remaining > 0 ? BRAND.crit : BRAND.sub};font-weight:700">${sar(remaining)}</span> <span style="color:${BRAND.sub};font-size:10px">من ${sar(s.totalAmount)}</span>`)}
      ${td(`<span dir="ltr" style="unicode-bidi:plaintext">${esc(arDate(s.registeredAt))}</span>`)}
    </tr>`;
}

/** تذييل الصفحة: هُويّة + ترقيم. */
function footerHtml(pageNo: number, pageCount: number): string {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;border-top:1.5px solid ${BRAND.gold};padding-top:8px;margin-top:6px">
      <div style="font-size:10.5px;color:${BRAND.sub}">معالي محافظة بلّسمر · تقرير الشباب</div>
      <div style="font-size:10.5px;color:${BRAND.petroleum};font-weight:700">صفحة ${sar(pageNo)} من ${sar(pageCount)}</div>
    </div>`;
}

/** يبني عنصر صفحةٍ فارغاً بأبعاد A4 وبنية رأس/جدول/تذييل جاهزة للقياس. */
function buildPageShell(logo: string, title: string, dateStr: string): {
  page: HTMLDivElement; tbody: HTMLTableSectionElement; footerSlot: HTMLDivElement; avail: number;
} {
  const page = document.createElement("div");
  page.style.cssText =
    `width:${PAGE_W}px;height:${PAGE_H}px;box-sizing:border-box;padding:${PAD}px;` +
    `background:#fff;font-family:var(--font-cairo),'IBM Plex Sans Arabic','Tajawal',sans-serif;` +
    `direction:rtl;display:flex;flex-direction:column`;

  const header = document.createElement("div");
  header.innerHTML = headerHtml(logo, title, dateStr);

  const body = document.createElement("div");
  body.style.cssText = "flex:1 1 auto;margin-top:14px;overflow:hidden";
  const table = document.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse;table-layout:fixed";
  table.innerHTML = theadHtml();
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  body.appendChild(table);

  const footerSlot = document.createElement("div");

  page.appendChild(header);
  page.appendChild(body);
  page.appendChild(footerSlot);

  // القياس: نُلحق الصفحة مؤقّتاً لحساب الارتفاع المتاح للصفوف.
  const thead = table.querySelector("thead") as HTMLTableSectionElement;
  const footerProbe = document.createElement("div");
  footerProbe.innerHTML = footerHtml(1, 1);
  footerSlot.appendChild(footerProbe);
  const avail = PAGE_H - PAD * 2 - header.offsetHeight - 14 - thead.offsetHeight - footerSlot.offsetHeight - 6;
  footerSlot.innerHTML = "";

  return { page, tbody, footerSlot, avail };
}

export type StudentsReportInput = {
  students: Student[];
  teams: Team[];
  supervisors: Supervisor[];
  brand?: Brand;
  title?: string;
};

/** يُولّد ملفّ PDF لبيانات الشباب ويُنزّله. */
export async function exportStudentsPdf(input: StudentsReportInput): Promise<void> {
  const { students, teams, supervisors } = input;
  const title = input.title ?? "تقرير بيانات الشباب";
  const dateStr = arDate(new Date().toISOString());

  const [{ jsPDF }, html2canvasMod, logo] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
    loadLogo(),
  ]);
  const html2canvas = html2canvasMod.default;

  // ننتظر تحميل الخطوط لضمان تشكيلٍ صحيحٍ قبل الرَّسم.
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* تجاهل */ } }

  // حاوية مخفيّة خارج الشاشة (مرئيّة للرَّسم لكن بعيدة عن العرض).
  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1";
  document.body.appendChild(stage);

  // ── ترقيم صفحات قائمٌ على القياس (لا يُقطع صفٌّ في المنتصف) ──
  const pages: HTMLDivElement[] = [];
  const footerSlots: HTMLDivElement[] = [];
  let cur = buildPageShell(logo, title, dateStr);
  stage.appendChild(cur.page);

  students.forEach((s, i) => {
    const wrap = document.createElement("tbody");
    wrap.innerHTML = rowHtml(s, i, teams, supervisors);
    const row = wrap.firstElementChild as HTMLTableRowElement;
    cur.tbody.appendChild(row);
    if (cur.tbody.offsetHeight > cur.avail && cur.tbody.children.length > 1) {
      cur.tbody.removeChild(row);            // الصفّ لا يتّسع → أغلِق الصفحة
      pages.push(cur.page); footerSlots.push(cur.footerSlot);
      cur = buildPageShell(logo, title, dateStr);
      stage.appendChild(cur.page);
      cur.tbody.appendChild(row);            // أعِد الصفّ لأعلى الصفحة الجديدة
    }
  });
  pages.push(cur.page); footerSlots.push(cur.footerSlot);

  // نملأ التذييل الآن بعد معرفة العدد الكلّي للصفحات.
  footerSlots.forEach((slot, i) => { slot.innerHTML = footerHtml(i + 1, pages.length); });

  // ── تحويل كلّ صفحة إلى صورة ثمّ إلى PDF ──
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false,
      width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W, windowHeight: PAGE_H,
    });
    const img = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage();
    pdf.addImage(img, "JPEG", 0, 0, pw, ph, undefined, "FAST");
  }

  document.body.removeChild(stage);

  const stamp = new Date().toISOString().slice(0, 10);
  pdf.save(`تقرير_الشباب_${students.length}_${stamp}.pdf`);
}
