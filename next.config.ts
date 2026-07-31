import type { NextConfig } from "next";

// معرّف البناء: نبثّه للعميل ليُقارنه دورياً بمعرّف الخادم الحيّ (/api/version)
// فيكتشف تلقائياً وجود نشرٍ جديد ويعرض «تحديث الآن». على Vercel يُضبط
// VERCEL_GIT_COMMIT_SHA تلقائياً وقتَ البناء؛ محلياً تبقى القيمة "dev" فيُعطَّل الفحص.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // يسمح بالوصول لخادم التطوير من أجهزة الشبكة المحلّيّة (الجوال) دون تحذيرات
  //  cross-origin. لا أثر له في الإنتاج.
  allowedDevOrigins: ["10.91.138.25"],
  // الحدّ الافتراضيّ لجسم «إجراء الخادم» (Server Action) مليونُ بايتٍ فقط، بينما
  // نسمح بصور الطلاب حتى ٣م.ب وصور الفواتير حتى ٥م.ب (تصل ~٧م.ب بعد ترميز base64).
  // دون رفع الحدّ يرفض إطارُ العمل الطلبَ صامتاً قبل تنفيذ الإدراج، فيبدو التسجيل ناجحاً
  // بينما لا يُحفَظ الطالب. نرفعه ليتّسع لأكبر رفعٍ مسموح مع هامش الترويسات.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
