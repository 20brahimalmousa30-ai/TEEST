"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login } from "@/lib/auth/session-actions.demo";
import { announceSessionChange } from "@/lib/auth/session";

const ROLES = [
  { role: "PRINCE", label: "الأمير", desc: "لوحة القيادة الكاملة وإدارة المنصّة" },
  { role: "SUPERVISOR", label: "مشرف", desc: "متابعة فريقه ولجانه وطلّابه" },
  { role: "BENEFICIARY", label: "طالب", desc: "صفحته الشخصيّة ومهامّه وحضوره" },
] as const;

export function LoginPanel() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function pick(role: string) {
    setError(null);
    setBusy(role);
    try {
      const result = await login(role);
      if (!result.ok) {
        setError("تعذّر الدخول بهذا الدور.");
        setBusy(null);
        return;
      }
      announceSessionChange();
      router.push(result.session.landing);
    } catch {
      setError("تعذّر الاتصال بالخادم. حاول مرّة أخرى.");
      setBusy(null);
    }
  }

  return (
    <>
      <h2 className="text-[24px] font-semibold text-text">أهلاً بك في «معالي»</h2>
      <p className="mt-1 text-[14px] text-text-2">
        نسخة عرض تجريبيّة — اختر الدور الذي تريد تجربته للدخول مباشرةً.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {ROLES.map(r => (
          <button
            key={r.role}
            type="button"
            onClick={() => pick(r.role)}
            disabled={busy !== null}
            className="group flex items-center justify-between gap-3 rounded border border-line bg-surface px-5 py-4 text-start transition-colors hover:border-accent hover:bg-accent/5 disabled:opacity-60"
          >
            <span>
              <span className="block text-[16px] font-semibold text-text">{r.label}</span>
              <span className="mt-0.5 block text-[12.5px] text-text-3">{r.desc}</span>
            </span>
            {busy === r.role ? (
              <span className="text-[13px] text-text-3">جارٍ الدخول…</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-text-3 group-hover:text-accent">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded border border-critical/40 bg-critical/5 px-3 py-2 text-[12.5px] text-critical">
          {error}
        </div>
      )}

      <p className="mt-8 border-t border-line pt-5 text-center text-[13px] text-text-3">
        <Link href="/" className="hover:text-text">العودة للصفحة الرئيسيّة →</Link>
      </p>
    </>
  );
}
