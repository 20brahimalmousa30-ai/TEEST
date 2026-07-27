/* أدوات صورٍ خفيفة تعمل في المتصفّح — بلا اعتماديّات.
 * تُستخدم لرفع صور الفرق/اللجان واشتقاق لونٍ مميّز منها تلقائياً. */

/** يقرأ ملفّ صورة ويُعيده كـ data URL (base64). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** يشتقّ لوناً مميّزاً (hex) من صورةٍ عبر تجميع البكسلات في صناديق لونيّة
 *  واختيار الأكثر تكراراً، مع تجاهل البكسلات القريبة من الأبيض/الأسود/الشفّافة. */
export function extractDominantColor(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 48; // عيّنةٌ مصغَّرة تكفي لتقدير اللون بسرعة
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no 2d context")); return; }
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);

      const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 125) continue;                               // شبه شفّاف
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max > 235 && min > 235) continue;                // قريبٌ من الأبيض
        if (max < 24) continue;                              // قريبٌ من الأسود
        const key = `${r >> 4}-${g >> 4}-${b >> 4}`;         // صناديق ١٦×١٦×١٦
        const cur = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
        cur.count++; cur.r += r; cur.g += g; cur.b += b;
        buckets.set(key, cur);
      }

      let best: { count: number; r: number; g: number; b: number } | null = null;
      for (const v of buckets.values()) if (!best || v.count > best.count) best = v;
      if (!best) { resolve("#2C6B79"); return; }             // رجوعٌ للون الهُويّة

      const toHex = (n: number) => Math.round(n / best!.count).toString(16).padStart(2, "0");
      resolve(`#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`);
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = dataUrl;
  });
}
