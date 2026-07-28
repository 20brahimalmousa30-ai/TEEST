"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Team, Student, Supervisor, Committee, Invoice, PaymentStatus } from "@/lib/mock/types";
import {
  loadAllData,
  dbAddTeam, dbUpdateTeam, dbDeleteTeam,
  dbAddStudent, dbRegisterStudent, dbApproveStudent, dbRejectStudent,
  dbUpdateStudent, dbDeleteStudent, dbMoveStudent, dbSetPayment, dbSetStudentPhoto,
  dbSubmitReceipt, dbReviewReceipt,
  dbAddSupervisor, dbUpdateSupervisor, dbDeleteSupervisor, dbImportSupervisors,
  dbAddCommittee, dbUpdateCommittee, dbDeleteCommittee,
  dbAddInvoice, dbApproveInvoice, dbDeleteInvoice, dbRestoreInvoice,
  dbToggleRegField, dbReorderRegField, dbAddRegField, dbUpdateRegField, dbRemoveRegField, dbSetRegOpen,
  dbToggleAttendance, dbSetLogoDisplayMode, dbResetAll,
  dbSetMotivations, dbSetTickerPhrases, dbSetTripMessage, dbSetPostRegisterNote,
  dbSetLogoUrl, dbSetBrandColors, dbSetPageMarquees,
} from "@/lib/db/data";
import { motivations as DEFAULT_MOTIVATIONS, tickerPhrases as DEFAULT_TICKER } from "@/lib/motivations";
import type { PageMarquee, PageMarqueeMap } from "@/lib/pageMarquees";

export type RegField = {
  key: string; label: string; type: string; required: boolean; active: boolean; desc: string;
};

const initialFields: RegField[] = [
  { key: "name",    label: "الاسم الكامل",     type: "نص",      required: true,  active: true,  desc: "اسمُ الطالب رباعياً كما في الهويّة." },
  { key: "nid",     label: "رقم الهويّة",       type: "رقم",     required: true,  active: true,  desc: "يُخزَّن مشفَّراً — لا يظهر كاملاً إلاّ للأمير الأصل." },
  { key: "phone",   label: "الجوّال",          type: "هاتف",    required: true,  active: true,  desc: "رقم واتساب مُفضَّل، للتواصل مع الطالب مباشرة." },
  { key: "grade",   label: "الصف الدراسي",     type: "قائمة",   required: true,  active: true,  desc: "من قائمة: أوّل/ثاني/ثالث ثانوي." },
  { key: "section", label: "الفريق",          type: "قائمة",   required: false, active: true,  desc: "الريادة/القيادة/العلو — لتوزيعٍ مبدئي." },
  { key: "photo",   label: "الصورة الشخصيّة", type: "ملف",      required: false, active: true,  desc: "بحدٍّ أقصى ٥ ميغا." },
  { key: "emergP",  label: "رقم وليّ الأمر",  type: "هاتف",    required: true,  active: true,  desc: "متاح ٢٤ ساعة أثناء الرحلة." },
  { key: "health",  label: "مقترحك للسفرة",   type: "نص طويل", required: false, active: true,  desc: "ملاحظاتك واقتراحاتك للرحلة (اختياري)." },
  { key: "notes",   label: "ملاحظات أخرى",    type: "نص طويل", required: false, active: false, desc: "معلومات إضافيّة (اختياري)." },
];

export type LogoDisplayMode = "VISIBLE" | "BLURRED" | "HIDDEN" | "ANIMATED";

/** ألوان الهوية المشتقّة من الشعار (البند ٦) — تتجاوز ألوان الثيم الافتراضيّة. */
export type BrandColors = { accent: string; accentWarm: string };

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
  /** جُمل تحفيزيّة كاملة (شاشة الانتظار) — يُحرّرها الأمير */
  motivations: string[];
  /** جُمل قصيرة للأشرطة المتحرّكة خلف نموذج التسجيل */
  tickerPhrases: string[];
  /** رسالة السفرة (تُعرض في الصفحة الرئيسيّة) — يُحرّرها الأمير */
  tripMessage: string;
  /** نصّ مربّع «ما التالي؟» بعد إرسال التسجيل — يُحرّرها الأمير */
  postRegisterNote: string;
  /** شعارٌ مخصّص يرفعه الأمير (Data URL). فارغٌ = الشعار الافتراضي /logo.png */
  logoUrl: string;
  /** ألوان الهوية المشتقّة من الشعار — null = ألوان الثيم الافتراضيّة */
  brandColors: BrandColors | null;
  /** خلفيّة تحفيزيّة متحرّكة لكلّ صفحة — يُحرّرها الأمير (المفتاح = صفحة) */
  pageMarquees: PageMarqueeMap;
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
  logoDisplayMode: "ANIMATED",
  motivations:   DEFAULT_MOTIVATIONS,
  tickerPhrases: DEFAULT_TICKER,
  tripMessage:   "",
  postRegisterNote: "",
  logoUrl:       "",
  brandColors:   null,
  pageMarquees:  {},
};

