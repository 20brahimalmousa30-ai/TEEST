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
  imageDataUrl?: string;             // شعار/صورة مخصَّصة (base64) — يُشتقّ منها اللون تلقائياً
};

export type Committee = {
  id: string;
  name: string;
  supervisorIds: string[];
  description: string;
  color: string;
  imageDataUrl?: string;             // صورة مخصَّصة (base64) — يُشتقّ منها اللون تلقائياً
};

export type Supervisor = {
  id: string;
  name: string;
  nationalIdMasked: string;
  phone: string;
  email: string;
  accessCode?: string;               // رمز دخول المشرف — يظهر للأمير
  teamIds: string[];
  committeeIds: string[];
  permissions: string[];             // البند ١٨: صلاحيات دقيقة يمنحها الأمير لكلّ مشرف
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

export type Invoice = {
  id: string;
  code: string;
  vendor: string;
  purpose: string;
  scope: { kind: "team"; teamId: string } | { kind: "committee"; committeeId: string } | { kind: "event" };
  amount: number;
  vat: number;
  date: string;
  status: "paid" | "pending" | "overdue";
  extractedByAI: boolean;
};
