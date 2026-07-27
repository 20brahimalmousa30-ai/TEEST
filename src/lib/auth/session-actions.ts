"use server";
import { cookies } from "next/headers";
import {
  dbVerifyLogin, dbSetLoginCode,
  dbListAdmins, dbCreateAdmin, dbTransferOwnership, dbDeleteAdmin,
  type AdminRow,
} from "@/lib/db/data";
import type { LoginResult } from "@/lib/db/types";
import {
  COOKIE, MAX_AGE, seal, getSession,
  loginBlocked, recordFailedLogin, clearLoginAttempts,
} from "./session-core";

export { getSession };

/** تسجيل الدخول: يتحقّق من الجوّال والرمز (مع حدٍّ للمحاولات) ثم يزرع كوكي جلسةٍ موقّعاً. */
export async function login(phone: string, code: string): Promise<LoginResult> {
  // حدُّ المحاولات: يمنع التخمين العنيف على رمز الدخول.
  const gate = loginBlocked(phone);
  if (gate.blocked) return { ok: false };
  const result = await dbVerifyLogin(phone, code);
  if (!result.ok) {
    recordFailedLogin(phone);
    return result;
  }
  clearLoginAttempts(phone);
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
