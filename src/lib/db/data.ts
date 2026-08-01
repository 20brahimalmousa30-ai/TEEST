"use server";
import { getSupabase } from "@/lib/supabase/server";
import type { Team, Student, Supervisor, Committee, Invoice, PaymentStatus, ActivityAnnouncement, NewsPost } from "@/lib/mock/types";
import type { RegField, LogoDisplayMode, State } from "@/lib/store/StoreProvider";
import type { LoginResult } from "./types";
import {
  rowToTeam, teamToRow,
  rowToCommittee, committeeToRow,
  rowToSupervisor, supervisorToRow,
  rowToStudent, studentToRow,
  rowToInvoice, invoiceToRow,
  rowToRegField, rowToStudentTask,
  rowToActivityAnnouncement, rowToNewsPost,
} from "./mappers";
import { motivations as DEFAULT_MOTIVATIONS, tickerPhrases as DEFAULT_TICKER } from "@/lib/motivations";
import type { PageMarqueeMap } from "@/lib/pageMarquees";
import { getSession } from "@/lib/auth/session-core";
import { normalizePhone } from "@/lib/phone";
import type { DbSession } from "./types";
import { analyzeInvoice, type InvoiceMediaType } from "@/lib/ai/vision";
import { evaluateConditions, passesPolicy, DEFAULT_CONDITIONS_POLICY } from "@/lib/ai/conditions";
import type { OcrExtraction, ConditionsPolicy } from "@/lib/mock/types";

/* ═══════════════════════ حُرّاسُ الصلاحية (خادم) ═══════════════════════
 * كلُّ دالّةٍ مُصدَّرة هنا هي نقطةُ RPC عامّة قابلةٌ للاستدعاء المباشر — لا يكفي
 * إخفاءُ الأزرار في الواجهة. لذا نتحقّق من الجلسة والدور داخل كلّ عمليّة كتابة. */

const STAFF = ["PRINCE", "DEPUTY_PRINCE", "SUPERVISOR"];
const ADMIN = ["PRINCE", "DEPUTY_PRINCE"];

/** كلُّ أعمدة جدول الطلاب **ما عدا** أعمدة الصور base64 الثقيلة
 *  (photo_data_url / receipt_data_url). تُستعمل في اللقطة الجماعية للطاقم
 *  حتى لا تُنقَل الصور في كلّ تحميل؛ تُجلَب الصور عند الطلب عبر مسارٍ مستقلّ. */
const STUDENT_LEAN_COLUMNS =
  "id,name,national_id_masked,national_id,phone,grade,section,team_id,payment_status," +
  "paid_amount,total_amount,points,emergency_contact,emergency_phone,attendance," +
  "approval_status,registered_at,access_code,receipt_status,receipt_amount,receipt_submitted_at,reg_answers,deleted_at";

/** كلُّ أعمدة الفواتير **ما عدا** image_data_url (base64 ثقيل يُجلَب عند الطلب
 *  عبر /api/invoices/[id]/image). has_image علمٌ خفيفٌ بديل. */
const INVOICE_LEAN_COLUMNS =
  "id,code,vendor,purpose,scope,amount,vat,date,status,extracted_by_ai,has_image," +
  "line_items,conditions,vendor_tax_number,invoice_number,uploaded_by,submitted_at,in_trash,created_at";

/** كلُّ أعمدة الإعدادات **ما عدا** logo_url (base64 ثقيل يُجلَب عند الطلب). */
const APP_SETTINGS_LEAN_COLUMNS =
  "id,reg_open,logo_display_mode,motivations,ticker_phrases,trip_message," +
  "post_register_note,brand_accent,brand_accent_warm,page_marquees,logo_version," +
  "association_name,association_tax_number,conditions_policy,default_fee";

async function requireSession(): Promise<DbSession> {
  const s = await getSession();
  if (!s) throw new Error("غير مصرّح — يجب تسجيل الدخول.");
  return s;
}
/** أيّ عضوٍ في الطاقم (أمير/نائب/مشرف). */
async function requireStaff(): Promise<DbSession> {
  const s = await requireSession();
  if (!STAFF.includes(s.role)) throw new Error("غير مصرّح.");
  return s;
}
/** الإدارة فقط (أمير/نائب أمير) — للإعدادات والعمليّات الحسّاسة. */
async function requireAdmin(): Promise<DbSession> {
  const s = await requireSession();
  if (!ADMIN.includes(s.role)) throw new Error("غير مصرّح — للإدارة فقط.");
  return s;
}
/** المالك الأصل فقط — لإدارة الحسابات الإداريّة. */
async function requireOwner(): Promise<DbSession> {
  const s = await requireSession();
  if (!s.isOwner) throw new Error("غير مصرّح — للمالك الأصل فقط.");
  return s;
}
/** الإدارة، أو مشرفٌ يملك صلاحيّةَ القسم المطلوب (students/teams/committees/invoices).
 *  يمنع مشرفاً من الوصول لقسمٍ لم يُمنَح له — ولو عبر استدعاء الإجراء مباشرةً. */
async function requirePermission(perm: string): Promise<DbSession> {
  const s = await requireSession();
  if (ADMIN.includes(s.role)) return s;
  if (s.role === "SUPERVISOR" && s.supervisorId) {
    const { data } = await getSupabase()
      .from("supervisors").select("permissions").eq("id", s.supervisorId).single();
    const perms = (data?.permissions ?? []) as string[];
    if (perms.includes(perm)) return s;
  }
  throw new Error("غير مصرّح — لا تملك صلاحيّةَ هذا القسم.");
}
/** المستفيد لنفسه فقط، أو أيّ عضو طاقم — لرفع الإيصال/الصورة الذاتيّة. */
async function requireSelfOrStaff(studentId: string): Promise<DbSession> {
  const s = await requireSession();
  if (STAFF.includes(s.role)) return s;
  if (s.role === "BENEFICIARY" && s.studentId === studentId) return s;
  throw new Error("غير مصرّح.");
}

/** يطابق البايتات الأولى (magic bytes) للنوع المُعلَن — يمنع حمولةً عشوائيّة تتنكّر كصورة. */
function magicMatches(format: string, head: Buffer): boolean {
  const fmt = format === "jpg" ? "jpeg" : format;
  switch (fmt) {
    case "png":
      return head.length >= 8 &&
        head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "jpeg":
      return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case "webp":
      return head.length >= 12 &&
        head.subarray(0, 4).toString("ascii") === "RIFF" &&
        head.subarray(8, 12).toString("ascii") === "WEBP";
    case "gif": {
      const sig = head.subarray(0, 6).toString("ascii");
      return sig === "GIF87a" || sig === "GIF89a";
    }
    default:
      return false;
  }
}

/** يتحقّق أنّ سلسلة Data URL صورةٌ مدعومة وبحجمٍ معقول (يمنع SVG/الحمولات الخبيثة). */
function assertValidImage(dataUrl?: string): void {
  if (!dataUrl) return;
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!m) throw new Error("صيغة الصورة غير مدعومة (المسموح: PNG/JPEG/WebP/GIF).");
  const bytes = Math.floor((m[2].length * 3) / 4);
  if (bytes > 3 * 1024 * 1024) throw new Error("حجم الصورة يتجاوز الحدّ (٣ ميغابايت).");
  // تحقّق البايتات الأولى: يجب أن يطابق المحتوى النوعَ المُعلَن فعلاً، لا الترويسة وحدها.
  const head = Buffer.from(m[2].slice(0, 24), "base64");
  if (!magicMatches(m[1], head)) throw new Error("محتوى الصورة لا يطابق نوعها المُعلَن.");
}

/** يقرأ مصفوفة نصوصٍ من عمود JSON.
 *  إن لم يُضبط العمود إطلاقاً (null/غير مصفوفة) نرجع للافتراضيّات؛ أمّا إن كان
 *  مصفوفةً صريحة — ولو فارغة بعد حذف الأمير لكلّ الجُمل — فنحترمها كما هي
 *  (لئلّا تعود الجُمل المحذوفة تلقائياً). */
