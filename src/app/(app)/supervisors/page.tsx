"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Modal, Confirm } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { useStore } from "@/lib/store/StoreProvider";
import type { Supervisor } from "@/lib/mock/types";

const empty = { name: "", phone: "", email: "", teamIds: [] as string[], committeeIds: [] as string[] };

export default function SupervisorsPage() {
  useEffect(() => { document.title = "المشرفون — معالي أبها"; }, []);
  const { supervisors, teams, committees, addSupervisor, updateSupervisor, deleteSupervisor } = useStore();
  const [modalId, setModalId] = useState<"new" | string | null>(null);
  const [toDelete, setToDelete] = useState<Supervisor | null>(null);
  const [form, setForm] = useState({ ...empty });

  function openNew() {
    setForm({ ...empty });
    setModalId("new");
  }
  function openEdit(s: Supervisor) {
    setForm({ name: s.name, phone: s.phone, email: s.email, teamIds: [...s.teamIds], committeeIds: [...s.committeeIds] });
    setModalId(s.id);
  }
  function toggleFrom(list: "teamIds" | "committeeIds", id: string) {
    setForm(f => f[list].includes(id)
      ? { ...f, [list]: f[list].filter(x => x !== id) }
      : { ...f, [list]: [...f[list], id] });
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (modalId === "new") {
      addSupervisor(form.name.trim(), form.phone.trim(), form.email.trim(), form.teamIds, form.committeeIds);
    } else if (modalId) {
      updateSupervisor(modalId, form);
    }
    setModalId(null);
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8">
      <PageHeader
        eyebrow="المشرفون"
        title="المشرفون"
        subtitle={`${supervisors.length} مشرفاً. المشرف الواحد قد يقود فريقاً وينتمي لأكثر من لجنةٍ معاً.`}
        action={<Button variant="primary" onClick={openNew}>+ إضافة مشرف</Button>}
      />

      <Card padded={false}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead className="text-[11px] uppercase tracking-[.14em] text-text-3">
            <tr className="border-b border-line">
              <th className="px-5 py-3 text-start font-normal">المشرف</th>
              <th className="px-5 py-3 text-start font-normal">الاتصال</th>
              <th className="px-5 py-3 text-start font-normal">الفرق</th>
              <th className="px-5 py-3 text-start font-normal">اللجان</th>
              <th className="px-5 py-3 text-end font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {supervisors.map(sup => (
              <tr key={sup.id} className="border-b border-line hover:bg-bg-raised">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[12px] font-semibold" style={{ color: "#F4EEE2" }}>{sup.name[0]}</div>
                    <div>
                      <div className="text-text">{sup.name}</div>
                      <div className="num mt-0.5 text-[11px] text-text-3">{sup.nationalIdMasked}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-text-2">
                  <div className="num text-[12.5px]">{sup.phone}</div>
                  <div className="lat text-[11.5px] text-text-3">{sup.email}</div>
                </td>
                <td className="px-5 py-3">
                  {sup.teamIds.length > 0
                    ? <div className="flex flex-wrap gap-1.5">{sup.teamIds.map(tid => { const t = teams.find(x => x.id === tid); return t && <Pill key={tid} variant="info">فريق {t.name}</Pill>; })}</div>
                    : <span className="text-text-3">—</span>}
                </td>
                <td className="px-5 py-3">
                  {sup.committeeIds.length > 0
                    ? <div className="flex flex-wrap gap-1.5">{sup.committeeIds.map(cid => { const c = committees.find(x => x.id === cid); return c && <Pill key={cid} variant="warn">{c.name}</Pill>; })}</div>
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
          <Field label="الاسم" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="الجوّال" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Field label="البريد" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@maali.abha" />
          </div>
          <div>
            <div className="mb-2 text-[12px] tracking-[.12em] text-text-3">الفرق ({form.teamIds.length})</div>
            <div className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto rounded border border-line p-3 text-[13px]">
              {teams.map(t => (
                <label key={t.id} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={form.teamIds.includes(t.id)} onChange={() => toggleFrom("teamIds", t.id)} className="accent-[color:var(--accent)]" />
                  <span className="text-text-2">فريق {t.name}</span>
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
        </form>
      </Modal>

      <Confirm
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteSupervisor(toDelete.id)}
        title={`حذف المشرف ${toDelete?.name}؟`}
        message="سيُزال المشرف من كلّ الفرق واللجان المرتبطة به."
        confirmLabel="نعم، احذف"
        danger
      />
    </div>
  );
}
