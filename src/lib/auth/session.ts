"use client";
import { useEffect, useState } from "react";
import type { DbSession } from "@/lib/db/types";
import { getSession, logout } from "./session-actions.demo";

/** شكل الجلسة كما تُقرأ في المتصفّح (مطابق لِما يُوقّع في الكوكي). */
export type Session = DbSession;

/**
 * هوك العميل — يقرأ الجلسة من الكوكي الموقّع عبر Server Action.
 * يُعيد { session, ready }؛ session تبقى null أثناء التحميل.
 */
export function useSession() {
  const [session, setSession] = useState<DbSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      getSession().then(s => {
        if (!alive) return;
        setSession(s);
        setReady(true);
      });
    refresh();
    const onChange = () => refresh();
    window.addEventListener("maali.session.changed", onChange as EventListener);
    return () => {
      alive = false;
      window.removeEventListener("maali.session.changed", onChange as EventListener);
    };
  }, []);

  return { session, ready };
}

/** يُخطر هوكات useSession في نفس التبويب بأن الجلسة تغيّرت. */
export function announceSessionChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("maali.session.changed"));
  }
}

/** يسجّل الخروج بمحو كوكي الجلسة من الخادم. */
export async function clearSession() {
  await logout();
}
