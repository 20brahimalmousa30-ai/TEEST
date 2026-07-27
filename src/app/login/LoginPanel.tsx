"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { login } from "@/lib/auth/session-actions";
import { announceSessionChange } from "@/lib/auth/session";

export function LoginPanel() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await login(phone, code);
      if (!result.ok) {
        setError("رقم الجوّال أو رمز الدخول غير صحيح.");
        setBusy(false);
        return;
      }
      announceSessionChange();
      router.push(result.session.landing);
    } catch {
      setError("تعذّر الاتصال بالخادم. تحقّق من الإعدادات وحاول مرّة أخرى.");
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="text-[24px] font-semibold text-text">أهلاً بك في «معالي»</h2>
      <p className="mt-1 text-[14px] text-text-2">
        أدخل رقم جوّالك ورمز الدخول للوصول إلى لوحتك.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <Field
          label="رقم الجوّال"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="05XX XXX XXX"
          required
        />
        <Field
          label="رمز الدخول"
          type="password"
          inputMode="numeric"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="••••••"
          required
        />

        {error && (
          <div className="rounded border border-critical/40 bg-critical/5 px-3 py-2 text-[12.5px] text-critical">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded bg-accent px-6 py-3 text-[15px] font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60"
          style={{ color: "#F4EEE2" }}
        >
          {busy ? "جارٍ الدخول..." : "الدخول"}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: "var(--accent-warm)" }}>
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
          </svg>
        </button>
      </form>

      <p className="mt-8 border-t border-line pt-5 text-center text-[13px] text-text-3">
        <Link href="/" className="hover:text-text">العودة للصفحة الرئيسيّة →</Link>
      </p>
    </>
  );
}
