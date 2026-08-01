"use server";
/**
 * طبقة البيانات التجريبية — بياناتٌ ثابتة بدون اتصالٍ بقاعدة البيانات.
 * تُستخدَم في نسخة «سمو» للعرض فقط. لا Supabase، لا مفاتيح، لا شبكة.
 */
import type { Team, Student, Supervisor, Committee, CommitteeTask, StudentTask,
  ActivityAnnouncement, NewsPost, Invoice, OcrExtraction, ConditionsPolicy } from "@/lib/mock/types";
import type { RegField, LogoDisplayMode, State, BrandColors } from "@/lib/store/StoreProvider";
import type { LoginResult } from "./types";
import { motivations as DEFAULT_MOTIVATIONS, tickerPhrases as DEFAULT_TICKER } from "@/lib/motivations";
import type { PageMarqueeMap } from "@/lib/pageMarquees";
import { DEFAULT_CONDITIONS_POLICY } from "@/lib/ai/conditions";

/* ════════════════════════════════════════════════════════
   بيانات التثبيت الوهمية
════════════════════════════════════════════════════════ */

const TEAMS: Team[] = [
  { id: "t1", name: "أسرة الريادة",  color: "#2C6B79", badge: "🦅", supervisorId: "s1", studentCount: 15, points: 1420, tagline: "نحو القمم بخطواتٍ راسخة", budget: 5000 },
  { id: "t2", name: "أسرة القيادة",  color: "#5F8A5C", badge: "🌿", supervisorId: "s3", studentCount: 15, points: 1380, tagline: "الأقوياء يبنون، والقادة يلهمون", budget: 4800 },
  { id: "t3", name: "أسرة العلو",    color: "#B54A2E", badge: "🔥", supervisorId: "s5", studentCount: 15, points: 1550, tagline: "العلو غايةٌ لكلّ طموح", budget: 5200 },
];

const SUPERVISORS: Supervisor[] = [
  { id: "s1", name: "أحمد بن سعيد العسيري",     nationalIdMasked: "••••1234", phone: "0501111001", email: "ahmad@demo.com",    teamIds: ["t1"],      committeeIds: ["c1"],      permissions: ["students","teams","invoices","committees"], accessCode: "1111", specialty: "الأنشطة الرياضية" },
  { id: "s2", name: "محمد بن عبدالله الزهراني", nationalIdMasked: "••••2345", phone: "0501111002", email: "mohammed@demo.com", teamIds: ["t1"],      committeeIds: ["c2"],      permissions: ["students"],                                accessCode: "2222", specialty: "التوجيه والإرشاد" },
  { id: "s3", name: "خالد بن راشد الغامدي",     nationalIdMasked: "••••3456", phone: "0501111003", email: "khalid@demo.com",   teamIds: ["t2"],      committeeIds: ["c3"],      permissions: ["students","teams"],                        accessCode: "3333", specialty: "الفنون والإبداع" },
  { id: "s4", name: "سلطان بن ناصر القرني",     nationalIdMasked: "••••4567", phone: "0501111004", email: "sultan@demo.com",   teamIds: ["t2"],      committeeIds: ["c1","c4"], permissions: ["students","committees"],                   accessCode: "4444", specialty: "التقنية والتصوير" },
  { id: "s5", name: "فيصل بن عمر الشهري",       nationalIdMasked: "••••5678", phone: "0501111005", email: "faisal@demo.com",   teamIds: ["t3"],      committeeIds: ["c5"],      permissions: ["students","teams","invoices"],             accessCode: "5555", specialty: "الرحلات والمغامرات" },
  { id: "s6", name: "نواف بن حمد العمري",       nationalIdMasked: "••••6789", phone: "0501111006", email: "nawaf@demo.com",    teamIds: ["t3"],      committeeIds: ["c2","c3"], permissions: ["students"],                                accessCode: "6666", specialty: "الخطابة والإلقاء" },
  { id: "s7", name: "ماجد بن عيسى الدوسري",     nationalIdMasked: "••••7890", phone: "0501111007", email: "majed@demo.com",    teamIds: ["t1","t2"], committeeIds: ["c4"],      permissions: ["committees","invoices"],                   accessCode: "7777", specialty: "الطبيعة والبيئة" },
  { id: "s8", name: "تركي بن سلمان البلوي",     nationalIdMasked: "••••8901", phone: "0501111008", email: "turki@demo.com",    teamIds: ["t2","t3"], committeeIds: ["c5"],      permissions: ["students","teams","committees"],           accessCode: "8888", specialty: "الصحة واللياقة" },
];

