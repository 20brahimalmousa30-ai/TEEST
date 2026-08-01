"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Confirm } from "@/components/ui/Modal";
import { useSession, clearSession, announceSessionChange } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/accounts";
import { listAdmins, addAdmin, transferOwnership, deleteAdmin } from "@/lib/auth/session-actions.demo";
import type { AdminRow } from "@/lib/db/data.demo";

export default function AdminsPage() {
  useEffect(() => { document.title = "إدارة الأمراء — معالي محافظة بلّسمر"; }, []);
  const router = useRouter();
  const { session, ready } = useSession();
  const isOwner = !!session?.isOwner;

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [transferTarget, setTransferTarget] = useState<AdminRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);

  const refresh = useCallback(async () => { setAdmins(await listAdmins()); }, []);

  // للمالك الأصل فقط.
  useEffect(() => {
    if (!ready) return;
    if (!isOwner) { router.replace("/settings/account"); return; }
    refresh();
  }, [ready, isOwner, router, refresh]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const res = await addAdmin(name, phone, code);
    setBusy(false);
    if (res.ok) {
      setMsg({ kind: "ok", text: "تمّ إنشاء حساب نائب الأمير." });
      setName(""); setPhone(""); setCode("");
      refresh();
    } else {
      setMsg({ kind: "err", text: res.error ?? "تعذّر إنشاء الحساب." });
    }
  }

  async function onTransfer() {
    if (!transferTarget) return;
    const res = await transferOwnership(transferTarget.id);
    setTransferTarget(null);
    if (res.ok) {
      // لم نعُد المالك — تُمحى الجلسة على الخادم؛ نُخرج المستخدم ليعيد الدخول.
      await clearSession();
      announceSessionChange();
      router.push("/login");
    } else {
      setMsg({ kind: "err", text: res.error ?? "تعذّر نقل الملكيّة." });
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    const res = await deleteAdmin(deleteTarget.id);
    setDeleteTarget(null);
    if (res.ok) { setMsg({ kind: "ok", text: "تمّ حذف الحساب." }); refresh(); }
    else { setMsg({ kind: "err", text: res.error ?? "تعذّر الحذف." }); }
  }

  if (!ready || !isOwner) return null;

  return (
    <div className="mx-auto max-w-[820px] px-6 py-8">
      <PageHeader
        eyebrow="إدارة الأمراء"
        title="الحسابات الإداريّة والملكيّة"
        subtitle="أنت المالك الأصل — وحدك من يُنشئ نوّاب الأمير، وينقل الملكيّة، ويحذف حساباً إدارياً."
      />

      {msg && (
        <p className={`mb-4 text-[13px] ${msg.kind === "ok" ? "text-ok" : "text-critical"}`}>{msg.text}</p>
      )}

      <div className="grid gap-6">
        <Card title="الحسابات الإداريّة">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-text-3">
                  <th className="py-2 text-start font-normal">الاسم</th>
                  <th className="py-2 text-start font-normal">الجوّال</th>
                  <th className="py-2 text-start font-normal">الدور</th>
                  <th className="py-2 text-start font-normal">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(a => {
                  const self = a.phone === session?.phone;
                  return (
                    <tr key={a.id} className="border-b border-line/60">
                      <td className="py-2.5 text-text">{a.name}{self && <span className="ms-1 text-[11px] text-text-3">(أنت)</span>}</td>
                      <td className="num py-2.5 text-text-2">{a.phone}</td>
                      <td className="py-2.5">
                        {a.isOwner
                          ? <Pill variant="warn">مالكٌ أصل</Pill>
                          : <span className="text-text-2">{roleLabel[a.role as keyof typeof roleLabel] ?? a.role}</span>}
                      </td>
                      <td className="py-2.5">
                        {a.isOwner ? (
                          <span className="text-[12px] text-text-3">—</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <Button variant="ghost" onClick={() => setTransferTarget(a)}>نقل الملكيّة</Button>
                            <Button variant="ghost" className="text-critical" onClick={() => setDeleteTarget(a)}>حذف</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {admins.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-text-3">لا حسابات.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="إضافة نائب أمير">
          <form onSubmit={onAdd} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="الاسم" value={name} onChange={e => setName(e.target.value)} required />
              <Field label="الجوّال" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" required />
              <Field label="رمز الدخول" type="password" value={code} onChange={e => setCode(e.target.value)} autoComplete="new-password" required />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-text-3">يُنشَأ الحساب بدور «نائب الأمير» ورمزٍ مُشفَّرٍ في الخادم.</p>
              <Button type="submit" disabled={busy}>{busy ? "جارٍ الإنشاء…" : "إنشاء الحساب"}</Button>
            </div>
          </form>
        </Card>
      </div>

      <Confirm
        open={!!transferTarget}
        onClose={() => setTransferTarget(null)}
        onConfirm={onTransfer}
        title="نقل الملكيّة؟"
        message={`ستُنقل ملكيّة المنصّة إلى «${transferTarget?.name ?? ""}» ويصبح هو الأمير الأصل. ستفقد أنت صلاحيّات المالك وتُسجَّل خروجاً لإعادة الدخول.`}
        confirmLabel="نعم، انقل الملكيّة"
        danger
      />
      <Confirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        title="حذف الحساب الإداريّ؟"
        message={`سيُحذف حساب «${deleteTarget?.name ?? ""}» نهائياً ولن يستطيع الدخول بعدها.`}
        confirmLabel="نعم، احذف"
        danger
      />
    </div>
  );
}
