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
};

export type Committee = {
  id: string;
  name: string;
  supervisorIds: string[];
  description: string;
  color: string;
};

export type Supervisor = {
  id: string;
  name: string;
  nationalIdMasked: string;
  phone: string;
  email: string;
  teamIds: string[];
  committeeIds: string[];
};

export type Student = {
  id: string;
  name: string;
  nationalIdMasked: string;
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
