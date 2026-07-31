"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store/StoreProvider";

/**
 * بطاقة «مهامّ اللجنة»: يضيفها الأمير/نائبه أو مشرف اللجنة، ويمكن تخصيص كلّ
 * مهمّةٍ لعضوٍ بعينه من أعضاء اللجنة. الحُرّاس الفعليّون في الخادم (requireCommitteeAccess).
 */
export function CommitteeTasks({ committeeId, memberIds }: { committeeId: string; memberIds: string[] }) {
  const { committeeTasks, supervisors, addCommitteeTask, toggleCommitteeTask, deleteCommitteeTask } = useStore();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");

  const tasks = committeeTasks.filter(t => t.committeeId === committeeId);
  const members = memberIds.map(id => supervisors.find(s => s.id === id)).filter(Boolean) as { id: string; name: string }[];
  const openCount = tasks.filter(t => !t.done).length;
  const nameOf = (id?: string) => id ? (supervisors.find(s => s.id === id)?.name ?? "—") : null;

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    addCommitteeTask(committeeId, t, assignee || undefined);
    setTitle(""); setAssignee("");
  }

  return (
    <Card title="مهامّ اللجنة" action={<span className="text-[11.5px] text-text-3">{openCount} مفتوحة · {tasks.length} إجمالاً</span>}>
      <form onSubmit={add} className="mb-4 grid gap-2 border-b border-line pb-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="أضف مهمّة جديدة…"
          className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[13.5px]"
        />
        <div className="flex gap-2">
          <select
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            className="flex-1 rounded border border-line-strong bg-surface px-3 py-2 text-[13px] text-text-2"
          >
            <option value="">— بلا تخصيص —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Button type="submit" variant="primary" disabled={!title.trim()}>إضافة</Button>
        </div>
      </form>

      <ul className="grid gap-2">
        {tasks.length === 0 && <li className="py-3 text-center text-[13px] text-text-3">لا مهامّ بعد — أضِف أوّل مهمّة.</li>}
        {tasks.map(t => (
          <li key={t.id} className="flex items-start gap-3 rounded border border-line px-3 py-2.5">
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggleCommitteeTask(t.id, !t.done)}
              className="mt-0.5 accent-[color:var(--accent)]"
              aria-label="إنجاز المهمّة"
            />
            <div className="min-w-0 flex-1">
              <div className={`text-[13.5px] ${t.done ? "text-text-3 line-through" : "text-text"}`}>{t.title}</div>
              {t.assigneeId && (
                <div className="mt-0.5 text-[11.5px] text-accent">↳ مخصَّصة لـ {nameOf(t.assigneeId)}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => deleteCommitteeTask(t.id)}
              className="text-text-3 hover:text-critical"
              aria-label="حذف المهمّة"
            >×</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
