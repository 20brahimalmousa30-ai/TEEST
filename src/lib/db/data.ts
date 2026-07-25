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

  const [teams, students, supervisors, committees, invoices, regRows, attRows, settings] =
    await Promise.all([
      db.from("teams").select("*").order("points", { ascending: false }),
      db.from("students").select("*").order("points", { ascending: false }),
      db.from("supervisors").select("*"),
      db.from("committees").select("*"),
      db.from("invoices").select("*").order("created_at", { ascending: false }),
      db.from("reg_fields").select("*").order("sort", { ascending: true }),
      db.from("attendance").select("*"),
      db.from("app_settings").select("*").eq("id", 1).single(),
    ]);

  const attendance: Record<string, boolean[]> = {};
  for (const a of attRows.data ?? []) {
    const arr = attendance[a.student_id] ?? [false, false, false, false, false, false, false, false];
    arr[a.day] = a.present;
    attendance[a.student_id] = arr;
  }

  const allInvoices = (invoices.data ?? []).map(rowToInvoice);
  const trashIds = new Set((invoices.data ?? []).filter(r => r.in_trash).map(r => r.id));

  return {
    teams:          (teams.data ?? []).map(rowToTeam),
    students:       (students.data ?? []).map(rowToStudent),
    supervisors:    (supervisors.data ?? []).map(rowToSupervisor),
    committees:     (committees.data ?? []).map(rowToCommittee),
    invoices:       allInvoices.filter(i => !trashIds.has(i.id)),
    trashInvoices:  allInvoices.filter(i => trashIds.has(i.id)),
    regFields:      (regRows.data ?? []).map(rowToRegField),
    regOpen:        settings.data?.reg_open ?? true,
    logoDisplayMode: (settings.data?.logo_display_mode ?? "VISIBLE") as LogoDisplayMode,
    attendance,
  };
}

/* ─────────────────────────── الفرق ─────────────────────────── */

export async function dbAddTeam(name: string, color: string, badge: string, supervisorId: string, tagline: string) {
  await getSupabase().from("teams").insert(
    teamToRow({ id: uid("t"), name, color, badge, supervisorId, tagline, studentCount: 0, points: 0 }),
  );
}
export async function dbUpdateTeam(id: string, patch: Partial<Team>) {
  await getSupabase().from("teams").update(teamToRow(patch)).eq("id", id);
}
export async function dbDeleteTeam(id: string) {
  const db = getSupabase();
  await db.from("students").delete().eq("team_id", id);
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
  await getSupabase().from("supervisors").insert(
    supervisorToRow({ id: uid("s"), name, phone, email, teamIds, committeeIds, nationalIdMasked: maskNid() }),
  );
}
export async function dbUpdateSupervisor(id: string, patch: Partial<Supervisor>) {
  await getSupabase().from("supervisors").update(supervisorToRow(patch)).eq("id", id);
}
export async function dbDeleteSupervisor(id: string) {
  await getSupabase().from("supervisors").delete().eq("id", id);
}

/* ─────────────────────────── اللجان ─────────────────────────── */

export async function dbAddCommittee(name: string, description: string, supervisorIds: string[], color: string) {
  await getSupabase().from("committees").insert(
    committeeToRow({ id: uid("c"), name, description, supervisorIds, color }),
  );
}
export async function dbUpdateCommittee(id: string, patch: Partial<Committee>) {
  await getSupabase().from("committees").update(committeeToRow(patch)).eq("id", id);
}
export async function dbDeleteCommittee(id: string) {
  await getSupabase().from("committees").delete().eq("id", id);
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

/* ─────────────────────────── المصادقة ─────────────────────────── */

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
