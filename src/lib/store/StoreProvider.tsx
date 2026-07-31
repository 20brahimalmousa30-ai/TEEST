"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Team, Student, Supervisor, Committee, CommitteeTask, StudentTask, ActivityAnnouncement, ActivityKind, ActivityTarget, Invoice, PaymentStatus, OcrExtraction, ConditionsPolicy } from "@/lib/mock/types";
import {
  loadAllData,
  dbAddTeam, dbUpdateTeam, dbDeleteTeam,
  dbAddStudent, dbRegisterStudent, dbApproveStudent, dbRejectStudent,
  dbUpdateStudent, dbDeleteStudent, dbRestoreStudent, dbPurgeStudent, dbMoveStudent, dbSetPayment, dbSetStudentPhoto,
  dbSubmitReceipt, dbReviewReceipt,
  dbAddSupervisor, dbUpdateSupervisor, dbDeleteSupervisor, dbImportSupervisors,
  dbAddCommittee, dbUpdateCommittee, dbDeleteCommittee,
  dbSetTeamBudget, dbSetCommitteeBudget,
  dbAddCommitteeTask, dbToggleCommitteeTask, dbDeleteCommitteeTask,
  dbAddActivity, dbToggleStudentTask, dbToggleActivityBatch, dbSetStudentTaskVisible, dbDeleteStudentTask, dbDeleteActivityBatch,
  dbAddAnnouncement, dbUpdateAnnouncement, dbDeleteAnnouncement,
  dbSetDefaultFee,
  dbAddInvoice, dbAddInvoices, dbApproveInvoice, dbRejectInvoice, dbDeleteInvoice, dbRestoreInvoice, dbAnalyzeInvoice,
  dbToggleRegField, dbReorderRegField, dbAddRegField, dbUpdateRegField, dbRemoveRegField, dbSetRegOpen,
  dbToggleAttendance, dbSetLogoDisplayMode, dbResetAll,
  dbSetMotivations, dbSetTickerPhrases, dbSetTripMessage, dbSetPostRegisterNote,
  dbSetLogoUrl, dbSetBrandColors, dbSetPageMarquees,
  dbSetAssociationIdentity, dbSetConditionsPolicy,
} from "@/lib/db/data";
import { motivations as DEFAULT_MOTIVATIONS, tickerPhrases as DEFAULT_TICKER } from "@/lib/motivations";
import type { PageMarquee, PageMarqueeMap } from "@/lib/pageMarquees";
import { evaluateConditions, passesPolicy } from "@/lib/ai/conditions";
import { teamLabel } from "@/lib/format";

export type RegField = {
  key: string; label: string; type: string; required: boolean; active: boolean; desc: string;
};

export type InvoiceInput = {
  vendor: string; purpose: string; scope: Invoice["scope"];
  amount: number; vat: number; date: string;
  imageDataUrl?: string; ocr?: OcrExtraction;
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
  committeeTasks: CommitteeTask[];
  studentTasks: StudentTask[];
  /** إعلاناتُ الأنشطة (لوحة الإعلانات) — يعلنها المشرف، ويراها الطلاب */
  announcements: ActivityAnnouncement[];
  invoices:     Invoice[];
  regFields:    RegField[];
  regOpen:      boolean;
  /** id -> daily flags (index 0..7 for the 8 days) */
  attendance:   Record<string, boolean[]>;
  /** invoices moved to trash */
  trashInvoices: Invoice[];
  /** طلابٌ في سلة المحذوفات (deleted_at مضبوط) — تُحذَف نهائياً بعد ١٠ ساعات */
  trashStudents: Student[];
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
  /** شعارٌ مخصّص يرفعه الأمير (Data URL) — للمعاينة الفوريّة بعد الرفع فقط؛
   *  لا يُشحن في لقطة التحميل. فارغٌ = استعمِل logoVersion/الافتراضي. */
  logoUrl: string;
  /** إصدار الشعار المخصّص (0 = لا شعار مخصّص). يبني رابط /api/logo?v= ويكسر
   *  التخزين المؤقّت عند التغيير — بديلٌ خفيفٌ عن شحن base64 في كل تحميل. */
  logoVersion: number;
  /** ألوان الهوية المشتقّة من الشعار — null = ألوان الثيم الافتراضيّة */
  brandColors: BrandColors | null;
  /** خلفيّة تحفيزيّة متحرّكة لكلّ صفحة — يُحرّرها الأمير (المفتاح = صفحة) */
  pageMarquees: PageMarqueeMap;
  /** اسم الجمعية الرسميّ — لمطابقة شرط اسم الجمعية في تحليل الفواتير */
  associationName: string;
  /** الرقم الضريبي للجمعية — لمطابقة شرط الرقم الضريبي */
  associationTaxNumber: string;
  /** سياسة الشروط الإلزاميّة لاعتماد الفواتير تلقائياً */
  conditionsPolicy: ConditionsPolicy;
  /** البند ٢: قيمة الرسوم الافتراضيّة — يعدّلها الأمير وتُطبَّق على جميع الطلاب */
  defaultFee: number;
};

