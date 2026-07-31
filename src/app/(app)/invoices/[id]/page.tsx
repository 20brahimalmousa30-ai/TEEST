"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store/StoreProvider";
import { useSession } from "@/lib/auth/session";
import { printPage } from "@/lib/download";
import { sar } from "@/lib/format";
import type { Invoice } from "@/lib/mock/types";
import { CONDITION_LABELS } from "@/lib/ai/conditions";

function statusPill(status: Invoice["status"]) {
  if (status === "approved") return { variant: "ok" as const, label: "معتمدة" };
  if (status === "paid") return { variant: "ok" as const, label: "مدفوعة" };
  if (status === "pending") return { variant: "warn" as const, label: "بانتظار الأمير" };
  return { variant: "critical" as const, label: "متأخّرة" };
}

export default function InvoiceDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { invoices, teams, committees, supervisors, approveInvoice, rejectInvoice, deleteInvoice } = useStore();
  const { session } = useSession();
  const canApprove = session?.role === "PRINCE" || session?.role === "DEPUTY_PRINCE";
  const inv = invoices.find(i => i.id === params.id);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { document.title = inv ? `${inv.code} — فاتورة` : "الفواتير"; }, [inv]);

  if (!inv) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-text-2">لم أعثر على هذه الفاتورة. قد تكون نُقلت إلى سلة المحذوفات.</p>
        <Link href="/invoices" className="mt-4 inline-block text-accent hover:underline">عودة للفواتير →</Link>
      </div>
    );
  }

  const vat = (inv.amount * inv.vat) / (100 + inv.vat);
  const net = inv.amount - vat;
  const scope = inv.scope;
  const scopeLabel = scope.kind === "event" ? "الفعاليّة كاملةً"
    : scope.kind === "team" ? `أسرة ${teams.find(t => t.id === scope.teamId)?.name ?? "—"}`
    : committees.find(c => c.id === scope.committeeId)?.name ?? "—";
  const uploader = inv.uploadedBy ? supervisors.find(s => s.id === inv.uploadedBy)?.name : null;
  const sp = statusPill(inv.status);

  // موازنة الجهة المصروف عليها + المتبقّي (عرضٌ إرشاديّ أثناء الاعتماد — لا يمنع).
  const budgetInfo = (() => {
    if (scope.kind === "team") {
      const t = teams.find(x => x.id === scope.teamId);
      if (!t) return null;
      const spent = invoices.filter(i => (i.status === "approved" || i.status === "paid") && i.scope.kind === "team" && i.scope.teamId === t.id && i.id !== inv.id).reduce((s, i) => s + i.amount, 0);
      return { label: `أسرة ${t.name}`, budget: t.budget ?? 0, spent };
    }
    if (scope.kind === "committee") {
      const c = committees.find(x => x.id === scope.committeeId);
      if (!c) return null;
      const spent = invoices.filter(i => (i.status === "approved" || i.status === "paid") && i.scope.kind === "committee" && i.scope.committeeId === c.id && i.id !== inv.id).reduce((s, i) => s + i.amount, 0);
      return { label: c.name, budget: c.budget ?? 0, spent };
    }
    return null;
  })();

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="تفاصيل الفاتورة"
        crumbs={[{ href: "/invoices", label: "الفواتير" }, { label: inv.code }]}
        title={inv.vendor}
        subtitle={inv.purpose}
        action={<Pill variant={sp.variant}>{sp.label}</Pill>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card padded={false}>
          <div className="border-b border-line bg-bg-raised px-6 py-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[11px] tracking-[.14em] text-text-3">رقم الفاتورة</div>
                <div className="num mt-1 text-[16px] text-text">{inv.invoiceNumber || inv.code}</div>
              </div>
              <div className="text-end">
                <div className="text-[11px] tracking-[.14em] text-text-3">التاريخ</div>
                <div className="num mt-1 text-[13.5px] text-text-2">{inv.date || "—"}</div>
              </div>
            </div>
          </div>
          <dl className="divide-y divide-line">
            {[
              ["المورّد", inv.vendor],
              ["الرقم الضريبي للمورّد", inv.vendorTaxNumber || "—"],
              ["الغرض", inv.purpose],
              ["المصروف على", scopeLabel],
              ...(uploader ? [["رفعها", uploader]] as [string, string][] : []),
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[150px_1fr] gap-4 px-6 py-3 text-[13.5px]">
                <dt className="text-text-3">{k}</dt><dd className="text-text">{v}</dd>
              </div>
            ))}
          </dl>

          {/* البنود المُستخرَجة */}
          {inv.lineItems && inv.lineItems.length > 0 && (
            <div className="border-t border-line px-6 py-4">
              <div className="mb-2 text-[11px] tracking-[.14em] text-text-3">البنود</div>
              <table className="w-full text-[13px]">
                <thead className="text-[11px] text-text-3">
                  <tr><th className="text-start font-normal">الوصف</th><th className="text-end font-normal">كميّة</th><th className="text-end font-normal">سعر</th><th className="text-end font-normal">إجمالي</th></tr>
                </thead>
                <tbody>
                  {inv.lineItems.map((it, i) => (
                    <tr key={i} className="border-t border-line/60">
                      <td className="py-1.5 text-text-2">{it.description || "—"}</td>
                      <td className="num py-1.5 text-end text-text-2">{it.quantity}</td>
                      <td className="num py-1.5 text-end text-text-2">{sar(it.unitPrice)}</td>
                      <td className="num py-1.5 text-end text-text">{sar(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-line bg-bg-raised/50 px-6 py-5">
            <div className="ms-auto max-w-[340px]">
              <div className="flex justify-between py-1.5 text-[13.5px] text-text-2"><span>الصافي</span><span className="num text-text">{sar(Math.round(net))}</span></div>
              <div className="flex justify-between py-1.5 text-[13.5px] text-text-2"><span>ضريبة القيمة المضافة ({inv.vat}٪)</span><span className="num text-text">{sar(Math.round(vat))}</span></div>
              <div className="mt-2 flex justify-between border-t border-line-strong pt-3 text-[15px] font-semibold text-text">
                <span>الإجمالي</span>
                <span className="num text-accent">{sar(inv.amount)} SAR</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {/* الفاتورة الأصليّة */}
          {inv.hasImage && !imgError && (
            <Card title="الفاتورة الأصليّة">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/invoices/${inv.id}/image`} alt="صورة الفاتورة"
                onError={() => setImgError(true)}
                className="w-full rounded border border-line" />
            </Card>
          )}

          {/* الشروط السبعة */}
          <Card title="الشروط السبعة (تقييمٌ آليّ)">
            {inv.conditions ? (
              <ul className="grid gap-2 text-[13.5px]">
                {(Object.keys(CONDITION_LABELS) as (keyof typeof CONDITION_LABELS)[]).map(k => {
                  const pass = inv.conditions![k];
                  return (
                    <li key={k} className="flex items-center gap-2 border-b border-line pb-2 last:border-0">
                      <span className={pass ? "text-ok" : "text-critical"}>{pass ? "✓" : "✗"}</span>
                      <span className="text-text-2">{CONDITION_LABELS[k]}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13.5px] text-text-2">أُدخِلت بياناتها يدويّاً دون تحليلٍ آليّ.</p>
            )}
          </Card>

          {/* الموازنة المتبقّية للجهة (عرضٌ إرشاديّ) */}
          {budgetInfo && budgetInfo.budget > 0 && (
            <Card title="موازنة الجهة">
              <div className="grid gap-1.5 text-[13px]">
                <div className="flex justify-between"><span className="text-text-3">{budgetInfo.label}</span></div>
                <div className="flex justify-between"><span className="text-text-2">المُخصَّص</span><span className="num text-text">{sar(budgetInfo.budget)}</span></div>
                <div className="flex justify-between"><span className="text-text-2">المصروف المعتمد</span><span className="num text-text">{sar(budgetInfo.spent)}</span></div>
                <div className="flex justify-between border-t border-line pt-1.5">
                  <span className="text-text-2">المتبقّي {inv.status !== "approved" && inv.status !== "paid" ? "قبل هذه الفاتورة" : ""}</span>
                  <span className={`num ${budgetInfo.budget - budgetInfo.spent < inv.amount ? "text-critical" : "text-ok"}`}>{sar(budgetInfo.budget - budgetInfo.spent)}</span>
                </div>
                {(inv.status === "pending") && budgetInfo.budget - budgetInfo.spent < inv.amount && (
                  <p className="mt-1 text-[11.5px] text-critical">⚠ هذه الفاتورة ({sar(inv.amount)}) تتجاوز المتبقّي من الموازنة.</p>
                )}
              </div>
            </Card>
          )}

          <Card title="الإجراءات">
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={printPage}>⎙ طباعة / تصدير PDF</Button>
              {/* اعتماد/رفض الأمير للفواتير المُصعَّدة */}
              {canApprove && inv.status === "pending" && (
                <>
                  <Button variant="primary" onClick={() => approveInvoice(inv.id)}>✓ اعتماد الفاتورة</Button>
                  <Button variant="danger" onClick={() => { rejectInvoice(inv.id); router.push("/invoices"); }}>✕ رفض (نقلٌ للمحذوفات)</Button>
                </>
              )}
              <Button variant="danger" onClick={() => { deleteInvoice(inv.id); router.push("/invoices"); }}>
                🗑 نقلٌ إلى سلة المحذوفات
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
