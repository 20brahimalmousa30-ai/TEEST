import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { OcrExtraction } from "@/lib/mock/types";

// ============================================================================
//  تحليل صورة فاتورة الشراء بواسطة Claude Vision — استخلاصٌ منظّم (JSON) للبيانات.
//  منقولٌ من محرّك محاسب كلود المُثبَت، مُكيَّفٌ لمعالي. النتيجة اقتراحٌ يُراجعه
//  البشر ويُصحّحه؛ لا تُعتمَد آلياً بذاتها — قواعدُ الشروط السبعة الحتميّة تقرّر.
// ============================================================================

const MODEL = "claude-sonnet-5";

/** أنواع الصور المدعومة في واجهة Anthropic. */
export type InvoiceMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const SYSTEM_PROMPT = `أنت محلّل فواتير خبير لمنصّة محاسبة جمعيّةٍ سعوديّة. تستلم صورة فاتورة شراءٍ وتستخلص بياناتها بدقّة.
أعِد كائن JSON فقط (بدون أي نصٍّ إضافي أو علامات Markdown) بالحقول التالية حرفياً:
{
  "vendorName": string,            // اسم المورّد/المنشأة كما في الفاتورة
  "vendorTaxNumber": string,       // الرقم الضريبي للمورّد (15 رقماً) أو "" إن لم يظهر
  "associationName": string,       // اسم الجهة المشتراة لصالحها (العميل) كما يظهر أو ""
  "associationTaxNumber": string,  // الرقم الضريبي للعميل (15 رقماً) أو ""
  "invoiceNumber": string,         // رقم الفاتورة كما هو مكتوب حرفياً أو "" إن لم يظهر
  "issueDate": string,             // تاريخ الإصدار بصيغة YYYY-MM-DD أو ""
  "lineItems": [ { "description": string, "quantity": number, "unitPrice": number, "total": number } ],
  "vatAmount": number,             // مبلغ ضريبة القيمة المضافة فقط (منفصلاً عن الإجمالي)
  "total": number,                 // الإجمالي النهائي شامل الضريبة
  "isTaxInvoice": boolean          // هل هي "فاتورة ضريبية" (تحمل هذا الوصف صراحةً)؟
}
قواعد صارمة:
- الأرقام الهنديّة العربيّة (٠١٢٣٤٥٦٧٨٩) وأي أرقامٍ فارسيّة حوّلها دائماً إلى أرقامٍ لاتينيّة (0-9) في كل الحقول الرقميّة والنصيّة (الأرقام الضريبيّة، التواريخ، المبالغ، رقم الفاتورة).
- استخرج الأرقام كقيمٍ رقميّة بلا فواصل آلاف أو رموز عملة (مثال: "١٬٢٥٠٫٥٠ ر.س" → 1250.5).
- إن غاب حقلٌ نصّي فاجعله "" (سلسلة فارغة)، والحقول الرقميّة 0.
- تمييز المورّد عن العميل (مهمٌّ جداً — لا تخلط بينهما):
  • المورّد/البائع (vendor): عادةً أعلى الفاتورة، يحمل الشعار والعنوان. الرقم الضريبي المجاور له هو vendorTaxNumber.
  • العميل/المشتري (association): يظهر بعد كلمات «العميل/المشتري/فاتورة إلى/بيانات العميل». الرقم الضريبي المجاور له هو associationTaxNumber.
- الرقم الضريبي السعودي: 15 خانة، يبدأ عادةً بـ«3» وينتهي بـ«3». التقطه بدقّة ولا تخلط بين رقم المورّد ورقم العميل. إن لم يظهر أحدهما فاجعله "".
- رمز QR وحقول هيئة الزكاة والضريبة (ZATCA): إن وُجد نصٌّ من رمز الاستجابة السريعة فاعتمده مصدراً موثوقاً للرقم الضريبي والإجمالي ومبلغ الضريبة عند التعارض مع النصّ المطبوع الباهت.
- "invoiceNumber": انقل رقم الفاتورة كما هو مكتوب حرفياً، مع تحويل أرقامه الهنديّة إلى لاتينيّة، أو "" إن لم يظهر.
- التاريخ "issueDate": أعِده دائماً بصيغة YYYY-MM-DD. إن كان ميلادياً بصيغة يوم/شهر/سنة فحوّله للصيغة القياسيّة. إن كان هجرياً فحوّله تقريبياً إلى الميلادي المقابل. إن تعذّر تحديده بثقة فاجعله "".
- "vatAmount": استخرج قيمة الضريبة المذكورة صراحةً فقط. إن لم تُذكر صراحةً وكانت الفاتورة ضريبيّة بنسبة 15%، احسبها احتياطياً (vatAmount = total × 15 / 115). وإلا اجعلها 0.
- "total" هو الإجمالي النهائي شامل الضريبة (وليس المجموع الفرعي قبل الضريبة). لا تخلط بينهما.
- لا تخترع بيانات؛ اقرأ ما في الصورة فقط. إن كان حقلٌ غير مقروء فاتركه فارغاً بدل التخمين.

صيغة الإخراج (إلزاميّة):
- ردّك بالكامل يجب أن يكون كائن JSON خام واحداً فقط. أول محرفٍ فيه { وآخر محرفٍ }.
- ممنوع منعاً باتاً أي نصٍّ تمهيدي أو ختامي أو شرح أو علامات Markdown أو أسيجة كود.
- ممنوع أي وسوم داخليّة أو نظاميّة (مثل وسوم XML) في ردّك.
- تأكّد أن JSON صالحٌ نحوياً (أقواس وفواصل صحيحة، بلا فاصلةٍ زائدة) وقابلٌ للتحليل مباشرةً بـ JSON.parse.`;