const initialState: State = {
  teams:        [],
  students:     [],
  supervisors:  [],
  committees:   [],
  committeeTasks: [],
  studentTasks: [],
  announcements: [],
  invoices:     [],
  regFields:    initialFields,
  regOpen:      true,
  attendance:   {},
  trashInvoices: [],
  trashStudents: [],
  logoDisplayMode: "ANIMATED",
  motivations:   DEFAULT_MOTIVATIONS,
  tickerPhrases: DEFAULT_TICKER,
  tripMessage:   "",
  postRegisterNote: "",
  logoUrl:       "",
  logoVersion:   0,
  brandColors:   null,
  pageMarquees:  {},
  associationName: "",
  associationTaxNumber: "",
  conditionsPolicy: {
    taxInvoice: true, associationName: true, associationTaxNumber: true,
    vendorTaxNumber: true, issueDate: true, serviceDetails: true, quantityAndTotal: true,
  },
  defaultFee: 2500,
};

export type StoreActions = {
  // Teams
  addTeam(name: string, color: string, badge: string, supervisorId: string, tagline: string): void;
  updateTeam(id: string, patch: Partial<Team>): void;
  deleteTeam(id: string): void;
  /** موازنة الفريق — للأمير/نائبه فقط */
  setTeamBudget(id: string, budget: number): void;
  // Students
  addStudent(input: Omit<Student, "id" | "nationalIdMasked" | "points" | "attendance">): void;
  /** Public registration path — always creates an APPROVAL-pending record */
  registerStudent(input: { name: string; phone: string; grade: string; section: Student["section"]; emergencyContact: string; emergencyPhone: string; photoDataUrl?: string; nationalId?: string; regAnswers?: Record<string, string> }): Promise<Student>;
  approveStudent(id: string, teamId: string): void;
  rejectStudent(id: string): void;
  updateStudent(id: string, patch: Partial<Student>): void;
  /** حذفٌ ناعم: نقلٌ لسلة المحذوفات (١٠ ساعات ثم حذفٌ نهائيّ تلقائيّ) */
  deleteStudent(id: string): void;
  /** استعادةٌ من سلة المحذوفات */
  restoreStudent(id: string): void;
  /** حذفٌ نهائيّ فوريّ من سلة المحذوفات */
  purgeStudent(id: string): void;
  moveStudent(id: string, newTeamId: string): void;
  setPayment(id: string, status: PaymentStatus, paid: number): void;
  setStudentPhoto(id: string, dataUrl: string): void;
  /** البند ١٠: يرفع الطالب إيصال السداد (قيد المراجعة) */
  /** يرفع الطالب صورة الإيصال فقط (بلا مبلغ) — الأمير يتحقّق ويحدّد المبلغ عند الاعتماد */
  submitReceipt(id: string, dataUrl: string): void;
  /** يعتمد الأمير الإيصال بمبلغٍ يتحقّق منه يدويّاً (أو يرفضه) */
  reviewReceipt(id: string, approve: boolean, amount?: number): void;
  // Supervisors
  addSupervisor(name: string, phone: string, email: string, teamIds: string[], committeeIds: string[], permissions: string[], nationalId?: string, specialty?: string, photoDataUrl?: string): void;
  /** استيراد جماعي من ملف Excel/CSV */
  importSupervisors(rows: { name: string; phone: string; email: string }[]): void;
  updateSupervisor(id: string, patch: Partial<Supervisor>): void;
  deleteSupervisor(id: string): void;
  // Committees
  addCommittee(name: string, description: string, supervisorIds: string[], color: string, imageDataUrl?: string): void;
  updateCommittee(id: string, patch: Partial<Committee>): void;
  deleteCommittee(id: string): void;
  /** موازنة اللجنة — للأمير/نائبه فقط */
  setCommitteeBudget(id: string, budget: number): void;
  /** مهامّ اللجنة — للأمير/نائبه أو مشرف اللجنة */
  addCommitteeTask(committeeId: string, title: string, assigneeId?: string): void;
  toggleCommitteeTask(id: string, done: boolean): void;
  deleteCommitteeTask(id: string): void;
  // Student activities & deductions (البند ١ و٣) — staff records for a student / أسرة / all
  addActivity(input: { target: ActivityTarget; title: string; points: number; kind: ActivityKind; expiresAt?: string }): void;
  toggleStudentTask(id: string, done: boolean): void;
  toggleActivityBatch(batchId: string, done: boolean): void;
  setStudentTaskVisible(id: string, visible: boolean): void;
  deleteStudentTask(id: string): void;
  deleteActivityBatch(batchId: string): void;
  // Activity announcements (لوحة الإعلانات) — supervisor announces for own committees
  addAnnouncement(input: { title: string; points: number; committeeId: string }): void;
  updateAnnouncement(id: string, patch: { title?: string; points?: number; active?: boolean }): void;
  deleteAnnouncement(id: string): void;
  // Default fee (البند ٢) — Prince only; applies to all students
  setDefaultFee(amount: number): void;
  // Invoices
  /** يحلّل صورة فاتورة (base64 data URL) بالذكاء الاصطناعي — قراءةٌ مباشرة (لا متفائلة). */
  analyzeInvoice(imageDataUrl: string): Promise<OcrExtraction>;
  addInvoice(input: InvoiceInput): void;
  /** إضافةُ دفعةِ فواتير معاً (رفعٌ متعدّد) — إدراجٌ خادميٌّ متسلسلٌ في استدعاءٍ واحد. */
  addInvoicesBatch(inputs: InvoiceInput[]): void;
  approveInvoice(id: string): void;
  rejectInvoice(id: string): void;
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
  // Association identity + invoice conditions policy (Prince only)
  setAssociationIdentity(name: string, taxNumber: string): void;
  setConditionsPolicy(policy: ConditionsPolicy): void;
  // Reset
  resetAll(): void;
};

