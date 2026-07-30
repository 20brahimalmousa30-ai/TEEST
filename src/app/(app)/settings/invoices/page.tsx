"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useStore } from "@/lib/store/StoreProvider";
import { useSession } from "@/lib/auth/session";
import { CONDITION_LABELS } from "@/lib/ai/conditions";
import type { ConditionsPolicy } from "@/lib/mock/types";

export default function InvoiceSettingsPage() {
  useEffect(() => { document.title = "إعدادات الفواتير — معالي محافظة بلّسمر"; }, []);
  const {
    associationName, associationTaxNumber, setAssociationIdentity,
    conditionsPolicy, setConditionsPolicy,
  } = useStore();
  const { session } = useSession();
  const canEdit = session?.role === "PRINCE" || session?.role === "DEPUTY_PRINCE";

  const [name, setName] = useState("");
  const [tax, setTax] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setName(associationName); }, [associationName]);
  useEffect(() => { setTax(associationTaxNumber); }, [associationTaxNumber]);

  function saveIdentity() {
    setAssociationIdentity(name.trim(), tax.trim());
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  function togglePolicy(key: keyof ConditionsPolicy) {
    setConditionsPolicy({ ...conditionsPolicy, [key]: !conditionsPolicy[key] });
  }

  if (!canEdit) {
    return (
      <div className="page-shell">
        <p className="text-text-2">هذه الصفحة للأمير/نائبه فقط.</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="الإعدادات"
        title="إعدادات الفواتير"
        subtitle="هويّة الجمعية الرسميّة وشروط الاعتماد التلقائيّ لفواتير المشرفين."
      />

      <div className="grid gap-6 lg:max-w-2xl">
        <Card title="هويّة الجمعية الرسميّة">
          <p className="mb-4 text-[13px] text-text-2">
            يُطابِق النظام اسم الجمعية ورقمها الضريبي المُستخرَجَين من الفاتورة بهذين الحقلين
            (الشرطان ٢ و٣). إن تُركا فارغين، لن يتحقق الشرطان وستُحال الفواتير للأمير دائماً.
          </p>
          <div className="grid gap-4">
            <Field label="اسم الجمعية الرسميّ (كما في الفواتير الضريبيّة)" value={name} onChange={e => setName(e.target.value)} placeholder="مثال: جمعية معالي محافظة بلّسمر" />
            <Field label="الرقم الضريبي للجمعية (15 رقماً)" inputMode="numeric" value={tax} onChange={e => setTax(e.target.value)} placeholder="3XXXXXXXXXXXX3" />
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={saveIdentity}>حفظ الهويّة</Button>
              {saved && <span className="text-[13px] text-ok">✓ حُفِظت</span>}
            </div>
          </div>
        </Card>

        <Card title="شروط الاعتماد التلقائيّ">
          <p className="mb-4 text-[13px] text-text-2">
            الفاتورة المستوفية لكلّ الشروط <b>المُفعّلة</b> تُعتمَد تلقائياً؛ وإن اختلّ أحدها
            تُرسَل للأمير/نائبه للمراجعة. الشروط غير المُفعّلة تُتجاهَل في القرار.
          </p>
          <ul className="grid gap-2">
            {(Object.keys(CONDITION_LABELS) as (keyof ConditionsPolicy)[]).map(k => (
              <li key={k}>
                <label className="flex cursor-pointer items-center gap-3 rounded border border-line px-3 py-2.5 text-[13.5px] hover:bg-bg-raised">
                  <input type="checkbox" checked={conditionsPolicy[k]} onChange={() => togglePolicy(k)} />
                  <span className="text-text">{CONDITION_LABELS[k]}</span>
                  <span className={`ms-auto text-[11px] ${conditionsPolicy[k] ? "text-ok" : "text-text-3"}`}>
                    {conditionsPolicy[k] ? "إلزاميّ" : "غير مُفعّل"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
