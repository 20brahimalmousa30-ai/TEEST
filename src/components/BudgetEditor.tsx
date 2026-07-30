"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { sar } from "@/lib/format";

/**
 * صفٌّ يعرض موازنة اللجنة/الفريق: المُخصَّص · المصروف المعتمد · المتبقّي.
 * الأمير/نائبه فقط يستطيع تعديل المبلغ (canEdit). الموازنة عرضٌ إرشاديّ —
 * لا تمنع اعتماد الفواتير.
 */
export function BudgetEditor({
  budget, spent, canEdit, onSave,
}: {
  budget: number;
  spent: number;
  canEdit: boolean;
  onSave: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(budget));
  useEffect(() => { setVal(String(budget)); }, [budget]);

  const remaining = budget - spent;
  const over = remaining < 0;

  return (
    <div className="mt-4 rounded border border-line bg-bg-raised/50 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracking-[.14em] text-text-3">الموازنة</span>
        {canEdit && !editing && (
          <button type="button" className="text-[12px] text-accent hover:underline" onClick={() => setEditing(true)}>
            تعديل
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number" min={0} inputMode="numeric" value={val}
            onChange={e => setVal(e.target.value)}
            className="num w-32 rounded border border-line-strong bg-surface px-2 py-1.5 text-[13px]"
          />
          <span className="text-[12px] text-text-3">ر.س</span>
          <Button variant="primary" onClick={() => { onSave(Math.max(0, Math.round(Number(val) || 0))); setEditing(false); }}>حفظ</Button>
          <Button variant="ghost" onClick={() => { setVal(String(budget)); setEditing(false); }}>إلغاء</Button>
        </div>
      ) : (
        <div className="mt-1.5 grid grid-cols-3 gap-2 text-[12.5px]">
          <div>
            <div className="text-text-3">المُخصَّص</div>
            <div className="num text-text">{budget > 0 ? sar(budget) : "—"}</div>
          </div>
          <div>
            <div className="text-text-3">المصروف</div>
            <div className="num text-text">{sar(spent)}</div>
          </div>
          <div>
            <div className="text-text-3">المتبقّي</div>
            <div className={`num ${over ? "text-critical" : "text-ok"}`}>
              {budget > 0 ? sar(remaining) : "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
