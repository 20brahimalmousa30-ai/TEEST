"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { demoAccounts, findAccountByEmail, roleLabel, type DemoAccount } from "@/lib/auth/accounts";
import { saveSession, announceSessionChange } from "@/lib/auth/session";

export function LoginPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@maali.abha");
  const [password, setPassword] = useState("1448");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function loginAs(account: DemoAccount) {
    saveSession(account);
    announceSessionChange();
    router.push(account.landing);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const account = findAccountByEmail(email);
    if (!account) {
      setError("لا يوجد حسابٌ بهذا البريد. جرّب أحد الحسابات التجريبيّة أدناه.");
      setBusy(false); return;
    }
    if (account.password !== password) {
      setError("كلمة المرور غير صحيحة. كلمة المرور لجميع الحسابات التجريبيّة: 1448");
      setBusy(false); return;
    }
    loginAs(account);
  }

  return (
    <>
      <h2 className="text-[24px] font-semibold text-text">أهلاً بك في «معالي»</h2>
      <p className="mt-1 text-[14px] text-text-2">
        اختر حساباً تجريبياً لترى كيف يتغيّر النظام حسب دورك.
      </p>

      {/* Quick-pick role cards */}
      <div className="mt-6 grid gap-2.5">
        {demoAccounts.map(a => (
          <button
            key={a.email}
            type="button"
            onClick={() => loginAs(a)}
            className="group relative flex items-start gap-3 overflow-hidden rounded-md border border-line bg-surface p-3.5 text-start transition-colors hover:border-accent-warm hover:bg-bg-raised"
          >
            <span
              aria-hidden
              className="mt-0.5 h-9 w-9 shrink-0 rounded-full text-center text-[13px] font-semibold leading-9 text-[#F4EEE2]"
              style={{ background: a.color }}
            >
              {roleLabel[a.role][0]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[13.5px] font-semibold text-text">{a.name}</span>
                {a.isOwner && (
                  <span className="rounded-full bg-accent-warm/15 px-2 py-[1px] text-[10px] text-accent-warm-2">
                    Owner
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="lat text-[11px] italic text-accent">{a.email}</span>
                <span className="text-[10px] text-text-3">·</span>
                <span className="num text-[10.5px] text-text-3">{a.password}</span>
              </div>
              <p className="mt-1.5 text-[12px] leading-[1.7] text-text-2">{a.description}</p>
            </div>
            <span className="mt-2 text-[16px] text-text-3 transition-transform group-hover:-translate-x-1 group-hover:text-accent">
              ←
            </span>
          </button>
        ))}
      </div>

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-line" />
        <span className="text-[11px] tracking-[.12em] text-text-3">أو أدخل يدوياً</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label="البريد المؤسّسي"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="owner@maali.abha"
          required
        />
        <Field
          label="كلمة المرور"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          hint="كلمة المرور لجميع الحسابات التجريبيّة: 1448"
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