export type StoreActions = {
  // Teams
  addTeam(name: string, color: string, badge: string, supervisorId: string, tagline: string): void;
  updateTeam(id: string, patch: Partial<Team>): void;
  deleteTeam(id: string): void;
  // Students
  addStudent(input: Omit<Student, "id" | "nationalIdMasked" | "points" | "attendance">): void;
  /** Public registration path — always creates an APPROVAL-pending record */
  registerStudent(input: { name: string; phone: string; grade: string; section: Student["section"]; emergencyContact: string; emergencyPhone: string; photoDataUrl?: string }): Student;
  approveStudent(id: string, teamId: string): void;
  rejectStudent(id: string): void;
  updateStudent(id: string, patch: Partial<Student>): void;
  deleteStudent(id: string): void;
  moveStudent(id: string, newTeamId: string): void;
  setPayment(id: string, status: PaymentStatus, paid: number): void;
  setStudentPhoto(id: string, dataUrl: string): void;
  /** البند ١٠: يرفع الطالب إيصال السداد (قيد المراجعة) */
  submitReceipt(id: string, dataUrl: string, amount: number): void;
  /** البند ١٠: يعتمد الأمير الإيصال أو يرفضه */
  reviewReceipt(id: string, approve: boolean): void;
  // Supervisors
  addSupervisor(name: string, phone: string, email: string, teamIds: string[], committeeIds: string[], permissions: string[]): void;
  /** استيراد جماعي من ملف Excel/CSV */
  importSupervisors(rows: { name: string; phone: string; email: string }[]): void;
  updateSupervisor(id: string, patch: Partial<Supervisor>): void;
  deleteSupervisor(id: string): void;
  // Committees
  addCommittee(name: string, description: string, supervisorIds: string[], color: string, imageDataUrl?: string): void;
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
  updateRegField(key: string, patch: Partial<Omit<RegField, "key">>): void;
  removeRegField(key: string): void;
  setRegOpen(open: boolean): void;
  // Attendance
  toggleAttendance(studentId: string, day: number): void;
  // Logo display (Prince only)
  setLogoDisplayMode(mode: LogoDisplayMode): void;
  // Motivational phrases (Prince only)
  setMotivations(list: string[]): void;
  setTickerPhrases(list: string[]): void;
  // Trip message (Prince only)
  setTripMessage(text: string): void;
  // Post-registration note (Prince only)
  setPostRegisterNote(text: string): void;
  // Site logo image + brand colors (Prince only) — البند ٦
  setLogoUrl(url: string): void;
  setBrandColors(colors: BrandColors | null): void;
  // Per-page background marquee (Prince only)
  setPageMarquee(key: string, cfg: PageMarquee): void;
  // Reset
  resetAll(): void;
};

type Store = State & StoreActions & { hydrated: boolean };

const StoreContext = createContext<Store | null>(null);

const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** رمزُ دخولٍ عشوائيٌّ آمنٌ تشفيرياً (٨ خانات، أبجديّةٌ خاليةٌ من الأحرف المُلتبِسة).
 *  يستخدم مولّدَ الأرقام العشوائيّة الآمن في المتصفّح بدلاً من Math.random. */
