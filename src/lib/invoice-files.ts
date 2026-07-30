"use client";

// ============================================================================
//  تحويل ملفات الفواتير (صور JPG/PNG/WebP/GIF أو PDF) إلى صورةٍ جاهزة للتحليل.
//  - الصور: تُصغَّر في المتصفّح إلى حافة ≤1568px بجودةٍ عالية (تحكّمٌ أدقّ بوضوح
//    الخطّ الصغير وتجنّبٌ لحدّ الحجم) كما في مسار محاسب كلود المُثبَت.
//  - PDF: تُرسَم الصفحة الأولى فقط على canvas ثم تُصدَّر JPEG — فتمرّ عبر نفس
//    مسار التحليل دون أي تغييرٍ في الخادم. (الفاتورة عادةً صفحةٌ واحدة.)
//  كلّ هذا يجري في المتصفّح؛ لا يُرسَل للخادم إلا صورة base64.
// ============================================================================

export const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.9;

export type InvoiceImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface InvoiceImage {
  base64: string;   // بلا بادئة data:
  mediaType: InvoiceImageMediaType;
  dataUrl: string;  // data:<mime>;base64,<...>
}

const SUPPORTED_IMAGE: Record<string, InvoiceImageMediaType> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
};

/** هل الملف PDF؟ (بالنوع أو الامتداد). */
export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/** هل الملف نوعٌ مدعوم (صورة أو PDF)؟ */
export function isSupportedInvoiceFile(file: File): boolean {
  return isPdfFile(file) || file.type.startsWith("image/");
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذّرت قراءة الملف."));
    reader.readAsDataURL(file);
  });
}

/** يُصغّر صورة إلى حافة ≤1568px ويعيدها JPEG (GIF يُرسَل كما هو لحفظ الحركة). */
async function imageFileToImage(file: File): Promise<InvoiceImage> {
  const rawType: InvoiceImageMediaType = SUPPORTED_IMAGE[file.type] ?? "image/jpeg";

  if (rawType === "image/gif" || typeof document === "undefined") {
    const dataUrl = await readAsDataUrl(file);
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    return { base64, mediaType: rawType, dataUrl: `data:${rawType};base64,${base64}` };
  }

  try {
    const dataUrl = await readAsDataUrl(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("تعذّر تحميل الصورة."));
      el.src = dataUrl;
    });

    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-2d-context");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff"; // خلفيّة بيضاء لصور PNG الشفّافة.
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const outUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const base64 = outUrl.split(",")[1];
    if (!base64) throw new Error("encode-failed");
    return { base64, mediaType: "image/jpeg", dataUrl: outUrl };
  } catch {
    const dataUrl = await readAsDataUrl(file);
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    return { base64, mediaType: rawType, dataUrl: `data:${rawType};base64,${base64}` };
  }
}

/** يرسم الصفحة الأولى من PDF على canvas ويعيدها صورة JPEG جاهزة للتحليل. */
async function pdfFileToImage(file: File): Promise<InvoiceImage> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = MAX_EDGE / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذّر تجهيز مساحة الرسم لتحويل PDF.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const base64 = dataUrl.split(",")[1];
    if (!base64) throw new Error("تعذّر تحويل صفحة PDF إلى صورة.");
    return { base64, mediaType: "image/jpeg", dataUrl };
  } finally {
    doc.destroy().catch(() => {});
  }
}

/** يحوّل أي ملف فاتورةٍ مدعوم (صورة أو PDF) إلى صورةٍ قابلة للتحليل. */
export async function fileToInvoiceImage(file: File): Promise<InvoiceImage> {
  if (isPdfFile(file)) return pdfFileToImage(file);
  return imageFileToImage(file);
}
