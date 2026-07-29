import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session-core";
import { getSupabase } from "@/lib/supabase/server";

/**
 * مسارُ صورةٍ عند الطلب لطالبٍ واحد (الصورة الشخصيّة أو إيصال السداد).
 *
 * لماذا؟ صور base64 كانت تُنقَل داخل لقطة loadAllData في كلّ تحميلٍ للصفحة،
 * فتضخّمت الاستجابةُ إلى ميغابايتاتٍ تنمو خطّياً مع عدد المستفيدين. الآن تُستبعد
 * تلك الأعمدة من اللقطة الجماعية، وتُجلَب كلُّ صورةٍ عند عرضها فقط عبر هذا المسار،
 * فيحمّلها المتصفّح كسولاً ويخزّنها مؤقّتاً.
 *
 * الصلاحية: الطاقم يرى أيّ صورة؛ المستفيد يرى صورته الشخصيّة فقط (لا الإيصالات).
 */

const STAFF = new Set(["PRINCE", "DEPUTY_PRINCE", "SUPERVISOR"]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const kind = req.nextUrl.searchParams.get("kind") === "receipt" ? "receipt" : "photo";

  const session = await getSession();
  if (!session) return new NextResponse("غير مصرّح", { status: 401 });

  const isStaff = STAFF.has(session.role);
  const isOwner = session.role === "BENEFICIARY" && session.studentId === id;

  // الإيصالات للطاقم فقط؛ الصورة الشخصيّة للطاقم أو لصاحبها.
  if (kind === "receipt" && !isStaff) return new NextResponse("ممنوع", { status: 403 });
  if (kind === "photo" && !isStaff && !isOwner) return new NextResponse("ممنوع", { status: 403 });

  const column = kind === "receipt" ? "receipt_data_url" : "photo_data_url";
  const { data, error } = await getSupabase()
    .from("students")
    .select(column)
    .eq("id", id)
    .single();

  const dataUrl = (data as Record<string, string | null> | null)?.[column];
  if (error || !dataUrl) return new NextResponse("لا توجد صورة", { status: 404 });

  // القيمة مخزّنةٌ كـ data URL: data:<mime>;base64,<payload>
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) return new NextResponse("صيغةٌ غير صالحة", { status: 422 });
  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      // محتوىً خاصّ بالمستخدم؛ تخزينٌ قصيرٌ يقلّل الطلبات المتكرّرة دون تعطيل التحديثات.
      "Cache-Control": "private, max-age=300",
    },
  });
}
