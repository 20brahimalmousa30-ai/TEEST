"use client";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useStore } from "@/lib/store/StoreProvider";
import { useSession } from "@/lib/auth/session";
import { isActivityClosed } from "@/lib/points";
import type { StudentTask, ActivityTarget } from "@/lib/mock/types";

/**
 * «رصد الأنشطة» (البند ١ و٣): يرصد الأمير/نائبه أو المشرف نشاطاً (نقاطٌ موجبة)
 * أو خصماً (نقاطٌ سالبة) — لطالبٍ بعينه، أو لأسرةٍ/أُسَر، أو لكلّ الطلاب.
 * التوقيت: مفتوح (يُحتسب فوراً) · بتاريخ · عدّاد تنازلي (يُغلق تلقائياً عند انتهائه).
 * يرى الطالبُ ما يخصّه (وما يخصّ أسرته) في صفحته — ولا يرصد لنفسه.
 */
type ScopeKind = "student" | "teams" | "all";
type TimeMode = "open" | "date" | "countdown";

export default function ActivitiesPage() {
  useEffect(() => { document.title = "رصد الأنشطة — معالي محافظة بلّسمر"; }, []);
  const { session } = useSession();
  const {
    students, teams, supervisors, studentTasks,
    addActivity, toggleStudentTask, toggleActivityBatch,
    setStudentTaskVisible, deleteStudentTask, deleteActivityBatch,
  } = useStore();

  // نطاقُ المشرف: أُسَره فقط؛ الأمير/نائبه يرى الجميع.
  const mySup = session?.role === "SUPERVISOR"
    ? supervisors.find(s => s.id === session.supervisorId)
    : undefined;
  const myTeamIds = mySup?.teamIds ?? null; // null = بلا تقييد (أمير)

  const approved = useMemo(
    () => students.filter(s => (s.approvalStatus ?? "APPROVED") === "APPROVED"
      && (!myTeamIds || myTeamIds.includes(s.teamId))),
    [students, myTeamIds],
  );
  const scopeTeams = useMemo(
    () => teams.filter(t => !myTeamIds || myTeamIds.includes(t.id)),
    [teams, myTeamIds],
  );
  const myStudentIds = useMemo(() => new Set(approved.map(s => s.id)), [approved]);

  // ── نموذج الرصد ──
  const [scope, setScope] = useState<ScopeKind>("student");
  const [studentId, setStudentId] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState("");
  const [timeMode, setTimeMode] = useState<TimeMode>("open");
  const [dateVal, setDateVal] = useState("");
  const [dtVal, setDtVal] = useState("");

  // مؤقّتٌ خفيف لتحديث العدّادات التنازليّة في القائمة.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  function toggleTeam(id: string) {
    setTeamIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function currentTarget(): ActivityTarget | null {
    if (scope === "student") return studentId ? { kind: "student", studentId } : null;
    if (scope === "teams") return teamIds.length ? { kind: "teams", teamIds } : null;
    return { kind: "all" };
  }

  function currentExpiry(): string | undefined {
    if (timeMode === "date") return dateVal ? new Date(`${dateVal}T23:59:59`).toISOString() : undefined;
    if (timeMode === "countdown") return dtVal ? new Date(dtVal).toISOString() : undefined;
    return undefined;
  }

  const scopeReady = scope === "all" || (scope === "student" && studentId) || (scope === "teams" && teamIds.length > 0);
  const canSubmit = !!title.trim() && !!points.trim() && scopeReady;

  function record(kind: "activity" | "deduction") {
    const target = currentTarget();
    if (!target || !title.trim() || !points.trim()) return;
    // الخصمُ يُطبَّق فوراً — يتجاهل التوقيت.
    const expiresAt = kind === "deduction" ? undefined : currentExpiry();
    addActivity({ target, title: title.trim(), points: Number(points) || 0, kind, expiresAt });
    setTitle(""); setPoints(""); setDateVal(""); setDtVal(""); setTimeMode("open");
  }

  // ── قائمة المرصود (مجمَّعة حسب batchId) — مقيَّدةٌ بطلاب نطاق المشرف ──
  const groups = useMemo(() => {
    const scoped = studentTasks.filter(t => !myTeamIds || myStudentIds.has(t.studentId));
    const byKey = new Map<string, StudentTask[]>();
    for (const t of scoped) {
      const key = t.batchId ?? t.id;
      (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(t);
    }
    return [...byKey.entries()]
      .map(([key, rows]) => {
        const first = rows[0];
        return {
          key,
          batchId: first.batchId,
          title: first.title,
          points: first.points,
          kind: first.kind,
          scopeLabel: first.scopeLabel,
          expiresAt: first.expiresAt,
          createdAt: first.createdAt,
          rows,
          doneCount: rows.filter(r => r.done).length,
        };
      })
      .sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
  }, [studentTasks, myStudentIds, myTeamIds]);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="النقاط · الأنشطة والخصومات"
        title="رصد الأنشطة"
        subtitle="ارصد نشاطاً (نقاطٌ تُضاف) أو خصماً (نقاطٌ تُطرح) — لطالبٍ أو أسرةٍ أو لكلّ الطلاب. يرى الشابُّ ما يخصّه في صفحته، ولا يرصد لنفسه."
      />

      <Card title="رصدٌ جديد">
        {/* النطاق */}
        <div className="mb-1.5 text-[12px] tracking-[.12em] text-text-3">النطاق</div>
        <div className="mb-3 flex flex-wrap gap-2">
          {([["student", "طالب واحد"], ["teams", "أسرة / أُسَر"], ["all", "كل الطلاب"]] as [ScopeKind, string][]).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setScope(k)}
              className={`rounded border px-3 py-1.5 text-[13px] ${scope === k ? "border-accent bg-accent text-[#F4EEE2]" : "border-line-strong text-text-2 hover:border-accent"}`}
            >{l}</button>
          ))}
        </div>

        {scope === "student" && (
          <select
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            className="mb-3 w-full rounded border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-text"
          >
            <option value="">— اختر شاباً —</option>
            {approved.map(s => (
              <option key={s.id} value={s.id}>{s.name}{s.grade ? ` · ${s.grade}` : ""}</option>
            ))}
          </select>
        )}

        {scope === "teams" && (
          <div className="mb-3 flex flex-wrap gap-2">
            {scopeTeams.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTeam(t.id)}
                className={`rounded border px-3 py-1.5 text-[13px] ${teamIds.includes(t.id) ? "border-accent bg-accent text-[#F4EEE2]" : "border-line-strong text-text-2 hover:border-accent"}`}
              >أسرة {t.name}</button>
            ))}
            {scopeTeams.length === 0 && <span className="text-[13px] text-text-3">لا أُسَر متاحة.</span>}
          </div>
        )}

        {scope === "all" && (
          <p className="mb-3 rounded border border-line bg-surface-alt/30 px-3 py-2 text-[12.5px] text-text-3">
            سيُطبَّق على {approved.length} شاباً معتمداً{myTeamIds ? " ضمن نطاقك" : ""}.
          </p>
        )}

        {/* العنوان والنقاط */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="العنوان… (مثال: حضورٌ مبكّر · مشاركةٌ فعّالة · مخالفة)"
          className="mb-2 w-full rounded border border-line-strong bg-surface px-3 py-2 text-[13.5px]"
        />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            value={points}
            onChange={e => setPoints(e.target.value)}
            placeholder="النقاط"
            className="num w-28 rounded border border-line-strong bg-surface px-3 py-2 text-[13px]"
          />
          <span className="text-[12px] text-text-3">النقاط رقمٌ موجب — يُضيفها «رصد نشاط» أو يطرحها «رصد خصم».</span>
        </div>

        {/* التوقيت (للنشاط) */}
        <div className="mb-1.5 text-[12px] tracking-[.12em] text-text-3">توقيت النشاط (لا يخصّ الخصم)</div>
        <div className="mb-2 flex flex-wrap gap-2">
          {([["open", "مفتوح"], ["date", "بتاريخ"], ["countdown", "عدّاد تنازلي"]] as [TimeMode, string][]).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTimeMode(k)}
              className={`rounded border px-3 py-1.5 text-[13px] ${timeMode === k ? "border-accent-warm bg-accent-warm/15 text-text" : "border-line-strong text-text-2 hover:border-accent"}`}
            >{l}</button>
          ))}
        </div>
        {timeMode === "date" && (
          <input
            type="date"
            value={dateVal}
            onChange={e => setDateVal(e.target.value)}
            className="num mb-3 w-full rounded border border-line-strong bg-surface px-3 py-2 text-[13px] text-text-2"
          />
        )}
        {timeMode === "countdown" && (
          <input
            type="datetime-local"
            value={dtVal}
            onChange={e => setDtVal(e.target.value)}
            className="num mb-3 w-full rounded border border-line-strong bg-surface px-3 py-2 text-[13px] text-text-2"
          />
        )}
        {timeMode === "open" && (
          <p className="mb-3 text-[12px] text-text-3">مفتوح: تُحتسب نقاط النشاط فوراً دون موعدٍ للإغلاق.</p>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <Button type="button" variant="primary" disabled={!canSubmit} onClick={() => record("activity")}>＋ رصد نشاط</Button>
          <Button type="button" variant="outline" disabled={!canSubmit} onClick={() => record("deduction")}>－ رصد خصم</Button>
        </div>
      </Card>

      <div className="mt-6">
        <Card title="المرصود" action={<span className="text-[11.5px] text-text-3">{groups.length} سجلّاً</span>}>
          {groups.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-text-3">لا شيء مرصودٌ بعد — ابدأ برصد نشاطٍ أو خصم.</p>
          ) : (
            <ul className="grid gap-2">
              {groups.map(g => {
                const isBatch = !!g.batchId;
                const isDed = g.kind === "deduction";
                const timed = !isDed && !!g.expiresAt;
                const closed = timed && isActivityClosed({ ...g.rows[0], done: g.doneCount > 0 } as StudentTask, nowTick);
                const remaining = timed && g.expiresAt ? g.expiresAt : undefined;
                const accepted = g.doneCount > 0;
                return (
                  <li key={g.key} className="rounded border border-line px-3 py-2.5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] text-text">{g.title}</span>
                          <Pill variant={isDed ? "critical" : accepted ? "ok" : "info"}>
                            {g.points > 0 ? `+${g.points}` : g.points} نقطة
                          </Pill>
                          {isDed && <span className="text-[11px] text-critical">خصم</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-3">
                          {g.scopeLabel && <span>{g.scopeLabel}</span>}
                          {isBatch && <span className="num">{g.rows.length} طالب{timed ? ` · ${g.doneCount} معتمد` : ""}</span>}
                          {timed && !closed && !accepted && remaining && (
                            <span className="num text-accent-warm-2">{formatCountdown(remaining, nowTick)}</span>
                          )}
                          {timed && closed && !accepted && <span className="text-critical">انتهى الوقت — لم يُعتمد</span>}
                          {!isDed && accepted && <span className="text-ok">محتسب</span>}
                          {!isDed && !timed && !accepted && <span>نشاطٌ مفتوح</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {!isDed && timed && !closed && (
                          <button
                            type="button"
                            onClick={() => isBatch ? toggleActivityBatch(g.batchId!, !accepted) : toggleStudentTask(g.rows[0].id, !accepted)}
                            className="text-[11.5px] text-accent hover:underline"
                          >{accepted ? "تراجع" : "اعتماد الإنجاز"}</button>
                        )}
                        {!isBatch && (
                          <button
                            type="button"
                            onClick={() => setStudentTaskVisible(g.rows[0].id, !g.rows[0].visible)}
                            className="text-[11.5px] text-text-3 hover:text-text"
                          >{g.rows[0].visible ? "إخفاء عن الشاب" : "إظهار للشاب"}</button>
                        )}
                        <button
                          type="button"
                          onClick={() => isBatch ? deleteActivityBatch(g.batchId!) : deleteStudentTask(g.rows[0].id)}
                          className="text-[11.5px] text-text-3 hover:text-critical"
                        >حذف</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/** يصوغ الوقت المتبقّي حتى إغلاق النشاط بصيغةٍ عربيّةٍ مختصرة. */
function formatCountdown(iso: string, now: number): string {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return "انتهى";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `يتبقّى ${days} يوم ${hours} س`;
  if (hours > 0) return `يتبقّى ${hours} س ${m} د`;
  return `يتبقّى ${m} د`;
}
