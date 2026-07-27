import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import type { DbSession } from "@/lib/db/types";

/**
 * نواةُ الجلسة (خادم فقط، ليست "use server"):
 * قراءةُ/ختمُ كوكي الجلسة الموقّع، ومُحدِّدُ مُحاولات الدخول.
 * تُستعمل من session-actions.ts (الإجراءات المكشوفة) ومن data.ts (حُرّاس الصلاحية)
 * دون أن تُصبح هي نفسها نقطةَ RPC عامّة.
 */

export const COOKIE = "maali_session";
export const MAX_AGE = 60 * 60 * 24 * 30; // 30 يوماً

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET غير مُهيّأ في .env.local");
  return s;
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

export function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** يُنتج رمزاً موقّعاً: base64url(json).توقيع */
export function seal(session: DbSession): string {
  const body = b64url(JSON.stringify(session));
  return `${body}.${sign(body)}`;
}

/** يفكّ الرمز ويتحقّق من التوقيع (مقارنة ثابتة الزمن)؛ يُعيد الجلسة أو null. */
export function unseal(token: string): DbSession | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
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

/** يقرأ الجلسة الحاليّة من الكوكي الموقّع (أو null). */
export async function getSession(): Promise<DbSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return unseal(token);
}

/* ───────────────────── مُحدِّدُ مُحاولات الدخول (Rate limit) ─────────────────────
 * ذاكرةٌ داخل العمليّة: تحمي من التخمين العنيف على رمز الدخول. في بيئةٍ عديمة الحالة
 * (serverless) تنفصل الذاكرة لكلّ نسخة، فهي طبقةٌ رادعة لا بديلاً عن حدٍّ مركزيّ،
 * لكنّها ترفع كلفة الهجوم كثيراً مقارنةً بغيابها التامّ. */
const WINDOW_MS = 15 * 60 * 1000; // نافذة 15 دقيقة
const MAX_ATTEMPTS = 8;            // 8 محاولاتٍ فاشلة ضمن النافذة
type Attempt = { count: number; first: number };
const attempts = new Map<string, Attempt>();

/** يتحقّق قبل محاولة الدخول: هل الجوّال محظورٌ مؤقّتاً؟ */
export function loginBlocked(phone: string): { blocked: boolean; retryAfterSec?: number } {
  const key = phone.trim();
  const rec = attempts.get(key);
  if (!rec) return { blocked: false };
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(key);
    return { blocked: false };
  }
  if (rec.count >= MAX_ATTEMPTS) {
    return { blocked: true, retryAfterSec: Math.ceil((WINDOW_MS - (Date.now() - rec.first)) / 1000) };
  }
  return { blocked: false };
}

/** يُسجّل محاولةً فاشلة. */
export function recordFailedLogin(phone: string): void {
  const key = phone.trim();
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
  } else {
    rec.count += 1;
  }
}

/** يُصفّر العدّاد بعد دخولٍ ناجح. */
export function clearLoginAttempts(phone: string): void {
  attempts.delete(phone.trim());
}
