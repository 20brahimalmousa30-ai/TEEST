"use client";
import { Button } from "@/components/ui/Button";

/**
 * عناصرُ واجهةٍ مشتركة لوضع «التحديد للتصدير» (مع خُطّاف useExportSelection):
 *  - ExportSelectToggle: زرُّ تفعيل الوضع، وعند التفعيل يعرض العدّاد وزرَّ الإلغاء.
 *  - SelectCheckbox: مربّع اختيارٍ موحَّد الشكل للصفوف ورأس «تحديد الكلّ».
 */

type Sel = { active: boolean; start: () => void; cancel: () => void; selectedCount: number };

export function ExportSelectToggle({ sel }: { sel: Sel }) {
  if (!sel.active) {
    return <Button variant="outline" onClick={sel.start}>☑ تحديد للتصدير</Button>;
  }
  return (
    <>
      <span className="self-center whitespace-nowrap text-[12.5px] text-text-2">
        {sel.selectedCount > 0 ? `محدَّد: ${sel.selectedCount}` : "لم تحدِّد شيئاً — سيُصدَّر الكلّ"}
      </span>
      <Button variant="outline" onClick={sel.cancel}>إنهاء التحديد</Button>
    </>
  );
}

export function SelectCheckbox({
  checked, onChange, label,
}: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label ?? "تحديد"}
      className="h-4 w-4 cursor-pointer align-middle"
      style={{ accentColor: "var(--accent)" }}
    />
  );
}
