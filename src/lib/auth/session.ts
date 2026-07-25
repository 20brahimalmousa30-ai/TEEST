"use client";
import { useEffect, useState } from "react";
import type { Session, DemoAccount } from "./accounts";

const KEY = "maali.session.v1";

export function saveSession(account: DemoAccount): Session {
  const session: Session = {
    email: account.email,
    name: account.name,
    role: account.role,
    isOwner: account.isOwner,
    supervisorId: account.supervisorId,
    studentId: account.studentId,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  }
  return session;
}

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}

/** Client hook — returns null while hydrating */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady]     = useState(false);

  useEffect(() => {
    setSession(readSession());
    setReady(true);
    const onStorage = () => setSession(readSession());
    window.addEventListener("storage", onStorage);
    window.addEventListener("maali.session.changed", onStorage as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("maali.session.changed", onStorage as EventListener);
    };
  }, []);

  return { session, ready };
}

/** Emit change so useSession hooks in the same tab react */
export function announceSessionChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("maali.session.changed"));
  }
}
