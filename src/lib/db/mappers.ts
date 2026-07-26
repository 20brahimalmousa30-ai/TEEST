import type { Team, Student, Supervisor, Committee, Invoice } from "@/lib/mock/types";
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
});

// supervisorIds لم يعد عموداً — يُشتقّ من supervisor_assignments في loadAllData.
export const rowToCommittee = (r: any): Committee => ({
  id: r.id,
  name: r.name,
  supervisorIds: [],
  description: r.description ?? "",
  color: r.color,
});

export const committeeToRow = (c: Partial<Committee>) => ({
  ...(c.id !== undefined && { id: c.id }),
  ...(c.name !== undefined && { name: c.name }),
  ...(c.description !== undefined && { description: c.description }),
  ...(c.color !== undefined && { color: c.color }),
});

// teamIds/committeeIds لم تعد أعمدة — تُشتقّ من supervisor_assignments في loadAllData.
export const rowToSupervisor = (r: any): Supervisor => ({
  id: r.id,
  name: r.name,
  nationalIdMasked: r.national_id_masked ?? "",
  phone: r.phone ?? "",
  email: r.email ?? "",
  teamIds: [],
  committeeIds: [],
});

export const supervisorToRow = (s: Partial<Supervisor>) => ({
  ...(s.id !== undefined && { id: s.id }),
  ...(s.name !== undefined && { name: s.name }),
  ...(s.nationalIdMasked !== undefined && { national_id_masked: s.nationalIdMasked }),
  ...(s.phone !== undefined && { phone: s.phone }),
  ...(s.email !== undefined && { email: s.email }),
});

export const rowToStudent = (r: any): Student => ({
  id: r.id,
  name: r.name,
  nationalIdMasked: r.national_id_masked ?? "",
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
});

export const studentToRow = (s: Partial<Student>) => ({
  ...(s.id !== undefined && { id: s.id }),
  ...(s.name !== undefined && { name: s.name }),
  ...(s.nationalIdMasked !== undefined && { national_id_masked: s.nationalIdMasked }),
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
});

export const rowToRegField = (r: any): RegField => ({
  key: r.key,
  label: r.label,
  type: r.type,
  required: r.required,
  active: r.active,
  desc: r.descr ?? "",
});