const COMMITTEES: Committee[] = [
  { id: "c1", name: "لجنة البرامج",   supervisorIds: ["s1","s4"], description: "تُنظّم وتُشرف على البرامج والفعاليات اليومية.", color: "#2C6B79", budget: 3000 },
  { id: "c2", name: "لجنة الإعلام",   supervisorIds: ["s2","s6"], description: "توثيق الرحلة وتغطيتها مرئياً وكتابياً.",       color: "#5F8A5C", budget: 2000 },
  { id: "c3", name: "لجنة المسابقات", supervisorIds: ["s3","s6"], description: "إدارة المسابقات الفكريّة والرياضيّة.",         color: "#B54A2E", budget: 1500 },
  { id: "c4", name: "لجنة الخدمات",   supervisorIds: ["s4","s7"], description: "ضمان راحة الأفراد وتلبية احتياجاتهم.",         color: "#8B6914", budget: 2500 },
  { id: "c5", name: "لجنة المغامرات", supervisorIds: ["s5","s8"], description: "الإشراف على الأنشطة الميدانية والتطوعية.",     color: "#6B2C79", budget: 4000 },
];

const COMMITTEE_TASKS: CommitteeTask[] = [
  { id: "ct1", committeeId: "c1", title: "إعداد جدول البرامج اليومي",       assigneeId: "s1", done: true,  createdAt: "2026-07-20T08:00:00Z" },
  { id: "ct2", committeeId: "c1", title: "تجهيز القاعة الرئيسية للحفل",     assigneeId: "s4", done: false, createdAt: "2026-07-20T09:00:00Z" },
  { id: "ct3", committeeId: "c2", title: "تصميم شعار الرحلة",               assigneeId: "s2", done: true,  createdAt: "2026-07-21T08:00:00Z" },
  { id: "ct4", committeeId: "c2", title: "إعداد ألبوم الصور الختامي",       assigneeId: "s6", done: false, createdAt: "2026-07-21T10:00:00Z" },
  { id: "ct5", committeeId: "c3", title: "تحضير أسئلة مسابقة المعلومات",   assigneeId: "s3", done: true,  createdAt: "2026-07-22T08:00:00Z" },
  { id: "ct6", committeeId: "c3", title: "تنظيم بطولة كرة القدم",           assigneeId: "s6", done: false, createdAt: "2026-07-22T11:00:00Z" },
  { id: "ct7", committeeId: "c4", title: "متابعة حاجات المبيت والإقامة",   assigneeId: "s7", done: true,  createdAt: "2026-07-19T08:00:00Z" },
  { id: "ct8", committeeId: "c5", title: "التواصل مع مشغّل مسار التسلّق",  assigneeId: "s5", done: true,  createdAt: "2026-07-18T08:00:00Z" },
  { id: "ct9", committeeId: "c5", title: "تجهيز معدّات المغامرة والسلامة", assigneeId: "s8", done: false, createdAt: "2026-07-22T14:00:00Z" },
];

/** دالّة مساعدة لإنشاء طالب (حضور ثابت لتفادي اختلاف الخادم/العميل). */
function mkst(
  id: string, name: string, phone: string, grade: string,
  section: Student["section"], teamId: string,
  payStatus: Student["paymentStatus"], paid: number, total: number, points: number,
  attendance: number,
): Student {
  return {
    id, name, nationalIdMasked: "••••" + id.slice(-4), phone, grade, section, teamId,
    paymentStatus: payStatus, paidAmount: paid, totalAmount: total, points,
    emergencyContact: "والد " + name.split(" ")[0], emergencyPhone: "0509" + phone.slice(-6),
    attendance, approvalStatus: "APPROVED", registeredAt: "2026-07-15T10:00:00Z",
  };
}

