// أدواتٌ لجانب العميل: قراءة ملفّ صورة واستخراج ألوان الهوية السائدة منه (البند ٦).
// تعمل عبر canvas داخل المتصفّح — لا تعتمد على أيّ مكتبة خارجيّة.

export type BrandColors = { accent: string; accentWarm: string };

/** يقرأ ملفّ صورة ويعيده كـ Data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("تعذّرت قراءة الملفّ."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذّر تحميل الصورة."));
    img.src = src;
  });
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** يحسب السطوع (0..255) والإشباع التقريبي (0..1) للون. */
function lightnessSat(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const d = max - min;
  const sat = d === 0 ? 0 : d / (255 - Math.abs(max + min - 255) || 1);
  const warm = r >= b; // مائلٌ للدفء (أحمر/ذهبي) أكثر من البرودة (أزرق)
  return { light, sat, warm };
}

/** يستخرج لونين للهوية من صورة الشعار:
 *  - accent: لونٌ غامقٌ مُشبَع (للأزرار والنصوص البارزة).
 *  - accentWarm: لونٌ دافئٌ مُشبَع (للحدود والعناصر الثانويّة). */
export async function extractBrandColors(dataUrl: string): Promise<BrandColors> {
  const img = await loadImage(dataUrl);
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas غير متاح.");
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  // تجميع الألوان في دلاءٍ خشنة (١٦ مستوى لكلّ قناة) مع تجاهل الشفاف/الأبيض/الأسود/الرماديّ.
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const { light, sat } = lightnessSat(r, g, b);
    if (light > 238 || light < 14) continue; // أبيضٌ/أسود
    if (sat < 0.12) continue;                 // رماديّ باهت
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const cur = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    cur.r += r; cur.g += g; cur.b += b; cur.n++;
    buckets.set(key, cur);
  }

  const colors = [...buckets.values()]
    .map(c => {
      const r = Math.round(c.r / c.n), g = Math.round(c.g / c.n), b = Math.round(c.b / c.n);
      return { r, g, b, n: c.n, ...lightnessSat(r, g, b) };
    })
    .sort((a, b) => b.n - a.n); // الأكثر شيوعاً أولاً

  if (colors.length === 0) {
    // لا لونَ مُشبَع (شعارٌ رماديّ) — أعِد ألوان الثيم الافتراضيّة.
    return { accent: "#2C6B79", accentWarm: "#C2A063" };
  }

  // accent: أغمق لونٍ مُشبَعٍ بين أبرز الألوان شيوعاً.
  const top = colors.slice(0, 6);
  const accentPick = [...top].sort((a, b) => a.light - b.light)[0];
  // accentWarm: أبرز لونٍ دافئٍ يختلف عن accent؛ وإلّا أكثرها شيوعاً.
  const warmPick =
    top.find(c => c.warm && c !== accentPick) ??
    top.find(c => c !== accentPick) ??
    accentPick;

  return {
    accent: toHex(accentPick.r, accentPick.g, accentPick.b),
    accentWarm: toHex(warmPick.r, warmPick.g, warmPick.b),
  };
}