type Store = State & StoreActions & { hydrated: boolean; loadError: boolean; retry(): void };

const StoreContext = createContext<Store | null>(null);

const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** يبني فاتورةً متفائلةً للعرض الفوريّ (تقييمُ الشروط يطابق منطق الخادم؛ تُصحَّح بالمزامنة). */
function makeOptimisticInvoice(input: InvoiceInput, assocName: string, assocTax: string, policy: ConditionsPolicy): Invoice {
  const conditions = evaluateConditions(input.ocr ?? null, assocName, assocTax);
  const status: Invoice["status"] = input.ocr && passesPolicy(conditions, policy) ? "approved" : "pending";
  return {
    id: uid("inv"), code: `INV-1448-${String(1000 + Math.floor(Math.random() * 8999))}`,
    vendor: input.vendor, purpose: input.purpose, scope: input.scope,
    amount: input.amount, vat: input.vat, date: input.date,
    status, extractedByAI: !!input.ocr,
    lineItems: input.ocr?.lineItems, conditions,
    vendorTaxNumber: input.ocr?.vendorTaxNumber, invoiceNumber: input.ocr?.invoiceNumber,
    submittedAt: new Date().toISOString(), hasImage: !!input.imageDataUrl,
  };
}

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
  // مرآةٌ للحالة الحاليّة تُقرأ داخل الإجراءات المُمَذكَرة (useMemo) دون إعادة إنشائها.
  const stateRef = useRef(state);
  stateRef.current = state;
  const [hydrated, setHydrated] = useState(false);
  // فشل جلبِ اللقطة (شبكة/إجراء خادمٍ قديم بعد النشر). نُظهره صراحةً حتى لا تبدو
  // القائمة الفارغة وكأنّ البيانات حُذفت — فيُميّز المستخدم «تعذّر التحميل» عن «لا بيانات».
  const [loadError, setLoadError] = useState(false);

  // يجلب اللقطة الكاملة من قاعدة البيانات ويستبدل بها الحالة المحلّيّة.
  const reload = useCallback(async () => {
    try {
      const fresh = await loadAllData();
      setState(fresh);
      setLoadError(false);
    } catch (e) {
      console.error("تعذّر تحميل البيانات من قاعدة البيانات:", e);
      setLoadError(true);
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
    setTeamBudget(id, budget) {
      const b = Math.max(0, Math.round(budget));
      update(s => ({ teams: s.teams.map(t => t.id === id ? { ...t, budget: b } : t) }));
      persist(() => dbSetTeamBudget(id, b));
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
    // مسارُ التسجيل العامّ: ننتظر تأكيد القاعدة (لا «أطلِق وانسَ») حتى لا تظهر
    // شاشةُ النجاح ما لم يُحفَظ الطالب فعلاً. أيُّ إخفاقٍ (تجاوز حجم الطلب، صورة
    // غير صالحة، خطأ شبكة) يُرمى للمتّصل ليعرضه للمستخدم بدل فقدان التسجيل صامتاً.
    async registerStudent(input) {
      const created = await dbRegisterStudent(input);
      update(s => ({ students: [...s.students, created] }));
      return created;
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
      // حذفٌ ناعم: نقلٌ لسلة المحذوفات مع إنقاص عدّاد الأسرة (لم يَعُد نشِطاً).
      update(s => {
        const st = s.students.find(x => x.id === id);
        if (!st) return {};
        return {
          students: s.students.filter(x => x.id !== id),
          trashStudents: [{ ...st, deletedAt: new Date().toISOString() }, ...s.trashStudents],
          teams: s.teams.map(t => t.id === st.teamId ? { ...t, studentCount: Math.max(0, t.studentCount - 1) } : t),
        };
      });
      persist(() => dbDeleteStudent(id));
    },
    restoreStudent(id) {
      // استعادةٌ من السلة: يعود نشِطاً ويُعاد عدّاد أسرته.
      update(s => {
        const st = s.trashStudents.find(x => x.id === id);
        if (!st) return {};
        const { deletedAt: _drop, ...active } = st;
        return {
          trashStudents: s.trashStudents.filter(x => x.id !== id),
          students: [active, ...s.students],
          teams: s.teams.map(t => t.id === st.teamId ? { ...t, studentCount: t.studentCount + 1 } : t),
        };
      });
      persist(() => dbRestoreStudent(id));
    },
    purgeStudent(id) {
      // حذفٌ نهائيّ فوريّ من السلة (لا يمسّ عدّاد الأسرة — نُقِص عند الحذف الناعم).
      update(s => ({ trashStudents: s.trashStudents.filter(x => x.id !== id) }));
      persist(() => dbPurgeStudent(id));
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
    submitReceipt(id, dataUrl) {
      // الطالب يرفع الصورة فقط؛ المبلغ يحدّده الأمير عند الاعتماد (غير معروفٍ الآن).
      update(s => ({ students: s.students.map(st => st.id === id
        ? { ...st, receiptDataUrl: dataUrl, receiptStatus: "PENDING", receiptAmount: undefined, receiptSubmittedAt: new Date().toISOString() }
        : st) }));
      persist(() => dbSubmitReceipt(id, dataUrl));
    },
    reviewReceipt(id, approve, amount) {
      update(s => ({ students: s.students.map(st => {
        if (st.id !== id) return st;
        if (!approve) return { ...st, receiptStatus: "REJECTED" };
        //  المبلغ الذي تحقّق منه الأمير يدويّاً؛ افتراضاً الإجماليّ الكامل.
        const amt = amount ?? st.totalAmount;
        const status: PaymentStatus = amt >= st.totalAmount ? "PAID" : amt > 0 ? "PARTIAL" : "PENDING";
        return { ...st, receiptStatus: "APPROVED", receiptAmount: amt, paymentStatus: status, paidAmount: amt };
      }) }));
      persist(() => dbReviewReceipt(id, approve, amount));
    },

    addSupervisor(name, phone, email, teamIds, committeeIds, permissions, nationalId = "", specialty = "", photoDataUrl) {
      const code = secureCode();
      const nid = nationalId.trim();
      update(s => ({
        supervisors: [...s.supervisors, {
          id: uid("s"), name, phone, email, teamIds, committeeIds, permissions, accessCode: code,
          nationalId: nid || undefined,
          nationalIdMasked: nid ? "••••••" + nid.slice(-4) : "",
          specialty: specialty.trim() || undefined,
          photoDataUrl: photoDataUrl || undefined,
        }],
      }));
      persist(() => dbAddSupervisor(name, phone, email, teamIds, committeeIds, permissions, code, nid, specialty, photoDataUrl));
    },
    importSupervisors(rows) {
      update(s => ({
        supervisors: [...s.supervisors, ...rows.map(r => ({
          id: uid("s"), name: r.name, phone: r.phone, email: r.email, teamIds: [], committeeIds: [], permissions: [],
          nationalIdMasked: "",
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
    setCommitteeBudget(id, budget) {
      const b = Math.max(0, Math.round(budget));
      update(s => ({ committees: s.committees.map(x => x.id === id ? { ...x, budget: b } : x) }));
      persist(() => dbSetCommitteeBudget(id, b));
    },
    addCommitteeTask(committeeId, title, assigneeId) {
      const t = title.trim();
      if (!t) return;
      update(s => ({ committeeTasks: [
        { id: uid("ctask"), committeeId, title: t, assigneeId: assigneeId || undefined, done: false, createdAt: new Date().toISOString() },
        ...s.committeeTasks,
      ] }));
      persist(() => dbAddCommitteeTask(committeeId, t, assigneeId));
    },
    toggleCommitteeTask(id, done) {
      update(s => ({ committeeTasks: s.committeeTasks.map(t => t.id === id ? { ...t, done } : t) }));
      persist(() => dbToggleCommitteeTask(id, done));
    },
    deleteCommitteeTask(id) {
      update(s => ({ committeeTasks: s.committeeTasks.filter(t => t.id !== id) }));
      persist(() => dbDeleteCommitteeTask(id));
    },

    addActivity({ target, title, points, kind, expiresAt }) {
      const t = title.trim();
      if (!t) return;
      const st = stateRef.current;
      const approved = st.students.filter(x => (x.approvalStatus ?? "APPROVED") === "APPROVED");
      // اشتقاق الطلاب المستهدفين ووصفِ النطاق حسب نوع الرصد.
      let ids: string[] = [];
      let scopeLabel = "";
      if (target.kind === "student") {
        ids = approved.filter(x => x.id === target.studentId).map(x => x.id);
        scopeLabel = approved.find(x => x.id === target.studentId)?.name ?? "";
      } else if (target.kind === "teams") {
        const set = new Set(target.teamIds);
        ids = approved.filter(x => set.has(x.teamId)).map(x => x.id);
        scopeLabel = st.teams.filter(tm => set.has(tm.id)).map(tm => teamLabel(tm.name)).join("، ");
      } else {
        ids = approved.map(x => x.id);
        scopeLabel = "كل الطلاب";
      }
      if (ids.length === 0) return;
      const pts = Math.trunc(points || 0);
      const signed = kind === "deduction" ? -Math.abs(pts) : Math.abs(pts);
      // الخصمُ والنشاطُ المفتوح يُحتسبان فوراً (done=true)؛ النشاطُ المؤقّت ينتظر الاعتماد.
      const done = kind === "deduction" ? true : !expiresAt;
      const batchId = ids.length > 1 ? uid("batch") : undefined;
      const now = new Date().toISOString();
      const rows: StudentTask[] = ids.map(studentId => ({
        id: uid("stask"), studentId, title: t, points: signed, visible: true,
        done, kind, batchId, scopeLabel: scopeLabel || undefined, expiresAt: expiresAt || undefined, createdAt: now,
      }));
      update(s => ({ studentTasks: [...rows, ...s.studentTasks] }));
      persist(() => dbAddActivity({ studentIds: ids, title: t, points: signed, kind, scopeLabel: scopeLabel || undefined, expiresAt, done, batchId }));
    },
    toggleStudentTask(id, done) {
      update(s => ({ studentTasks: s.studentTasks.map(t => t.id === id ? { ...t, done } : t) }));
      persist(() => dbToggleStudentTask(id, done));
    },
    toggleActivityBatch(batchId, done) {
      update(s => ({ studentTasks: s.studentTasks.map(t => t.batchId === batchId ? { ...t, done } : t) }));
      persist(() => dbToggleActivityBatch(batchId, done));
    },
    setStudentTaskVisible(id, visible) {
      update(s => ({ studentTasks: s.studentTasks.map(t => t.id === id ? { ...t, visible } : t) }));
      persist(() => dbSetStudentTaskVisible(id, visible));
    },
    deleteStudentTask(id) {
      update(s => ({ studentTasks: s.studentTasks.filter(t => t.id !== id) }));
      persist(() => dbDeleteStudentTask(id));
    },
    deleteActivityBatch(batchId) {
      update(s => ({ studentTasks: s.studentTasks.filter(t => t.batchId !== batchId) }));
      persist(() => dbDeleteActivityBatch(batchId));
    },

    addAnnouncement({ title, points, committeeId }) {
      const t = title.trim();
      if (!t || !committeeId) return;
      const pts = Math.max(0, Math.trunc(points || 0));
      const row: ActivityAnnouncement = {
        id: uid("ann"), title: t, points: pts, committeeId, active: true, createdAt: new Date().toISOString(),
      };
      update(s => ({ announcements: [row, ...s.announcements] }));
      persist(() => dbAddAnnouncement({ title: t, points: pts, committeeId }));
    },
    updateAnnouncement(id, patch) {
      update(s => ({ announcements: s.announcements.map(a => a.id === id ? { ...a, ...patch } : a) }));
      persist(() => dbUpdateAnnouncement(id, patch));
    },
    deleteAnnouncement(id) {
      update(s => ({ announcements: s.announcements.filter(a => a.id !== id) }));
      persist(() => dbDeleteAnnouncement(id));
    },
    setDefaultFee(amount) {
      const fee = Math.max(0, Math.round(amount));
      update(s => ({
        defaultFee: fee,
        students: s.students.map(st => ({ ...st, totalAmount: fee })),
      }));
      persist(() => dbSetDefaultFee(fee));
    },

    analyzeInvoice(imageDataUrl) {
      return dbAnalyzeInvoice(imageDataUrl);
    },
    addInvoice(input) {
      update(s => ({ invoices: [makeOptimisticInvoice(input, s.associationName, s.associationTaxNumber, s.conditionsPolicy), ...s.invoices] }));
      persist(() => dbAddInvoices([input]));
    },
    addInvoicesBatch(inputs) {
      if (inputs.length === 0) return;
      update(s => ({
        invoices: [
          ...inputs.map(i => makeOptimisticInvoice(i, s.associationName, s.associationTaxNumber, s.conditionsPolicy)),
          ...s.invoices,
        ],
      }));
      //  إدراجٌ خادميٌّ متسلسلٌ في استدعاءٍ واحد (يمنع سباق الاستدعاءات وضياع فاتورة).
      persist(() => dbAddInvoices(inputs));
    },
    approveInvoice(id) {
      update(s => ({ invoices: s.invoices.map(i => i.id === id ? { ...i, status: "approved" } : i) }));
      persist(() => dbApproveInvoice(id));
    },
    rejectInvoice(id) {
      update(s => {
        const inv = s.invoices.find(i => i.id === id);
        return {
          invoices: s.invoices.filter(i => i.id !== id),
          trashInvoices: inv ? [inv, ...s.trashInvoices] : s.trashInvoices,
        };
      });
      persist(() => dbRejectInvoice(id));
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
      // معاينةٌ فوريّة عبر logoUrl، وتبديلُ logoVersion ليعرض /api/logo الجديد
      // بعد المزامنة (حين يُفرَّغ logoUrl عند إعادة التحميل). 0 = استعادة الافتراضي.
      update({ logoUrl: url, logoVersion: url ? Date.now() : 0 });
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
    setAssociationIdentity(name, taxNumber) {
      update({ associationName: name, associationTaxNumber: taxNumber });
      persist(() => dbSetAssociationIdentity(name, taxNumber));
    },
    setConditionsPolicy(policy) {
      update({ conditionsPolicy: policy });
      persist(() => dbSetConditionsPolicy(policy));
    },

    resetAll() {
      setState(initialState);
      persist(() => dbResetAll());
    },
  }), [update, persist]);

  const value = useMemo<Store>(
    () => ({ ...state, ...actions, hydrated, loadError, retry: () => { void reload(); } }),
    [state, actions, hydrated, loadError, reload],
  );
  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
