import type { Role } from "@/lib/mock/types";

export type DemoAccount = {
  email: string;
  password: string;
  name: string;
  role: Role;
  isOwner?: boolean;
  /** For SUPERVISOR: link to their supervisor record */
  supervisorId?: string;
  /** For BENEFICIARY: link to their student record */
  studentId?: string;
  /** Where to land after login */
  landing: string;
  /** Short description shown on the login page */
  description: string;
  /** Chip colour for the role card */
  color: string;
};

export const demoAccounts: DemoAccount[] = [
  {
    email: "owner@maali.abha",
    password: "1448",
    name: "الأمير الأصل — عبدالله السعدي",
    role: "PRINCE",
    isOwner: true,
    landing: "/dashboard",
    description: "صاحب الصلاحيّة الكاملة. الوحيد الذي يعيّن الأمراء وينقل الملكيّة.",
    color: "#1E4635",
  },
  {
    email: "deputy@maali.abha",
    password: "1448",
    name: "نائب الأمير — سليمان القحطاني",
    role: "DEPUTY_PRINCE",
    landing: "/dashboard",
    description: "إدارةٌ كاملة للفعاليّة عدا القرارات الجذريّة المحصورة بالأصل.",
    color: "#2A5C48",
  },
  {
    email: "supervisor@maali.abha",
    password: "1448",
    name: "المشرف — أحمد الشهري",
    role: "SUPERVISOR",
    supervisorId: "s1",
    landing: "/my-team",
    description: "يُشرف على فريق المرتفعات، وعضوٌ في لجنة السلامة. يرى ما يخصّه فقط.",
    color: "#B8955A",
  },
  {
    email: "student@maali.abha",
    password: "1448",
    name: "الشاب — محمد الشهري",
    role: "BENEFICIARY",
    studentId: "st001",
    landing: "/me",
    description: "طالبٌ في فريق المرتفعات. يرى بياناته وحالة سداده فقط.",
    color: "#4E6B7A",
  },
];

export const findAccountByEmail = (email: string) =>
  demoAccounts.find(a => a.email.toLowerCase() === email.trim().toLowerCase());

export type Session = {
  email: string;
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
