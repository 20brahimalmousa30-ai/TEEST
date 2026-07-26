"use server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import {
  dbVerifyLogin, dbSetLoginCode,
  dbListAdmins, dbCreateAdmin, dbTransferOwnership, dbDeleteAdmin,
  type AdminRow,
} from "@/lib/db/data";
import type { DbSession, LoginResult } from "@/lib/db/types";

const COOKIE = "maali_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 يوماً

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET غير مُهيّأ في .env.local");
  return s;
}

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64url");

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** يُنتج رمزاً موقّعاً: base64url(json).توقيع */
function seal(session: DbSession): string {
  const body = b64url(JSON.stringify(session));
  return `${body}.${sign(body)}`;
}

/** يفكّ الرمز ويتحقّق من التوقيع؛ يُعيد الجلسة أو null. */
function unseal(token: string): DbSession | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  // مقارنة ثابتة الزمن
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as DbSession;
  } catch {
    return null;
  }
}

/** تسجيل الدخول: يتحقّق من الجوّال والرمز ثم يزرع كوكي جلسةٍ موقّعاً. */
export async function login(phone: string, code: string): Promise<LoginResult> {
  const result = await dbVerifyLogin(phone, code);
  if (!result.ok) return result;
  const jar = await cookies();
  jar.set(COOKIE, seal(result.session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return result;
}

/** تسجيل الخروج: يمحو كوكي الجلسة. */
export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** تغيير رمز الدخول للحساب الحاليّ: يتطلّب الرمز الحالي، ويتحقّق منه في الخادم. */
export async function changeCode(current: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "انتهت الجلسة، سجّل الدخول مجدّداً." };
  if (next.trim().length < 4) return { ok: false, error: "الرمز الجديد يجب أن يكون ٤ خانات فأكثر." };
  const ok = await dbSetLoginCode(session.phone, current, next);
  return ok ? { ok: true } : { ok: false, error: "الرمز الحالي غير صحيح." };
}

/** يقرأ الجلسة الحاليّة من الكوكي الموقّع (أو null). */
export async function getSession(): Promise<DbSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return unseal(token);
}

/* ─────────────────────────── إدارة الأمراء (المالك فقط) ─────────────────────────── */

/** قائمة الحسابات الإداريّة — للمالك فقط (وإلاّ فارغة). */
export async function listAdmins(): Promise<AdminRow[]> {
  const session = await getSession();
  if (!session?.isOwner) return [];
  return dbListAdmins();
}

/** يُنشئ حساب نائب أمير — للمالك فقط. */
export async function addAdmin(name: string, phone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.isOwner) return { ok: false, error: "غير مصرّح — للمالك الأصل فقط." };
  if (!name.trim() || !phone.trim()) return { ok: false, error: "الاسم والجوّال مطلوبان." };
  if (code.trim().length < 4) return { ok: false, error: "الرمز يجب أن يكون ٤ خاناتٍ فأكثر." };
  return dbCreateAdmin(name, phone, code, "DEPUTY_PRINCE");
}

/** ينقل الملكيّة لحسابٍ آخر — للمالك فقط. يُنهي جلسة المالك السابق بعد النجاح. */
export async function transferOwnership(toId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.isOwner) return { ok: false, error: "غير مصرّح — للمالك الأصل فقط." };
  const ok = await dbTransferOwnership(session.phone, toId);
  if (!ok) return { ok: false, error: "تعذّر نقل الملكيّة." };
  // لم يعُد مالكاً — تُمحى جلسته ليعيد الدخول بصلاحياته الجديدة.
  (await cookies()).delete(COOKIE);
  return { ok: true };
}

/** يحذف حساباً إدارياً آخر — للمالك فقط، ولا يُحذف المالك ولا الحساب نفسه. */
export async function deleteAdmin(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.isOwner) return { ok: false, error: "غير مصرّح — للمالك الأصل فقط." };
  const ok = await dbDeleteAdmin(id);
  return ok ? { ok: true } : { ok: false, error: "تعذّر الحذف — لا يمكن حذف المالك." };
}