const STUDENTS: Student[] = [
  // ── أسرة الريادة (t1) ────────────────────────────
  mkst("st01","عبدالرحمن بن سعد الحربي",   "0502001001","أوّل ثانوي", "ريادة","t1","PAID",   2500,2500,195,100),
  mkst("st02","يوسف بن ماجد الشمري",       "0502001002","ثاني ثانوي", "ريادة","t1","PAID",   2500,2500,180, 95),
  mkst("st03","أنس بن فهد العتيبي",        "0502001003","ثالث ثانوي", "ريادة","t1","PAID",   2500,2500,175, 90),
  mkst("st04","فراس بن خالد القحطاني",     "0502001004","أوّل ثانوي", "ريادة","t1","PAID",   2500,2500,165, 88),
  mkst("st05","محمد بن علي الدوسري",       "0502001005","ثاني ثانوي", "ريادة","t1","PARTIAL",1500,2500,160, 85),
  mkst("st06","ريان بن عبدالله الغامدي",   "0502001006","ثالث ثانوي", "ريادة","t1","PAID",   2500,2500,155, 92),
  mkst("st07","زياد بن تركي السبيعي",      "0502001007","أوّل ثانوي", "ريادة","t1","PAID",   2500,2500,150, 80),
  mkst("st08","ناصر بن حمد العنزي",        "0502001008","ثاني ثانوي", "ريادة","t1","PARTIAL",1000,2500,145, 75),
  mkst("st09","عمر بن سلطان الرشيدي",      "0502001009","أوّل ثانوي", "ريادة","t1","PAID",   2500,2500,140, 96),
  mkst("st10","بدر بن محمد الزهراني",      "0502001010","ثالث ثانوي", "ريادة","t1","PAID",   2500,2500,135, 84),
  mkst("st11","لؤي بن أحمد الشهري",        "0502001011","أوّل ثانوي", "ريادة","t1","PAID",   2500,2500,130, 90),
  mkst("st12","وليد بن ناصر المطيري",      "0502001012","ثاني ثانوي", "ريادة","t1","PENDING",   0,2500,120, 60),
  mkst("st13","عبدالعزيز بن سعيد الحمدان", "0502001013","ثالث ثانوي", "ريادة","t1","PAID",   2500,2500,115, 88),
  mkst("st14","سلطان بن عيسى البلوي",      "0502001014","أوّل ثانوي", "ريادة","t1","PAID",   2500,2500,110, 82),
  mkst("st15","طارق بن فيصل الحربي",       "0502001015","ثاني ثانوي", "ريادة","t1","PARTIAL",1200,2500,105, 78),

  // ── أسرة القيادة (t2) ────────────────────────────
  mkst("st16","حمزة بن راشد العسيري",      "0502002001","ثالث ثانوي", "قيادة","t2","PAID",   2500,2500,190, 98),
  mkst("st17","عبدالملك بن صالح الغامدي",  "0502002002","أوّل ثانوي", "قيادة","t2","PAID",   2500,2500,185, 94),
  mkst("st18","أيمن بن محمد الزهراني",     "0502002003","ثاني ثانوي", "قيادة","t2","PAID",   2500,2500,178, 90),
  mkst("st19","مشعل بن عبدالله القرني",    "0502002004","ثالث ثانوي", "قيادة","t2","PARTIAL",1800,2500,170, 86),
  mkst("st20","هاشم بن خالد الشمري",       "0502002005","أوّل ثانوي", "قيادة","t2","PAID",   2500,2500,163, 92),
  mkst("st21","عبدالرحمن بن ناصر العنزي",  "0502002006","ثاني ثانوي", "قيادة","t2","PAID",   2500,2500,158, 88),
  mkst("st22","تركي بن سلمان القحطاني",    "0502002007","ثالث ثانوي", "قيادة","t2","PAID",   2500,2500,152, 84),
  mkst("st23","فهد بن عمر المطيري",        "0502002008","أوّل ثانوي", "قيادة","t2","PARTIAL", 500,2500,145, 62),
  mkst("st24","سعود بن أحمد الدوسري",      "0502002009","ثاني ثانوي", "قيادة","t2","PAID",   2500,2500,138, 90),
  mkst("st25","راشد بن فهد الحربي",        "0502002010","ثالث ثانوي", "قيادة","t2","PAID",   2500,2500,130, 80),
  mkst("st26","أسامة بن تركي الشهري",      "0502002011","أوّل ثانوي", "قيادة","t2","PENDING",   0,2500,122, 58),
  mkst("st27","حسن بن علي الرشيدي",        "0502002012","ثاني ثانوي", "قيادة","t2","PAID",   2500,2500,115, 86),
  mkst("st28","ماجد بن ياسر العتيبي",      "0502002013","ثالث ثانوي", "قيادة","t2","PAID",   2500,2500,110, 82),
  mkst("st29","عادل بن صالح الزهراني",     "0502002014","أوّل ثانوي", "قيادة","t2","PAID",   2500,2500,105, 90),
  mkst("st30","جاسر بن محمد البلوي",       "0502002015","ثاني ثانوي", "قيادة","t2","PARTIAL",2000,2500,100, 76),

  // ── أسرة العلو (t3) ──────────────────────────────
  mkst("st31","نايف بن سعد العسيري",       "0502003001","ثالث ثانوي", "علو","t3","PAID",   2500,2500,205,100),
  mkst("st32","عبدالله بن محمد الغامدي",   "0502003002","أوّل ثانوي", "علو","t3","PAID",   2500,2500,198, 96),
  mkst("st33","سامي بن راشد الشمري",       "0502003003","ثاني ثانوي", "علو","t3","PAID",   2500,2500,192, 94),
  mkst("st34","حمد بن خالد القحطاني",      "0502003004","ثالث ثانوي", "علو","t3","PARTIAL",1500,2500,185, 88),
  mkst("st35","مطيع بن عبدالله الدوسري",   "0502003005","أوّل ثانوي", "علو","t3","PAID",   2500,2500,180, 92),
  mkst("st36","أنور بن سلطان العنزي",      "0502003006","ثاني ثانوي", "علو","t3","PAID",   2500,2500,175, 90),
  mkst("st37","فارس بن أحمد الزهراني",     "0502003007","ثالث ثانوي", "علو","t3","PAID",   2500,2500,168, 86),
  mkst("st38","عزيز بن علي المطيري",       "0502003008","أوّل ثانوي", "علو","t3","PARTIAL", 800,2500,160, 72),
  mkst("st39","سلطان بن ناصر الحربي",      "0502003009","ثاني ثانوي", "علو","t3","PAID",   2500,2500,155, 88),
  mkst("st40","عبدالكريم بن فهد الشهري",   "0502003010","ثالث ثانوي", "علو","t3","PAID",   2500,2500,148, 84),
  mkst("st41","أيوب بن تركي الرشيدي",      "0502003011","أوّل ثانوي", "علو","t3","PENDING",   0,2500,140, 56),
  mkst("st42","حازم بن محمد البلوي",       "0502003012","ثاني ثانوي", "علو","t3","PAID",   2500,2500,132, 90),
  mkst("st43","وائل بن صالح القرني",       "0502003013","ثالث ثانوي", "علو","t3","PAID",   2500,2500,125, 82),
  mkst("st44","براء بن عيسى العتيبي",      "0502003014","أوّل ثانوي", "علو","t3","PAID",   2500,2500,118, 88),
  mkst("st45","كرار بن حمد الغامدي",       "0502003015","ثاني ثانوي", "علو","t3","PARTIAL",1000,2500,110, 74),
];

