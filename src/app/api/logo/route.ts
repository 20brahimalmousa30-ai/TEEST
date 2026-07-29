import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

/**
 * مسارُ شعار الموقع المخصّص عند الطلب.
 *
 * لماذا؟ الشعار المخصّص يُخزَّن كـ data URL (base64 ≈ ٢٥٠ ك.ب) في app_settings،
 * وكان يُنقَل داخل لقطة loadAllData في كل تحميلٍ لأيّ صفحة — لكلّ زائر بما فيهم
 * كلُّ شابٍّ يفتح رابط التسجيل. الآن يُستبعد من اللقطة ويُجلَب هنا مرّةً ويُخزَّن
 * مؤقّتاً في المتصفّح. الشعار علامةٌ عامّة، فالمسار عامٌّ بلا صلاحية.
 *
 * كسرُ التخزين المؤقّت: الواجهة تستدعيه بـ ?v=logo_version، فيتغيّر الرابط عند
 * كلّ رفعٍ جديدٍ للشعار ويُحمَّل الجديد فوراً رغم التخزين الطويل.
 */
export async function GET() {
  const { data, error } = await getSupabase()
    .from("app_settings").select("logo_url").eq("id", 1).single();

  const dataUrl = (data?.logo_url as string | null) ?? null;
  if (error || !dataUrl) return new NextResponse("لا يوجد شعارٌ مخصّص", { status: 404 });

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
