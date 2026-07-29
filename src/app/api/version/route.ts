import { NextResponse } from "next/server";

// يُقرأ وقتَ التشغيل من نسخة النشر الحاليّة على الخادم. يقارنه العميل بالمعرّف
// المخبوز في حزمته (NEXT_PUBLIC_BUILD_ID)؛ فاختلافهما يعني أنّ نشراً جديداً وصل
// بينما لا يزال المتصفّح يشغّل النسخة القديمة → نعرض «تحديث الآن».
export const dynamic = "force-dynamic";

export async function GET() {
  const id =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
  return NextResponse.json({ id }, { headers: { "Cache-Control": "no-store" } });
}