/** حضور وهمي ثابت: خمسة أيّام، مع غيابٍ متفرّق لبعض الطلاب. */
const ATTENDANCE: Record<string, boolean[]> = {};
for (const st of STUDENTS) {
  const arr = [true, true, true, true, true];
  if (["st12","st23","st41"].includes(st.id)) { arr[1] = false; arr[3] = false; }
  else if (["st08","st26","st38"].includes(st.id)) { arr[2] = false; }
  ATTENDANCE[st.id] = arr;
}

const STUDENT_TASKS: StudentTask[] = [
  { id: "sk1", studentId: "st01", title: "المشاركة في مسابقة المعلومات العامّة", points: 50,  kind: "activity",  done: true, visible: true, createdAt: "2026-07-21T09:00:00Z" },
  { id: "sk2", studentId: "st02", title: "قيادة فريق النشيد الختامي",            points: 40,  kind: "activity",  done: true, visible: true, createdAt: "2026-07-21T10:00:00Z" },
  { id: "sk3", studentId: "st31", title: "الفوز في مسابقة التسلّق",              points: 80,  kind: "activity",  done: true, visible: true, createdAt: "2026-07-22T08:00:00Z" },
  { id: "sk4", studentId: "st16", title: "التميّز في إدارة الحوار الجماعي",      points: 60,  kind: "activity",  done: true, visible: true, createdAt: "2026-07-20T14:00:00Z" },
  { id: "sk5", studentId: "st12", title: "غياب عن جلسة الصباح دون عذر",         points: -20, kind: "deduction", done: true, visible: true, createdAt: "2026-07-21T07:30:00Z" },
  { id: "sk6", studentId: "st08", title: "إزعاجٌ أثناء المحاضرة المسائيّة",      points: -15, kind: "deduction", done: true, visible: true, createdAt: "2026-07-22T20:00:00Z" },
];

