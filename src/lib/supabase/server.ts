import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * عميل Supabase للخادم فقط، باستخدام مفتاح service_role.
 * يمرّ كلُّ الوصول للبيانات عبر Server Actions، لذا لا يصل هذا المفتاح
 * إلى المتصفّح أبداً. لا تستورد هذا الملف في أيّ مكوّن "use client".
 */
let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase غير مُهيّأ: أضِف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في .env.local",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** هل أُعِدّت مفاتيح Supabase؟ (للسماح بعملٍ محلّي قبل الربط) */
export const isSupabaseConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
