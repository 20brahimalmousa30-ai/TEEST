"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Team, Student, Supervisor, Committee, Invoice, PaymentStatus } from "@/lib/mock/types";
import {
  loadAllData,
  dbAddTeam, dbUpdateTeam, dbDeleteTeam,
  dbAddStudent, dbRegisterStudent, dbApproveStudent, dbRejectStudent,
  dbUpdateStudent, dbDeleteStudent, dbMoveStudent, dbSetPayment, dbSetStudentPhoto,
  dbAddSupervisor, dbUpdateSupervisor, dbDeleteSupervisor,
  dbAddCommittee, dbUpdateCommittee, dbDeleteCommittee,
  dbAddInvoice, dbApproveInvoice, dbDeleteInvoice, dbRestoreInvoice,
  dbToggleRegField, dbReorderRegField, dbAddRegField, dbRemoveRegField, dbSetRegOpen,
  dbToggleAttendance, dbSetLogoDisplayMode, dbResetAll,
} from "@/lib/db/data";

export type RegField = {
  key: string; label: string; type: string; required: boolean; active: boolean; desc: string;
};

const initialFields: RegField[] = [
  { key: "name",    label: "الاسم الكامل",     type: "نص",      required: true,  active: true,  desc: "اسمُ الطالب رباعياً كما في الهويّة." },
  { key: "nid",     label: "رقم الهويّة",       type: "رقم",     required: true,  active: true,  desc: "يُخزَّن مشفَّراً — لا يظهر كاملاً إلاّ للأمير الأصل." },
  { key: "phone",   label: "الجوّال",          type: "هاتف",    required: true,  active: true,  desc: "رقم واتساب مُفضَّل، للتواصل مع الطالب مباشرة." },
  { key: "grade",   label: "الصف الدراسي",     type: "قائمة",   required: true,  active: true,  desc: "من قائمة: أوّل/ثاني/ثالث ثانوي." },
  { key: "section", label: "القسم المفضَّل",   type: "قائمة",   required: false, active: true,  desc: "ريادة/علو/قيادة — لتوزيعٍ مبدئي." },
  { key: "photo",   label: "الصورة الشخصيّة", type: "ملف",      required: false, active: true,  desc: "بحدٍّ أقصى ٥ ميغا." },
  { key: "emergN",  label: "اسم جهة الطوارئ", type: "نص",      required: true,  active: true,  desc: "الأب/الأم/الوليّ." },
  { key: "emergP",  label: "رقم الطوارئ",     type: "هاتف",    required: true,  active: true,  desc: "متاح ٢٤ ساعة أثناء الرحلة." },
  { key: "health",  label: "الحالة الصحيّة",  type: "نص طويل", required: false, active: true,  desc: "أمراض مزمنة، حساسيّة دواء، غذاء خاص." },
  { key: "notes",   label: "ملاحظات أخرى",    type: "نص طويل", required: false, active: false, desc: "معلومات إضافيّة (اختياري)." },
];

export type LogoDisplayMode = "VISIBLE" | "BLURRED" | "HIDDEN";

export type State = {
  teams:        Team[];
  students:     Student[];
  supervisors:  Supervisor[];
  committees:   Committee[];
  invoices:     Invoice[];
  regFields:    RegField[];
  regOpen:      boolean;
  /** id -> daily flags (index 0..7 for the 8 days) */
  attendance:   Record<string, boolean[]>;
  /** invoices moved to trash */
  trashInvoices: Invoice[];
  /** site-wide logo visibility, controlled by the Prince (settings) */
  logoDisplayMode: LogoDisplayMode;
};

const initialState: State = {
  teams:        [],
  students:     [],
  supervisors:  [],
  committees:   [],
  invoices:     [],
  regFields:    initialFields,
  regOpen:      true,
  attendance:   {},
  trashInvoices: [],
  logoDisplayMode: "VISIBLE",
};

