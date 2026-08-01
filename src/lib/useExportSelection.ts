"use client";
import { useCallback, useMemo, useState } from "react";

/**
 * وضعُ تحديدٍ مؤقّت للتصدير (يُستخدم في جداول الموقع القابلة للتصدير).
 *
 * يُفعّله المستخدم بزرّ «تحديد للتصدير»، فتظهر مربّعاتُ اختيارٍ بجانب الصفوف،
 * يحدّد ما يشاء ثمّ يصدّر (إكسل/PDF) المحدَّد فقط. إن لم يحدّد شيئاً تُصدَّر كلُّ
 * الصفوف المعروضة (السلوك الافتراضيّ السابق)، فلا يتعطّل أحد.
 *
 * التمرير: مرّر القائمة المعروضة (المفلترة) ذاتها. استعمل exportRows في دوال
 * التصدير بدل القائمة الأصليّة.
 */
export function useExportSelection<T extends { id: string }>(rows: T[]) {
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  const visibleIds = useMemo(() => rows.map(r => r.id), [rows]);

  const toggle = useCallback((id: string) => {
    setIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isSelected = useCallback((id: string) => ids.has(id), [ids]);

  const allSelected = visibleIds.length > 0 && visibleIds.every(id => ids.has(id));
  const someSelected = visibleIds.some(id => ids.has(id));

  const toggleAll = useCallback(() => {
    setIds(prev => {
      const all = visibleIds.length > 0 && visibleIds.every(id => prev.has(id));
      return all ? new Set() : new Set(visibleIds);
    });
  }, [visibleIds]);

  const start = useCallback(() => setActive(true), []);
  const cancel = useCallback(() => { setActive(false); setIds(new Set()); }, []);

  const selectedCount = useMemo(
    () => visibleIds.filter(id => ids.has(id)).length,
    [visibleIds, ids],
  );

  // الصفوف التي ستُصدَّر فعلاً: المحدَّدة إن وُجدت، وإلّا كلُّ المعروضة.
  const exportRows = useMemo(
    () => (active && selectedCount > 0 ? rows.filter(r => ids.has(r.id)) : rows),
    [active, selectedCount, rows, ids],
  );

  return {
    active, start, cancel,
    toggle, isSelected, toggleAll, allSelected, someSelected,
    selectedCount, exportRows,
  };
}
