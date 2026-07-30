"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea } from "@/components/ui/Field";
import { useStore } from "@/lib/store/StoreProvider";
import { useSession } from "@/lib/auth/session";
import { downloadCSV } from "@/lib/download";
import type { Invoice, OcrExtraction } from "@/lib/mock/types";
import { sar } from "@/lib/format";
import { fileToInvoiceImage, isSupportedInvoiceFile } from "@/lib/invoice-files";
import { evaluateConditions, passesPolicy, CONDITION_LABELS } from "@/lib/ai/conditions";

/** عرضُ حالة الفاتورة (لونٌ ونصّ). */
function statusPill(status: Invoice["status"]) {
  if (status === "approved") return { variant: "ok" as const, label: "معتمدة" };
  if (status === "paid") return { variant: "ok" as const, label: "مدفوعة" };
  if (status === "pending") return { variant: "warn" as const, label: "بانتظار الأمير" };
  return { variant: "critical" as const, label: "متأخّرة" };
}

const EMPTY_OCR: OcrExtraction = {
  vendorName: "", vendorTaxNumber: "", associationName: "", associationTaxNumber: "",
  invoiceNumber: "", issueDate: "", lineItems: [], vatAmount: 0, total: 0, isTaxInvoice: false,
};

type Stage = "pick" | "analyzing" | "review" | "error";