export type StoreActions = {
  // Teams
  addTeam(name: string, color: string, badge: string, supervisorId: string, tagline: string): void;
  updateTeam(id: string, patch: Partial<Team>): void;
  deleteTeam(id: string): void;
  // Students
  addStudent(input: Omit<Student, "id" | "nationalIdMasked" | "points" | "attendance">): void;
  /** Public registration path — always creates an APPROVAL-pending record */
  registerStudent(input: { name: string; phone: string; grade: string; section: Student["section"]; emergencyContact: string; emergencyPhone: string }): Student;
  approveStudent(id: string, teamId: string): void;
  rejectStudent(id: string): void;
  updateStudent(id: string, patch: Partial<Student>): void;
  deleteStudent(id: string): void;
  moveStudent(id: string, newTeamId: string): void;
  setPayment(id: string, status: PaymentStatus, paid: number): void;
  setStudentPhoto(id: string, dataUrl: string): void;
  // Supervisors
  addSupervisor(name: string, phone: string, email: string, teamIds: string[], committeeIds: string[]): void;
  updateSupervisor(id: string, patch: Partial<Supervisor>): void;
  deleteSupervisor(id: string): void;
  // Committees
  addCommittee(name: string, description: string, supervisorIds: string[], color: string): void;
  updateCommittee(id: string, patch: Partial<Committee>): void;
  deleteCommittee(id: string): void;
  // Invoices
  addInvoice(input: Omit<Invoice, "id" | "code">): void;
  approveInvoice(id: string): void;
  deleteInvoice(id: string): void;
  restoreInvoice(id: string): void;
  // Registration
  toggleRegField(key: string): void;
  reorderRegField(key: string, dir: "up" | "down"): void;
  addRegField(field: Omit<RegField, "active">): void;
  removeRegField(key: string): void;
  setRegOpen(open: boolean): void;
  // Attendance
  toggleAttendance(studentId: string, day: number): void;
  // Logo display (Prince only)
  setLogoDisplayMode(mode: LogoDisplayMode): void;
  // Reset
  resetAll(): void;
};

type Store = State & StoreActions & { hydrated: boolean };

const StoreContext = createContext<Store | null>(null);

