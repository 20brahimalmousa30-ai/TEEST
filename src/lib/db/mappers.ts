import type { Team, Student, Supervisor, Committee, Invoice, StudentTask } from "@/lib/mock/types";
import type { RegField } from "@/lib/store/StoreProvider";

/**
 * محوّلات بين صفوف قاعدة البيانات (snake_case) وأنواع التطبيق (camelCase).
 * تُبقي بقيّة الشيفرة كما هي دون أن تعرف تفاصيل التخزين.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const rowToTeam = (r: any): Team => ({
  id: r.id,
  name: r.name,
  color: r.color,
  badge: r.badge,
  supervisorId: r.supervisor_id ?? "",
  studentCount: r.student_count ?? 0,
  points: r.points ?? 0,
  tagline: r.tagline ?? "",
  budget: r.budget ?? 0,
  imageDataUrl: r.image_data_url ?? undefined,
});

export const teamToRow = (t: Partial<Team>) => ({
  ...(t.id !== undefined && { id: t.id }),
  ...(t.name !== undefined && { name: t.name }),
  ...(t.color !== undefined && { color: t.color }),
  ...(t.badge !== undefined && { badge: t.badge }),
  ...(t.supervisorId !== undefined && { supervisor_id: t.supervisorId || null }),
  ...(t.studentCount !== undefined && { student_count: t.studentCount }),
  ...(t.points !== undefined && { points: t.points }),
  ...(t.tagline !== undefined && { tagline: t.tagline }),
  ...(t.budget !== undefined && { budget: t.budget }),
  ...(t.imageDataUrl !== undefined && { image_data_url: t.imageDataUrl }),
});

// supervisorIds لم يعد عموداً — يُشتقّ من supervisor_assignments في loadAllData.
export const rowToCommittee = (r: any): Committee => ({
  id: r.id,
  name: r.name,
  supervisorIds: [],
  description: r.description ?? "",
  color: r.color,
  budget: r.budget ?? 0,
  imageDataUrl: r.image_data_url ?? undefined,
});

export const committeeToRow = (c: Partial<Committee>) => ({
  ...(c.id !== undefined && { id: c.id }),
  ...(c.name !== undefined && { name: c.name }),
  ...(c.description !== undefined && { description: c.description }),
  ...(c.color !== undefined && { color: c.color }),
  ...(c.budget !== undefined && { budget: c.budget }),
  ...(c.imageDataUrl !== undefined && { image_data_url: c.imageDataUrl }),
});

// teamIds/committeeIds لم تعد أعمدة — تُشتقّ من supervisor_assignments في loadAllData.
export const rowToSupervisor = (r: any): Supervisor => ({
  id: r.id,
  name: r.name,
  nationalIdMasked: r.national_id_masked ?? "",
  nationalId: r.national_id ?? undefined,
  phone: r.phone ?? "",
  email: r.email ?? "",
  accessCode: r.access_code ?? undefined,
  teamIds: [],
  committeeIds: [],
  permissions: r.permissions ?? [],
  photoDataUrl: r.photo_data_url ?? undefined,
  specialty: r.specialty ?? undefined,
});

export const supervisorToRow = (s: Partial<Supervisor>) => ({
  ...(s.id !== undefined && { id: s.id }),
  ...(s.name !== undefined && { name: s.name }),
  ...(s.nationalIdMasked !== undefined && { national_id_masked: s.nationalIdMasked }),
  ...(s.nationalId !== undefined && { national_id: s.nationalId }),
  ...(s.phone !== undefined && { phone: s.phone }),
  ...(s.email !== undefined && { email: s.email }),
  ...(s.accessCode !== undefined && { access_code: s.accessCode }),
  ...(s.permissions !== undefined && { permissions: s.permissions }),
  ...(s.photoDataUrl !== undefined && { photo_data_url: s.photoDataUrl }),
  ...(s.specialty !== undefined && { specialty: s.specialty }),
});

export const rowToStudentTask = (r: any): StudentTask => ({
  id: r.id,
  studentId: r.student_id,
  title: r.title,
  points: r.points ?? 0,
  assignedBy: r.assigned_by ?? undefined,
  visible: r.visible ?? true,
  dueDate: r.due_date ?? undefined,
  done: r.done ?? false,
  kind: (r.kind ?? "activity") as StudentTask["kind"],
  batchId: r.batch_id ?? undefined,
  scopeLabel: r.scope_label ?? undefined,
  expiresAt: r.expires_at ?? undefined,
  createdAt: r.created_at ?? "",
});

export const rowToStudent = (r: any): Student => ({
  id: r.id,
  name: r.name,
  nationalIdMasked: r.national_id_masked ?? "",
  nationalId: r.national_id ?? undefined,
  phone: r.phone ?? "",
  grade: r.grade ?? "",
  section: r.section,
  teamId: r.team_id ?? "",
  paymentStatus: r.payment_status,
  paidAmount: r.paid_amount ?? 0,
  totalAmount: r.total_amount ?? 0,
  points: r.points ?? 0,
  emergencyContact: r.emergency_contact ?? "",
  emergencyPhone: r.emergency_phone ?? "",
  attendance: r.attendance ?? 100,
  approvalStatus: r.approval_status ?? undefined,
  registeredAt: r.registered_at ?? undefined,
  photoDataUrl: r.photo_data_url ?? undefined,
  accessCode: r.access_code ?? undefined,
  receiptDataUrl: r.receipt_data_url ?? undefined,
  receiptStatus: r.receipt_status ?? undefined,
  receiptAmount: r.receipt_amount ?? undefined,
  receiptSubmittedAt: r.receipt_submitted_at ?? undefined,
  regAnswers: r.reg_answers ?? undefined,
  deletedAt: r.deleted_at ?? undefined,
});

export const studentToRow = (s: Partial<Student>) => ({
  ...(s.id !== undefined && { id: s.id }),
  ...(s.name !== undefined && { name: s.name }),
  ...(s.nationalIdMasked !== undefined && { national_id_masked: s.nationalIdMasked }),
  ...(s.nationalId !== undefined && { national_id: s.nationalId }),
  ...(s.phone !== undefined && { phone: s.phone }),
  ...(s.grade !== undefined && { grade: s.grade }),
  ...(s.section !== undefined && { section: s.section }),
  ...(s.teamId !== undefined && { team_id: s.teamId }),
  ...(s.paymentStatus !== undefined && { payment_status: s.paymentStatus }),
  ...(s.paidAmount !== undefined && { paid_amount: s.paidAmount }),
  ...(s.totalAmount !== undefined && { total_amount: s.totalAmount }),
  ...(s.points !== undefined && { points: s.points }),
  ...(s.emergencyContact !== undefined && { emergency_contact: s.emergencyContact }),
  ...(s.emergencyPhone !== undefined && { emergency_phone: s.emergencyPhone }),
  ...(s.attendance !== undefined && { attendance: s.attendance }),
  ...(s.approvalStatus !== undefined && { approval_status: s.approvalStatus }),
  ...(s.registeredAt !== undefined && { registered_at: s.registeredAt }),
  ...(s.photoDataUrl !== undefined && { photo_data_url: s.photoDataUrl }),
  ...(s.accessCode !== undefined && { access_code: s.accessCode }),
  ...(s.receiptDataUrl !== undefined && { receipt_data_url: s.receiptDataUrl }),
  ...(s.receiptStatus !== undefined && { receipt_status: s.receiptStatus }),
  ...(s.receiptAmount !== undefined && { receipt_amount: s.receiptAmount }),
  ...(s.receiptSubmittedAt !== undefined && { receipt_submitted_at: s.receiptSubmittedAt }),
  ...(s.regAnswers !== undefined && { reg_answers: s.regAnswers }),
  ...(s.deletedAt !== undefined && { deleted_at: s.deletedAt }),
});

export const rowToInvoice = (r: any): Invoice => ({
  id: r.id,
  code: r.code,
  vendor: r.vendor ?? "",
  purpose: r.purpose ?? "",
  scope: r.scope,
  amount: r.amount ?? 0,
  vat: r.vat ?? 15,
  date: r.date ?? "",
  status: r.status,
  extractedByAI: r.extracted_by_ai ?? false,
  lineItems: r.line_items ?? undefined,
  conditions: r.conditions ?? undefined,
  vendorTaxNumber: r.vendor_tax_number ?? undefined,
  invoiceNumber: r.invoice_number ?? undefined,
  uploadedBy: r.uploaded_by ?? undefined,
  submittedAt: r.submitted_at ?? undefined,
  //  اللقطة الجماعيّة تستبعد image_data_url؛ نحسب علماً بوجود صورة فقط.
  hasImage: !!(r.has_image ?? (r.image_data_url != null && r.image_data_url !== "")),
});

export const invoiceToRow = (i: Partial<Invoice>) => ({
  ...(i.id !== undefined && { id: i.id }),
  ...(i.code !== undefined && { code: i.code }),
  ...(i.vendor !== undefined && { vendor: i.vendor }),
  ...(i.purpose !== undefined && { purpose: i.purpose }),
  ...(i.scope !== undefined && { scope: i.scope }),
  ...(i.amount !== undefined && { amount: i.amount }),
  ...(i.vat !== undefined && { vat: i.vat }),
  ...(i.date !== undefined && { date: i.date }),
  ...(i.status !== undefined && { status: i.status }),
  ...(i.extractedByAI !== undefined && { extracted_by_ai: i.extractedByAI }),
  ...(i.lineItems !== undefined && { line_items: i.lineItems }),
  ...(i.conditions !== undefined && { conditions: i.conditions }),
  ...(i.vendorTaxNumber !== undefined && { vendor_tax_number: i.vendorTaxNumber }),
  ...(i.invoiceNumber !== undefined && { invoice_number: i.invoiceNumber }),
  ...(i.uploadedBy !== undefined && { uploaded_by: i.uploadedBy }),
  ...(i.submittedAt !== undefined && { submitted_at: i.submittedAt }),
});

export const rowToRegField = (r: any): RegField => ({
  key: r.key,
  label: r.label,
  type: r.type,
  required: r.required,
  active: r.active,
  desc: r.descr ?? "",
});
