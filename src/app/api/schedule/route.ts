import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

/**
 * مسارُ صورة «جدول السفرة» عند الطلب.
 *
 * لماذا؟ صورة الجدول تُخزَّن كـ data URL (base64) في app_settings بكامل دقّتها،
 * ولئلّا تُنقَل داخل لقطة loadAllData في كل تحميلٍ لأيّ صفحة نستبعدها ونجلبها هنا
 * مرّةً ونخزّنها مؤقّتاً في المتصفّح. البايتات تُخدَم كما هي دون أيّ إعادة ترميز،
 * فتبقى الدقّة كاملةً كما رفعها الأمير. الجدول معلومةٌ عامّة، فالمسار عامٌّ بلا صلاحية.
 *
 * كسرُ التخزين المؤقّت: الواجهة تستدعيه بـ ?v=schedule_version، فيتغيّر الرابط عند
 * كلّ رفعٍ جديدٍ ويُحمَّل الجديد فوراً رغم التخزين الطويل.
 */
export async function GET() {
  const { data, error } = await getSupabase()
    .from("app_settings").select("schedule_url").eq("id", 1).single();

  const dataUrl = (data?.schedule_url as string | null) ?? null;
  if (error || !dataUrl) return new NextResponse("لا يوجد جدولٌ للسفرة", { status: 404 });

  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) return new NextResponse("صيغةٌ غير صالحة", { status: 422 });
  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      // الرابط يحمل ?v=version يتبدّل عند كل تغيير، فيُؤمَن التخزين الطويل بأمان.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
