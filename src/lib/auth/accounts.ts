import type { Role } from "@/lib/mock/types";

export type DemoAccount = {
  /** Login identifier — Saudi mobile number */
  phone: string;
  /** Fixed access code (in production this must be hashed server-side) */
  code: string;
  name: string;
  role: Role;
  isOwner?: boolean;
  /** For SUPERVISOR: link to their supervisor record */
  supervisorId?: string;
  /** For BENEFICIARY: link to their student record */
  studentId?: string;
  /** Where to land after login */
  landing: string;
};

/** Normalise a Saudi mobile to bare digits for comparison (05XXXXXXXX / +9665XXXXXXXX / 9665XXXXXXXX). */
const normalizePhone = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("966")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d; // 5XXXXXXXX
};

export const accounts: DemoAccount[] = [
  {
    phone: "0559570829",
    code: "740318",
    name: "الأمير",
    role: "PRINCE",
    isOwner: true,
    landing: "/dashboard",
  },
];

export const findAccountByPhone = (phone: string) => {
  const target = normalizePhone(phone);
  return accounts.find(a => normalizePhone(a.phone) === target);
};

export type Session = {
  phone: string;
  name: string;
  role: Role;
  isOwner?: boolean;
  supervisorId?: string;
  studentId?: string;
};

export const roleLabel: Record<Role, string> = {
  PRINCE: "الأمير",
  DEPUTY_PRINCE: "نائب الأمير",
  SUPERVISOR: "المشرف",
  BENEFICIARY: "الشاب",
};
