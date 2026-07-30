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
import { exportXlsx, SAR_FMT } from "@/lib/xlsx";
import { exportTableReportPdf, esc, ltr, pill, REPORT_COLORS as RC } from "@/lib/pdf/reportEngine";
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

// عنصرُ فاتورةٍ واحدٍ ضمن دفعة الرفع المتعدّد.
type ItemStage = "analyzing" | "review" | "error";
type BatchItem = {
  id: number;
  fileName: string;
  imageDataUrl: string;
  stage: ItemStage;
  err: string;
  ocr: OcrExtraction;
  purpose: string;
  scopeKind: "event" | "team" | "committee";
  scopeId: string;
};

const CONCURRENCY = 3; // تحليل ٣ فواتير معاً (كنمط محاسب كلود).

export default function InvoicesPage() {
  useEffect(() => { document.title = "الفواتير — معالي محافظة بلّسمر"; }, []);
  const { invoices, teams, committees, supervisors, addInvoicesBatch, analyzeInvoice,
    associationName, associationTaxNumber, conditionsPolicy } = useStore();
  const { session } = useSession();
  const canApprove = session?.role === "PRINCE" || session?.role === "DEPUTY_PRINCE";

  const [statusFilter, setStatusFilter] = useState<"ALL" | Invoice["status"]>("ALL");
  const [q, setQ] = useState("");

  // ── حالة نافذة الرفع المتعدّد ──
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pickErr, setPickErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);
  const filesRef = useRef<Record<number, File>>({});

  function openModal() {
    setItems([]); setActiveIdx(0); setPickErr("");
    if (fileRef.current) fileRef.current.value = "";
    setOpen(true);
  }

  const active = items[activeIdx];
  const defaultScopeId = teams[0]?.id ?? "";

  /** يحلّل عنصراً واحداً (تحويل الملف ثمّ تحليل الذكاء الاصطناعي). */
  async function analyzeItem(itemId: number, file: File) {
    try {
      const img = await fileToInvoiceImage(file);
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, imageDataUrl: img.dataUrl } : it));
      const result = await analyzeInvoice(img.dataUrl);
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, ocr: result, stage: "review" } : it));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذّر تحليل الفاتورة.";
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, stage: "error", err: msg } : it));
    }
  }

  /** يستقبل ملفّات الدخل ويحلّلها متوازياً (٣ معاً). */
  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter(isSupportedInvoiceFile);
    const rejected = fileList.length - files.length;
    setPickErr(rejected > 0 ? `تجاهلتُ ${rejected} ملفاً بنوعٍ غير مدعوم (المسموح: JPG · PNG · WebP · GIF · PDF).` : "");
    if (files.length === 0) return;

    const startIdx = items.length;
    const created: BatchItem[] = files.map(f => {
      const id = ++idRef.current;
      filesRef.current[id] = f;
      return {
        id, fileName: f.name, imageDataUrl: "", stage: "analyzing" as const, err: "",
        ocr: EMPTY_OCR, purpose: "", scopeKind: "event" as const, scopeId: defaultScopeId,
      };
    });
    setItems(prev => [...prev, ...created]);
    setActiveIdx(startIdx);
    if (fileRef.current) fileRef.current.value = "";

    // مجمّعُ تنفيذٍ محدود التوازي.
    let cursor = 0;
    const worker = async () => {
      while (cursor < created.length) {
        const my = cursor++;
        await analyzeItem(created[my].id, files[my]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, created.length) }, worker));
  }

  function retryItem(item: BatchItem) {
    const file = filesRef.current[item.id];
    if (!file) return;
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, stage: "analyzing", err: "" } : it));
    void analyzeItem(item.id, file);
  }

  function removeItem(id: number) {
    setItems(prev => {
      const next = prev.filter(it => it.id !== id);
      setActiveIdx(i => Math.max(0, Math.min(i, next.length - 1)));
      return next;
    });
    delete filesRef.current[id];
  }

  // ── تعديل العنصر النشط ──
  function patchActive(patch: Partial<BatchItem>) {
    setItems(prev => prev.map((it, i) => i === activeIdx ? { ...it, ...patch } : it));
  }
  function patchOcr(patch: Partial<OcrExtraction>) {
    setItems(prev => prev.map((it, i) => i === activeIdx ? { ...it, ocr: { ...it.ocr, ...patch } } : it));
  }
  function updateLine(idx: number, patch: Partial<OcrExtraction["lineItems"][number]>) {
    setItems(prev => prev.map((it, i) => i === activeIdx
      ? { ...it, ocr: { ...it.ocr, lineItems: it.ocr.lineItems.map((li, k) => k === idx ? { ...li, ...patch } : li) } } : it));
  }
  function addLine() {
    setItems(prev => prev.map((it, i) => i === activeIdx
      ? { ...it, ocr: { ...it.ocr, lineItems: [...it.ocr.lineItems, { description: "", quantity: 1, unitPrice: 0, total: 0 }] } } : it));
  }
  function removeLine(idx: number) {
    setItems(prev => prev.map((it, i) => i === activeIdx
      ? { ...it, ocr: { ...it.ocr, lineItems: it.ocr.lineItems.filter((_, k) => k !== idx) } } : it));
  }

  // هل العنصر سيُعتمد تلقائياً؟ (يطابق منطق الخادم).
  function itemAutoApproves(it: BatchItem) {
    return passesPolicy(evaluateConditions(it.ocr, associationName, associationTaxNumber), conditionsPolicy);
  }
  function itemValid(it: BatchItem) {
    return it.stage === "review" && !!it.ocr.vendorName.trim() && !!it.ocr.total && !!it.purpose.trim();
  }

  const liveConditions = active ? evaluateConditions(active.ocr, associationName, associationTaxNumber) : null;
  const activeAutoApprove = active ? passesPolicy(liveConditions!, conditionsPolicy) : false;

  const reviewItems = items.filter(it => it.stage === "review");
  const analyzingCount = items.filter(it => it.stage === "analyzing").length;
  const allReviewValid = reviewItems.length > 0 && reviewItems.every(itemValid);

  function submitAll() {
    const invalid = items.find(it => it.stage === "review" && !itemValid(it));
    if (invalid) { setActiveIdx(items.indexOf(invalid)); return; }
    const inputs = items.filter(it => it.stage === "review").map(it => {
      const scope = it.scopeKind === "event" ? { kind: "event" as const }
        : it.scopeKind === "team" ? { kind: "team" as const, teamId: it.scopeId }
        : { kind: "committee" as const, committeeId: it.scopeId };
      const vatPct = it.ocr.total > it.ocr.vatAmount && it.ocr.vatAmount > 0
        ? Math.round((it.ocr.vatAmount / (it.ocr.total - it.ocr.vatAmount)) * 100) : 15;
      return {
        vendor: it.ocr.vendorName.trim(),
        purpose: it.purpose.trim(),
        scope,
        amount: it.ocr.total,
        vat: vatPct,
        date: it.ocr.issueDate,
        imageDataUrl: it.imageDataUrl || undefined,
        ocr: it.imageDataUrl ? it.ocr : undefined,
      };
    });
    if (inputs.length > 0) addInvoicesBatch(inputs);
    setOpen(false);
  }

  // نصّ زرّ الإرسال (البند ٤): مفردةٌ مطابِقة → «اعتماد»؛ مخالِفة → «طلب اعتماد»؛ متعدّدة → «إرسال الكل».
  const submitLabel = (() => {
    if (reviewItems.length === 0) return "إرسال";
    if (reviewItems.length === 1) return itemAutoApproves(reviewItems[0]) ? "✓ اعتماد" : "طلب اعتماد";
    return `إرسال الكل (${reviewItems.length})`;
  })();

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

  // ── بيانات صفٍّ واحدٍ لتقرير المشتريات (مشتركة بين إكسل وPDF) ──
  function purchaseFields(i: Invoice) {
    const vatAmt = Math.round((i.amount * i.vat) / (100 + i.vat));
    return {
      number: i.invoiceNumber || i.code,
      vendor: i.vendor,
      vendorTax: i.vendorTaxNumber || "—",
      purpose: i.purpose,
      scope: scopeLabel(i.scope),
      date: i.date || "—",
      net: i.amount - vatAmt,
      vat: vatAmt,
      total: i.amount,
      status: statusPill(i.status).label,
      uploader: i.uploadedBy ? (supervisors.find(s => s.id === i.uploadedBy)?.name ?? "—") : "الأمير",
    };
  }

  async function exportPurchasesXlsx() {
    const rows = filtered.map(i => {
      const f = purchaseFields(i);
      return [f.number, f.vendor, f.vendorTax, f.purpose, f.scope, f.date, f.net, f.vat, f.total, f.status, f.uploader];
    });
    await exportXlsx({
      filename: `تقرير_المشتريات_${filtered.length}`,
      sheetName: "المشتريات",
      title: "تقرير المشتريات — معالي محافظة بلّسمر",
      subtitle: `${filtered.length} فاتورة · إجماليّ ${sar(filtered.reduce((s, i) => s + i.amount, 0))} ر.س`,
      columns: [
        { header: "رقم الفاتورة", width: 16, align: "center" },
        { header: "المورّد", width: 26, align: "right" },
        { header: "الرقم الضريبي", width: 18, align: "center" },
        { header: "الغرض", width: 28, align: "right" },
        { header: "المصروف على", width: 20, align: "right" },
        { header: "التاريخ", width: 14, align: "center" },
        { header: "الصافي", width: 14, align: "center", numFmt: SAR_FMT, total: true },
        { header: "الضريبة", width: 13, align: "center", numFmt: SAR_FMT, total: true },
        { header: "الإجمالي", width: 15, align: "center", numFmt: SAR_FMT, total: true },
        { header: "الحالة", width: 16, align: "center" },
        { header: "مَن رفع", width: 20, align: "right" },
      ],
      rows,
      totalsLabel: "الإجماليّ",
    });
  }

  async function exportPurchasesPdf() {
    const statusColor = (s: Invoice["status"]) =>
      s === "approved" || s === "paid" ? RC.petroleum : s === "pending" ? RC.gold : "#B23A48";
    const rows = filtered.map(i => {
      const f = purchaseFields(i);
      return [
        ltr(f.number),
        `<span style="font-weight:600">${esc(f.vendor)}</span>`,
        ltr(f.vendorTax),
        esc(f.purpose),
        esc(f.scope),
        ltr(f.date),
        ltr(sar(f.total)),
        pill(f.status, statusColor(i.status)),
        esc(f.uploader),
      ];
    });
    const totalSum = filtered.reduce((s, i) => s + i.amount, 0);
    const approvedSum = filtered.filter(i => i.status === "approved" || i.status === "paid").reduce((s, i) => s + i.amount, 0);
    const pendingCount = filtered.filter(i => i.status === "pending").length;
    const summaryHtml =
      `<div style="display:flex;gap:10px;flex-wrap:wrap">` +
      [["إجماليّ المشتريات", `${sar(totalSum)} ر.س`], ["المعتمد", `${sar(approvedSum)} ر.س`], ["بانتظار الأمير", `${pendingCount}`], ["عدد الفواتير", `${filtered.length}`]]
        .map(([k, v]) => `<div style="flex:1;min-width:130px;border:1px solid ${RC.line};border-radius:8px;padding:8px 12px;background:${RC.paper}">` +
          `<div style="font-size:10px;color:${RC.sub}">${esc(k)}</div>` +
          `<div style="font-size:14px;font-weight:800;color:${RC.petroleum};margin-top:2px" dir="ltr">${esc(v)}</div></div>`).join("") +
      `</div>`;
    await exportTableReportPdf({
      title: "تقرير المشتريات",
      subtitle: `${filtered.length} فاتورة`,
      filename: "تقرير_المشتريات",
      footerLabel: "تقرير المشتريات",
      columns: [
        { header: "رقم الفاتورة", width: "80px", align: "center" },
        { header: "المورّد", width: "auto", align: "right" },
        { header: "الرقم الضريبي", width: "104px", align: "center" },
        { header: "الغرض", width: "auto", align: "right" },
        { header: "المصروف على", width: "96px", align: "right" },
        { header: "التاريخ", width: "78px", align: "center" },
        { header: "الإجمالي", width: "84px", align: "center" },
        { header: "الحالة", width: "92px", align: "center" },
        { header: "مَن رفع", width: "90px", align: "right" },
      ],
      rows,
      summaryHtml,
    });
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="الفواتير"
        title="الفواتير"
        subtitle={`${invoices.length} فاتورة، منها ${summary.aiExtracted} حُلِّلت بالذكاء الاصطناعي، و${summary.pending} بانتظار اعتماد الأمير.`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportPurchasesXlsx}>⬇ إكسل</Button>
            <Button variant="outline" onClick={exportPurchasesPdf}>⎙ PDF</Button>
            <Button variant="primary" onClick={openModal}>↑ ارفع فواتير</Button>
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
            {teams.filter(t => spendByScope.teamSpend[t.id]).map(t => {
              const b = t.budget ?? 0;
              return (
                <div key={t.id} className="flex items-center justify-between rounded border border-line px-3 py-2 text-[13px]">
                  <span className="text-text-2">فريق {t.name}</span>
                  <span className="num text-text">{sar(spendByScope.teamSpend[t.id])}{b > 0 ? ` / ${sar(b)}` : ""}</span>
                </div>
              );
            })}
            {committees.filter(c => spendByScope.commSpend[c.id]).map(c => {
              const b = c.budget ?? 0;
              return (
                <div key={c.id} className="flex items-center justify-between rounded border border-line px-3 py-2 text-[13px]">
                  <span className="text-text-2">{c.name}</span>
                  <span className="num text-text">{sar(spendByScope.commSpend[c.id])}{b > 0 ? ` / ${sar(b)}` : ""}</span>
                </div>
              );
            })}
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
        title="رفعُ فواتير"
        subtitle="ارفع صورة/PDF لفاتورةٍ أو أكثر، ويحلّلها الذكاء الاصطناعي تلقائياً ومتوازياً. راجِع كلّ فاتورة وصحّحها قبل الإرسال."
        size="lg"
        footer={reviewItems.length > 0 ? (
          <>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="button" onClick={submitAll} disabled={!allReviewValid || analyzingCount > 0}>{submitLabel}</Button>
          </>
        ) : (
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>إغلاق</Button>
        )}
      >
        <div className="grid gap-4">
          {/* اختيار الملفّات */}
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line-strong bg-bg-raised px-6 py-6 text-center hover:border-accent">
            <span className="text-[24px]">📄</span>
            <span className="text-[14px] text-text">اضغط لاختيار صورة/صور أو ملفات PDF (يمكن اختيار عدّة ملفات)</span>
            <span className="text-[12px] text-text-3">JPG · PNG · WebP · GIF · PDF — حتى ٥ ميغابايت للملف</span>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
              onChange={e => onFiles(e.target.files)} />
          </label>
          {pickErr && <p className="text-[12.5px] text-critical">{pickErr}</p>}

          {/* شريط التقدّم */}
          {items.length > 0 && analyzingCount > 0 && (
            <div className="flex items-center gap-2 text-[12.5px] text-text-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
              يُحلّل {items.length - analyzingCount} من {items.length}…
            </div>
          )}

          {/* تبويبات التنقّل بين الفواتير */}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-line pb-3">
              {items.map((it, i) => {
                const ok = it.stage === "review";
                const bad = it.stage === "error";
                const icon = it.stage === "analyzing" ? "…" : bad ? "✗" : ok && itemAutoApproves(it) ? "✓" : ok ? "⚠" : "";
                return (
                  <button key={it.id} type="button" onClick={() => setActiveIdx(i)}
                    className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px] ${i === activeIdx ? "border-accent bg-accent/5 text-text" : "border-line text-text-2 hover:bg-bg-raised"}`}>
                    <span className={bad ? "text-critical" : ok && itemAutoApproves(it) ? "text-ok" : ok ? "text-warn" : "text-text-3"}>{icon}</span>
                    <span className="max-w-[120px] truncate">{it.ocr.vendorName || it.fileName || `فاتورة ${i + 1}`}</span>
                    <span role="button" tabIndex={0} aria-label="إزالة" className="ms-1 text-text-3 hover:text-critical"
                      onClick={e => { e.stopPropagation(); removeItem(it.id); }}>×</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* العنصر النشط */}
          {active && active.stage === "analyzing" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
              <p className="text-[14px] text-text-2">يُحلّل الذكاء الاصطناعي هذه الفاتورة…</p>
            </div>
          )}

          {active && active.stage === "error" && (
            <div className="rounded border border-critical/40 bg-critical/5 px-3 py-3 text-[13px] text-critical">
              {active.err}
              <button type="button" className="ms-2 underline" onClick={() => retryItem(active)}>إعادة المحاولة</button>
            </div>
          )}

          {active && active.stage === "review" && (
            <div className="grid gap-4">
              {active.imageDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.imageDataUrl} alt="معاينة الفاتورة" className="max-h-48 w-auto self-center rounded border border-line" />
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="المورّد" value={active.ocr.vendorName} onChange={e => patchOcr({ vendorName: e.target.value })} required />
                <Field label="رقم الفاتورة" value={active.ocr.invoiceNumber} onChange={e => patchOcr({ invoiceNumber: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="التاريخ (YYYY-MM-DD)" value={active.ocr.issueDate} onChange={e => patchOcr({ issueDate: e.target.value })} placeholder="2026-01-01" />
                <Field label="الرقم الضريبي للمورّد" inputMode="numeric" value={active.ocr.vendorTaxNumber} onChange={e => patchOcr({ vendorTaxNumber: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="اسم الجمعية (كما في الفاتورة)" value={active.ocr.associationName} onChange={e => patchOcr({ associationName: e.target.value })} />
                <Field label="الرقم الضريبي للجمعية" inputMode="numeric" value={active.ocr.associationTaxNumber} onChange={e => patchOcr({ associationTaxNumber: e.target.value })} />
              </div>

              <label className="flex items-center gap-2 text-[13.5px] text-text-2">
                <input type="checkbox" checked={active.ocr.isTaxInvoice} onChange={e => patchOcr({ isTaxInvoice: e.target.checked })} />
                فاتورة ضريبيّة (تحمل هذا الوصف صراحةً)
              </label>

              {/* البنود */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[12px] tracking-[.12em] text-text-3">البنود</span>
                  <button type="button" className="text-[12px] text-accent hover:underline" onClick={addLine}>+ إضافة بند</button>
                </div>
                <div className="grid gap-2">
                  {active.ocr.lineItems.length === 0 && <p className="text-[12px] text-text-3">لا بنود — أضِف بنداً واحداً على الأقل.</p>}
                  {active.ocr.lineItems.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_60px_80px_80px_28px] items-center gap-2">
                      <input value={it.description} onChange={e => updateLine(idx, { description: e.target.value })} placeholder="الوصف" className="rounded border border-line-strong bg-surface px-2 py-1.5 text-[13px]" />
                      <input type="number" min={0} value={it.quantity} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })} placeholder="كميّة" className="num rounded border border-line-strong bg-surface px-2 py-1.5 text-[13px]" />
                      <input type="number" min={0} value={it.unitPrice} onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })} placeholder="سعر" className="num rounded border border-line-strong bg-surface px-2 py-1.5 text-[13px]" />
                      <input type="number" min={0} value={it.total} onChange={e => updateLine(idx, { total: Number(e.target.value) })} placeholder="إجمالي" className="num rounded border border-line-strong bg-surface px-2 py-1.5 text-[13px]" />
                      <button type="button" className="text-critical hover:opacity-70" onClick={() => removeLine(idx)}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="مبلغ الضريبة" type="number" min={0} value={active.ocr.vatAmount} onChange={e => patchOcr({ vatAmount: Number(e.target.value) })} />
                <Field label="الإجمالي (شامل الضريبة)" type="number" min={0} value={active.ocr.total} onChange={e => patchOcr({ total: Number(e.target.value) })} required />
              </div>

              <TextArea label="الغرض" value={active.purpose} onChange={e => patchActive({ purpose: e.target.value })} required rows={2} placeholder="مثال: مستلزمات فعاليّة اللجنة العلميّة" />

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">المصروف على</span>
                  <select value={active.scopeKind} onChange={e => patchActive({ scopeKind: e.target.value as "event" | "team" | "committee", scopeId: defaultScopeId })} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                    <option value="event">الفعاليّة كاملة</option>
                    <option value="team">فريق</option>
                    <option value="committee">لجنة</option>
                  </select>
                </label>
                {active.scopeKind !== "event" && (
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">{active.scopeKind === "team" ? "الفريق" : "اللجنة"}</span>
                    <select value={active.scopeId} onChange={e => patchActive({ scopeId: e.target.value })} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                      {active.scopeKind === "team"
                        ? teams.map(t => <option key={t.id} value={t.id}>فريق {t.name}</option>)
                        : committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
              </div>

              {/* لوحة الشروط السبعة الحيّة */}
              <div className={`rounded-lg border px-4 py-3 ${activeAutoApprove ? "border-ok/40 bg-ok/5" : "border-warn/40 bg-warn/5"}`}>
                <div className="mb-2 text-[13px] font-semibold text-text">
                  {activeAutoApprove
                    ? "✓ مستوفية للشروط — ستُعتمَد تلقائياً عند الإرسال."
                    : "⚠ اختلّ شرطٌ إلزاميّ — ستُرسَل للأمير/نائبه للمراجعة."}
                </div>
                <ul className="grid grid-cols-1 gap-1 text-[12.5px] sm:grid-cols-2">
                  {(Object.keys(CONDITION_LABELS) as (keyof typeof CONDITION_LABELS)[]).map(k => {
                    const pass = liveConditions![k];
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
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