const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [hydrated, setHydrated] = useState(false);

  // يجلب اللقطة الكاملة من قاعدة البيانات ويستبدل بها الحالة المحلّيّة.
  const reload = useCallback(async () => {
    try {
      const fresh = await loadAllData();
      setState(fresh);
    } catch (e) {
      console.error("تعذّر تحميل البيانات من قاعدة البيانات:", e);
    }
  }, []);

  // تحميل أوّلي من قاعدة البيانات عند الإقلاع.
  useEffect(() => {
    reload().finally(() => setHydrated(true));
  }, [reload]);

  // تحديثٌ متفائل فوري للحالة المحلّيّة (استجابة سريعة قبل تأكيد الخادم).
  const update = useCallback((patch: Partial<State> | ((s: State) => Partial<State>)) => {
    setState(cur => ({ ...cur, ...(typeof patch === "function" ? patch(cur) : patch) }));
  }, []);

  // يُنفّذ عمليّة الكتابة على قاعدة البيانات ثم يُعيد المزامنة مع الخادم.
  const persist = useCallback((run: () => Promise<unknown>) => {
    run().then(reload).catch(e => {
      console.error("تعذّرت مزامنة التغيير مع قاعدة البيانات:", e);
      reload();
    });
  }, [reload]);

  const actions: StoreActions = useMemo(() => ({
    addTeam(name, color, badge, supervisorId, tagline) {
      update(s => ({
        teams: [...s.teams, { id: uid("t"), name, color, badge, supervisorId, tagline, studentCount: 0, points: 0 }],
      }));
      persist(() => dbAddTeam(name, color, badge, supervisorId, tagline));
    },
    updateTeam(id, patch) {
      update(s => ({ teams: s.teams.map(t => t.id === id ? { ...t, ...patch } : t) }));
      persist(() => dbUpdateTeam(id, patch));
    },
    deleteTeam(id) {
      update(s => ({
        teams: s.teams.filter(t => t.id !== id),
        students: s.students.filter(st => st.teamId !== id),
      }));
      persist(() => dbDeleteTeam(id));
    },

    addStudent(input) {
      const id = uid("st");
      update(s => ({
        students: [...s.students, {
          ...input,
          id,
          nationalIdMasked: "••••••" + Math.floor(1000 + Math.random() * 8999),
          points: 0,
          attendance: 100,
          approvalStatus: "APPROVED",
        }],
        teams: s.teams.map(t => t.id === input.teamId ? { ...t, studentCount: t.studentCount + 1 } : t),
      }));
      persist(() => dbAddStudent(input));
    },
    registerStudent(input) {
      const id = uid("st");
      const record: Student = {
        id,
        name: input.name,
        phone: input.phone,
        grade: input.grade,
        section: input.section,
        teamId: "",                       // unassigned until approval
        paymentStatus: "PENDING",
        paidAmount: 0,
        totalAmount: 2500,
        emergencyContact: input.emergencyContact,
        emergencyPhone: input.emergencyPhone,
        nationalIdMasked: "••••••" + Math.floor(1000 + Math.random() * 8999),
        points: 0,
        attendance: 100,
        approvalStatus: "PENDING",
        registeredAt: new Date().toISOString(),
      };
      update(s => ({ students: [...s.students, record] }));
      persist(() => dbRegisterStudent(input));
      return record;
    },
    approveStudent(id, teamId) {
      update(s => {
        const st = s.students.find(x => x.id === id);
        if (!st) return {};
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        return {
          students: s.students.map(x => x.id === id ? { ...x, approvalStatus: "APPROVED", teamId, accessCode: code } : x),
          teams: teamId ? s.teams.map(t => t.id === teamId ? { ...t, studentCount: t.studentCount + 1 } : t) : s.teams,
        };
      });
      persist(() => dbApproveStudent(id, teamId));
    },
    rejectStudent(id) {
      update(s => ({ students: s.students.map(x => x.id === id ? { ...x, approvalStatus: "REJECTED" } : x) }));
      persist(() => dbRejectStudent(id));
    },
    setStudentPhoto(id, dataUrl) {
      update(s => ({ students: s.students.map(x => x.id === id ? { ...x, photoDataUrl: dataUrl } : x) }));
      persist(() => dbSetStudentPhoto(id, dataUrl));
    },
    updateStudent(id, patch) {
      update(s => ({ students: s.students.map(st => st.id === id ? { ...st, ...patch } : st) }));
      persist(() => dbUpdateStudent(id, patch));
    },
    deleteStudent(id) {
      update(s => {
        const st = s.students.find(x => x.id === id);
        return {
          students: s.students.filter(x => x.id !== id),
          teams: st ? s.teams.map(t => t.id === st.teamId ? { ...t, studentCount: Math.max(0, t.studentCount - 1) } : t) : s.teams,
        };
      });
      persist(() => dbDeleteStudent(id));
    },
    moveStudent(id, newTeamId) {
      update(s => {
        const st = s.students.find(x => x.id === id);
        if (!st || st.teamId === newTeamId) return {};
        const oldTeamId = st.teamId;
        return {
          students: s.students.map(x => x.id === id ? { ...x, teamId: newTeamId } : x),
          teams: s.teams.map(t =>
            t.id === oldTeamId ? { ...t, studentCount: Math.max(0, t.studentCount - 1) } :
            t.id === newTeamId ? { ...t, studentCount: t.studentCount + 1 } : t
          ),
        };
      });
      persist(() => dbMoveStudent(id, newTeamId));
    },
    setPayment(id, status, paid) {
      update(s => ({ students: s.students.map(st => st.id === id ? { ...st, paymentStatus: status, paidAmount: paid } : st) }));
      persist(() => dbSetPayment(id, status, paid));
    },

    addSupervisor(name, phone, email, teamIds, committeeIds) {
      update(s => ({
        supervisors: [...s.supervisors, {
          id: uid("s"), name, phone, email, teamIds, committeeIds,
          nationalIdMasked: "••••••" + Math.floor(1000 + Math.random() * 8999),
        }],
      }));
      persist(() => dbAddSupervisor(name, phone, email, teamIds, committeeIds));
    },
    updateSupervisor(id, patch) {
      update(s => ({ supervisors: s.supervisors.map(x => x.id === id ? { ...x, ...patch } : x) }));
      persist(() => dbUpdateSupervisor(id, patch));
    },
    deleteSupervisor(id) {
      update(s => ({ supervisors: s.supervisors.filter(x => x.id !== id) }));
      persist(() => dbDeleteSupervisor(id));
    },

    addCommittee(name, description, supervisorIds, color) {
      update(s => ({
        committees: [...s.committees, { id: uid("c"), name, description, supervisorIds, color }],
      }));
      persist(() => dbAddCommittee(name, description, supervisorIds, color));
    },
    updateCommittee(id, patch) {
      update(s => ({ committees: s.committees.map(x => x.id === id ? { ...x, ...patch } : x) }));
      persist(() => dbUpdateCommittee(id, patch));
    },
    deleteCommittee(id) {
      update(s => ({ committees: s.committees.filter(x => x.id !== id) }));
      persist(() => dbDeleteCommittee(id));
    },

    addInvoice(input) {
      const nextNo = String(1000 + Math.floor(Math.random() * 8999));
      update(s => ({
        invoices: [{ ...input, id: uid("inv"), code: `INV-1448-${nextNo}` }, ...s.invoices],
      }));
      persist(() => dbAddInvoice(input));
    },
    approveInvoice(id) {
      update(s => ({ invoices: s.invoices.map(i => i.id === id ? { ...i, status: "paid" } : i) }));
      persist(() => dbApproveInvoice(id));
    },
    deleteInvoice(id) {
      update(s => {
        const inv = s.invoices.find(i => i.id === id);
        return {
          invoices: s.invoices.filter(i => i.id !== id),
          trashInvoices: inv ? [inv, ...s.trashInvoices] : s.trashInvoices,
        };
      });
      persist(() => dbDeleteInvoice(id));
    },
    restoreInvoice(id) {
      update(s => {
        const inv = s.trashInvoices.find(i => i.id === id);
        return {
          invoices: inv ? [inv, ...s.invoices] : s.invoices,
          trashInvoices: s.trashInvoices.filter(i => i.id !== id),
        };
      });
      persist(() => dbRestoreInvoice(id));
    },

    toggleRegField(key) {
      update(s => ({ regFields: s.regFields.map(f => f.key === key ? { ...f, active: !f.active } : f) }));
      persist(() => dbToggleRegField(key));
    },
    reorderRegField(key, dir) {
      update(s => {
        const idx = s.regFields.findIndex(f => f.key === key);
        if (idx < 0) return {};
        const swap = dir === "up" ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= s.regFields.length) return {};
        const next = s.regFields.slice();
        [next[idx], next[swap]] = [next[swap], next[idx]];
        return { regFields: next };
      });
      persist(() => dbReorderRegField(key, dir));
    },
    addRegField(field) {
      update(s => ({ regFields: [...s.regFields, { ...field, active: true }] }));
      persist(() => dbAddRegField(field));
    },
    removeRegField(key) {
      update(s => ({ regFields: s.regFields.filter(f => f.key !== key) }));
      persist(() => dbRemoveRegField(key));
    },
    setRegOpen(open) {
      update({ regOpen: open });
      persist(() => dbSetRegOpen(open));
    },

    toggleAttendance(studentId, day) {
      update(s => {
        const current = s.attendance[studentId] ?? [true, true, true, true, true, false, false, false];
        const next = current.slice();
        next[day] = !next[day];
        return { attendance: { ...s.attendance, [studentId]: next } };
      });
      persist(() => dbToggleAttendance(studentId, day));
    },

    setLogoDisplayMode(mode) {
      update({ logoDisplayMode: mode });
      persist(() => dbSetLogoDisplayMode(mode));
    },

    resetAll() {
      setState(initialState);
      persist(() => dbResetAll());
    },
  }), [update, persist]);

  const value = useMemo<Store>(() => ({ ...state, ...actions, hydrated }), [state, actions, hydrated]);
  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
