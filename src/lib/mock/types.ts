export type Role = "PRINCE" | "DEPUTY_PRINCE" | "SUPERVISOR" | "BENEFICIARY";
export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Team = {
  id: string;
  name: string;
  color: string;
  badge: string;
  supervisorId: string;
  studentCount: number;
  points: number;
  tagline: string;
  budget?: number;                   // موازنة الفريق (ر.س) — للأمير/نائبه تعديلها (افتراض 0)
  imageDataUrl?: string;             // شعار/صورة مخصَّصة (base64) — يُشتقّ منها اللون تلقائياً
};

export type Committee = {
  id: string;
  name: string;
  supervisorIds: string[];
  description: string;
  color: string;
  budget?: number;                   // موازنة اللجنة (ر.س) — للأمير/نائبه تعديلها (افتراض 0)
  imageDataUrl?: string;             // صورة مخصَّصة (base64) — يُشتقّ منها اللون تلقائياً
};

export type CommitteeTask = {
  id: string;
  committeeId: string;
  title: string;
  assigneeId?: string;               // مشرف اللجنة المخصَّص لها (اختياري)
  done: boolean;
  createdAt: string;
};

/** مهمّةٌ تحفيزيّة/ذاتيّة تُرصَد لطالبٍ بعينه، ولكلّ مهمّةٍ نقاطٌ محفِّزة. */
export type StudentTask = {
  id: string;
  studentId: string;
  title: string;
  points: number;                    // النقاط التحفيزيّة عند الإنجاز
  assignedBy?: string;               // مُعرِّف مَن رصد المهمّة (مشرف/أمير)
  visible: boolean;                  // إظهار/إخفاء عن الطالب
  dueDate?: string;                  // موعدٌ نهائيّ اختياري
  done: boolean;
  createdAt: string;
};

export type Supervisor = {
  id: string;
  name: string;
  nationalIdMasked: string;          // قناعٌ عشوائيّ قديم (لا يُعتمد عليه) — للتوافق فقط
  nationalId?: string;               // رقم الهوية الحقيقيّ — للأمير/نائبه فقط
  phone: string;
  email: string;
  accessCode?: string;               // رمز دخول المشرف — يظهر للأمير
  teamIds: string[];
  committeeIds: string[];
  permissions: string[];             // البند ١٨: صلاحيات دقيقة يمنحها الأمير لكلّ مشرف
  photoDataUrl?: string;             // صورةٌ شخصيّة (base64) — تُعرَض في صفحة «المشرفون»
  specialty?: string;                // التخصُّص/المجال — يُعرَض في صفحة «المشرفون»
};

/** البند ١٨: كتالوج الصلاحيات الدقيقة الممنوحة للمشرفين.
 *  كلّ صلاحيةٍ تفتح للمشرف قسماً إدارياً إضافياً في القائمة الجانبيّة. */
export const SUPERVISOR_PERMISSIONS = [
  { key: "invoices",   label: "إضافة الفواتير", href: "/invoices" },
  { key: "students",   label: "إدارة الشباب",    href: "/students" },
  { key: "teams",      label: "إدارة الفرق",     href: "/teams" },
  { key: "committees", label: "إدارة اللجان",    href: "/committees" },
] as const;

export type SupervisorPermission = (typeof SUPERVISOR_PERMISSIONS)[number]["key"];

export type Student = {
  id: string;
  name: string;
  nationalIdMasked: string;          // قناعٌ عشوائيّ قديم (لا يُعتمد عليه) — للتوافق فقط
  nationalId?: string;               // رقم الهوية الحقيقيّ الذي يُدخله الطالب عند التسجيل
  phone: string;
  grade: string;
  section: "ريادة" | "علو" | "قيادة";
  teamId: string;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  totalAmount: number;
  points: number;
  emergencyContact: string;
  emergencyPhone: string;
  attendance: number; // 0-100
  approvalStatus?: ApprovalStatus;   // undefined = legacy APPROVED
  registeredAt?: string;             // ISO date, for waitlist ordering
  photoDataUrl?: string;             // base64 data URL, uploaded after first login
  accessCode?: string;               // hashed access code sent via WhatsApp
  receiptDataUrl?: string;           // إيصال السداد المرفوع (base64) — بانتظار اعتماد الأمير
  receiptStatus?: "PENDING" | "APPROVED" | "REJECTED"; // حالة مراجعة الإيصال
  receiptAmount?: number;            // المبلغ المُصرَّح به في الإيصال
  receiptSubmittedAt?: string;       // ISO date لرفع الإيصال
  regAnswers?: Record<string, string>; // إجابات حقول التسجيل المخصّصة (مفتاح الحقل → الإجابة)
};

/** بندٌ واحدٌ في الفاتورة (وصف/كميّة/سعر/إجمالي). */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** الاستخلاص الخام من صورة الفاتورة (اقتراحٌ قابلٌ للتصحيح — لا يُعتمَد آلياً). */
export interface OcrExtraction {
  vendorName: string;
  vendorTaxNumber: string;
  associationName: string;
  associationTaxNumber: string;
  invoiceNumber: string;
  issueDate: string;            // YYYY-MM-DD
  lineItems: InvoiceLineItem[];
  vatAmount: number;
  total: number;
  isTaxInvoice: boolean;
}

/** تقييم الشروط السبعة لصحّة الفاتورة الضريبيّة. */
export interface SevenConditions {
  taxInvoice: boolean;           // ١) فاتورة ضريبيّة
  associationName: boolean;      // ٢) اسم الجمعية الصحيح
  associationTaxNumber: boolean; // ٣) الرقم الضريبي للجمعية
  vendorTaxNumber: boolean;      // ٤) الرقم الضريبي للمنشأة (المورّد)
  issueDate: boolean;            // ٥) تاريخ إصدار الفاتورة
  serviceDetails: boolean;       // ٦) تفاصيل الخدمة أو المنتج
  quantityAndTotal: boolean;     // ٧) الكميّة والسعر الإجمالي
}

/** سياسة الشروط: true = هذا الشرط «إلزاميّ» للجمعية، false = «غير مُفعّل» (يُتجاهَل). */
export type ConditionsPolicy = SevenConditions;

export type Invoice = {
  id: string;
  code: string;
  vendor: string;
  purpose: string;
  scope: { kind: "team"; teamId: string } | { kind: "committee"; committeeId: string } | { kind: "event" };
  amount: number;
  vat: number;
  date: string;
  //  «معتمدة» (approved): اجتازت الشروط الإلزاميّة فاعتُمِدت تلقائياً.
  //  «معلّقة» (pending): اختلّ شرطٌ فرُفِعت لمراجعة الأمير.
  status: "paid" | "pending" | "overdue" | "approved";
  extractedByAI: boolean;
  lineItems?: InvoiceLineItem[];       // بنود الفاتورة المُستخرَجة
  conditions?: SevenConditions;        // تقييم الشروط (مُثبَّت خادميّاً)
  vendorTaxNumber?: string;            // الرقم الضريبي للمورّد
  associationName?: string;            // اسم الجمعية المُستخرَج (للمراجعة)
  associationTaxNumber?: string;       // الرقم الضريبي للجمعية المُستخرَج
  invoiceNumber?: string;              // رقم الفاتورة المُستخرَج
  uploadedBy?: string;                 // مُعرِّف المشرف الرافع
  submittedAt?: string;                // ISO date للإرسال
  hasImage?: boolean;                  // صورةٌ مرفوعة تُخدَم عبر مسارٍ مستقلّ
};
