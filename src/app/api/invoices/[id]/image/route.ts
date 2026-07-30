import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session-core";
import { getSupabase } from "@/lib/supabase/server";

/**
 * مسارُ صورةِ فاتورةٍ واحدة عند الطلب.
 *
 * لماذا؟ صورة base64 كانت ستنقل ميغابايتاتٍ داخل لقطة loadAllData في كلّ تحميل.
 * الآن تُستبعَد من اللقطة (has_image علمٌ خفيف)، وتُجلَب كلُّ صورةٍ عند عرضها فقط
 * عبر هذا المسار — يحمّلها المتصفّح كسولاً ويخزّنها مؤقّتاً.
 *
 * الصلاحية: الأمير/نائبه، أو مشرفٌ يملك صلاحيّة «invoices». (فواتيرُ الشراء
 * حسّاسةٌ ماليّاً — لا تُكشَف لمن لا يملك القسم.)
 */

const ADMIN = new Set(["PRINCE", "DEPUTY_PRINCE"]);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await getSession();
  if (!session) return new NextResponse("غير مصرّح", { status: 401 });

  // الإدارة تمرّ مباشرةً؛ المشرف يحتاج صلاحيّة «invoices».
  let allowed = ADMIN.has(session.role);
  if (!allowed && session.role === "SUPERVISOR" && session.supervisorId) {
    const { data } = await getSupabase()
      .from("supervisors").select("permissions").eq("id", session.supervisorId).single();
    allowed = ((data?.permissions ?? []) as string[]).includes("invoices");
  }
  if (!allowed) return new NextResponse("ممنوع", { status: 403 });

  const { data, error } = await getSupabase()
    .from("invoices").select("image_data_url").eq("id", id).single();

  const dataUrl = (data as { image_data_url?: string | null } | null)?.image_data_url;
  if (error || !dataUrl) return new NextResponse("لا توجد صورة", { status: 404 });

  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) return new NextResponse("صيغةٌ غير صالحة", { status: 422 });
  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=300",
    },
  });
}
