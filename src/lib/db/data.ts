"use server";
import { getSupabase } from "@/lib/supabase/server";
import type { Team, Student, Supervisor, Committee, Invoice, PaymentStatus } from "@/lib/mock/types";
import type { RegField, LogoDisplayMode, State } from "@/lib/store/StoreProvider";
import type { LoginResult } from "./types";
import {
  rowToTeam, teamToRow,
  rowToCommittee, committeeToRow,
  rowToSupervisor, supervisorToRow,
  rowToStudent, studentToRow,
  rowToInvoice, invoiceToRow,
  rowToRegField,
} from "./mappers";

const uid = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const maskNid = () => "••••••" + Math.floor(1000 + Math.random() * 8999);

/* ─────────────────────────── القراءة ─────────────────────────── */

/** يقرأ لقطةً كاملة للحالة من قاعدة البيانات، بنفس شكل State في المتجر. */
export async function loadAllData(): Promise<State> {
  const db = getSupabase();

  const [teams, students, supervisors, committees, invoices, regRows, attRows, asgRows, settings] =
    await Promise.all([
      db.from("teams").select("*").order("points", { ascending: false }),
      db.from("students").select("*").order("points", { ascending: false }),
      db.from("supervisors").select("*"),
      db.from("committees").select("*"),
      db.from("invoices").select("*").order("created_at", { ascending: false }),
      db.from("reg_fields").select("*").order("sort", { ascending: true }),
      db.from("attendance").select("*"),
      db.from("supervisor_assignments").select("*"),
      db.from("app_settings").select("*").eq("id", 1).single(),
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

  const allInvoices = (invoices.data ?? []).map(rowToInvoice);
  const trashIds = new Set((invoices.data ?? []).filter(r => r.in_trash).map(r => r.id));

  return {
    teams:          (teams.data ?? []).map(rowToTeam),
    students:       (students.data ?? []).map(rowToStudent),
    supervisors:    (supervisors.data ?? []).map(r => ({
      ...rowToSupervisor(r),
      teamIds: supTeams[r.id] ?? [],
      committeeIds: supComms[r.id] ?? [],
    })),
    committees:     (committees.data ?? []).map(r => ({
      ...rowToCommittee(r),
      supervisorIds: commSups[r.id] ?? [],
    })),
    invoices:       allInvoices.filter(i => !trashIds.has(i.id)),
    trashInvoices:  allInvoices.filter(i => trashIds.has(i.id)),
    regFields:      (regRows.data ?? []).map(rowToRegField),
    regOpen:        settings.data?.reg_open ?? true,
    logoDisplayMode: (settings.data?.logo_display_mode ?? "VISIBLE") as LogoDisplayMode,
    attendance,
  };
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
  await getSupabase().from("teams").update(teamToRow(patch)).eq("id", id);
  // عند تغيير القائد: يُضاف كمُشرفٍ على الفريق (دون إزالة مشرفين آخرين).
  if (patch.supervisorId) {
    await getSupabase().from("supervisor_assignments")
      .upsert({ supervisor_id: patch.supervisorId, target_kind: "team", target_id: id }, { ignoreDuplicates: true });
  }
}
export async function dbDeleteTeam(id: string) {
  const db = getSupabase();
  await db.from("students").delete().eq("team_id", id);
  await db.from("supervisor_assignments").delete().eq("target_kind", "team").eq("target_id", id);
  await db.from("teams").delete().eq("id", id);
}

/* ─────────────────────────── الطلاب ─────────────────────────── */

export async function dbAddStudent(input: Omit<Student, "id" | "nationalIdMasked" | "points" | "attendance">) {
  const db = getSupabase();
  const row = studentToRow({
    ...input,
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
  emergencyContact: string; emergencyPhone: string;
}): Promise<Student> {
  const row = studentToRow({
    id: uid("st"),
    name: input.name,
    phone: input.phone,
    grade: input.grade,
    section: input.section,
    teamId: "",
    paymentStatus: "PENDING",
    paidAmount: 0,
    totalAmount: 2500,
    emergencyContact: input.emergencyContact,
    emergencyPhone: input.emergencyPhone,
    nationalIdMasked: maskNid(),
    points: 0,
    attendance: 100,
    approvalStatus: "PENDING",
    registeredAt: new Date().toISOString(),
  });
  const { data } = await getSupabase().from("students").insert(row).select("*").single();
  return rowToStudent(data);
}

export async function dbApproveStudent(id: string, teamId: string) {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await getSupabase().from("students").update(
    studentToRow({ approvalStatus: "APPROVED", teamId, accessCode: code }),
  ).eq("id", id);
  if (teamId) await bumpTeamCount(teamId, 1);
}
export async function dbRejectStudent(id: string) {
  await getSupabase().from("students").update(studentToRow({ approvalStatus: "REJECTED" })).eq("id", id);
}
export async function dbUpdateStudent(id: string, patch: Partial<Student>) {
  await getSupabase().from("students").update(studentToRow(patch)).eq("id", id);
}
export async function dbSetStudentPhoto(id: string, dataUrl: string) {
  await getSupabase().from("students").update({ photo_data_url: dataUrl }).eq("id", id);
}
export async function dbDeleteStudent(id: string) {
  const db = getSupabase();
  const { data } = await db.from("students").select("team_id").eq("id", id).single();
  await db.from("students").delete().eq("id", id);
  if (data?.team_id) await bumpTeamCount(data.team_id, -1);
}
export async function dbMoveStudent(id: string, newTeamId: string) {
  const db = getSupabase();
  const { data } = await db.from("students").select("team_id").eq("id", id).single();
  const oldTeamId = data?.team_id as string | undefined;
  if (oldTeamId === newTeamId) return;
  await db.from("students").update({ team_id: newTeamId }).eq("id", id);
  if (oldTeamId) await bumpTeamCount(oldTeamId, -1);
  if (newTeamId) await bumpTeamCount(newTeamId, 1);
}
export async function dbSetPayment(id: string, status: PaymentStatus, paid: number) {
  await getSupabase().from("students").update({ payment_status: status, paid_amount: paid }).eq("id", id);
}

async function bumpTeamCount(teamId: string, delta: number) {
  const db = getSupabase();
  const { data } = await db.from("teams").select("student_count").eq("id", teamId).single();
  if (!data) return;
  const next = Math.max(0, (data.student_count ?? 0) + delta);
  await db.from("teams").update({ student_count: next }).eq("id", teamId);
}

/* ─────────────────────────── المشرفون ─────────────────────────── */

export async function dbAddSupervisor(name: string, phone: string, email: string, teamIds: string[], committeeIds: string[]) {
  const id = uid("s");
  await getSupabase().from("supervisors").insert(
    supervisorToRow({ id, name, phone, email, nationalIdMasked: maskNid() }),
  );
  await setSupervisorTargets(id, "team", teamIds);
  await setSupervisorTargets(id, "committee", committeeIds);
}
export async function dbUpdateSupervisor(id: string, patch: Partial<Supervisor>) {
  const row = supervisorToRow(patch);
  if (Object.keys(row).length) await getSupabase().from("supervisors").update(row).eq("id", id);
  if (patch.teamIds !== undefined) await setSupervisorTargets(id, "team", patch.teamIds);
  if (patch.committeeIds !== undefined) await setSupervisorTargets(id, "committee", patch.committeeIds);
}
export async function dbDeleteSupervisor(id: string) {
  // تعيينات المشرف تُحذف تلقائياً (on delete cascade).
  await getSupabase().from("supervisors").delete().eq("id", id);
}

/* ─────────────────────────── اللجان ─────────────────────────── */

export async function dbAddCommittee(name: string, description: string, supervisorIds: string[], color: string) {
  const id = uid("c");
  await getSupabase().from("committees").insert(
    committeeToRow({ id, name, description, color }),
  );
  await setCommitteeSupervisors(id, supervisorIds);
}
export async function dbUpdateCommittee(id: string, patch: Partial<Committee>) {
  const row = committeeToRow(patch);
  if (Object.keys(row).length) await getSupabase().from("committees").update(row).eq("id", id);
  if (patch.supervisorIds !== undefined) await setCommitteeSupervisors(id, patch.supervisorIds);
}
export async function dbDeleteCommittee(id: string) {
  const db = getSupabase();
  await db.from("supervisor_assignments").delete().eq("target_kind", "committee").eq("target_id", id);
  await db.from("committees").delete().eq("id", id);
}

/* ─────────────────────────── الفواتير ─────────────────────────── */

export async function dbAddInvoice(input: Omit<Invoice, "id" | "code">) {
  const nextNo = String(1000 + Math.floor(Math.random() * 8999));
  await getSupabase().from("invoices").insert(
    { ...invoiceToRow(input), id: uid("inv"), code: `INV-1448-${nextNo}`, in_trash: false },
  );
}
export async function dbApproveInvoice(id: string) {
  await getSupabase().from("invoices").update({ status: "paid" }).eq("id", id);
}
export async function dbDeleteInvoice(id: string) {
  await getSupabase().from("invoices").update({ in_trash: true }).eq("id", id);
}
export async function dbRestoreInvoice(id: string) {
  await getSupabase().from("invoices").update({ in_trash: false }).eq("id", id);
}

/* ─────────────────────────── نموذج التسجيل ─────────────────────────── */

export async function dbToggleRegField(key: string) {
  const db = getSupabase();
  const { data } = await db.from("reg_fields").select("active").eq("key", key).single();
  if (!data) return;
  await db.from("reg_fields").update({ active: !data.active }).eq("key", key);
}
export async function dbReorderRegField(key: string, dir: "up" | "down") {
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
  const db = getSupabase();
  const { data } = await db.from("reg_fields").select("sort").order("sort", { ascending: false }).limit(1);
  const sort = (data?.[0]?.sort ?? 0) + 1;
  await db.from("reg_fields").insert({
    key: field.key, label: field.label, type: field.type, required: field.required, active: true, descr: field.desc, sort,
  });
}
export async function dbRemoveRegField(key: string) {
  await getSupabase().from("reg_fields").delete().eq("key", key);
}
export async function dbSetRegOpen(open: boolean) {
  await getSupabase().from("app_settings").update({ reg_open: open }).eq("id", 1);
}

/* ─────────────────────────── الحضور والإعدادات ─────────────────────────── */

export async function dbToggleAttendance(studentId: string, day: number) {
  const db = getSupabase();
  const { data } = await db.from("attendance").select("present").eq("student_id", studentId).eq("day", day).single();
  const present = !(data?.present ?? (day < 5));
  await db.from("attendance").upsert({ student_id: studentId, day, present });
}
export async function dbSetLogoDisplayMode(mode: LogoDisplayMode) {
  await getSupabase().from("app_settings").update({ logo_display_mode: mode }).eq("id", 1);
}

/* ─────────────────────────── التصفير ─────────────────────────── */

/** يمحو كلّ بيانات الفعاليّة (الفرق/الطلاب/المشرفين/اللجان/الفواتير/الحضور)
 *  دون المساس بالحسابات (profiles) ولا الإعدادات ولا حقول التسجيل. */
export async function dbResetAll() {
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
  const { data } = await getSupabase()
    .from("profiles").select("id, phone, name, role, is_owner")
    .in("role", ["PRINCE", "DEPUTY_PRINCE"])
    .order("is_owner", { ascending: false });
  return (data ?? []).map(r => ({ id: r.id, phone: r.phone, name: r.name, role: r.role, isOwner: r.is_owner }));
}

/** يُنشئ حساب نائب أمير برمزٍ مُشفَّر (عبر create_admin). */
export async function dbCreateAdmin(name: string, phone: string, code: string, role: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await getSupabase().rpc("create_admin", {
    p_id: uid("adm"), p_phone: phone.trim(), p_code: code.trim(), p_name: name.trim(), p_role: role,
  });
  if (error) return { ok: false, error: /duplicate|unique/i.test(error.message) ? "الجوّال مُسجَّل مسبقاً." : "تعذّر إنشاء الحساب." };
  return { ok: true };
}

/** ينقل الملكيّة ذرّياً من المالك الحاليّ إلى حسابٍ آخر (عبر transfer_ownership). */
export async function dbTransferOwnership(fromPhone: string, toId: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("transfer_ownership", { p_from_phone: fromPhone, p_to_id: toId });
  if (error) return false;
  return data === true;
}

/** يحذف حساباً إدارياً — لا يُحذف المالك أبداً (شرط is_owner=false). */
export async function dbDeleteAdmin(id: string): Promise<boolean> {
  const { error, count } = await getSupabase()
    .from("profiles").delete({ count: "exact" }).eq("id", id).eq("is_owner", false);
  return !error && (count ?? 0) > 0;
}

/** يتحقّق من الجوّال والرمز عبر دالّة verify_login في قاعدة البيانات (تشفير bcrypt). */
export async function dbVerifyLogin(phone: string, code: string): Promise<LoginResult> {
  const { data, error } = await getSupabase().rpc("verify_login", { p_phone: phone.trim(), p_code: code.trim() });
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
