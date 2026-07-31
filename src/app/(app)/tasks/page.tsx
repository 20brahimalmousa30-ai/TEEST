"use client";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useStore } from "@/lib/store/StoreProvider";

/**
 * «رصد المهام» (البند ١ و٣): يرصد الأمير/نائبه أو المشرف مهامّاً تحفيزيّة لطالبٍ
 * بعينه، ولكلّ مهمّةٍ نقاطٌ محفِّزة. يمكن إظهار/إخفاء كلّ مهمّة عن الطالب.
 * يرى الطالب المرئيّة منها فقط في صفحته «مهامي».
 */
export default function TasksPage() {
  useEffect(() => { document.title = "رصد المهام — معالي محافظة بلّسمر"; }, []);
  const { students, studentTasks, addStudentTask, toggleStudentTask, setStudentTaskVisible, deleteStudentTask } = useStore();

  const approved = useMemo(
    () => students.filter(s => (s.approvalStatus ?? "APPROVED") === "APPROVED"),
    [students],
  );
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState("");
  const [dueDate, setDueDate] = useState("");

  const student = approved.find(s => s.id === studentId);
  const tasks = useMemo(
    () => studentTasks.filter(t => t.studentId === studentId),
    [studentTasks, studentId],
  );
  const openCount = tasks.filter(t => !t.done).length;

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!studentId || !t) return;
    addStudentTask(studentId, t, Number(points) || 0, dueDate || undefined);
    setTitle(""); setPoints(""); setDueDate("");
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="النقاط · المهام التحفيزيّة"
        title="رصد المهام"
        subtitle="ارصد مهامّاً تحفيزيّة لكلّ شابٍّ ولكلّ مهمّةٍ نقاطها. يرى الشاب المرئيّة منها فقط في صفحته «مهامي»."
      />

      <Card title="اختر الشاب">
        <select
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          className="w-full rounded border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-text"
        >
          <option value="">— اختر شاباً —</option>
          {approved.map(s => (
            <option key={s.id} value={s.id}>{s.name}{s.grade ? ` · ${s.grade}` : ""}</option>
          ))}
        </select>
      </Card>

      {student && (
        <div className="mt-6">
          <Card
            title={`مهامّ ${student.name}`}
            action={<span className="text-[11.5px] text-text-3">{openCount} مفتوحة · {tasks.length} إجمالاً</span>}
          >
            <form onSubmit={add} className="mb-4 grid gap-2 border-b border-line pb-4">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="عنوان المهمّة… (مثال: قراءة صفحة من كتاب)"
                className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[13.5px]"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  min={0}
                  value={points}
                  onChange={e => setPoints(e.target.value)}
                  placeholder="النقاط"
                  className="num w-28 rounded border border-line-strong bg-surface px-3 py-2 text-[13px]"
                />
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="num flex-1 rounded border border-line-strong bg-surface px-3 py-2 text-[13px] text-text-2"
                />
                <Button type="submit" variant="primary" disabled={!title.trim()}>رصد المهمّة</Button>
              </div>
            </form>

            <ul className="grid gap-2">
              {tasks.length === 0 && (
                <li className="py-3 text-center text-[13px] text-text-3">لا مهامّ بعد — ارصد أوّل مهمّة.</li>
              )}
              {tasks.map(t => (
                <li key={t.id} className="flex items-start gap-3 rounded border border-line px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleStudentTask(t.id, !t.done)}
                    className="mt-0.5 accent-[color:var(--accent)]"
                    aria-label="إنجاز المهمّة"
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13.5px] ${t.done ? "text-text-3 line-through" : "text-text"}`}>{t.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Pill variant={t.points > 0 ? "info" : "neutral"}>{t.points} نقطة</Pill>
                      {t.dueDate && <span className="num text-[11px] text-text-3">حتى {t.dueDate}</span>}
                      {!t.visible && <span className="text-[11px] text-accent-warm-2">مخفيّة عن الشاب</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStudentTaskVisible(t.id, !t.visible)}
                      className="text-[11.5px] text-text-3 hover:text-text"
                    >{t.visible ? "إخفاء" : "إظهار"}</button>
                    <button
                      type="button"
                      onClick={() => deleteStudentTask(t.id)}
                      className="text-text-3 hover:text-critical"
                      aria-label="حذف المهمّة"
                    >×</button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
