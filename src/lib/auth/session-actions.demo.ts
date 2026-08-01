"use server";
import { cookies } from "next/headers";
import type { LoginResult, DbSession } from "@/lib/db/types";
import type { AdminRow } from "@/lib/db/data.demo";

const COOKIE = "demo_role";

export type DemoRole = "PRINCE" | "SUPERVISOR" | "BENEFICIARY";

const SESSIONS: Record<DemoRole, DbSession> = {
  PRINCE: {
    phone: "0500000000",
    name: "الأمير التجريبي",
    role: "PRINCE",
    isOwner: true,
    supervisorId: null,
    studentId: null,
    landing: "/dashboard",
  },
  SUPERVISOR: {
    phone: "0500000001",
    name: "أحمد بن سعيد العسيري",
    role: "SUPERVISOR",
    isOwner: false,
    supervisorId: "s1",
    studentId: null,
    landing: "/my-team",
  },
  BENEFICIARY: {
    phone: "0502001001",
    name: "عبدالرحمن بن سعد الحربي",
    role: "BENEFICIARY",
    isOwner: false,
    supervisorId: null,
    studentId: "st01",
    landing: "/me",
  },
};

function isRole(v: string | undefined): v is DemoRole {
  return v === "PRINCE" || v === "SUPERVISOR" || v === "BENEFICIARY";
}

export async function getSession(): Promise<DbSession | null> {
  const jar = await cookies();
  const role = jar.get(COOKIE)?.value;
  if (!isRole(role)) return null;
  return SESSIONS[role];
}

export async function login(role: string): Promise<LoginResult> {
  if (!isRole(role)) return { ok: false };
  const jar = await cookies();
  jar.set(COOKIE, role, { httpOnly: false, sameSite: "lax", path: "/" });
  return { ok: true, session: SESSIONS[role] };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function changeCode(_current: string, _next: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function listAdmins(): Promise<AdminRow[]> {
  return [{ id: "admin1", phone: "0500000000", name: "الأمير التجريبي", role: "PRINCE", isOwner: true }];
}

export async function addAdmin(_name: string, _phone: string, _code: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function transferOwnership(_toId: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function deleteAdmin(_id: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}
