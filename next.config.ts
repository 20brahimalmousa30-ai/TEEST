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
};

export default nextConfig;