const ANNOUNCEMENTS: ActivityAnnouncement[] = [
  { id: "an1", title: "مسابقة التحدّي الفكري — ١٠٠ نقطة للفائز",     points: 100, committeeId: "c3", active: true,  createdAt: "2026-07-20T12:00:00Z" },
  { id: "an2", title: "نشاط تسلّق الجبل — ٨٠ نقطة للمشارك المتميّز", points: 80,  committeeId: "c5", active: true,  createdAt: "2026-07-21T08:00:00Z" },
  { id: "an3", title: "ليلة الإبداع الفنّي — ٥٠ نقطة لكلّ مشارك",    points: 50,  committeeId: "c2", active: false, createdAt: "2026-07-19T18:00:00Z" },
];

const NEWS: NewsPost[] = [
  { id: "nw1", title: "تأجيل رحلة السوق الشعبي إلى مساء الغد",      body: "بسبب الطقس يُقرَّر تأجيل زيارة السوق الشعبي إلى مساء الأحد.",  active: true, createdByName: "الأمير التجريبي", createdAt: "2026-07-22T15:00:00Z" },
  { id: "nw2", title: "نتائج مسابقة المعلومات — أسرة العلو تتصدّر!", body: "احتفلت أسرة العلو بالمركز الأوّل في مسابقة المعلومات العامّة.", active: true, createdByName: "لجنة المسابقات",   createdAt: "2026-07-21T20:00:00Z" },
  { id: "nw3", title: "ترحيبٌ بالضيوف الكرام في ختام اليوم الثاني", body: "انضمّ إلينا عددٌ من ضيوف الرحلة في جلسة الختام المسائيّة.",    active: true, createdByName: "لجنة الإعلام",     createdAt: "2026-07-21T22:00:00Z" },
];

const INVOICES: Invoice[] = [
  { id: "inv1", code: "INV-001", vendor: "مؤسسة النجمة للتموين", purpose: "تأمين وجبات اليوم الأوّل",
    scope: { kind: "event" }, amount: 4500, vat: 675, date: "2026-07-20", status: "approved", extractedByAI: true,
    conditions: { taxInvoice: true, associationName: true, associationTaxNumber: true, vendorTaxNumber: true, issueDate: true, serviceDetails: true, quantityAndTotal: true }, vendorTaxNumber: "3001234567" },
  { id: "inv2", code: "INV-002", vendor: "شركة المغامرات السعودية", purpose: "إيجار معدّات التسلّق",
    scope: { kind: "committee", committeeId: "c5" }, amount: 3200, vat: 480, date: "2026-07-21", status: "approved", extractedByAI: true,
    conditions: { taxInvoice: true, associationName: true, associationTaxNumber: true, vendorTaxNumber: true, issueDate: true, serviceDetails: true, quantityAndTotal: true } },
  { id: "inv3", code: "INV-003", vendor: "مطبعة الإبداع", purpose: "طباعة لافتات وشعارات الرحلة",
    scope: { kind: "committee", committeeId: "c2" }, amount: 850, vat: 127, date: "2026-07-18", status: "paid", extractedByAI: false },
  { id: "inv4", code: "INV-004", vendor: "استراحة جبال عسير", purpose: "إيجار المقرّ الرئيسي للرحلة",
    scope: { kind: "team", teamId: "t1" }, amount: 8000, vat: 1200, date: "2026-07-15", status: "paid", extractedByAI: false },
  { id: "inv5", code: "INV-005", vendor: "متجر اللوازم الرياضية", purpose: "كرات وأدوات رياضيّة",
    scope: { kind: "committee", committeeId: "c3" }, amount: 1200, vat: 180, date: "2026-07-19", status: "pending", extractedByAI: true,
    conditions: { taxInvoice: false, associationName: true, associationTaxNumber: false, vendorTaxNumber: true, issueDate: true, serviceDetails: true, quantityAndTotal: true } },
  { id: "inv6", code: "INV-006", vendor: "محل هدايا القمم", purpose: "جوائز مسابقات الأسر",
    scope: { kind: "event" }, amount: 2200, vat: 330, date: "2026-07-22", status: "approved", extractedByAI: false },
  { id: "inv7", code: "INV-007", vendor: "مؤسّسة النقل والمواصلات", purpose: "إيجار حافلتَي النقل",
    scope: { kind: "event" }, amount: 3600, vat: 540, date: "2026-07-14", status: "overdue", extractedByAI: false },
];

