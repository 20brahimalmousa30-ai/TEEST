// ============================================================================
//  تقييم «الشروط السبعة» لصحّة الفاتورة الضريبيّة — منقولٌ حرفيّاً من محرّك
//  محاسب كلود المُثبَت. التطبيق (لا الذكاء الاصطناعي) هو من يقرّر: الذكاء
//  الاصطناعي يستخرج البيانات فقط، وهذه الدالّة الحتميّة تقيّم كل شرط منها.
//  تُستدعى خادميّاً عند رفع الفاتورة، وتُثبَّت النتيجة معها (لا يُوثَق بقيمة العميل).
// ============================================================================
import type { OcrExtraction, SevenConditions, ConditionsPolicy } from "@/lib/mock/types";

/** السياسة الافتراضيّة: كل الشروط السبعة إلزاميّة. */
export const DEFAULT_CONDITIONS_POLICY: ConditionsPolicy = {
  taxInvoice: true,
  associationName: true,
  associationTaxNumber: true,
  vendorTaxNumber: true,
  issueDate: true,
  serviceDetails: true,
  quantityAndTotal: true,
};

/**
 * يقيّم الشروط السبعة من الاستخلاص وحده (مستقلّاً عن أي فاتورة أخرى).
 * expectedAssociationName / expectedAssociationTaxNumber: هويّة الجمعية المسجّلة
 * في الإعدادات — تُقارَن بها الحقول المستخرَجة (الشرطان ٢ و٣).
 */
export function evaluateConditions(
  ocr: OcrExtraction | null,
  expectedAssociationName: string,
  expectedAssociationTaxNumber: string,
): SevenConditions {
  if (!ocr) {
    return {
      taxInvoice: false,
      associationName: false,
      associationTaxNumber: false,
      vendorTaxNumber: false,
      issueDate: false,
      serviceDetails: false,
      quantityAndTotal: false,
    };
  }
  const norm = (s: string) => s.trim().replace(/\s+/g, " ");
  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
  const items = ocr.lineItems ?? [];
  return {
    // ١) فاتورة ضريبيّة صراحةً
    taxInvoice: ocr.isTaxInvoice === true,
    // ٢) اسم الجمعية يطابق الاسم المسجّل (بعد تطبيع المسافات) وليس فارغاً
    associationName:
      norm(ocr.associationName) === norm(expectedAssociationName) &&
      norm(ocr.associationName).length > 0 &&
      norm(expectedAssociationName).length > 0,
    // ٣) الرقم الضريبي للجمعية يطابق المسجّل ومكوّن من ١٥ رقماً
    associationTaxNumber:
      ocr.associationTaxNumber === expectedAssociationTaxNumber &&
      /^\d{15}$/.test(ocr.associationTaxNumber),
    // ٤) الرقم الضريبي للمورّد مكوّن من ١٥ رقماً
    vendorTaxNumber: /^\d{15}$/.test((ocr.vendorTaxNumber ?? "").trim()),
    // ٥) تاريخ إصدار صالح YYYY-MM-DD
    issueDate: isValidDate(ocr.issueDate ?? ""),
    // ٦) تفاصيل خدمة/منتج لكل بند
    serviceDetails: items.length > 0 && items.every(li => norm(li.description).length > 0),
    // ٧) كميّة وسعر إجمالي موجبان لكل بند + إجمالي موجب
    quantityAndTotal:
      items.length > 0 && items.every(li => li.quantity > 0 && li.total > 0) && ocr.total > 0,
  };
}

/**
 * هل الفاتورة مستوفية لكل الشروط الإلزاميّة في السياسة؟ (الشروط غير المُفعّلة تُتجاهَل.)
 * true → تُعتمَد تلقائياً؛ false → تُصعَّد للأمير للمراجعة.
 */
export function passesPolicy(conditions: SevenConditions, policy: ConditionsPolicy): boolean {
  return (Object.keys(policy) as (keyof ConditionsPolicy)[])
    .every(key => !policy[key] || conditions[key]);
}

/** أسماء الشروط بالعربية — للعرض في الواجهة. */
export const CONDITION_LABELS: Record<keyof SevenConditions, string> = {
  taxInvoice:           "فاتورة ضريبيّة",
  associationName:      "اسم الجمعية صحيح",
  associationTaxNumber: "الرقم الضريبي للجمعية",
  vendorTaxNumber:      "الرقم الضريبي للمورّد",
  issueDate:            "تاريخ الإصدار",
  serviceDetails:       "تفاصيل الخدمة/المنتج",
  quantityAndTotal:     "الكميّة والإجمالي",
};