function secureCode(len = 8): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // بلا 0/O/1/I/L
  const buf = new Uint32Array(len);
  (globalThis.crypto ?? window.crypto).getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

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
        totalAmount: 500,
        emergencyContact: input.emergencyContact,
        emergencyPhone: input.emergencyPhone,
        nationalIdMasked: "••••••" + Math.floor(1000 + Math.random() * 8999),
        points: 0,
        attendance: 100,
        approvalStatus: "PENDING",
        registeredAt: new Date().toISOString(),
        photoDataUrl: input.photoDataUrl,
      };
      update(s => ({ students: [...s.students, record] }));
      persist(() => dbRegisterStudent(input));
      return record;
    },
    approveStudent(id, teamId) {
      const code = secureCode();
      update(s => {
        const st = s.students.find(x => x.id === id);
        if (!st) return {};
        return {
          students: s.students.map(x => x.id === id ? { ...x, approvalStatus: "APPROVED", teamId, accessCode: code } : x),
          teams: teamId ? s.teams.map(t => t.id === teamId ? { ...t, studentCount: t.studentCount + 1 } : t) : s.teams,
        };
      });
      persist(() => dbApproveStudent(id, teamId, code));
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
    submitReceipt(id, dataUrl, amount) {
      update(s => ({ students: s.students.map(st => st.id === id
        ? { ...st, receiptDataUrl: dataUrl, receiptStatus: "PENDING", receiptAmount: amount, receiptSubmittedAt: new Date().toISOString() }
        : st) }));
      persist(() => dbSubmitReceipt(id, dataUrl, amount));
    },
    reviewReceipt(id, approve) {
      update(s => ({ students: s.students.map(st => {
        if (st.id !== id) return st;
        if (!approve) return { ...st, receiptStatus: "REJECTED" };
        const amount = st.receiptAmount ?? 0;
        const status: PaymentStatus = amount >= st.totalAmount ? "PAID" : amount > 0 ? "PARTIAL" : "PENDING";
        return { ...st, receiptStatus: "APPROVED", paymentStatus: status, paidAmount: amount };
      }) }));
      persist(() => dbReviewReceipt(id, approve));
    },

    addSupervisor(name, phone, email, teamIds, committeeIds, permissions) {
      const code = secureCode();
      update(s => ({
        supervisors: [...s.supervisors, {
          id: uid("s"), name, phone, email, teamIds, committeeIds, permissions, accessCode: code,
          nationalIdMasked: "••••••" + Math.floor(1000 + Math.random() * 8999),
        }],
      }));
      persist(() => dbAddSupervisor(name, phone, email, teamIds, committeeIds, permissions, code));
    },
    importSupervisors(rows) {
      update(s => ({
        supervisors: [...s.supervisors, ...rows.map(r => ({
          id: uid("s"), name: r.name, phone: r.phone, email: r.email, teamIds: [], committeeIds: [], permissions: [],
          nationalIdMasked: "••••••" + Math.floor(1000 + Math.random() * 8999),
        }))],
      }));
      persist(() => dbImportSupervisors(rows));
    },
    updateSupervisor(id, patch) {
      update(s => ({ supervisors: s.supervisors.map(x => x.id === id ? { ...x, ...patch } : x) }));
      persist(() => dbUpdateSupervisor(id, patch));
    },
    deleteSupervisor(id) {
      update(s => ({ supervisors: s.supervisors.filter(x => x.id !== id) }));
      persist(() => dbDeleteSupervisor(id));
    },

    addCommittee(name, description, supervisorIds, color, imageDataUrl) {
      update(s => ({
        committees: [...s.committees, { id: uid("c"), name, description, supervisorIds, color, imageDataUrl }],
      }));
      persist(() => dbAddCommittee(name, description, supervisorIds, color, imageDataUrl));
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
    updateRegField(key, patch) {
      update(s => ({ regFields: s.regFields.map(f => f.key === key ? { ...f, ...patch } : f) }));
      persist(() => dbUpdateRegField(key, patch));
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

    setMotivations(list) {
      update({ motivations: list });
      persist(() => dbSetMotivations(list));
    },
    setTickerPhrases(list) {
      update({ tickerPhrases: list });
      persist(() => dbSetTickerPhrases(list));
    },
    setPostRegisterNote(text) {
      update({ postRegisterNote: text });
      persist(() => dbSetPostRegisterNote(text));
    },
    setTripMessage(text) {
      update({ tripMessage: text });
      persist(() => dbSetTripMessage(text));
    },
    setLogoUrl(url) {
      update({ logoUrl: url });
      persist(() => dbSetLogoUrl(url));
    },
    setBrandColors(colors) {
      update({ brandColors: colors });
      persist(() => dbSetBrandColors(colors));
    },
    setPageMarquee(key, cfg) {
      let nextMap: PageMarqueeMap = {};
      update(s => {
        nextMap = { ...s.pageMarquees, [key]: cfg };
        return { pageMarquees: nextMap };
      });
      persist(() => dbSetPageMarquees(nextMap));
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
