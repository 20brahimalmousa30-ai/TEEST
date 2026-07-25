"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Modal, Confirm } from "@/components/ui/Modal";
import { Field, TextArea } from "@/components/ui/Field";
import { useStore } from "@/lib/store/StoreProvider";

const swatches = ["#B54A2E", "#1E4635", "#5F8A5C", "#4E6B7A", "#B8955A", "#7A5B2E", "#8C5A3C"];

export default function CommitteesPage() {
  useEffect(() => { document.title = "اللجان — معالي أبها"; }, []);
  const { committees, supervisors, addCommittee, deleteCommittee } = useStore();
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: swatches[0], supervisorIds: [] as string[] });

  function toggleSup(id: string) {
    setForm(f => f.supervisorIds.includes(id)
      ? { ...f, supervisorIds: f.supervisorIds.filter(x => x !== id) }
      : { ...f, supervisorIds: [...f.supervisorIds, id] });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    addCommittee(form.name.trim(), form.description.trim() || "لجنةٌ جديدة.", form.supervisorIds, form.color);
    setForm({ name: "", description: "", color: swatches[0], supervisorIds: [] });
    setOpen(false);
  }

  const committeeToDelete = committees.find(c => c.id === toDelete);

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8">
      <PageHeader
        eyebrow={`اللجان · ${committees.length} لجنة`}
        title="اللجان"
        subtitle="سبعُ لجان (أو أكثر) تدير التفاصيل التشغيليّة للرحلة. المشرف الواحد قد يكون عضواً في أكثر من لجنةٍ وفي فريقٍ معاً."
        action={<Button variant="primary" onClick={() => setOpen(true)}>+ لجنةٌ جديدة</Button>}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {committees.map(c => {
          const members = c.supervisorIds.map(id => supervisors.find(s => s.id === id)).filter(Boolean);
          return (
            <article key={c.id} className="relative overflow-hidden rounded-md border border-line bg-surface p-6 transition-colors hover:border-accent-warm">
              <span className="absolute inset-y-0 right-0 w-1" style={{ background: c.color }} />
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[17px] font-semibold text-text">{c.name}</h3>
                <div className="flex items-center gap-2">
                  <Pill variant="neutral">{members.length} مشرفاً</Pill>
                  <button onClick={() => setToDelete(c.id)} aria-label="حذف اللجنة" className="text-text-3 hover:text-critical">×</button>
                </div>
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.85] text-text-2">{c.description}</p>
              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-2 text-[11px] tracking-[.14em] text-text-3">الأعضاء</div>
                <div className="flex flex-wrap gap-2">
                  {members.length === 0 && <span className="text-[12px] text-text-3">لا مشرفين بعد</span>}
                  {members.map(m => (
                    <span key={m!.id} className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-[12.5px] text-text-2">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-semibold" style={{ color: "#F4EEE2" }}>{m!.name[0]}</span>
                      {m!.name}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="إضافة لجنةٍ جديدة"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" form="new-committee">إنشاء اللجنة</Button>
          </>
        }
      >
        <form id="new-committee" onSubmit={submit} className="grid gap-4">
          <Field label="اسم اللجنة" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثال: لجنة التصوير" required />
          <TextArea label="وصف موجز" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div>
            <div className="mb-2 text-[12px] tracking-[.12em] text-text-3">اللون المميّز</div>
            <div className="flex flex-wrap gap-2">
              {swatches.map(sw => (
                <button key={sw} type="button" onClick={() => setForm({ ...form, color: sw })}
                  className={`h-8 w-8 rounded ${form.color === sw ? "ring-2 ring-offset-2 ring-accent-warm" : ""}`} style={{ background: sw }} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12px] tracking-[.12em] text-text-3">أعضاء اللجنة ({form.supervisorIds.length})</div>
            <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded border border-line p-3">
              {supervisors.map(s => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={form.supervisorIds.includes(s.id)} onChange={() => toggleSup(s.id)} className="accent-[color:var(--accent)]" />
                  <span className="text-text-2">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <Confirm
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteCommittee(toDelete)}
        title={`حذف ${committeeToDelete?.name ?? "اللجنة"}؟`}
        message="سيُزال ارتباط جميع مشرفيها بها. لا يمكن التراجع في النسخة التجريبية."
        confirmLabel="نعم، احذف"
        danger
      />
    </div>
  );
}
