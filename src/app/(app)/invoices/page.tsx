"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { useStore } from "@/lib/store/StoreProvider";
import { downloadCSV } from "@/lib/download";
import type { Invoice } from "@/lib/mock/types";
import { sar } from "@/lib/format";

export default function InvoicesPage() {
  useEffect(() => { document.title = "الفواتير — معالي محافظة بلّسمر"; }, []);
  const { invoices, teams, committees, addInvoice } = useStore();
  const [statusFilter, setStatusFilter] = useState<"ALL" | Invoice["status"]>("ALL");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vendor: "", purpose: "", amount: "", vat: "15", date: new Date().toISOString().slice(0, 10),
    scopeKind: "event" as "event" | "team" | "committee",
    scopeId: teams[0]?.id ?? "",
  });

  const filtered = useMemo(() => invoices.filter(i => {
    if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
    if (q.trim()) {
      const n = q.trim();
      if (!i.vendor.includes(n) && !i.purpose.includes(n) && !i.code.includes(n)) return false;
    }
    return true;
  }), [invoices, statusFilter, q]);

  const summary = useMemo(() => ({
    total: invoices.reduce((s, i) => s + i.amount, 0),
    paid: invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0),
    pending: invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.amount, 0),
    overdue: invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0),
    aiExtracted: invoices.filter(i => i.extractedByAI).length,
  }), [invoices]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.vendor.trim() || !amount || !form.purpose.trim()) return;
    const scope = form.scopeKind === "event" ? { kind: "event" as const }
      : form.scopeKind === "team" ? { kind: "team" as const, teamId: form.scopeId }
      : { kind: "committee" as const, committeeId: form.scopeId };
    addInvoice({
      vendor: form.vendor.trim(),
      purpose: form.purpose.trim(),
      amount, vat: Number(form.vat) || 15,
      date: form.date,
      status: "pending",
      extractedByAI: false,
      scope,
    });
    setForm({ vendor: "", purpose: "", amount: "", vat: "15", date: new Date().toISOString().slice(0, 10), scopeKind: "event", scopeId: teams[0]?.id ?? "" });
    setOpen(false);
  }

  function exportAll() {
    const rows: (string | number)[][] = [
      ["الرقم", "المورّد", "الغرض", "التاريخ", "المبلغ", "الحالة"],
      ...filtered.map(i => [i.code, i.vendor, i.purpose, i.date, i.amount,
        i.status === "paid" ? "مدفوعة" : i.status === "pending" ? "معلّقة" : "متأخّرة"]),
    ];
    downloadCSV(`فواتير_${filtered.length}`, rows);
  }

  function scopeLabel(s: Invoice["scope"]) {
    if (s.kind === "event") return "الفعاليّة كاملةً";
    if (s.kind === "team") return `فريق ${teams.find(t => t.id === s.teamId)?.name ?? "—"}`;
    return committees.find(c => c.id === s.committeeId)?.name ?? "—";
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="الفواتير"
        title="الفواتير"
        subtitle={`${invoices.length} فاتورة، منها ${summary.aiExtracted} استُخرجت بياناتها آلياً. رفعُ فاتورةٍ جديدةٍ يعمل فوراً.`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportAll}>⬇ CSV</Button>
            <Button variant="primary" onClick={() => setOpen(true)}>↑ ارفع فاتورة</Button>
          </div>
        }
      />

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="الإجمالي" value={sar(summary.total)} sub="SAR شامل ضريبة القيمة المضافة" />
        <KpiCard label="مدفوعة" value={sar(summary.paid)} sub={`${invoices.filter(i => i.status === "paid").length} فاتورة`} variant="ok" />
        <KpiCard label="معلّقة" value={sar(summary.pending)} sub={`${invoices.filter(i => i.status === "pending").length} بانتظار المراجعة`} variant="warn" />
        <KpiCard label="متأخّرة" value={sar(summary.overdue)} sub={`${invoices.filter(i => i.status === "overdue").length} تستدعي إجراءً`} variant="critical" />
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالرقم أو المورّد..." className="min-w-[220px] flex-1 rounded border border-line-strong bg-surface px-4 py-2 text-[14px]" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as "ALL" | Invoice["status"])} className="rounded border border-line-strong bg-surface px-3 py-2 text-[13px] text-text-2">
          <option value="ALL">كلّ الحالات</option>
          <option value="paid">مدفوعة</option>
          <option value="pending">معلّقة</option>
          <option value="overdue">متأخّرة</option>
        </select>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead className="text-[11px] uppercase tracking-[.14em] text-text-3">
            <tr className="border-b border-line">
              <th className="px-5 py-3 text-start font-normal">الرقم / المورّد</th>
              <th className="px-5 py-3 text-start font-normal">الغرض</th>
              <th className="px-5 py-3 text-start font-normal">المصروف على</th>
              <th className="px-5 py-3 text-start font-normal">التاريخ</th>
              <th className="px-5 py-3 text-end font-normal">المبلغ</th>
              <th className="px-5 py-3 text-end font-normal">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-text-3">لا فواتير مطابقة.</td></tr>
            )}
            {filtered.map(inv => (
              <tr key={inv.id} className="border-b border-line hover:bg-bg-raised">
                <td className="px-5 py-3">
                  <Link href={`/invoices/${inv.id}`} className="text-text hover:text-accent">{inv.vendor}</Link>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="num text-[11px] text-text-3">{inv.code}</span>
                    {inv.extractedByAI && <Pill variant="info">↺ AI</Pill>}
                  </div>
                </td>
                <td className="px-5 py-3 text-text-2">{inv.purpose}</td>
                <td className="px-5 py-3 text-text-2">{scopeLabel(inv.scope)}</td>
                <td className="num px-5 py-3 text-text-2">{inv.date}</td>
                <td className="num px-5 py-3 text-end text-text">{sar(inv.amount)}</td>
                <td className="px-5 py-3 text-end">
                  <Pill variant={inv.status === "paid" ? "ok" : inv.status === "pending" ? "warn" : "critical"}>
                    {inv.status === "paid" ? "مدفوعة" : inv.status === "pending" ? "معلّقة" : "متأخّرة"}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="رفعُ فاتورةٍ جديدة"
        subtitle="في النسخة الفعلية سيتولّى الذكاء الاصطناعي قراءة الملف. أدخل البيانات يدوياً في هذه النسخة التجريبية."
        size="lg"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" form="add-invoice">إضافة الفاتورة</Button>
          </>
        }
      >
        <form id="add-invoice" onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="المورّد" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} required />
            <Field label="التاريخ" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <Field label="الغرض" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="المبلغ (شامل الضريبة)" type="number" min={0} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            <Field label="ضريبة القيمة المضافة %" type="number" min={0} max={100} value={form.vat} onChange={e => setForm({ ...form, vat: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">المصروف على</span>
              <select value={form.scopeKind} onChange={e => setForm({ ...form, scopeKind: e.target.value as "event" | "team" | "committee" })} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                <option value="event">الفعاليّة كاملة</option>
                <option value="team">فريق</option>
                <option value="committee">لجنة</option>
              </select>
            </label>
            {form.scopeKind !== "event" && (
              <label className="block">
                <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">{form.scopeKind === "team" ? "الفريق" : "اللجنة"}</span>
                <select value={form.scopeId} onChange={e => setForm({ ...form, scopeId: e.target.value })} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                  {form.scopeKind === "team"
                    ? teams.map(t => <option key={t.id} value={t.id}>فريق {t.name}</option>)
                    : committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
