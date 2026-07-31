import type { StudentTask } from "@/lib/mock/types";

/** النقاط تُحتسَب فقط عند اعتماد الإنجاز (done=true).
 *  الخصمُ والنشاطُ المفتوح يُخزَّنان done=true فيُحتسبان فوراً؛
 *  النشاطُ المؤقّت يُحتسَب عند اعتماده قبل انتهاء وقته. */
export function taskCounts(t: StudentTask): boolean {
  return t.done;
}

/** صافي نقاط طالبٍ بعينه (الأنشطة المعتمدة ناقص الخصومات). */
export function studentNet(tasks: StudentTask[], studentId: string): number {
  return tasks.reduce((sum, t) => (t.studentId === studentId && taskCounts(t) ? sum + t.points : sum), 0);
}

/** صافي نقاط مجموعةٍ من الطلاب (لأسرة/أُسَر المشرف). */
export function studentsNet(tasks: StudentTask[], studentIds: Set<string>): number {
  return tasks.reduce((sum, t) => (studentIds.has(t.studentId) && taskCounts(t) ? sum + t.points : sum), 0);
}

/** إجمالي صافي نقاط الفعاليّة كاملةً. */
export function totalNet(tasks: StudentTask[]): number {
  return tasks.reduce((sum, t) => (taskCounts(t) ? sum + t.points : sum), 0);
}

/** هل انتهى وقتُ النشاط المؤقّت دون اعتماد؟ (يُغلَق تلقائياً فلا يُحتسَب). */
export function isActivityClosed(t: StudentTask, now = Date.now()): boolean {
  return !t.done && !!t.expiresAt && Date.parse(t.expiresAt) <= now;
}