/** يستخلص بيانات الفاتورة من صورة (base64) عبر Claude Vision. */
export async function analyzeInvoice(
  imageBase64: string,
  mediaType: InvoiceMediaType,
): Promise<OcrExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY غير مُهيّأ — لا يمكن تحليل الصورة.");
  }
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4000, // يتّسع لفواتير ببنودٍ كثيرة دون قطع JSON
    // استخلاصٌ حرفيٌّ وحيد الطلقة: نعطّل التفكير للسرعة والكلفة (effort الافتراضي high).
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: "استخرج بيانات هذه الفاتورة وأعِدها بصيغة JSON فقط حسب المخطط المحدّد. ابدأ ردّك بـ { مباشرةً وانتهِ بـ } بلا أي نصٍّ أو شرح أو علامات Markdown.",
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find(b => b.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
  return normalize(parseJson(raw));
}

/** يستخرج JSON حتى لو أحاطته أسيجة Markdown أو نصّ. */
function parseJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as Record<string, unknown>;
    throw new Error("تعذّر تفسير مُخرَجات التحليل كـ JSON.");
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** يضمن مطابقة الشكل الصارم لأنواع النموذج مهما كان مُخرَج النموذج. */
function normalize(o: Record<string, unknown>): OcrExtraction {
  const rawItems = Array.isArray(o.lineItems) ? (o.lineItems as unknown[]) : [];
  const lineItems = rawItems.map(it => {
    const item = (it ?? {}) as Record<string, unknown>;
    const quantity = num(item.quantity) || 1;
    const unitPrice = num(item.unitPrice);
    const total = num(item.total) || quantity * unitPrice;
    return { description: str(item.description), quantity, unitPrice, total };
  });
  const total = num(o.total) || lineItems.reduce((s, i) => s + i.total, 0);
  const isTaxInvoice = o.isTaxInvoice === true;
  const vatAmount = num(o.vatAmount) || (isTaxInvoice && total > 0 ? (total * 15) / 115 : 0);
  return {
    vendorName: str(o.vendorName),
    vendorTaxNumber: str(o.vendorTaxNumber),
    associationName: str(o.associationName),
    associationTaxNumber: str(o.associationTaxNumber),
    invoiceNumber: str(o.invoiceNumber),
    issueDate: str(o.issueDate),
    lineItems,
    vatAmount,
    total,
    isTaxInvoice,
  };
}
