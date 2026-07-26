"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth/session";
import { changeCode } from "@/lib/auth/session-actions";
import { roleLabel } from "@/lib/auth/accounts";

export default function AccountSettingsPage() {
  useEffect(() => { document.title = "إعدادات الحساب — معالي أبها"; }, []);
  const { session } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!current.trim() || !next.trim()) { setMsg({ kind: "err", text: "أدخل الرمز الحالي والجديد." }); return; }
    if (next !== confirm) { setMsg({ kind: "err", text: "الرمز الجديد وتأكيده غير متطابقين." }); return; }
    if (next === current) { setMsg({ kind: "err", text: "الرمز الجديد مطابق للحالي." }); return; }
    setBusy(true);
    const res = await changeCode(current, next);
    setBusy(false);
    if (res.ok) {
      setMsg({ kind: "ok", text: "تمّ تغيير رمز الدخول بنجاح." });
      setCurrent(""); setNext(""); setConfirm("");
    } else {
      setMsg({ kind: "err", text: res.error ?? "تعذّر تغيير الرمز." });
    }
  }

  return (
    <div className="mx-auto max-w-[720px] px-6 py-8">
      <PageHeader
        eyebrow="إعدادات الحساب"
        title="إعدادات الحساب"
        subtitle="بياناتُ حسابك وتغييرُ رمز الدخول الخاصّ بك."
      />

      <div className="grid gap-6">
        <Card title="بيانات الحساب">
          <dl className="grid gap-3 text-[13.5px]">
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <dt className="text-text-3">الاسم</dt><dd className="text-text">{session?.name ?? "—"}</dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <dt className="text-text-3">الجوّال (اسم المستخدم)</dt><dd className="num text-text">{session?.phone ?? "—"}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-text-3">الدور</dt>
              <dd className="text-text">
                {session ? (roleLabel[session.role as keyof typeof roleLabel] ?? session.role) : "—"}
                {session?.isOwner && <span className="ms-1 text-accent-warm-2">· الأصل</span>}
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="تغيير رمز الدخول">
          <form onSubmit={onSubmit} className="grid gap-4">
            <Field label="الرمز الحالي" type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="الرمز الجديد" type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" required />
              <Field label="تأكيد الرمز الجديد" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
            </div>
            {msg && (
              <p className={`text-[13px] ${msg.kind === "ok" ? "text-ok" : "text-critical"}`}>{msg.text}</p>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-text-3">يُتحقَّق من الرمز الحالي في الخادم قبل التغيير.</p>
              <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ الرمز الجديد"}</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