export default function InvoicesPage() {
  useEffect(() => { document.title = "الفواتير — معالي محافظة بلّسمر"; }, []);
  const { invoices, teams, committees, addInvoice, analyzeInvoice,
    associationName, associationTaxNumber, conditionsPolicy } = useStore();
  const { session } = useSession();
  const canApprove = session?.role === "PRINCE" || session?.role === "DEPUTY_PRINCE";

  const [statusFilter, setStatusFilter] = useState<"ALL" | Invoice["status"]>("ALL");
  const [q, setQ] = useState("");

  // ── حالة نافذة الرفع/التحليل/المراجعة ──
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("pick");
  const [err, setErr] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [ocr, setOcr] = useState<OcrExtraction>(EMPTY_OCR);
  const [purpose, setPurpose] = useState("");
  const [scopeKind, setScopeKind] = useState<"event" | "team" | "committee">("event");
  const [scopeId, setScopeId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function resetModal() {
    setStage("pick"); setErr(""); setImageDataUrl(""); setOcr(EMPTY_OCR);
    setPurpose(""); setScopeKind("event"); setScopeId(teams[0]?.id ?? "");
    if (fileRef.current) fileRef.current.value = "";
  }
  function openModal() { resetModal(); setOpen(true); }

  async function runAnalysis(dataUrl: string) {
    setStage("analyzing"); setErr("");
    try {
      const result = await analyzeInvoice(dataUrl);
      setOcr(result);
      setStage("review");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر تحليل الفاتورة.");
      setStage("error");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!isSupportedInvoiceFile(file)) {
      setErr("نوع ملفٍ غير مدعوم — المسموح: JPG أو PNG أو WebP أو GIF أو PDF."); setStage("error"); return;
    }
    setStage("analyzing"); setErr("");
    try {
      const img = await fileToInvoiceImage(file); // ضغطٌ في المتصفّح + تحويل PDF
      setImageDataUrl(img.dataUrl);
      await runAnalysis(img.dataUrl);            // تحليلٌ تلقائيٌّ فور الرفع
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّرت قراءة الملف."); setStage("error");
    }
  }

  // ── تقييمُ الشروط السبعة حيّاً (يطابق منطق الخادم) ──
  const liveConditions = useMemo(
    () => evaluateConditions(ocr, associationName, associationTaxNumber),
    [ocr, associationName, associationTaxNumber],
  );
  const willAutoApprove = passesPolicy(liveConditions, conditionsPolicy);

  function updateItem(idx: number, patch: Partial<OcrExtraction["lineItems"][number]>) {
    setOcr(o => ({ ...o, lineItems: o.lineItems.map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  }
  function addItem() {
    setOcr(o => ({ ...o, lineItems: [...o.lineItems, { description: "", quantity: 1, unitPrice: 0, total: 0 }] }));
  }
  function removeItem(idx: number) {
    setOcr(o => ({ ...o, lineItems: o.lineItems.filter((_, i) => i !== idx) }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ocr.vendorName.trim() || !ocr.total || !purpose.trim()) return;
    const scope = scopeKind === "event" ? { kind: "event" as const }
      : scopeKind === "team" ? { kind: "team" as const, teamId: scopeId }
      : { kind: "committee" as const, committeeId: scopeId };
    const vatPct = ocr.total > ocr.vatAmount && ocr.vatAmount > 0
      ? Math.round((ocr.vatAmount / (ocr.total - ocr.vatAmount)) * 100) : 15;
    addInvoice({
      vendor: ocr.vendorName.trim(),
      purpose: purpose.trim(),
      scope,
      amount: ocr.total,
      vat: vatPct,
      date: ocr.issueDate,
      imageDataUrl: imageDataUrl || undefined,
      ocr: imageDataUrl ? ocr : undefined, // تحليلٌ فقط عند وجود صورة
    });
    setOpen(false);
  }

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
    approved: invoices.filter(i => i.status === "approved" || i.status === "paid").reduce((s, i) => s + i.amount, 0),
    pending: invoices.filter(i => i.status === "pending").length,
    aiExtracted: invoices.filter(i => i.extractedByAI).length,
  }), [invoices]);

  // ── تجميع المصروفات المعتمدة لكل لجنة/فريق ──
  const spendByScope = useMemo(() => {
    const teamSpend: Record<string, number> = {};
    const commSpend: Record<string, number> = {};
    let eventSpend = 0;
    for (const i of invoices) {
      if (i.status !== "approved" && i.status !== "paid") continue;
      if (i.scope.kind === "team") teamSpend[i.scope.teamId] = (teamSpend[i.scope.teamId] ?? 0) + i.amount;
      else if (i.scope.kind === "committee") commSpend[i.scope.committeeId] = (commSpend[i.scope.committeeId] ?? 0) + i.amount;
      else eventSpend += i.amount;
    }
    return { teamSpend, commSpend, eventSpend };
  }, [invoices]);

  function scopeLabel(s: Invoice["scope"]) {
    if (s.kind === "event") return "الفعاليّة كاملةً";
    if (s.kind === "team") return `فريق ${teams.find(t => t.id === s.teamId)?.name ?? "—"}`;
    return committees.find(c => c.id === s.committeeId)?.name ?? "—";
  }

  function exportAll() {
    const rows: (string | number)[][] = [
      ["الرقم", "المورّد", "الغرض", "التاريخ", "المبلغ", "الحالة"],
      ...filtered.map(i => [i.code, i.vendor, i.purpose, i.date, i.amount, statusPill(i.status).label]),
    ];
    downloadCSV(`فواتير_${filtered.length}`, rows);
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="الفواتير"
        title="الفواتير"
        subtitle={`${invoices.length} فاتورة، منها ${summary.aiExtracted} حُلِّلت بالذكاء الاصطناعي، و${summary.pending} بانتظار اعتماد الأمير.`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportAll}>⬇ CSV</Button>
            <Button variant="primary" onClick={openModal}>↑ ارفع فاتورة</Button>
          </div>
        }
      />

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="الإجمالي" value={sar(summary.total)} sub="SAR شامل الضريبة" />
        <KpiCard label="معتمدة" value={sar(summary.approved)} sub={`${invoices.filter(i => i.status === "approved" || i.status === "paid").length} فاتورة`} variant="ok" />
        <KpiCard label="بانتظار الأمير" value={String(summary.pending)} sub="اختلّ فيها شرطٌ فأُحيلت للمراجعة" variant="warn" />
        <KpiCard label="حُلِّلت آلياً" value={String(summary.aiExtracted)} sub="بالذكاء الاصطناعي" />
      </section>

      {/* مصروفات اللجان والفرق المعتمدة */}
      {(Object.keys(spendByScope.teamSpend).length > 0 || Object.keys(spendByScope.commSpend).length > 0 || spendByScope.eventSpend > 0) && (
        <Card title="المصروفات المعتمدة حسب الجهة" className="mb-8">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {spendByScope.eventSpend > 0 && (
              <div className="flex items-center justify-between rounded border border-line px-3 py-2 text-[13px]">
                <span className="text-text-2">الفعاليّة كاملةً</span>
                <span className="num text-text">{sar(spendByScope.eventSpend)}</span>
              </div>
            )}
            {teams.filter(t => spendByScope.teamSpend[t.id]).map(t => (
              <div key={t.id} className="flex items-center justify-between rounded border border-line px-3 py-2 text-[13px]">
                <span className="text-text-2">فريق {t.name}</span>
                <span className="num text-text">{sar(spendByScope.teamSpend[t.id])}</span>
              </div>
            ))}
            {committees.filter(c => spendByScope.commSpend[c.id]).map(c => (
              <div key={c.id} className="flex items-center justify-between rounded border border-line px-3 py-2 text-[13px]">
                <span className="text-text-2">{c.name}</span>
                <span className="num text-text">{sar(spendByScope.commSpend[c.id])}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالرقم أو المورّد..." className="min-w-[220px] flex-1 rounded border border-line-strong bg-surface px-4 py-2 text-[14px]" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as "ALL" | Invoice["status"])} className="rounded border border-line-strong bg-surface px-3 py-2 text-[13px] text-text-2">
          <option value="ALL">كلّ الحالات</option>
          <option value="approved">معتمدة</option>
          <option value="pending">بانتظار الأمير</option>
          <option value="overdue">متأخّرة</option>
        </select>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13.5px]">
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
            {filtered.map(inv => {
              const sp = statusPill(inv.status);
              return (
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
                  <td className="num px-5 py-3 text-text-2">{inv.date || "—"}</td>
                  <td className="num px-5 py-3 text-end text-text">{sar(inv.amount)}</td>
                  <td className="px-5 py-3 text-end"><Pill variant={sp.variant}>{sp.label}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="رفعُ فاتورةٍ جديدة"
        subtitle="ارفع صورة/PDF فاتورة الشراء، ويحلّلها الذكاء الاصطناعي تلقائياً. راجِع النتيجة وصحّحها قبل الإرسال."
        size="lg"
        footer={stage === "review" ? (
          <>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" form="add-invoice">إرسال الفاتورة</Button>
          </>
        ) : (
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>إغلاق</Button>
        )}
      >
        {/* اختيار الملف */}
        {(stage === "pick" || stage === "error") && (
          <div className="grid gap-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line-strong bg-bg-raised px-6 py-10 text-center hover:border-accent">
              <span className="text-[28px]">📄</span>
              <span className="text-[14px] text-text">اضغط لاختيار صورة أو ملف PDF للفاتورة</span>
              <span className="text-[12px] text-text-3">JPG · PNG · WebP · GIF · PDF — حتى ٥ ميغابايت</span>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={e => onFile(e.target.files?.[0])} />
            </label>
            {stage === "error" && (
              <div className="rounded border border-critical/40 bg-critical/5 px-3 py-2 text-[13px] text-critical">
                {err}
                <button type="button" className="ms-2 underline" onClick={() => { setStage("pick"); setErr(""); }}>حاول مجدداً</button>
              </div>
            )}
          </div>
        )}

        {/* أثناء التحليل */}
        {stage === "analyzing" && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
            <p className="text-[14px] text-text-2">يُحلّل الذكاء الاصطناعي الفاتورة…</p>
          </div>
        )}

        {/* المراجعة والتصحيح */}
        {stage === "review" && (
          <form id="add-invoice" onSubmit={submit} className="grid gap-4">
            {imageDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageDataUrl} alt="معاينة الفاتورة" className="max-h-56 w-auto self-center rounded border border-line" />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="المورّد" value={ocr.vendorName} onChange={e => setOcr({ ...ocr, vendorName: e.target.value })} required />
              <Field label="رقم الفاتورة" value={ocr.invoiceNumber} onChange={e => setOcr({ ...ocr, invoiceNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="التاريخ (YYYY-MM-DD)" value={ocr.issueDate} onChange={e => setOcr({ ...ocr, issueDate: e.target.value })} placeholder="2026-01-01" />
              <Field label="الرقم الضريبي للمورّد" inputMode="numeric" value={ocr.vendorTaxNumber} onChange={e => setOcr({ ...ocr, vendorTaxNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="اسم الجمعية (كما في الفاتورة)" value={ocr.associationName} onChange={e => setOcr({ ...ocr, associationName: e.target.value })} />
              <Field label="الرقم الضريبي للجمعية" inputMode="numeric" value={ocr.associationTaxNumber} onChange={e => setOcr({ ...ocr, associationTaxNumber: e.target.value })} />
            </div>

            <label className="flex items-center gap-2 text-[13.5px] text-text-2">
              <input type="checkbox" checked={ocr.isTaxInvoice} onChange={e => setOcr({ ...ocr, isTaxInvoice: e.target.checked })} />
              فاتورة ضريبيّة (تحمل هذا الوصف صراحةً)
            </label>

            {/* البنود */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] tracking-[.12em] text-text-3">البنود</span>
                <button type="button" className="text-[12px] text-accent hover:underline" onClick={addItem}>+ إضافة بند</button>
              </div>
              <div className="grid gap-2">
                {ocr.lineItems.length === 0 && <p className="text-[12px] text-text-3">لا بنود — أضِف بنداً واحداً على الأقل.</p>}
                {ocr.lineItems.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_60px_80px_80px_28px] items-center gap-2">
                    <input value={it.description} onChange={e => updateItem(idx, { description: e.target.value })} placeholder="الوصف" className="rounded border border-line-strong bg-surface px-2 py-1.5 text-[13px]" />
                    <input type="number" min={0} value={it.quantity} onChange={e => updateItem(idx, { quantity: Number(e.target.value) })} placeholder="كميّة" className="num rounded border border-line-strong bg-surface px-2 py-1.5 text-[13px]" />
                    <input type="number" min={0} value={it.unitPrice} onChange={e => updateItem(idx, { unitPrice: Number(e.target.value) })} placeholder="سعر" className="num rounded border border-line-strong bg-surface px-2 py-1.5 text-[13px]" />
                    <input type="number" min={0} value={it.total} onChange={e => updateItem(idx, { total: Number(e.target.value) })} placeholder="إجمالي" className="num rounded border border-line-strong bg-surface px-2 py-1.5 text-[13px]" />
                    <button type="button" className="text-critical hover:opacity-70" onClick={() => removeItem(idx)}>×</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="مبلغ الضريبة" type="number" min={0} value={ocr.vatAmount} onChange={e => setOcr({ ...ocr, vatAmount: Number(e.target.value) })} />
              <Field label="الإجمالي (شامل الضريبة)" type="number" min={0} value={ocr.total} onChange={e => setOcr({ ...ocr, total: Number(e.target.value) })} required />
            </div>

            <TextArea label="الغرض" value={purpose} onChange={e => setPurpose(e.target.value)} required rows={2} placeholder="مثال: مستلزمات فعاليّة اللجنة العلميّة" />

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">المصروف على</span>
                <select value={scopeKind} onChange={e => setScopeKind(e.target.value as "event" | "team" | "committee")} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                  <option value="event">الفعاليّة كاملة</option>
                  <option value="team">فريق</option>
                  <option value="committee">لجنة</option>
                </select>
              </label>
              {scopeKind !== "event" && (
                <label className="block">
                  <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">{scopeKind === "team" ? "الفريق" : "اللجنة"}</span>
                  <select value={scopeId} onChange={e => setScopeId(e.target.value)} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                    {scopeKind === "team"
                      ? teams.map(t => <option key={t.id} value={t.id}>فريق {t.name}</option>)
                      : committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
            </div>

            {/* لوحة الشروط السبعة الحيّة */}
            <div className={`rounded-lg border px-4 py-3 ${willAutoApprove ? "border-ok/40 bg-ok/5" : "border-warn/40 bg-warn/5"}`}>
              <div className="mb-2 text-[13px] font-semibold text-text">
                {willAutoApprove
                  ? "✓ مستوفية للشروط — ستُعتمَد تلقائياً عند الإرسال."
                  : "⚠ اختلّ شرطٌ إلزاميّ — ستُرسَل للأمير/نائبه للمراجعة."}
              </div>
              <ul className="grid grid-cols-1 gap-1 text-[12.5px] sm:grid-cols-2">
                {(Object.keys(CONDITION_LABELS) as (keyof typeof CONDITION_LABELS)[]).map(k => {
                  const pass = liveConditions[k];
                  const required = conditionsPolicy[k];
                  return (
                    <li key={k} className={`flex items-center gap-2 ${!required ? "opacity-40" : ""}`}>
                      <span className={pass ? "text-ok" : "text-critical"}>{pass ? "✓" : "✗"}</span>
                      <span className="text-text-2">{CONDITION_LABELS[k]}{!required && " (غير مُفعّل)"}</span>
                    </li>
                  );
                })}
              </ul>
              {!associationName && !associationTaxNumber && (
                <p className="mt-2 text-[11.5px] text-text-3">لم تُضبَط هويّة الجمعية بعد (الاسم/الرقم الضريبي) في الإعدادات — لذا شرطا الجمعية لن يتحققا وستُحال الفاتورة للأمير.</p>
              )}
            </div>

            {!canApprove && (
              <p className="text-[12px] text-text-3">ملاحظة: القرار النهائيّ للأمير/نائبه؛ إن اختلّ شرطٌ ستصل الفاتورة إليهم للاعتماد.</p>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
