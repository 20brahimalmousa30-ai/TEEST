"use client";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Modal, Confirm } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { useStore } from "@/lib/store/StoreProvider";
import { useSession } from "@/lib/auth/session";
import type { Supervisor } from "@/lib/mock/types";
import { SUPERVISOR_PERMISSIONS } from "@/lib/mock/types";
import { parseCSV } from "@/lib/spreadsheet";
import { exportXlsx } from "@/lib/xlsx";
import { useExportSelection } from "@/lib/useExportSelection";
import { ExportSelectToggle, SelectCheckbox } from "@/components/ExportSelect";
import { fileToDataUrl } from "@/lib/image";
import { teamLabel } from "@/lib/format";

const empty = { name: "", phone: "", email: "", nationalId: "", specialty: "", photoDataUrl: "", teamIds: [] as string[], committeeIds: [] as string[], permissions: [] as string[] };

export default function SupervisorsPage() {
  useEffect(() => { document.title = "المشرفون — معالي محافظة بلّسمر"; }, []);
  const { supervisors, teams, committees, addSupervisor, updateSupervisor, deleteSupervisor, importSupervisors } = useStore();
  const { session } = useSession();
  // رقم الهوية الحقيقيّ للمشرف — للأمير/نائبه فقط (عرضاً وتحريراً).
  const canApprove = session?.role === "PRINCE" || session?.role === "DEPUTY_PRINCE";
  const [modalId, setModalId] = useState<"new" | string | null>(null);
  const [toDelete, setToDelete] = useState<Supervisor | null>(null);
  const [form, setForm] = useState({ ...empty });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const [photoErr, setPhotoErr] = useState("");
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sel = useExportSelection(supervisors);

  async function exportExcel() {
    const data = sel.exportRows;
    const rows = data.map(s => [
      s.name, s.phone, s.email || "—", s.teamIds.length, s.committeeIds.length,
      canApprove ? (s.nationalId || "غير مسجَّل") : "",
    ]);
    await exportXlsx({
      filename: `المشرفون_${new Date().toISOString().slice(0, 10)}`,
      sheetName: "المشرفون",
      title: "قائمة المشرفين — معالي محافظة بلّسمر",
      subtitle: `${data.length} مشرف`,
      columns: [
        { header: "الاسم", width: 26, align: "right" },
        { header: "الجوّال", width: 16, align: "center" },
        { header: "البريد", width: 24, align: "right" },
        { header: "عدد الأسر", width: 12, align: "center", numFmt: "0" },
        { header: "عدد اللجان", width: 12, align: "center", numFmt: "0" },
        ...(canApprove ? [{ header: "رقم الهويّة", width: 16, align: "center" as const }] : []),
      ],
      rows: rows.map(r => canApprove ? r : r.slice(0, 5)),
    });
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // للسماح بإعادة اختيار الملف نفسه
    if (!file) return;
    try {
      const text = await file.text();
      const grid = parseCSV(text);
      if (!grid.length) { setImportMsg({ ok: false, text: "الملفّ فارغ." }); return; }
      // تخطّي صفّ الترويسة إن بدا كذلك (يحوي كلمة «الاسم» أو «name»).
      const first = (grid[0][0] || "").toLowerCase();
      const body = /الاسم|name|اسم/.test(first) ? grid.slice(1) : grid;
      const seen = new Set(supervisors.map(s => s.phone.trim()));
      const parsed: { name: string; phone: string; email: string }[] = [];
      let skipped = 0;
      for (const r of body) {
        const name = (r[0] || "").trim();
        const phone = (r[1] || "").trim();
        const email = (r[2] || "").trim();
        if (!name) { skipped++; continue; }
        if (phone && seen.has(phone)) { skipped++; continue; }
        if (phone) seen.add(phone);
        parsed.push({ name, phone, email });
      }
      if (!parsed.length) { setImportMsg({ ok: false, text: `لم يُستورَد أيّ صفّ صالح (${skipped} صفّاً متجاوَزاً).` }); return; }
      importSupervisors(parsed);
      setImportMsg({ ok: true, text: `استُورد ${parsed.length} مشرفاً${skipped ? ` — تُخطّي ${skipped} صفّاً (مكرّر/ناقص).` : "."}` });
    } catch {
      setImportMsg({ ok: false, text: "تعذّرت قراءة الملفّ. تأكّد أنّه بصيغة CSV/Excel." });
    }
  }

  function openNew() {
    setForm({ ...empty });
    setPhotoErr("");
    setModalId("new");
  }
  function openEdit(s: Supervisor) {
    setForm({ name: s.name, phone: s.phone, email: s.email, nationalId: s.nationalId ?? "", specialty: s.specialty ?? "", photoDataUrl: s.photoDataUrl ?? "", teamIds: [...s.teamIds], committeeIds: [...s.committeeIds], permissions: [...(s.permissions ?? [])] });
    setPhotoErr("");
    setModalId(s.id);
  }
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoErr("الملف يجب أن يكون صورة."); return; }
    if (file.size > 3 * 1024 * 1024) { setPhotoErr("الحدّ الأقصى ٣ ميغابايت."); return; }
    setPhotoErr("");
    try { const dataUrl = await fileToDataUrl(file); setForm(f => ({ ...f, photoDataUrl: dataUrl })); }
    catch { setPhotoErr("تعذّرت قراءة الصورة."); }
  }
  function toggleFrom(list: "teamIds" | "committeeIds" | "permissions", id: string) {
    setForm(f => f[list].includes(id)
      ? { ...f, [list]: f[list].filter(x => x !== id) }
      : { ...f, [list]: [...f[list], id] });
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    // رقم الهوية يُدخله/يُعدّله الأمير فقط؛ لغيره لا نُرسل الحقل إطلاقاً.
    if (modalId === "new") {
      addSupervisor(form.name.trim(), form.phone.trim(), form.email.trim(), form.teamIds, form.committeeIds, form.permissions, canApprove ? form.nationalId.trim() : "", form.specialty.trim(), form.photoDataUrl || undefined);
    } else if (modalId) {
      const { nationalId, specialty, photoDataUrl, ...rest } = form;
      const patch = { ...rest, specialty: specialty.trim(), photoDataUrl: photoDataUrl || undefined };
      updateSupervisor(modalId, canApprove ? { ...patch, nationalId: nationalId.trim() } : patch);
    }
    setModalId(null);
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="المشرفون"
        title="المشرفون"
        subtitle={`${supervisors.length} مشرفاً. المشرف الواحد قد يقود أسرةً وينتمي لأكثر من لجنةٍ معاً.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportSelectToggle sel={sel} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>استيراد Excel</Button>
            <Button variant="outline" onClick={exportExcel}>تصدير Excel</Button>
            <Button variant="primary" onClick={openNew}>+ إضافة مشرف</Button>
          </div>
        }
      />

      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onImportFile} className="hidden" />

      {importMsg && (
        <div
          className={`mb-4 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-[13px] ${
            importMsg.ok ? "border-ok/40 bg-ok/10 text-ok" : "border-critical/40 bg-critical/10 text-critical"
          }`}
        >
          <span>{importMsg.text}</span>
          <button onClick={() => setImportMsg(null)} className="text-text-3 hover:text-text">✕</button>
        </div>
      )}

      <Card padded={false}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead className="text-[11px] uppercase tracking-[.14em] text-text-3">
            <tr className="border-b border-line">
              {sel.active && (
                <th className="px-4 py-3 text-center font-normal">
                  <SelectCheckbox checked={sel.allSelected} onChange={sel.toggleAll} label="تحديد الكل" />
                </th>
              )}
              <th className="px-5 py-3 text-start font-normal">المشرف</th>
              <th className="px-5 py-3 text-start font-normal">الاتصال</th>
              <th className="px-5 py-3 text-start font-normal">الأسر</th>
              <th className="px-5 py-3 text-start font-normal">اللجان</th>
              <th className="px-5 py-3 text-start font-normal">الصلاحيات</th>
              <th className="px-5 py-3 text-end font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {supervisors.map(sup => (
              <tr key={sup.id} className="border-b border-line hover:bg-bg-raised">
                {sel.active && (
                  <td className="px-4 py-3 text-center">
                    <SelectCheckbox checked={sel.isSelected(sup.id)} onChange={() => sel.toggle(sup.id)} label={`تحديد ${sup.name}`} />
                  </td>
                )}
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[12px] font-semibold" style={{ color: "#F4EEE2" }}>{sup.name[0]}</div>
                    <div>
                      <div className="text-text">{sup.name}</div>
                      {canApprove && (
                        <div className="num mt-0.5 text-[11px] text-text-3">
                          {sup.nationalId ? sup.nationalId : <span className="text-text-3/70">غير مسجَّل</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-text-2">
                  <div className="num text-[12.5px]">{sup.phone}</div>
                  <div className="lat text-[11.5px] text-text-3">{sup.email}</div>
                  {sup.accessCode && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10.5px] text-text-3">رمز الدخول</span>
                      <span className="num rounded bg-bg-raised px-2 py-0.5 text-[12px] tracking-wider text-accent">{sup.accessCode}</span>
                    </div>
                  )}
                </td>
                <td className="px-5 py-3">
                  {sup.teamIds.length > 0
                    ? <div className="flex flex-wrap gap-1.5">{sup.teamIds.map(tid => { const t = teams.find(x => x.id === tid); return t && <Pill key={tid} variant="info">{teamLabel(t.name)}</Pill>; })}</div>
                    : <span className="text-text-3">—</span>}
                </td>
                <td className="px-5 py-3">
                  {sup.committeeIds.length > 0
                    ? <div className="flex flex-wrap gap-1.5">{sup.committeeIds.map(cid => { const c = committees.find(x => x.id === cid); return c && <Pill key={cid} variant="warn">{c.name}</Pill>; })}</div>
                    : <span className="text-text-3">—</span>}
                </td>
                <td className="px-5 py-3">
                  {(sup.permissions?.length ?? 0) > 0
                    ? <div className="flex flex-wrap gap-1.5">{sup.permissions.map(pk => { const p = SUPERVISOR_PERMISSIONS.find(x => x.key === pk); return p && <Pill key={pk} variant="info">{p.label}</Pill>; })}</div>
                    : <span className="text-text-3">—</span>}
                </td>
                <td className="px-5 py-3 text-end text-[12.5px]">
                  <button onClick={() => openEdit(sup)} className="text-accent hover:underline">تعديل</button>
                  <button onClick={() => setToDelete(sup)} className="ms-3 text-critical hover:underline">حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      <Modal
        open={modalId !== null}
        onClose={() => setModalId(null)}
        title={modalId === "new" ? "إضافة مشرف" : "تعديل بيانات المشرف"}
        size="lg"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setModalId(null)}>إلغاء</Button>
            <Button type="submit" form="sup-form">{modalId === "new" ? "إضافة" : "حفظ"}</Button>
          </>
        }
      >
        <form id="sup-form" onSubmit={submit} className="grid gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-accent text-[22px] font-semibold" style={{ color: "#F4EEE2" }}>
              {form.photoDataUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={form.photoDataUrl} alt="" className="h-full w-full object-cover" />
                : (form.name.trim()[0] ?? "؟")}
            </span>
            <div>
              <input ref={photoRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
              <div className="flex gap-2">
                <Button variant="outline" type="button" onClick={() => photoRef.current?.click()}>
                  {form.photoDataUrl ? "تغيير الصورة" : "صورة المشرف"}
                </Button>
                {form.photoDataUrl && (
                  <Button variant="ghost" type="button" onClick={() => setForm(f => ({ ...f, photoDataUrl: "" }))}>إزالة</Button>
                )}
              </div>
              <p className="mt-1.5 text-[11.5px] text-text-3">تظهر في صفحة «المشرفون» التعريفيّة — بحدٍّ أقصى ٣ ميغابايت.</p>
              {photoErr && <p className="text-[11.5px] text-critical">{photoErr}</p>}
            </div>
          </div>
          <Field label="الاسم" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Field label="التخصُّص / المجال" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="مثال: الإعلام والتصوير" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="الجوّال" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Field label="البريد" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@maali.abha" />
          </div>
          {canApprove && (
            <Field
              label="رقم الهويّة"
              inputMode="numeric"
              value={form.nationalId}
              onChange={e => setForm({ ...form, nationalId: e.target.value })}
              placeholder="غير مسجَّل"
            />
          )}
          <div>
            <div className="mb-2 text-[12px] tracking-[.12em] text-text-3">الأسر ({form.teamIds.length})</div>
            <div className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto rounded border border-line p-3 text-[13px]">
              {teams.map(t => (
                <label key={t.id} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={form.teamIds.includes(t.id)} onChange={() => toggleFrom("teamIds", t.id)} className="accent-[color:var(--accent)]" />
                  <span className="text-text-2">{teamLabel(t.name)}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12px] tracking-[.12em] text-text-3">اللجان ({form.committeeIds.length})</div>
            <div className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto rounded border border-line p-3 text-[13px]">
              {committees.map(c => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={form.committeeIds.includes(c.id)} onChange={() => toggleFrom("committeeIds", c.id)} className="accent-[color:var(--accent)]" />
                  <span className="text-text-2">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12px] tracking-[.12em] text-text-3">الصلاحيات ({form.permissions.length})</div>
            <p className="mb-2 text-[11.5px] text-text-3">حدّد الأقسام الإداريّة التي يُسمح لهذا المشرف بالوصول إليها من قائمته الجانبيّة.</p>
            <div className="grid grid-cols-2 gap-2 rounded border border-line p-3 text-[13px]">
              {SUPERVISOR_PERMISSIONS.map(p => (
                <label key={p.key} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={form.permissions.includes(p.key)} onChange={() => toggleFrom("permissions", p.key)} className="accent-[color:var(--accent)]" />
                  <span className="text-text-2">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <Confirm
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteSupervisor(toDelete.id)}
        title={`حذف المشرف ${toDelete?.name}؟`}
        message="سيُزال المشرف من كلّ الأسر واللجان المرتبطة به."
        confirmLabel="نعم، احذف"
        danger
      />
    </div>
  );
}