function readPhrases(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

// عدّادٌ تصاعديّ يضمن تفرّد المعرّفات حتى عند توليد عدّةٍ في نفس المِلّي ثانية
//  (مثل إدراج دفعة فواتير متعدّدة في استدعاءٍ واحد) — يمنع تصادم المفتاح الأساسيّ.
let uidCounter = 0;
const uid = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const maskNid = () => "••••••" + Math.floor(1000 + Math.random() * 8999);

/* ─────────────────────────── القراءة ─────────────────────────── */

/** يقرأ لقطةً للحالة من قاعدة البيانات، **مُقيّدةً بدور المُستدعي**:
 *  - زائرٌ غير مسجّل: إعداداتٌ عامّة فقط (لا بيانات شخصيّة إطلاقاً).
 *  - مستفيد: سجلُّه الشخصيّ وفريقُه فقط (لِـ /me) — دون بقيّة الشباب.
 *  - طاقمٌ (أمير/نائب/مشرف): لقطةٌ كاملة.
 *  هذا يمنع تسريب بيانات الشباب (هواتف/جهاتُ طوارئ/رموزُ دخول) لأيّ زائر. */
export async function loadAllData(): Promise<State> {
  const db = getSupabase();
  const session = await getSession();

  // إعداداتٌ وحقولُ تسجيلٍ عامّة — تحتاجها صفحةُ التسجيل والواجهةُ حتى بلا جلسة.
  const [regRows, settings] = await Promise.all([
    db.from("reg_fields").select("*").order("sort", { ascending: true }),
    // نستبعد logo_url (base64 ثقيل ≈ ٢٥٠ ك.ب) من كل تحميلٍ للصفحة؛ يُجلَب الشعار
    // عند الطلب عبر /api/logo، ونكتفي هنا بـ logo_version الخفيف لبناء الرابط.
    db.from("app_settings").select(APP_SETTINGS_LEAN_COLUMNS).eq("id", 1).single(),
  ]);

  // تحديدُ أعمدةٍ بسلسلةٍ متغيّرة يُفقِد Supabase استنتاجَ نوع الصفّ، فنُصرّح به يدويّاً.
  const s = settings.data as {
    reg_open?: boolean; logo_display_mode?: string;
    motivations?: unknown; ticker_phrases?: unknown;
    trip_message?: string; post_register_note?: string;
    logo_version?: number; brand_accent?: string; brand_accent_warm?: string;
    page_marquees?: unknown;
    association_name?: string; association_tax_number?: string; conditions_policy?: unknown;
    default_fee?: number;
  } | null;

  const publicState = {
    regFields:      (regRows.data ?? []).map(rowToRegField),
    regOpen:        s?.reg_open ?? true,
    logoDisplayMode: (s?.logo_display_mode ?? "ANIMATED") as LogoDisplayMode,
    motivations:    readPhrases(s?.motivations, DEFAULT_MOTIVATIONS),
    tickerPhrases:  readPhrases(s?.ticker_phrases, DEFAULT_TICKER),
    tripMessage:    s?.trip_message ?? "",
    postRegisterNote: s?.post_register_note ?? "",
    // logoUrl فارغٌ في اللقطة (لا نشحن base64)؛ الشعار المخصّص يُعرض عبر /api/logo
    // اعتماداً على logoVersion. يبقى logoUrl للمعاينة الفوريّة بعد الرفع فقط.
    logoUrl:        "",
    logoVersion:    s?.logo_version ?? 0,
    brandColors:    (s?.brand_accent && s?.brand_accent_warm)
      ? { accent: s.brand_accent, accentWarm: s.brand_accent_warm }
      : null,
    pageMarquees:   (s?.page_marquees ?? {}) as PageMarqueeMap,
    associationName:      s?.association_name ?? "",
    associationTaxNumber: s?.association_tax_number ?? "",
    conditionsPolicy:     (s?.conditions_policy as ConditionsPolicy | null) ?? DEFAULT_CONDITIONS_POLICY,
    defaultFee:           s?.default_fee ?? 2500,
  };

  const base: State = {
    teams: [], students: [], supervisors: [], committees: [], committeeTasks: [],
    studentTasks: [], announcements: [], news: [],
    invoices: [], trashInvoices: [], trashStudents: [], attendance: {},
    ...publicState,
  };

  // زائرٌ غير مسجّل: إعداداتٌ عامّة فقط.
  if (!session) return base;

  // المستفيد: سجلُّه وفريقُه فقط.
  if (session.role === "BENEFICIARY") {
    if (!session.studentId) return base;
    const [meRow, teams, myTasks, committees, anns, news] = await Promise.all([
      db.from("students").select("*").eq("id", session.studentId).single(),
      db.from("teams").select("*").order("points", { ascending: false }),
      // البند ١: يرى الطالب مهامّه المرئيّة فقط (visible=true).
      db.from("student_tasks").select("*")
        .eq("student_id", session.studentId).eq("visible", true)
        .order("created_at", { ascending: false }),
      // لوحة الإعلانات: يرى الطالبُ أسماءَ اللجان (غيرُ حسّاسة) والإعلاناتِ الفعّالة فقط.
      db.from("committees").select("id,name,color,description"),
      db.from("activity_announcements").select("*").eq("active", true)
        .order("created_at", { ascending: false }),
      // لوحة «آخر الأخبار»: الأخبارُ الفعّالة فقط، أحدثها أوّلاً.
      db.from("news_posts").select("*").eq("active", true)
        .order("created_at", { ascending: false }).limit(50),
    ]);
    // حسابٌ في سلة المحذوفات = محذوفٌ فعلياً في نظر المستفيد؛ لا بيانات له.
    if (meRow.data?.deleted_at) return base;
    return {
      ...base,
      teams: (teams.data ?? []).map(rowToTeam),
      students: meRow.data ? [rowToStudent(meRow.data)] : [],
      studentTasks: (myTasks.data ?? []).map(rowToStudentTask),
      committees: (committees.data ?? []).map(rowToCommittee),
      announcements: (anns.data ?? []).map(rowToActivityAnnouncement),
      news: (news.data ?? []).map(rowToNewsPost),
    };
  }

  // غيرُ الطاقم (دورٌ غير معروف): لا بيانات شخصيّة.
  if (!STAFF.includes(session.role)) return base;

  // تنظيفٌ كسول: يُحذَف نهائياً كلُّ طالبٍ مضى على وجوده في السلة أكثر من ١٠ ساعات.
  await purgeExpiredStudents(db);

  // الطاقم: لقطةٌ كاملة — لكن **دون** أعمدة base64 الثقيلة
  // (photo_data_url / receipt_data_url). كانت هذه الأعمدة تنقل ميغابايتات
  // في كلّ تحميلٍ للصفحة (صورةٌ واحدة ≈ ٣٠٠ ك.ب) وتتضخّم خطّياً مع عدد
  // المستفيدين، فصارت أكبر سببٍ لبطء الموقع. تُجلَب الصور الآن عند الطلب
  // فقط عبر مسار /api/students/[id]/image عند عرض صورةٍ بعينها.
  const [teams, students, supervisors, committees, invoices, attRows, asgRows, cTasks, sTasks, anns, news] =
    await Promise.all([
      db.from("teams").select("*").order("points", { ascending: false }),
      db.from("students").select(STUDENT_LEAN_COLUMNS).order("points", { ascending: false }),
      db.from("supervisors").select("*"),
      db.from("committees").select("*"),
      db.from("invoices").select(INVOICE_LEAN_COLUMNS).order("created_at", { ascending: false }),
      db.from("attendance").select("*"),
      db.from("supervisor_assignments").select("*"),
      db.from("committee_tasks").select("*").order("created_at", { ascending: false }),
      db.from("student_tasks").select("*").order("created_at", { ascending: false }),
      db.from("activity_announcements").select("*").order("created_at", { ascending: false }),
      // لوحة «آخر الأخبار»: كلُّ الأخبار للطاقم (ليديروا المخفيَّ أيضاً).
      db.from("news_posts").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

  const attendance: Record<string, boolean[]> = {};
  for (const a of attRows.data ?? []) {
    const arr = attendance[a.student_id] ?? [false, false, false, false, false, false, false, false];
    arr[a.day] = a.present;
    attendance[a.student_id] = arr;
  }

  // اشتقاق علاقات المشرفين من جدول الربط (المصدر الوحيد للحقيقة).
  const supTeams: Record<string, string[]> = {};
  const supComms: Record<string, string[]> = {};
  const commSups: Record<string, string[]> = {};
  for (const a of asgRows.data ?? []) {
    if (a.target_kind === "team") {
      (supTeams[a.supervisor_id] ??= []).push(a.target_id);
    } else if (a.target_kind === "committee") {
      (supComms[a.supervisor_id] ??= []).push(a.target_id);
      (commSups[a.target_id] ??= []).push(a.supervisor_id);
    }
  }

  // تحديدُ الأعمدة بسلسلةٍ متغيّرة يُفقِد Supabase استنتاجَ نوع الصفّ، فنُصرّح به يدويّاً.
  const invoiceRows = (invoices.data ?? []) as unknown as Array<Record<string, unknown> & { id: string; in_trash?: boolean }>;
  const allInvoices = invoiceRows.map(rowToInvoice);
  const trashIds = new Set(invoiceRows.filter(r => r.in_trash).map(r => r.id));

  // رقم الهوية الحقيقيّ (national_id) حسّاسٌ — يُكشف للإدارة فقط (الأمير/نائبه).
  // نُجرّده من لقطة المشرفين هنا (لا في الواجهة فقط) حتّى لا يصل لأجهزتهم أصلاً.
  const isAdmin = ADMIN.includes(session.role);

  // فصلُ الطلاب النشطين عن سلة المحذوفات (deleted_at مضبوط).
  const allStudents = (students.data ?? []).map(r => {
    const st = rowToStudent(r);
    if (!isAdmin) st.nationalId = undefined;
    return st;
  });

  return {
    ...base,
    teams:          (teams.data ?? []).map(rowToTeam),
    students:       allStudents.filter(s => !s.deletedAt),
    trashStudents:  allStudents.filter(s => s.deletedAt),
    supervisors:    (supervisors.data ?? []).map(r => {
      const sup = {
        ...rowToSupervisor(r),
        teamIds: supTeams[r.id] ?? [],
        committeeIds: supComms[r.id] ?? [],
      };
      // رقم الهوية الحقيقيّ للمشرف حسّاسٌ — للإدارة فقط؛ نُجرّده من لقطة غيرهم.
      if (!isAdmin) sup.nationalId = undefined;
      return sup;
    }),
    committees:     (committees.data ?? []).map(r => ({
      ...rowToCommittee(r),
      supervisorIds: commSups[r.id] ?? [],
    })),
    committeeTasks: (cTasks.data ?? []).map(t => ({
      id: t.id, committeeId: t.committee_id, title: t.title,
      assigneeId: t.assignee_id ?? undefined, done: !!t.done, createdAt: t.created_at,
    })),
    studentTasks:   (sTasks.data ?? []).map(rowToStudentTask),
    announcements:  (anns.data ?? []).map(rowToActivityAnnouncement),
    news:           (news.data ?? []).map(rowToNewsPost),
    invoices:       allInvoices.filter(i => !trashIds.has(i.id)),
    trashInvoices:  allInvoices.filter(i => trashIds.has(i.id)),
    attendance,
  };
}

/* ─────────── دليلٌ تعريفيٌّ عامّ (صفحات «اللجان» و«المشرفون») ───────────
 *  صفحاتٌ عامّة لا تتطلّب دخولاً، لذا نكشف حقولاً غيرَ حسّاسة فقط:
 *  للجان: الاسم/الوصف/اللون/الصورة/المشرفون/عدد الطلاب (المشتقّ من فرق مشرفيها).
 *  للمشرفين: الاسم/التخصُّص/الصورة/اللجان — دون هاتفٍ أو بريدٍ أو هويّة أو رمز دخول. */
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
  const db = getSupabase();
  const [committees, supervisors, teams, asgRows] = await Promise.all([
    db.from("committees").select("id,name,description,color,image_data_url"),
    db.from("supervisors").select("id,name,specialty,photo_data_url"),
    db.from("teams").select("id,supervisor_id,student_count"),
    db.from("supervisor_assignments").select("*"),
  ]);

  // اشتقاق علاقات المشرفين من جدول الربط (المصدر الوحيد للحقيقة).
  const supTeams: Record<string, string[]> = {};
  const supComms: Record<string, string[]> = {};
  const commSups: Record<string, string[]> = {};
  for (const a of asgRows.data ?? []) {
    if (a.target_kind === "team") (supTeams[a.supervisor_id] ??= []).push(a.target_id);
    else if (a.target_kind === "committee") {
      (supComms[a.supervisor_id] ??= []).push(a.target_id);
      (commSups[a.target_id] ??= []).push(a.supervisor_id);
    }
  }

  // عددُ طلاب الفريق (لاشتقاق «عدد طلاب اللجنة» عبر فرق مشرفيها).
  const teamCount: Record<string, number> = {};
  for (const t of teams.data ?? []) teamCount[t.id] = t.student_count ?? 0;

  const pubCommittees: PublicCommittee[] = (committees.data ?? []).map(c => {
    const sups = commSups[c.id] ?? [];
    // فرقُ مشرفي اللجنة (دون تكرار) ← مجموع طلابها = «عدد طلاب اللجنة».
    const teamIds = new Set<string>();
    for (const sid of sups) for (const tid of supTeams[sid] ?? []) teamIds.add(tid);
    let studentCount = 0;
    for (const tid of teamIds) studentCount += teamCount[tid] ?? 0;
    return {
      id: c.id, name: c.name, description: c.description ?? "", color: c.color,
      imageDataUrl: c.image_data_url ?? undefined, supervisorIds: sups, studentCount,
    };
  });

  const pubSupervisors: PublicSupervisor[] = (supervisors.data ?? []).map(s => ({
    id: s.id, name: s.name, specialty: s.specialty ?? undefined,
    photoDataUrl: s.photo_data_url ?? undefined,
    committeeIds: supComms[s.id] ?? [], teamIds: supTeams[s.id] ?? [],
  }));

  return { committees: pubCommittees, supervisors: pubSupervisors };
}

/* ─────────── جدول الربط: مُساعِدات المشرفين↔الفرق/اللجان ─────────── */

/** يستبدل كامل تعيينات مشرفٍ من نوعٍ معيّن (team أو committee). */
async function setSupervisorTargets(supervisorId: string, kind: "team" | "committee", targetIds: string[]) {
  const db = getSupabase();
  await db.from("supervisor_assignments").delete().eq("supervisor_id", supervisorId).eq("target_kind", kind);
  const rows = targetIds.filter(Boolean).map(t => ({ supervisor_id: supervisorId, target_kind: kind, target_id: t }));
  if (rows.length) await db.from("supervisor_assignments").insert(rows);
}

/** يستبدل كامل مشرفي لجنةٍ معيّنة. */
async function setCommitteeSupervisors(committeeId: string, supervisorIds: string[]) {
  const db = getSupabase();
  await db.from("supervisor_assignments").delete().eq("target_kind", "committee").eq("target_id", committeeId);
  const rows = supervisorIds.filter(Boolean).map(s => ({ supervisor_id: s, target_kind: "committee", target_id: committeeId }));
  if (rows.length) await db.from("supervisor_assignments").insert(rows);
}

/* ─────────────────────────── الفرق ─────────────────────────── */

export async function dbAddTeam(name: string, color: string, badge: string, supervisorId: string, tagline: string) {
  await requirePermission("teams");
  const id = uid("t");
  await getSupabase().from("teams").insert(
    teamToRow({ id, name, color, badge, supervisorId, tagline, studentCount: 0, points: 0 }),
  );
  // قائد الفريق يُصبح مُشرفاً عليه في جدول الربط.
  if (supervisorId) {
    await getSupabase().from("supervisor_assignments")
      .upsert({ supervisor_id: supervisorId, target_kind: "team", target_id: id }, { ignoreDuplicates: true });
  }
}
export async function dbUpdateTeam(id: string, patch: Partial<Team>) {
  await requirePermission("teams");
  await getSupabase().from("teams").update(teamToRow(patch)).eq("id", id);
  // عند تغيير القائد: يُضاف كمُشرفٍ على الفريق (دون إزالة مشرفين آخرين).
  if (patch.supervisorId) {
    await getSupabase().from("supervisor_assignments")
      .upsert({ supervisor_id: patch.supervisorId, target_kind: "team", target_id: id }, { ignoreDuplicates: true });
  }
}
export async function dbDeleteTeam(id: string) {
  await requirePermission("teams");
  const db = getSupabase();
  await db.from("students").delete().eq("team_id", id);
  await db.from("supervisor_assignments").delete().eq("target_kind", "team").eq("target_id", id);
  await db.from("teams").delete().eq("id", id);
}

/* ─────────────────────────── الطلاب ─────────────────────────── */

export async function dbAddStudent(input: Omit<Student, "id" | "nationalIdMasked" | "points" | "attendance">) {
  await requirePermission("students");
  assertValidImage(input.photoDataUrl);
  const db = getSupabase();
  const row = studentToRow({
    ...input,
    phone: normalizePhone(input.phone),
    id: uid("st"),
    nationalIdMasked: maskNid(),
    points: 0,
    attendance: 100,
    approvalStatus: "APPROVED",
  });
  await db.from("students").insert(row);
  if (input.teamId) await bumpTeamCount(input.teamId, 1);
}

export async function dbRegisterStudent(input: {
  name: string; phone: string; grade: string; section: Student["section"];
  emergencyContact: string; emergencyPhone: string; photoDataUrl?: string; nationalId?: string;
  regAnswers?: Record<string, string>;
}): Promise<Student> {
  // مسارٌ عامٌّ (تسجيل الزائر) — لا يتطلّب جلسة، لكن نتحقّق من الصورة والمدخلات.
  assertValidImage(input.photoDataUrl);
  if (!input.name?.trim() || !input.phone?.trim()) throw new Error("الاسم والجوّال مطلوبان.");
  const nationalId = (input.nationalId ?? "").trim();
  const row = studentToRow({
    id: uid("st"),
    name: input.name,
    phone: normalizePhone(input.phone),
    grade: input.grade,
    section: input.section,
    teamId: "",
    paymentStatus: "PENDING",
    paidAmount: 0,
    totalAmount: 500,
    emergencyContact: input.emergencyContact,
    emergencyPhone: input.emergencyPhone,
    nationalId,
    // نُبقي القناع لعرضٍ مختصرٍ عند الحاجة، لكنّه مشتقٌّ الآن من الرقم الحقيقيّ حين وُجد.
    nationalIdMasked: nationalId ? "••••••" + nationalId.slice(-4) : maskNid(),
    points: 0,
    attendance: 100,
    approvalStatus: "PENDING",
    registeredAt: new Date().toISOString(),
    photoDataUrl: input.photoDataUrl,
    regAnswers: input.regAnswers && Object.keys(input.regAnswers).length ? input.regAnswers : undefined,
  });
  const { data } = await getSupabase().from("students").insert(row).select("*").single();
  return rowToStudent(data);
}

/** يوفّر (أو يُحدّث) حساب دخولٍ لمشرفٍ/مستفيدٍ عبر دالّة upsert_login في القاعدة.
 *  الرمز يُشفَّر داخل القاعدة (bcrypt)؛ نسخته الصريحة تُخزَّن على صفّ المشرف/الطالب فقط. */
async function dbUpsertLogin(opts: {
  phone: string; code: string; name: string;
  role: "SUPERVISOR" | "BENEFICIARY"; supervisorId?: string; studentId?: string; landing: string;
}) {
  const phone = normalizePhone(opts.phone);
  if (!phone) return; // لا حساب دون جوّال
  const { error } = await getSupabase().rpc("upsert_login", {
    p_id: uid("acc"),
    p_phone: phone,
    p_code: opts.code,
    p_name: opts.name,
    p_role: opts.role,
    p_supervisor_id: opts.supervisorId ?? "",
    p_student_id: opts.studentId ?? "",
    p_landing: opts.landing,
  });
  if (error) throw error;
}

export async function dbApproveStudent(id: string, teamId: string, code: string) {
  await requirePermission("students");
  const db = getSupabase();
  await db.from("students").update(
    studentToRow({ approvalStatus: "APPROVED", teamId, accessCode: code }),
  ).eq("id", id);
  if (teamId) await bumpTeamCount(teamId, 1);
  // يُنشأ حساب دخول المستفيد فوراً برمزٍ صالحٍ يظهر للأمير.
  const { data } = await db.from("students").select("name, phone").eq("id", id).single();
  if (data) {
    await dbUpsertLogin({
      phone: data.phone ?? "", code, name: data.name ?? "مستفيد",
      role: "BENEFICIARY", studentId: id, landing: "/me",
    });
  }
}
export async function dbRejectStudent(id: string) {
  await requirePermission("students");
  await getSupabase().from("students").update(studentToRow({ approvalStatus: "REJECTED" })).eq("id", id);
}
export async function dbUpdateStudent(id: string, patch: Partial<Student>) {
  const session = await requirePermission("students");
  assertValidImage(patch.photoDataUrl);
  const db = getSupabase();
  const row = studentToRow(patch);
  if (patch.phone !== undefined) (row as Record<string, unknown>).phone = normalizePhone(patch.phone);
  // رقم الهوية الحقيقيّ حسّاسٌ — لا يعدّله إلاّ الإدارة (الأمير/نائبه)، لا المشرف،
  // ولو صاغ طلباً مباشراً. نُجرّده هنا في الخادم كخطّ دفاعٍ ثانٍ خلف إخفاء الحقل.
  if (!ADMIN.includes(session.role)) {
    delete (row as Record<string, unknown>).national_id;
    delete (row as Record<string, unknown>).national_id_masked;
  }
  if (Object.keys(row).length) await db.from("students").update(row).eq("id", id);
  // تغيير جوّال الطالب يجب أن يُحدّث حسابَ دخوله المرتبط (BENEFICIARY) أيضاً،
  // وإلاّ انكسر تسجيل دخوله (الجوّال هو معرّف الدخول). الرمز يبقى كما هو (مُشفَّراً).
  if (patch.phone !== undefined && patch.phone.trim()) {
    await db.from("profiles")
      .update({ phone: patch.phone.trim() })
      .eq("student_id", id).eq("role", "BENEFICIARY");
  }
}
export async function dbSetStudentPhoto(id: string, dataUrl: string) {
  // المستفيدُ يرفع صورته الذاتيّة (من /me)، أو أيّ عضو طاقم.
  await requireSelfOrStaff(id);
  assertValidImage(dataUrl);
  await getSupabase().from("students").update({ photo_data_url: dataUrl }).eq("id", id);
}
// نافذةُ بقاء الحساب في سلة المحذوفات قبل الحذف النهائيّ التلقائيّ (١٠ ساعات).
// ملاحظة: مِلفّ "use server" لا يسمح بتصدير غير الدوالّ اللاتزامنيّة، فنُبقيها محلّيّة.
const STUDENT_TRASH_WINDOW_MS = 10 * 60 * 60 * 1000;

/** حذفٌ ناعم: يُوسَم الحساب بـ deleted_at فيُنقَل لسلة المحذوفات (١٠ ساعات)،
 *  ويُنقَص عدّاد أسرته (لأنّه لم يَعُد نشِطاً). يعيده dbRestoreStudent، أو يُحذَف
 *  نهائياً تلقائياً بعد النافذة (purgeExpiredStudents) أو يدوياً (dbPurgeStudent). */
export async function dbDeleteStudent(id: string) {
  await requirePermission("students");
  const db = getSupabase();
  const { data } = await db.from("students").select("team_id, deleted_at").eq("id", id).single();
  if (data?.deleted_at) return; // مُحذوفٌ مسبقاً
  await db.from("students").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (data?.team_id) await bumpTeamCount(data.team_id, -1);
}

/** استعادةٌ من سلة المحذوفات: يُلغى وسمُ deleted_at ويُعاد عدّاد أسرته. */
export async function dbRestoreStudent(id: string) {
  await requirePermission("students");
  const db = getSupabase();
  const { data } = await db.from("students").select("team_id, deleted_at").eq("id", id).single();
  if (!data?.deleted_at) return; // ليس في السلة
  await db.from("students").update({ deleted_at: null }).eq("id", id);
  if (data?.team_id) await bumpTeamCount(data.team_id, 1);
}

/** حذفٌ نهائيّ لحسابٍ واحد (مع بياناته المرتبطة): أنشطته وحساب دخوله.
 *  لا يمسّ عدّاد الأسرة (نُقِص عند الحذف الناعم). */
async function hardDeleteStudents(db: ReturnType<typeof getSupabase>, ids: string[]) {
  if (!ids.length) return;
  await db.from("student_tasks").delete().in("student_id", ids);
  await db.from("profiles").delete().in("student_id", ids);
  await db.from("students").delete().in("id", ids);
}

/** حذفٌ نهائيّ فوريّ لحسابٍ من السلة (يستدعيه الأمير/نائبه). */
export async function dbPurgeStudent(id: string) {
  await requirePermission("students");
  await hardDeleteStudents(getSupabase(), [id]);
}

/** تنظيفٌ كسول: حذفٌ نهائيّ لكلّ حسابٍ مضى على وجوده في السلة أكثر من النافذة. */
async function purgeExpiredStudents(db: ReturnType<typeof getSupabase>) {
  const cutoff = new Date(Date.now() - STUDENT_TRASH_WINDOW_MS).toISOString();
  const { data } = await db.from("students").select("id").not("deleted_at", "is", null).lt("deleted_at", cutoff);
  await hardDeleteStudents(db, (data ?? []).map(r => r.id as string));
}
export async function dbMoveStudent(id: string, newTeamId: string) {
  await requirePermission("students");
  const db = getSupabase();
  const { data } = await db.from("students").select("team_id").eq("id", id).single();
  const oldTeamId = data?.team_id as string | undefined;
  if (oldTeamId === newTeamId) return;
  await db.from("students").update({ team_id: newTeamId }).eq("id", id);
  if (oldTeamId) await bumpTeamCount(oldTeamId, -1);
  if (newTeamId) await bumpTeamCount(newTeamId, 1);
}
export async function dbSetPayment(id: string, status: PaymentStatus, paid: number) {
  await requirePermission("students");
  await getSupabase().from("students").update({ payment_status: status, paid_amount: paid }).eq("id", id);
}
/** البند ١٠: يرفع الطالبُ إيصال السداد — يُخزَّن بانتظار اعتماد الأمير. */
export async function dbSubmitReceipt(id: string, dataUrl: string) {
  // المستفيدُ لسجلّه فقط، أو عضو طاقم. يرفع الصورة فقط (بلا مبلغ) — الأمير يتحقّق لاحقاً.
  await requireSelfOrStaff(id);
  assertValidImage(dataUrl);
  await getSupabase().from("students").update({
    receipt_data_url: dataUrl,
    receipt_status: "PENDING",
    receipt_amount: null,
    receipt_submitted_at: new Date().toISOString(),
  }).eq("id", id);
}
/** البند ١٠: يعتمد الأميرُ الإيصال بمبلغٍ يتحقّق منه يدويّاً (افتراضاً الإجماليّ)، أو يرفضه. */
export async function dbReviewReceipt(id: string, approve: boolean, amount?: number) {
  await requirePermission("students");
  const db = getSupabase();
  if (!approve) {
    await db.from("students").update({ receipt_status: "REJECTED" }).eq("id", id);
    return;
  }
  const { data } = await db.from("students").select("total_amount").eq("id", id).single();
  const total = data?.total_amount ?? 0;
  //  المبلغ من تحقّق الأمير اليدويّ؛ إن لم يُمرَّر فالإجماليّ الكامل. نحصره ضمن [0, total].
  const verified = Math.max(0, Math.min(total, Math.round(amount ?? total)));
  const status: PaymentStatus = verified >= total ? "PAID" : verified > 0 ? "PARTIAL" : "PENDING";
  await db.from("students").update({
    receipt_status: "APPROVED",
    payment_status: status,
    paid_amount: verified,
    receipt_amount: verified, // نُثبّت المبلغ الذي اعتمده الأمير
  }).eq("id", id);
}

async function bumpTeamCount(teamId: string, delta: number) {
  const db = getSupabase();
  const { data } = await db.from("teams").select("student_count").eq("id", teamId).single();
  if (!data) return;
  const next = Math.max(0, (data.student_count ?? 0) + delta);
  await db.from("teams").update({ student_count: next }).eq("id", teamId);
}

/* ─────────────────────────── المشرفون ─────────────────────────── */

export async function dbAddSupervisor(name: string, phoneRaw: string, email: string, teamIds: string[], committeeIds: string[], permissions: string[], code: string, nationalId = "", specialty = "", photoDataUrl?: string) {
  await requireAdmin();
  assertValidImage(photoDataUrl);
  const phone = normalizePhone(phoneRaw);
  const id = uid("s");
  const nid = nationalId.trim();
  await getSupabase().from("supervisors").insert(
    supervisorToRow({
      id, name, phone, email, permissions, accessCode: code,
      nationalId: nid || undefined,
      nationalIdMasked: nid ? "••••••" + nid.slice(-4) : "",
      specialty: specialty.trim() || undefined,
      photoDataUrl: photoDataUrl || undefined,
    }),
  );
  await setSupervisorTargets(id, "team", teamIds);
  await setSupervisorTargets(id, "committee", committeeIds);
  // يُنشأ حساب دخول المشرف فوراً برمزٍ صالحٍ يظهر للأمير.
  await dbUpsertLogin({
    phone, code, name, role: "SUPERVISOR", supervisorId: id, landing: "/my-team",
  });
}
/** استيراد جماعي للمشرفين من ملف (Excel/CSV). يُدرج الأسماء دفعةً واحدة
 *  ويُعيد عدد المُدرَجين. لا يُنشئ تعيينات فرق/لجان (تُضاف لاحقاً يدوياً). */
export async function dbImportSupervisors(rows: { name: string; phone: string; email: string }[]) {
  await requireAdmin();
  if (!rows.length) return 0;
  const payload = rows.map(r =>
    // الاستيراد لا يحمل رقم هوية — يُترك فارغاً فيُعرَض «غير مسجَّل» (لا قناعٌ وهمي).
    supervisorToRow({ id: uid("s"), name: r.name, phone: normalizePhone(r.phone), email: r.email, nationalIdMasked: "" }),
  );
  const { error } = await getSupabase().from("supervisors").insert(payload);
  if (error) throw error;
  return rows.length;
}
export async function dbUpdateSupervisor(id: string, patch: Partial<Supervisor>) {
  await requireAdmin();
  const row = supervisorToRow(patch);
  if (patch.phone !== undefined) (row as Record<string, unknown>).phone = normalizePhone(patch.phone);
  // عند تعديل رقم الهوية الحقيقيّ، نُزامن القناع معه (أو نُفرغه إن مُسِح).
  if (patch.nationalId !== undefined) {
    const nid = patch.nationalId.trim();
    (row as Record<string, unknown>).national_id = nid || null;
    (row as Record<string, unknown>).national_id_masked = nid ? "••••••" + nid.slice(-4) : "";
  }
  if (Object.keys(row).length) await getSupabase().from("supervisors").update(row).eq("id", id);
  if (patch.teamIds !== undefined) await setSupervisorTargets(id, "team", patch.teamIds);
  if (patch.committeeIds !== undefined) await setSupervisorTargets(id, "committee", patch.committeeIds);
}
export async function dbDeleteSupervisor(id: string) {
  await requireAdmin();
  // تعيينات المشرف تُحذف تلقائياً (on delete cascade).
  await getSupabase().from("supervisors").delete().eq("id", id);
}

/* ─────────────────────────── اللجان ─────────────────────────── */

export async function dbAddCommittee(name: string, description: string, supervisorIds: string[], color: string, imageDataUrl?: string) {
  await requirePermission("committees");
  assertValidImage(imageDataUrl);
  const id = uid("c");
  await getSupabase().from("committees").insert(
    committeeToRow({ id, name, description, color, imageDataUrl }),
  );
  await setCommitteeSupervisors(id, supervisorIds);
}
export async function dbUpdateCommittee(id: string, patch: Partial<Committee>) {
  await requirePermission("committees");
  assertValidImage(patch.imageDataUrl);
  const row = committeeToRow(patch);
  if (Object.keys(row).length) await getSupabase().from("committees").update(row).eq("id", id);
  if (patch.supervisorIds !== undefined) await setCommitteeSupervisors(id, patch.supervisorIds);
}
export async function dbDeleteCommittee(id: string) {
  await requirePermission("committees");
  const db = getSupabase();
  await db.from("supervisor_assignments").delete().eq("target_kind", "committee").eq("target_id", id);
  await db.from("committees").delete().eq("id", id);
}

/* ─────────────────────── موازنة اللجان والفرق (للأمير/نائبه فقط) ───────────────────────
 * تعديل الموازنة حسّاسٌ ماليّاً — نحرسه بـ requireAdmin (لا يكفي إذنُ «الفرق»/«اللجان»).
 * الموازنة عرضٌ فقط أثناء الاعتماد ولا تمنع الاعتماد التلقائي. */
export async function dbSetTeamBudget(id: string, budget: number) {
  await requireAdmin();
  await getSupabase().from("teams").update({ budget: Math.max(0, Math.round(budget)) }).eq("id", id);
}
export async function dbSetCommitteeBudget(id: string, budget: number) {
  await requireAdmin();
  await getSupabase().from("committees").update({ budget: Math.max(0, Math.round(budget)) }).eq("id", id);
}

/* ─────────────────────────── مهامّ اللجان ───────────────────────────
 * يضيفها/يعدّلها الأمير/نائبه أو مشرفٌ عضوٌ في هذه اللجنة تحديداً. */
async function requireCommitteeAccess(committeeId: string): Promise<DbSession> {
  const session = await requireStaff();
  if (ADMIN.includes(session.role)) return session;
  if (session.role === "SUPERVISOR" && session.supervisorId) {
    const { data } = await getSupabase().from("supervisor_assignments")
      .select("supervisor_id").eq("supervisor_id", session.supervisorId)
      .eq("target_kind", "committee").eq("target_id", committeeId).limit(1);
    if (data && data.length) return session;
  }
  throw new Error("غير مصرّح — لست عضواً في هذه اللجنة.");
}
/** اللجنة المالكة لمهمّةٍ ما (للتحقّق من الصلاحيّة). */
async function committeeOfTask(id: string): Promise<string | null> {
  const { data } = await getSupabase().from("committee_tasks").select("committee_id").eq("id", id).single();
  return data?.committee_id ?? null;
}
export async function dbAddCommitteeTask(committeeId: string, title: string, assigneeId?: string) {
  await requireCommitteeAccess(committeeId);
  const t = title.trim();
  if (!t) return;
  await getSupabase().from("committee_tasks").insert({
    id: uid("ctask"), committee_id: committeeId, title: t,
    assignee_id: assigneeId || null, done: false,
  });
}
export async function dbToggleCommitteeTask(id: string, done: boolean) {
  const cid = await committeeOfTask(id);
  if (!cid) throw new Error("المهمّة غير موجودة.");
  await requireCommitteeAccess(cid);
  await getSupabase().from("committee_tasks").update({ done }).eq("id", id);
}
export async function dbDeleteCommitteeTask(id: string) {
  const cid = await committeeOfTask(id);
  if (!cid) return;
  await requireCommitteeAccess(cid);
  await getSupabase().from("committee_tasks").delete().eq("id", id);
}

/* ─────────── الأنشطة والخصومات للطلاب (البند ١ و٣) ───────────
 *  يرصدها أيُّ عضوِ طاقم (أمير/نائب/مشرف): نشاطٌ (نقاطٌ موجبة) أو خصمٌ (سالبة)،
 *  لطالبٍ بعينه أو لأسرةٍ/أُسَرٍ أو لكلّ الطلاب — الرصدُ الجماعيّ يُنشئ صفّاً لكلّ
 *  طالبٍ بنفس batch_id. يراها الطالب في صفحته. الحُرّاس خادميّون. */
export async function dbAddActivity(input: {
  studentIds: string[]; title: string; points: number;
  kind: "activity" | "deduction"; scopeLabel?: string;
  expiresAt?: string; done: boolean; batchId?: string;
}) {
  const s = await requireStaff();
  const t = input.title.trim();
  const ids = [...new Set(input.studentIds)].filter(Boolean);
  if (!t || ids.length === 0) return;
  const pts = Math.trunc(input.points || 0);
  const signed = input.kind === "deduction" ? -Math.abs(pts) : Math.abs(pts);
  const batchId = input.batchId ?? (ids.length > 1 ? uid("batch") : undefined);
  const assignedBy = s.supervisorId ?? s.phone ?? null;
  const rows = ids.map(studentId => ({
    id: uid("stask"), student_id: studentId, title: t,
    points: signed, assigned_by: assignedBy,
    visible: true, done: input.done,
    kind: input.kind, batch_id: batchId ?? null,
    scope_label: input.scopeLabel ?? null, expires_at: input.expiresAt ?? null,
  }));
  await getSupabase().from("student_tasks").insert(rows);
}
export async function dbToggleStudentTask(id: string, done: boolean) {
  await requireStaff();
  await getSupabase().from("student_tasks").update({ done }).eq("id", id);
}
export async function dbToggleActivityBatch(batchId: string, done: boolean) {
  await requireStaff();
  await getSupabase().from("student_tasks").update({ done }).eq("batch_id", batchId);
}
export async function dbSetStudentTaskVisible(id: string, visible: boolean) {
  await requireStaff();
  await getSupabase().from("student_tasks").update({ visible }).eq("id", id);
}
export async function dbDeleteStudentTask(id: string) {
  await requireStaff();
  await getSupabase().from("student_tasks").delete().eq("id", id);
}
export async function dbDeleteActivityBatch(batchId: string) {
  await requireStaff();
  await getSupabase().from("student_tasks").delete().eq("batch_id", batchId);
}

/* ─────────── لوحة إعلانات الأنشطة (البند الجديد) ───────────
 *  يعلن مشرفُ اللجنة عن نشاطٍ وقيمتِه بالنقاط في لجانه فقط؛ الأمير/نائبه في أيّ
 *  لجنة. يراه الطلابُ في لوحةٍ (كلّ اللجان أو لجنةٍ محدّدة)، ويرصده المشرفُ لمن
 *  أنجزه عبر اختياره من المُعلَن. الحُرّاسُ خادميّون (لا يكفي إخفاءُ الواجهة). */

/** يتحقّق من صلاحيّة التصرّف في إعلانٍ قائم عبر لجنته. */
async function requireAnnouncementAccess(id: string): Promise<DbSession> {
  const s = await requireStaff();
  if (ADMIN.includes(s.role)) return s;
  const { data } = await getSupabase()
    .from("activity_announcements").select("committee_id").eq("id", id).single();
  if (data?.committee_id) return requireCommitteeAccess(data.committee_id);
  throw new Error("غير مصرّح.");
}

export async function dbAddAnnouncement(input: { title: string; points: number; committeeId: string; expiresAt?: string }) {
  const s = await requireCommitteeAccess(input.committeeId);
  const title = input.title.trim();
  if (!title || !input.committeeId) return;
  const pts = Math.max(0, Math.trunc(input.points || 0));
  await getSupabase().from("activity_announcements").insert({
    id: uid("ann"), title, points: pts, committee_id: input.committeeId,
    created_by: s.supervisorId ?? s.phone ?? null, active: true,
    expires_at: input.expiresAt ?? null,
  });
}

export async function dbUpdateAnnouncement(
  id: string, patch: { title?: string; points?: number; active?: boolean },
) {
  await requireAnnouncementAccess(id);
  const upd: Record<string, unknown> = {};
  if (patch.title !== undefined) upd.title = patch.title.trim();
  if (patch.points !== undefined) upd.points = Math.max(0, Math.trunc(patch.points || 0));
  if (patch.active !== undefined) upd.active = patch.active;
  if (Object.keys(upd).length === 0) return;
  await getSupabase().from("activity_announcements").update(upd).eq("id", id);
}

export async function dbDeleteAnnouncement(id: string) {
  await requireAnnouncementAccess(id);
  await getSupabase().from("activity_announcements").delete().eq("id", id);
}

/* ─────────── لوحة الإعلانات (آخر الأخبار) — أخبارٌ عامّة ───────────
 *  يكتبها أيُّ عضوِ طاقمٍ (مشرف/أمير)، غيرُ مرتبطةٍ بلجنةٍ ولا نقاط. كلٌّ يدير
 *  أخباره؛ والأمير/نائبه يديرون كلَّ الأخبار. اسمُ الكاتب يُشتقُّ من الجلسة
 *  (لا من الواجهة) منعاً للانتحال. الحُرّاسُ خادميّون. */

/** يتحقّق من صلاحيّة التصرّف في خبرٍ قائم: الأمير/نائبه كلّ الأخبار؛
 *  والمشرفُ في أخباره التي كتبها فقط. */
async function requireNewsAccess(id: string): Promise<DbSession> {
  const s = await requireStaff();
  if (ADMIN.includes(s.role)) return s;
  const { data } = await getSupabase()
    .from("news_posts").select("created_by").eq("id", id).single();
  const mine = s.supervisorId ?? s.phone;
  if (data?.created_by && mine && data.created_by === mine) return s;
  throw new Error("غير مصرّح — يمكنك إدارةُ أخبارك أنت فقط.");
}

export async function dbAddNews(input: { title: string; body?: string; imageDataUrl?: string }) {
  const s = await requireStaff();
  const title = input.title.trim();
  if (!title) return;
  await getSupabase().from("news_posts").insert({
    id: uid("news"), title,
    body: input.body?.trim() || null,
    image_data_url: input.imageDataUrl || null,
    created_by: s.supervisorId ?? s.phone ?? null,
    created_by_name: s.name || null,
    active: true,
  });
}

export async function dbUpdateNews(
  id: string, patch: { title?: string; body?: string; imageDataUrl?: string; active?: boolean },
) {
  await requireNewsAccess(id);
  const upd: Record<string, unknown> = {};
  if (patch.title !== undefined) upd.title = patch.title.trim();
  if (patch.body !== undefined) upd.body = patch.body.trim() || null;
  if (patch.imageDataUrl !== undefined) upd.image_data_url = patch.imageDataUrl || null;
  if (patch.active !== undefined) upd.active = patch.active;
  if (Object.keys(upd).length === 0) return;
  await getSupabase().from("news_posts").update(upd).eq("id", id);
}

export async function dbDeleteNews(id: string) {
  await requireNewsAccess(id);
  await getSupabase().from("news_posts").delete().eq("id", id);
}

/* ─────────── قيمة الرسوم الافتراضيّة (البند ٢) ───────────
 *  يعدّلها الأمير/نائبه فقط. تُطبَّق على جميع الطلاب، ويُحفَظ تغييرٌ في fee_history. */
export async function dbSetDefaultFee(amount: number) {
  const s = await requireAdmin();
  const fee = Math.max(0, Math.floor(amount || 0));
  const db = getSupabase();
  await db.from("app_settings").update({ default_fee: fee }).eq("id", 1);
  await db.from("students").update({ total_amount: fee }).neq("id", "");
  await db.from("fee_history").insert({
    id: uid("fee"), amount: fee, changed_by: s.supervisorId ?? s.phone ?? null,
  });
}

/* ─────────────────────────── الفواتير ─────────────────────────── */

// حدودٌ أمنيّة خادميّة (لا الواجهة فقط): نوعٌ مسموح + حدٌّ أقصى للحجم. الواجهة قد
// تُحايَل عليها باستدعاء الإجراء مباشرةً بصورةٍ ضخمة أو نوعٍ غير مدعوم.
const ALLOWED_INVOICE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_INVOICE_BASE64_LENGTH = 7 * 1024 * 1024; // ≈ ٥ ميغابايت بعد فكّ الترميز

/** يتحقّق من صيغة data URL ونوعه وحجمه؛ يعيد {base64, mediaType, dataUrl} أو يرمي. */
function validateInvoiceImage(dataUrl: string): {
  base64: string; mediaType: InvoiceMediaType; dataUrl: string;
} {
  const m = /^data:([^;,]+);base64,([\s\S]*)$/u.exec(dataUrl);
  if (!m) throw new Error("صيغة صورة الفاتورة غير صالحة.");
  const mediaType = m[1];
  if (!(ALLOWED_INVOICE_MEDIA_TYPES as readonly string[]).includes(mediaType)) {
    throw new Error("نوع صورة الفاتورة غير مدعوم — المسموح: JPG أو PNG أو WebP أو GIF.");
  }
  if (m[2].length > MAX_INVOICE_BASE64_LENGTH) {
    throw new Error("حجم صورة الفاتورة كبيرٌ جداً — الحدّ الأقصى نحو ٥ ميغابايت.");
  }
  return { base64: m[2], mediaType: mediaType as InvoiceMediaType, dataUrl };
}

/** يحلّل صورة فاتورة (base64 data URL) بالذكاء الاصطناعي ويعيد الاستخلاص للمراجعة.
 *  للمشرف صاحب صلاحيّة «invoices» أو الإدارة فقط. */
export async function dbAnalyzeInvoice(imageDataUrl: string): Promise<OcrExtraction> {
  await requirePermission("invoices");
  const { base64, mediaType } = validateInvoiceImage(imageDataUrl);
  return analyzeInvoice(base64, mediaType);
}

type AddInvoiceInput = {
  vendor: string;
  purpose: string;
  scope: Invoice["scope"];
  amount: number;
  vat: number;
  date: string;
  imageDataUrl?: string;   // صورة الفاتورة (base64) — تُخزَّن وتُخدَم كسولاً
  ocr?: OcrExtraction;     // الاستخلاص (بعد تصحيح المشرف) — لتقييم الشروط وتثبيت البنود
};

// إعداداتُ هويّة الجمعية وسياسة الشروط — تُقرأ مرّةً وتُستعمَل لكلّ فواتير الدفعة.
type InvoiceSettings = { name: string; tax: string; policy: ConditionsPolicy };
async function readInvoiceSettings(): Promise<InvoiceSettings> {
  const { data: st } = await getSupabase().from("app_settings")
    .select("association_name,association_tax_number,conditions_policy").eq("id", 1).single();
  return {
    name: st?.association_name ?? "",
    tax: st?.association_tax_number ?? "",
    policy: (st?.conditions_policy as ConditionsPolicy | null) ?? DEFAULT_CONDITIONS_POLICY,
  };
}

/** يبني صفَّ الإدراج لفاتورةٍ واحدة مع إعادة تقييمٍ خادميّةٍ للشروط السبعة. */
function buildInvoiceRow(input: AddInvoiceInput, session: DbSession, cfg: InvoiceSettings) {
  const ocr = input.ocr ?? null;
  //  إعادة تقييمٍ خادميّةٌ للشروط (تُثبَّت مع الفاتورة، لا يُوثَق بقيمة العميل).
  const conditions = evaluateConditions(ocr, cfg.name, cfg.tax);
  //  حُلِّلت واستوفت الشروط الإلزاميّة → تُعتمَد تلقائياً؛ وإلا (أو إدخالٌ يدويٌّ) → «معلّقة» للأمير.
  const status: Invoice["status"] = ocr && passesPolicy(conditions, cfg.policy) ? "approved" : "pending";
  const img = input.imageDataUrl ? validateInvoiceImage(input.imageDataUrl).dataUrl : null;
  const nextNo = String(1000 + Math.floor(Math.random() * 8999));
  return {
    ...invoiceToRow({
      vendor: input.vendor, purpose: input.purpose, scope: input.scope,
      amount: input.amount, vat: input.vat, date: input.date,
      extractedByAI: !!ocr, lineItems: ocr?.lineItems, conditions,
      vendorTaxNumber: ocr?.vendorTaxNumber, invoiceNumber: ocr?.invoiceNumber,
      uploadedBy: session.supervisorId ?? undefined, submittedAt: new Date().toISOString(),
    }),
    id: uid("inv"), code: `INV-1448-${nextNo}`, in_trash: false, status,
    image_data_url: img, has_image: !!img,
  };
}

export async function dbAddInvoice(input: AddInvoiceInput) {
  await dbAddInvoices([input]);
}

/** إضافةُ دفعةِ فواتير في استدعاءٍ خادميٍّ واحد — إدراجٌ متسلسلٌ مع فحص الأخطاء
 *  (يمنع سباق الاستدعاءات المتوازية وضياع فاتورةٍ بصمت). */
export async function dbAddInvoices(inputs: AddInvoiceInput[]) {
  const session = await requirePermission("invoices");
  if (inputs.length === 0) return;
  const db = getSupabase();
  const cfg = await readInvoiceSettings();
  for (const input of inputs) {
    const { error } = await db.from("invoices").insert(buildInvoiceRow(input, session, cfg));
    if (error) throw new Error(`تعذّر حفظ فاتورة «${input.vendor}»: ${error.message}`);
  }
}

//  الاعتماد النهائيّ للأمير/نائبه فقط (لا اعتمادٌ آليٌّ صامتٌ بناءً على الذكاء وحده).
export async function dbApproveInvoice(id: string) {
  await requireAdmin();
  await getSupabase().from("invoices").update({ status: "approved" }).eq("id", id);
}
//  رفض الأمير: يُنقَل لسلة المحذوفات.
export async function dbRejectInvoice(id: string) {
  await requireAdmin();
  await getSupabase().from("invoices").update({ in_trash: true }).eq("id", id);
}
export async function dbDeleteInvoice(id: string) {
  await requirePermission("invoices");
  await getSupabase().from("invoices").update({ in_trash: true }).eq("id", id);
}
export async function dbRestoreInvoice(id: string) {
  await requirePermission("invoices");
  await getSupabase().from("invoices").update({ in_trash: false }).eq("id", id);
}

/* ─────────────────────────── نموذج التسجيل ─────────────────────────── */

export async function dbToggleRegField(key: string) {
  await requireAdmin();
  const db = getSupabase();
  const { data } = await db.from("reg_fields").select("active").eq("key", key).single();
  if (!data) return;
  await db.from("reg_fields").update({ active: !data.active }).eq("key", key);
}
export async function dbReorderRegField(key: string, dir: "up" | "down") {
  await requireAdmin();
  const db = getSupabase();
  const { data } = await db.from("reg_fields").select("key, sort").order("sort", { ascending: true });
  if (!data) return;
  const idx = data.findIndex(f => f.key === key);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= data.length) return;
  await db.from("reg_fields").update({ sort: data[swap].sort }).eq("key", data[idx].key);
  await db.from("reg_fields").update({ sort: data[idx].sort }).eq("key", data[swap].key);
}
export async function dbAddRegField(field: Omit<RegField, "active">) {
  await requireAdmin();
  const db = getSupabase();
  const { data } = await db.from("reg_fields").select("sort").order("sort", { ascending: false }).limit(1);
  const sort = (data?.[0]?.sort ?? 0) + 1;
  await db.from("reg_fields").insert({
    key: field.key, label: field.label, type: field.type, required: field.required, active: true, descr: field.desc, sort,
  });
}
export async function dbUpdateRegField(key: string, patch: Partial<Omit<RegField, "key">>) {
  await requireAdmin();
  const row = {
    ...(patch.label !== undefined && { label: patch.label }),
    ...(patch.type !== undefined && { type: patch.type }),
    ...(patch.required !== undefined && { required: patch.required }),
    ...(patch.active !== undefined && { active: patch.active }),
    ...(patch.desc !== undefined && { descr: patch.desc }),
  };
  if (Object.keys(row).length) await getSupabase().from("reg_fields").update(row).eq("key", key);
}
export async function dbRemoveRegField(key: string) {
  await requireAdmin();
  await getSupabase().from("reg_fields").delete().eq("key", key);
}
export async function dbSetRegOpen(open: boolean) {
  await requireAdmin();
  await getSupabase().from("app_settings").update({ reg_open: open }).eq("id", 1);
}

/* ─────────────────────────── الحضور والإعدادات ─────────────────────────── */

export async function dbToggleAttendance(studentId: string, day: number) {
  await requireStaff();
  const db = getSupabase();
  const { data } = await db.from("attendance").select("present").eq("student_id", studentId).eq("day", day).single();
  const present = !(data?.present ?? (day < 5));
  await db.from("attendance").upsert({ student_id: studentId, day, present });
}
export async function dbSetLogoDisplayMode(mode: LogoDisplayMode) {
  await requireAdmin();
  const { error } = await getSupabase().from("app_settings").update({ logo_display_mode: mode }).eq("id", 1);
  if (error) throw error;
}
export async function dbSetMotivations(list: string[]) {
  await requireAdmin();
  const { error } = await getSupabase().from("app_settings").update({ motivations: list }).eq("id", 1);
  if (error) throw error;
}
export async function dbSetTickerPhrases(list: string[]) {
  await requireAdmin();
  const { error } = await getSupabase().from("app_settings").update({ ticker_phrases: list }).eq("id", 1);
  if (error) throw error;
}
export async function dbSetTripMessage(text: string) {
  await requireAdmin();
  const { error } = await getSupabase().from("app_settings").update({ trip_message: text }).eq("id", 1);
  if (error) throw error;
}
export async function dbSetPostRegisterNote(text: string) {
  await requireAdmin();
  const { error } = await getSupabase().from("app_settings").update({ post_register_note: text }).eq("id", 1);
  if (error) throw error;
}
/** هويّة الجمعية الرسميّة — لمطابقة شرطَي «اسم الجمعية» و«الرقم الضريبي للجمعية». */
export async function dbSetAssociationIdentity(name: string, taxNumber: string) {
  await requireAdmin();
  const { error } = await getSupabase().from("app_settings")
    .update({ association_name: name.trim() || null, association_tax_number: taxNumber.trim() || null })
    .eq("id", 1);
  if (error) throw error;
}
/** سياسة الشروط الإلزاميّة لاعتماد الفواتير تلقائياً. */
export async function dbSetConditionsPolicy(policy: ConditionsPolicy) {
  await requireAdmin();
  const { error } = await getSupabase().from("app_settings")
    .update({ conditions_policy: policy }).eq("id", 1);
  if (error) throw error;
}
/** البند ٦: يحفظ شعار الموقع المخصّص (Data URL). فارغٌ = استعادة الشعار الافتراضي.
 *  نُبدّل logo_version أيضاً: قيمةٌ جديدة عند الرفع (لكسر التخزين المؤقّت)، و0 عند
 *  الاستعادة (تعني «لا شعار مخصّص»). */
export async function dbSetLogoUrl(url: string) {
  await requireAdmin();
  if (url) assertValidImage(url);
  const { error } = await getSupabase()
    .from("app_settings")
    .update({ logo_url: url || null, logo_version: url ? Date.now() : 0 })
    .eq("id", 1);
  if (error) throw error;
}

/** البند ٦: يحفظ ألوان الهوية المشتقّة من الشعار. null = استعادة ألوان الثيم الافتراضيّة. */
export async function dbSetBrandColors(colors: { accent: string; accentWarm: string } | null) {
  await requireAdmin();
  const { error } = await getSupabase().from("app_settings").update({
    brand_accent:      colors?.accent ?? null,
    brand_accent_warm: colors?.accentWarm ?? null,
  }).eq("id", 1);
  if (error) throw error;
}

/** يحفظ خريطة خلفيّات الصفحات المتحرّكة (الجُمل + النمط + التفعيل لكلّ صفحة). */
export async function dbSetPageMarquees(map: PageMarqueeMap) {
  await requireAdmin();
  const { error } = await getSupabase().from("app_settings").update({
    page_marquees: map,
  }).eq("id", 1);
  if (error) throw error;
}

/* ─────────────────────────── التصفير ─────────────────────────── */

/** يمحو كلّ بيانات الفعاليّة (الفرق/الطلاب/المشرفين/اللجان/الفواتير/الحضور)
 *  دون المساس بالحسابات (profiles) ولا الإعدادات ولا حقول التسجيل. */
export async function dbResetAll() {
  await requireAdmin();
  const db = getSupabase();
  await Promise.all([
    db.from("attendance").delete().neq("student_id", ""),
    db.from("supervisor_assignments").delete().neq("supervisor_id", ""),
    db.from("students").delete().neq("id", ""),
    db.from("invoices").delete().neq("id", ""),
    db.from("teams").delete().neq("id", ""),
    db.from("committees").delete().neq("id", ""),
    db.from("supervisors").delete().neq("id", ""),
  ]);
}

/* ─────────────────────────── المصادقة ─────────────────────────── */

/** يغيّر رمز الدخول: يتحقّق من الرمز الحالي ثم يُحدّث التشفير (عبر set_login_code).
 *  يُعيد true عند النجاح، false إن كان الرمز الحالي خاطئاً. */
export async function dbSetLoginCode(phone: string, current: string, next: string): Promise<boolean> {
  await requireSession(); // يتغيّر رمزُ الحساب الحاليّ فقط؛ الـRPC يتحقّق من الرمز الحالي.
  const { data, error } = await getSupabase().rpc("set_login_code", {
    p_phone: phone.trim(), p_current: current.trim(), p_new: next.trim(),
  });
  if (error) return false;
  return data === true;
}

/* ─────────────────────────── الإدارة (الأمراء) ─────────────────────────── */

export type AdminRow = { id: string; phone: string; name: string; role: string; isOwner: boolean };

/** يُعيد كلّ الحسابات الإداريّة (أمير/نائب أمير) — المالكُ أولاً. */
export async function dbListAdmins(): Promise<AdminRow[]> {
  await requireOwner();
  const { data } = await getSupabase()
    .from("profiles").select("id, phone, name, role, is_owner")
    .in("role", ["PRINCE", "DEPUTY_PRINCE"])
    .order("is_owner", { ascending: false });
  return (data ?? []).map(r => ({ id: r.id, phone: r.phone, name: r.name, role: r.role, isOwner: r.is_owner }));
}

/** يُنشئ حساب نائب أمير برمزٍ مُشفَّر (عبر create_admin). */
export async function dbCreateAdmin(name: string, phone: string, code: string, role: string): Promise<{ ok: boolean; error?: string }> {
  await requireOwner();
  const { error } = await getSupabase().rpc("create_admin", {
    p_id: uid("adm"), p_phone: normalizePhone(phone), p_code: code.trim(), p_name: name.trim(), p_role: role,
  });
  if (error) return { ok: false, error: /duplicate|unique/i.test(error.message) ? "الجوّال مُسجَّل مسبقاً." : "تعذّر إنشاء الحساب." };
  return { ok: true };
}

/** ينقل الملكيّة ذرّياً من المالك الحاليّ إلى حسابٍ آخر (عبر transfer_ownership). */
export async function dbTransferOwnership(fromPhone: string, toId: string): Promise<boolean> {
  await requireOwner();
  const { data, error } = await getSupabase().rpc("transfer_ownership", { p_from_phone: fromPhone, p_to_id: toId });
  if (error) return false;
  return data === true;
}

/** يحذف حساباً إدارياً — لا يُحذف المالك أبداً (شرط is_owner=false). */
export async function dbDeleteAdmin(id: string): Promise<boolean> {
  await requireOwner();
  const { error, count } = await getSupabase()
    .from("profiles").delete({ count: "exact" }).eq("id", id).eq("is_owner", false);
  return !error && (count ?? 0) > 0;
}

/** يتحقّق من الجوّال والرمز عبر دالّة verify_login في قاعدة البيانات (تشفير bcrypt). */
export async function dbVerifyLogin(phone: string, code: string): Promise<LoginResult> {
  const { data, error } = await getSupabase().rpc("verify_login", { p_phone: normalizePhone(phone), p_code: code.trim() });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return { ok: false };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    session: {
      phone: row.phone,
      name: row.name,
      role: row.role,
      isOwner: row.is_owner,
      supervisorId: row.supervisor_id ?? null,
      studentId: row.student_id ?? null,
      landing: row.landing ?? "/dashboard",
    },
  };
}