const REG_FIELDS: RegField[] = [
  { key: "name",    label: "الاسم الكامل",    type: "نص",      required: true,  active: true,  desc: "اسمُ الطالب رباعياً كما في الهويّة." },
  { key: "nid",     label: "رقم الهويّة",      type: "رقم",     required: true,  active: true,  desc: "يُخزَّن مشفَّراً — لا يظهر كاملاً إلاّ للأمير الأصل." },
  { key: "phone",   label: "الجوّال",          type: "هاتف",    required: true,  active: true,  desc: "رقم واتساب مُفضَّل، للتواصل مع الطالب مباشرة." },
  { key: "grade",   label: "الصف الدراسي",    type: "قائمة",   required: true,  active: true,  desc: "من قائمة: أوّل/ثاني/ثالث ثانوي." },
  { key: "section", label: "الفريق",           type: "قائمة",   required: false, active: true,  desc: "الريادة/القيادة/العلو — لتوزيعٍ مبدئي." },
  { key: "photo",   label: "الصورة الشخصيّة", type: "ملف",     required: false, active: true,  desc: "بحدٍّ أقصى ٥ ميغا." },
  { key: "emergP",  label: "رقم وليّ الأمر",  type: "هاتف",    required: true,  active: true,  desc: "متاح ٢٤ ساعة أثناء الرحلة." },
  { key: "health",  label: "مقترحك للسفرة",   type: "نص طويل", required: false, active: true,  desc: "ملاحظاتك واقتراحاتك للرحلة (اختياري)." },
];

function buildDemoState(): State {
  return {
    teams:            TEAMS,
    students:         STUDENTS,
    supervisors:      SUPERVISORS,
    committees:       COMMITTEES,
    committeeTasks:   COMMITTEE_TASKS,
    studentTasks:     STUDENT_TASKS,
    announcements:    ANNOUNCEMENTS,
    news:             NEWS,
    invoices:         INVOICES,
    regFields:        REG_FIELDS,
    regOpen:          true,
    attendance:       ATTENDANCE,
    trashInvoices:    [],
    trashStudents:    [],
    logoDisplayMode:  "ANIMATED",
    motivations:      DEFAULT_MOTIVATIONS,
    tickerPhrases:    DEFAULT_TICKER,
    tripMessage:      "مرحباً بكم في رحلة معالي ١٤٤٨هـ — رحلةٌ تُدار من مكانٍ واحد، تجمع الأمير مع رعيته في مرتفعات عسير الجميلة.",
    postRegisterNote: "١ · يراجع طلبَك الأمير أو نائبه.\n٢ · ستصلك رسالة القبول متضمّنةً اسم المستخدم وكلمة المرور.",
    logoUrl:          "",
    logoVersion:      0,
    scheduleUrl:      "",
    scheduleVersion:  0,
    brandColors:      null,
    pageMarquees:     {},
    associationName:  "جمعية بلّسمر للتنمية الاجتماعيّة",
    associationTaxNumber: "3009876543",
    conditionsPolicy: DEFAULT_CONDITIONS_POLICY,
    defaultFee:       2500,
  };
}

/* ════════════════════════════════════════════════════════
   loadAllData — تُعيد الحالة الكاملة دون قاعدة بيانات
════════════════════════════════════════════════════════ */

export async function loadAllData(): Promise<State> {
  return buildDemoState();
}

/* ════════════════════════════════════════════════════════
   الدليل العام (صفحات المشرفين/اللجان العامّة) — بيانات وهمية
════════════════════════════════════════════════════════ */

export type PublicSupervisor = {
  id: string; name: string; specialty?: string; photoDataUrl?: string;
  committeeIds: string[]; teamIds: string[];
};
export type PublicCommittee = {
  id: string; name: string; description: string; color: string;
  imageDataUrl?: string; supervisorIds: string[]; studentCount: number;
};
export type PublicDirectory = { committees: PublicCommittee[]; supervisors: PublicSupervisor[] };

