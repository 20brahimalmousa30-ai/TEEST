"use client";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useStore } from "@/lib/store/StoreProvider";
import { useSession } from "@/lib/auth/session";
import { formatCountdown } from "@/lib/points";

type TimeMode = "open" | "date" | "countdown";

/**
 * «لوحة الإعلانات»: يعلن المشرفُ عن أنشطةٍ في لجانه — كلُّ نشاطٍ بقيمتِه بالنقاط.
 * يراها الطلابُ في صفحتهم (لكلّ اللجان أو لجنةٍ محدّدة)، ويرصدها المشرفُ لمن أنجزها
 * من صفحة «رصد الأنشطة» باختيارها من المُعلَن. الأمير/نائبه يُدير كلّ اللجان.
 */
export default function AnnouncementsPage() {
  useEffect(() => { document.title = "لوحة الإعلانات — معالي محافظة بلّسمر"; }, []);
  const { session } = useSession();
  const { committees, supervisors, announcements, addAnnouncement, updateAnnouncement, deleteAnnouncement } = useStore();

  // المشرفُ يُدير إعلاناتِ لجانه فقط؛ الأمير/نائبه كلّ اللجان.
  const mySup = session?.role === "SUPERVISOR"
    ? supervisors.find(s => s.id === session.supervisorId)
    : undefined;
  const manageable = useMemo(
    () => session?.role === "SUPERVISOR"
      ? committees.filter(c => (mySup?.committeeIds ?? []).includes(c.id))
      : committees,
    [session?.role, committees, mySup],
  );
  const manageableIds = useMemo(() => new Set(manageable.map(c => c.id)), [manageable]);

  const [committeeId, setCommitteeId] = useState("");
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState("");
  const [timeMode, setTimeMode] = useState<TimeMode>("open");
  const [dateVal, setDateVal] = useState("");
  const [dtVal, setDtVal] = useState("");

  // موعدُ الإغلاق المُعلَن — يظهر للشباب في لوحتهم؛ غيابُه يعني «نشاطٌ مفتوح».
  function currentExpiry(): string | undefined {
    if (timeMode === "date") return dateVal ? new Date(`${dateVal}T23:59:59`).toISOString() : undefined;
    if (timeMode === "countdown") return dtVal ? new Date(dtVal).toISOString() : undefined;
    return undefined;
  }

  // اختيارٌ افتراضيّ عند توفّر لجنةٍ واحدة.
  useEffect(() => {
    if (manageable.length === 1) setCommitteeId(manageable[0].id);
  }, [manageable]);

  const canSubmit = !!committeeId && !!title.trim() && !!points.trim();

  function submit() {
    if (!canSubmit) return;
    addAnnouncement({ title: title.trim(), points: Number(points) || 0, committeeId, expiresAt: currentExpiry() });
    setTitle(""); setPoints(""); setDateVal(""); setDtVal(""); setTimeMode("open");
  }

  // إعلاناتُ اللجان التي يُديرها المُستخدم فقط، أحدثها أوّلاً.
  const myAnnouncements = useMemo(
    () => announcements.filter(a => manageableIds.has(a.committeeId)),
    [announcements, manageableIds],
  );
  const committeeName = (id: string) => committees.find(c => c.id === id)?.name ?? "—";

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="النقاط · الأنشطة المُعلَنة"
        title="لوحة الإعلانات"
        subtitle="أعلِن أنشطةَ لجنتك وقيمةَ كلٍّ منها بالنقاط — يراها الشبابُ في صفحتهم، وترصدها لمن أنجزها من «رصد الأنشطة»."
      />

      {manageable.length === 0 ? (
        <Card title="لا لجان">
          <p className="py-4 text-center text-[13px] text-text-3">لا توجد لجنةٌ مُسنَدةٌ إليك للإعلان فيها — تواصل مع الأمير.</p>
        </Card>
      ) : (
        <Card title="إعلانٌ جديد">
          {manageable.length > 1 && (
            <>
              <div className="mb-1.5 text-[12px] tracking-[.12em] text-text-3">اللجنة</div>
              <select
                value={committeeId}
                onChange={e => setCommitteeId(e.target.value)}
                className="mb-3 w-full rounded border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-text"
              >
                <option value="">— اختر لجنة —</option>
                {manageable.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>
          )}
          {manageable.length === 1 && (
            <p className="mb-3 rounded border border-line bg-surface-alt/30 px-3 py-2 text-[12.5px] text-text-3">
              الإعلانُ ضمن لجنتك: <span className="text-text">{manageable[0].name}</span>
            </p>
          )}

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="اسم النشاط… (مثال: حضورٌ مبكّر · مشاركةٌ في التنظيم)"
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
            <span className="text-[12px] text-text-3">قيمةُ النشاط بالنقاط — تُملأ تلقائياً عند الرصد ويمكن تعديلها.</span>
          </div>

          {/* موعدُ الإغلاق — يُحدَّد هنا مرّةً، ويسري تلقائياً عند الرصد دون إعادة إدخال */}
          <div className="mb-1.5 text-[12px] tracking-[.12em] text-text-3">موعد النشاط</div>
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
            <p className="mb-3 text-[12px] text-text-3">مفتوح: يبقى النشاطُ متاحاً بلا موعدٍ للإغلاق.</p>
          )}

          <div className="border-t border-line pt-3">
            <Button type="button" variant="primary" disabled={!canSubmit} onClick={submit}>＋ إعلان نشاط</Button>
          </div>
        </Card>
      )}

      <div className="mt-6">
        <Card title="الأنشطة المُعلَنة" action={<span className="text-[11.5px] text-text-3">{myAnnouncements.length} نشاطاً</span>}>
          {myAnnouncements.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-text-3">لا أنشطةَ معلَنةً بعد — أضِف نشاطاً ليظهر للشباب.</p>
          ) : (
            <ul className="grid gap-2">
              {myAnnouncements.map(a => (
                <li key={a.id} className={`rounded border px-3 py-2.5 ${a.active ? "border-line" : "border-line bg-surface-alt/30 opacity-70"}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] text-text">{a.title}</span>
                        <Pill variant={a.active ? "ok" : "info"}>+{a.points} نقطة</Pill>
                        {!a.active && <span className="text-[11px] text-text-3">مخفيّ</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11.5px] text-text-3">
                        <span>{committeeName(a.committeeId)}</span>
                        {a.expiresAt
                          ? <span className="num text-accent-warm-2">{formatCountdown(a.expiresAt)}</span>
                          : <span>مفتوح</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateAnnouncement(a.id, { active: !a.active })}
                        className="text-[11.5px] text-text-3 hover:text-text"
                      >{a.active ? "إخفاء" : "إظهار"}</button>
                      <button
                        type="button"
                        onClick={() => deleteAnnouncement(a.id)}
                        className="text-[11.5px] text-text-3 hover:text-critical"
                      >حذف</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
