"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store/StoreProvider";
import { printPage } from "@/lib/download";

const sar = (n: number) => new Intl.NumberFormat("ar-SA-u-nu-latn").format(n);

export default function InvoiceDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { invoices, teams, committees, approveInvoice, deleteInvoice } = useStore();
  const inv = invoices.find(i => i.id === params.id);
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
    : scope.kind === "team" ? `فريق ${teams.find(t => t.id === scope.teamId)?.name}`
    : committees.find(c => c.id === scope.committeeId)?.name ?? "—";

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8">
      <PageHeader
        eyebrow="تفاصيل الفاتورة"
        crumbs={[{ href: "/invoices", label: "الفواتير" }, { label: inv.code }]}
        title={inv.vendor}
        subtitle={inv.purpose}
        action={
          <Pill variant={inv.status === "paid" ? "ok" : inv.status === "pending" ? "warn" : "critical"}>
            {inv.status === "paid" ? "مدفوعة" : inv.status === "pending" ? "معلّقة" : "متأخّرة"}
          </Pill>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card padded={false}>
          <div className="border-b border-line bg-bg-raised px-6 py-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[11px] tracking-[.14em] text-text-3">رقم الفاتورة</div>
                <div className="num mt-1 text-[16px] text-text">{inv.code}</div>
              </div>
              <div className="text-end">
                <div className="text-[11px] tracking-[.14em] text-text-3">التاريخ</div>
                <div className="num mt-1 text-[13.5px] text-text-2">{inv.date}</div>
              </div>
            </div>
          </div>
          <dl className="divide-y divide-line">
            {[["المورّد", inv.vendor], ["الغرض", inv.purpose], ["المصروف على", scopeLabel]].map(([k, v]) => (
              <div key={k as string} className="grid grid-cols-[130px_1fr] gap-4 px-6 py-3 text-[13.5px]">
                <dt className="text-text-3">{k}</dt><dd className="text-text">{v}</dd>
              </div>
            ))}
          </dl>
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
          <Card title="بيانات مستخرجة تلقائيّاً">
            {inv.extractedByAI ? (
              <div>
                <div className="mb-4 flex items-center gap-2 rounded border border-accent/30 bg-accent/5 px-3 py-2 text-[12.5px] text-accent">
                  <span>↺</span>استُخرجت البيانات من ملف الفاتورة بواسطة الذكاء الاصطناعي.
                </div>
                <ul className="grid gap-2 text-[13.5px] text-text-2">
                  <li className="flex items-center gap-2 border-b border-line pb-2"><span className="text-ok">✓</span> اسم المورّد</li>
                  <li className="flex items-center gap-2 border-b border-line pb-2"><span className="text-ok">✓</span> رقم الفاتورة والتاريخ</li>
                  <li className="flex items-center gap-2"><span className="text-ok">✓</span> المبلغ وضريبة القيمة المضافة</li>
                </ul>
              </div>
            ) : (
              <p className="text-[13.5px] text-text-2">أُدخلت بياناتها يدويّاً.</p>
            )}
          </Card>

          <Card title="الإجراءات">
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={printPage}>⎙ طباعة / تصدير PDF</Button>
              {inv.status !== "paid" && (
                <Button variant="primary" onClick={() => approveInvoice(inv!.id)}>✓ اعتماد السداد</Button>
              )}
              <Button variant="danger" onClick={() => { deleteInvoice(inv!.id); router.push("/invoices"); }}>
                🗑 نقلٌ إلى سلة المحذوفات
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