export async function loadPublicDirectory(): Promise<PublicDirectory> {
  // عددُ طلاب اللجنة = مجموع طلاب فرق مشرفيها (اشتقاق من البيانات الوهمية).
  const teamCount: Record<string, number> = {};
  for (const t of TEAMS) teamCount[t.id] = t.studentCount;

  const committees: PublicCommittee[] = COMMITTEES.map(c => {
    const teamIds = new Set<string>();
    for (const sid of c.supervisorIds) {
      const sup = SUPERVISORS.find(s => s.id === sid);
      for (const tid of sup?.teamIds ?? []) teamIds.add(tid);
    }
    let studentCount = 0;
    for (const tid of teamIds) studentCount += teamCount[tid] ?? 0;
    return {
      id: c.id, name: c.name, description: c.description, color: c.color,
      imageDataUrl: c.imageDataUrl, supervisorIds: c.supervisorIds, studentCount,
    };
  });

  const supervisors: PublicSupervisor[] = SUPERVISORS.map(s => ({
    id: s.id, name: s.name, specialty: s.specialty, photoDataUrl: s.photoDataUrl,
    committeeIds: s.committeeIds, teamIds: s.teamIds,
  }));

  return { committees, supervisors };
}

/* ════════════════════════════════════════════════════════
   دوالّ الكتابة — كلّها بلا أثر (no-ops) في نسخة العرض
════════════════════════════════════════════════════════ */

// Teams
export async function dbAddTeam(_n: string, _c: string, _b: string, _s: string, _t: string): Promise<void> {}
export async function dbUpdateTeam(_id: string, _p: unknown): Promise<void> {}
export async function dbDeleteTeam(_id: string): Promise<void> {}
export async function dbSetTeamBudget(_id: string, _b: number): Promise<void> {}

// Students
export async function dbAddStudent(_p: unknown): Promise<void> {}
export async function dbRegisterStudent(input: {
  name: string; phone: string; grade: string; section: Student["section"];
  emergencyContact: string; emergencyPhone: string; photoDataUrl?: string; nationalId?: string;
  regAnswers?: Record<string, string>;
}): Promise<Student> {
  return {
    id: "demo-" + Date.now(),
    name: input.name, phone: input.phone, grade: input.grade, section: input.section,
    nationalIdMasked: "••••0000",
    teamId: "", paymentStatus: "PENDING", paidAmount: 0, totalAmount: 2500,
    points: 0, emergencyContact: input.emergencyContact, emergencyPhone: input.emergencyPhone,
    attendance: 100, approvalStatus: "PENDING", registeredAt: new Date().toISOString(),
  };
}
export async function dbApproveStudent(_id: string, _teamId: string, _code?: string): Promise<void> {}
export async function dbRejectStudent(_id: string): Promise<void> {}
export async function dbUpdateStudent(_id: string, _p: unknown): Promise<void> {}
export async function dbDeleteStudent(_id: string): Promise<void> {}
export async function dbRestoreStudent(_id: string): Promise<void> {}
export async function dbPurgeStudent(_id: string): Promise<void> {}
export async function dbMoveStudent(_id: string, _t: string): Promise<void> {}
export async function dbSetPayment(_id: string, _s: unknown, _paid: number): Promise<void> {}
export async function dbSetStudentPhoto(_id: string, _url: string): Promise<void> {}
export async function dbSubmitReceipt(_id: string, _url: string): Promise<void> {}
export async function dbReviewReceipt(_id: string, _approve: boolean, _amount?: number): Promise<void> {}

// Supervisors
export async function dbAddSupervisor(..._args: unknown[]): Promise<void> {}
export async function dbUpdateSupervisor(_id: string, _p: unknown): Promise<void> {}
export async function dbDeleteSupervisor(_id: string): Promise<void> {}
export async function dbImportSupervisors(_rows: unknown[]): Promise<void> {}

// Committees
export async function dbAddCommittee(_n: string, _d: string, _s: string[], _c: string, _img?: string): Promise<void> {}
export async function dbUpdateCommittee(_id: string, _p: unknown): Promise<void> {}
export async function dbDeleteCommittee(_id: string): Promise<void> {}
export async function dbSetCommitteeBudget(_id: string, _b: number): Promise<void> {}

// Committee tasks
export async function dbAddCommitteeTask(_committeeId: string, _title: string, _assigneeId?: string): Promise<void> {}
export async function dbToggleCommitteeTask(_id: string, _done: boolean): Promise<void> {}
export async function dbDeleteCommitteeTask(_id: string): Promise<void> {}

// Student tasks & activities
export async function dbAddActivity(_input: unknown): Promise<void> {}
export async function dbToggleStudentTask(_id: string, _done: boolean): Promise<void> {}
export async function dbToggleActivityBatch(_batchId: string, _done: boolean): Promise<void> {}
export async function dbSetStudentTaskVisible(_id: string, _visible: boolean): Promise<void> {}
export async function dbDeleteStudentTask(_id: string): Promise<void> {}
export async function dbDeleteActivityBatch(_batchId: string): Promise<void> {}

// Announcements
export async function dbAddAnnouncement(_input: unknown): Promise<void> {}
export async function dbUpdateAnnouncement(_id: string, _p: unknown): Promise<void> {}
export async function dbDeleteAnnouncement(_id: string): Promise<void> {}

// News
export async function dbAddNews(_input: unknown): Promise<void> {}
export async function dbUpdateNews(_id: string, _p: unknown): Promise<void> {}
export async function dbDeleteNews(_id: string): Promise<void> {}

// Default fee
export async function dbSetDefaultFee(_amount: number): Promise<void> {}

// Invoices
export async function dbAnalyzeInvoice(_imageDataUrl: string): Promise<OcrExtraction> {
  return {
    vendorName: "مورّد تجريبي", vendorTaxNumber: "3001234567",
    associationName: "جمعية بلّسمر للتنمية الاجتماعيّة", associationTaxNumber: "3009876543",
    invoiceNumber: "INV-DEMO-001", issueDate: new Date().toISOString().slice(0, 10),
    lineItems: [{ description: "خدمة تجريبية", quantity: 1, unitPrice: 1000, total: 1000 }],
    vatAmount: 150, total: 1150, isTaxInvoice: true,
  };
}
export async function dbAddInvoice(_input: unknown): Promise<void> {}
export async function dbAddInvoices(_inputs: unknown[]): Promise<void> {}
export async function dbApproveInvoice(_id: string): Promise<void> {}
export async function dbRejectInvoice(_id: string): Promise<void> {}
export async function dbDeleteInvoice(_id: string): Promise<void> {}
export async function dbRestoreInvoice(_id: string): Promise<void> {}

// Registration
export async function dbToggleRegField(_key: string): Promise<void> {}
export async function dbReorderRegField(_key: string, _dir: "up" | "down"): Promise<void> {}
export async function dbAddRegField(_field: unknown): Promise<void> {}
export async function dbUpdateRegField(_key: string, _p: unknown): Promise<void> {}
export async function dbRemoveRegField(_key: string): Promise<void> {}
export async function dbSetRegOpen(_open: boolean): Promise<void> {}

// Attendance
export async function dbToggleAttendance(_studentId: string, _day: number): Promise<void> {}

// Logo & display
export async function dbSetLogoDisplayMode(_mode: LogoDisplayMode): Promise<void> {}
export async function dbSetLogoUrl(_url: string): Promise<void> {}
export async function dbSetScheduleUrl(_url: string): Promise<void> {}
export async function dbSetBrandColors(_colors: BrandColors | null): Promise<void> {}

// Settings
export async function dbSetMotivations(_list: string[]): Promise<void> {}
export async function dbSetTickerPhrases(_list: string[]): Promise<void> {}
export async function dbSetTripMessage(_text: string): Promise<void> {}
export async function dbSetPostRegisterNote(_text: string): Promise<void> {}
export async function dbSetPageMarquees(_map: PageMarqueeMap): Promise<void> {}
export async function dbSetAssociationIdentity(_name: string, _tax: string): Promise<void> {}
export async function dbSetConditionsPolicy(_policy: ConditionsPolicy): Promise<void> {}
export async function dbResetAll(): Promise<void> {}

/* ════════════════════════════════════════════════════════
   دوالّ المصادقة — قيمٌ ثابتة (تُستخدَم من لوحة إدارة الأمراء)
════════════════════════════════════════════════════════ */

export type AdminRow = { id: string; phone: string; name: string; role: string; isOwner: boolean };

export async function dbVerifyLogin(_phone: string, _code: string): Promise<LoginResult> {
  return {
    ok: true,
    session: {
      phone: "0500000000", name: "الأمير التجريبي",
      role: "PRINCE", isOwner: true,
      supervisorId: null, studentId: null,
      landing: "/dashboard",
    },
  };
}
export async function dbSetLoginCode(_phone: string, _current: string, _next: string): Promise<boolean> {
  return true;
}
export async function dbListAdmins(): Promise<AdminRow[]> {
  return [{ id: "admin1", phone: "0500000000", name: "الأمير التجريبي", role: "PRINCE", isOwner: true }];
}
export async function dbCreateAdmin(_name: string, _phone: string, _code: string, _role: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}
export async function dbTransferOwnership(_fromPhone: string, _toId: string): Promise<boolean> {
  return true;
}
export async function dbDeleteAdmin(_id: string): Promise<boolean> {
  return true;
}
