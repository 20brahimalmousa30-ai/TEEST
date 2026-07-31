"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { LoadErrorBanner } from "./LoadErrorBanner";
import { VersionWatcher } from "./VersionWatcher";
import { useSession, clearSession, announceSessionChange } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/accounts";
import { useStore } from "@/lib/store/StoreProvider";
import { studentsNet, totalNet } from "@/lib/points";

type NavItem = { href: string; label: string; icon: React.ReactNode; count?: string };
type NavGroup = { label: string; items: NavItem[] };

// Full nav for Prince / Deputy
const fullNav: NavGroup[] = [
  {
    label: "الفعاليّة",
    items: [
      { href: "/dashboard",   label: "نظرةٌ عامّة", icon: <IconHome /> },
      { href: "/teams",       label: "الأسر",       icon: <IconTeams /> },
      { href: "/committees",  label: "اللجان",       icon: <IconCommittee /> },
      { href: "/students",    label: "الشباب",        icon: <IconStudents /> },
      { href: "/supervisors", label: "المشرفون",     icon: <IconSupervisor /> },
      { href: "/announcements", label: "لوحة الإعلانات", icon: <IconMegaphone /> },
      { href: "/tasks",       label: "رصد الأنشطة",    icon: <IconTasks /> },
    ],
  },
  {
    label: "المالي والنقاط",
    items: [
      { href: "/invoices",    label: "الفواتير",       icon: <IconInvoice /> },
      { href: "/leaderboard", label: "قائمة الصدارة",  icon: <IconTrophy /> },
    ],
  },
  {
    label: "الإعداد",
    items: [
      { href: "/settings/site",         label: "إعدادات الموقع", icon: <IconImage /> },
      { href: "/settings/registration", label: "نموذج التسجيل", icon: <IconSettings /> },
      { href: "/settings/invoices",     label: "إعدادات الفواتير", icon: <IconInvoice /> },
      { href: "/settings/motivations",  label: "الجُمل التحفيزيّة", icon: <IconSettings /> },
      { href: "/settings/account",      label: "إعدادات الحساب", icon: <IconUser /> },
    ],
  },
];

// Limited nav for Supervisor
const supervisorNav: NavGroup[] = [
  {
    label: "نطاقي",
    items: [
      { href: "/my-team",    label: "أسرتي",           icon: <IconTeams /> },
      { href: "/my-committee", label: "لجنتي",         icon: <IconCommittee /> },
      { href: "/announcements", label: "لوحة الإعلانات", icon: <IconMegaphone /> },
      { href: "/tasks",       label: "رصد الأنشطة",     icon: <IconTasks /> },
      { href: "/leaderboard", label: "قائمة الصدارة", icon: <IconTrophy /> },
    ],
  },
  {
    label: "الإعداد",
    items: [
      { href: "/settings/account", label: "إعدادات الحساب", icon: <IconUser /> },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { session, ready } = useSession();
  const { supervisors, students, studentTasks, hydrated } = useStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // البند ١٨: صلاحيات المشرف الحاليّ (تُقرأ من المتجر عبر supervisorId في الجلسة).
  const mySupervisor = session?.role === "SUPERVISOR"
    ? supervisors.find(s => s.id === session.supervisorId)
    : undefined;
  const myPerms = mySupervisor?.permissions ?? [];

  // عدّاد النقاط: المشرف يرى صافي نقاط أُسَره؛ الأمير/نائبه الإجمالي العام.
  const isSup = session?.role === "SUPERVISOR";
  const pointsValue = isSup
    ? studentsNet(studentTasks, new Set(students.filter(s => (mySupervisor?.teamIds ?? []).includes(s.teamId)).map(s => s.id)))
    : totalNet(studentTasks);
  const pointsLabel = isSup ? "نقاط أُسَرك" : "إجمالي النقاط";

  // حارس الدخول: أيّ زائرٍ غير مسجّل (لا جلسة) يُحوَّل لصفحة الدخول —
  // يمنع الوصول المباشر إلى /dashboard وبقيّة لوحة الإدارة بلا مصادقة.
  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    // Beneficiary should not see the shell at all
    if (session.role === "BENEFICIARY" && pathname !== "/me") {
      router.replace("/me");
      return;
    }
    // البند ١٨: حارسُ مسارٍ للمشرف — لا يصل قسماً إدارياً إلاّ بصلاحيةٍ ممنوحة.
    // ننتظر تحميل المتجر أوّلاً حتى لا نطرد المشرف قبل قراءة صلاحياته.
    if (session.role === "SUPERVISOR" && hydrated) {
      const allowedPrefixes = [
        "/my-team", "/my-committee", "/announcements", "/tasks", "/leaderboard", "/settings/account", "/me",
        ...(myPerms.includes("invoices")   ? ["/invoices"]   : []),
        ...(myPerms.includes("students")   ? ["/students"]   : []),
        ...(myPerms.includes("teams")      ? ["/teams"]      : []),
        ...(myPerms.includes("committees") ? ["/committees"] : []),
      ];
      const allowed = allowedPrefixes.some(p => pathname === p || pathname.startsWith(p + "/"));
      if (!allowed) {
        router.replace("/my-team");
      }
    }
  }, [ready, session, pathname, router, hydrated, myPerms]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // البند ١٨: أقسامٌ إداريّةٌ إضافيّة يفتحها الأمير للمشرف عبر الصلاحيات الدقيقة.
  const supervisorNavWithPerms: NavGroup[] = (() => {
    if (session?.role !== "SUPERVISOR") return supervisorNav;
    const me = supervisors.find(s => s.id === session.supervisorId);
    const perms = me?.permissions ?? [];
    if (perms.length === 0) return supervisorNav;
    const extra: NavItem[] = [];
    if (perms.includes("invoices"))   extra.push({ href: "/invoices",   label: "الفواتير", icon: <IconInvoice /> });
    if (perms.includes("students"))   extra.push({ href: "/students",   label: "الشباب",    icon: <IconStudents /> });
    if (perms.includes("teams"))      extra.push({ href: "/teams",      label: "الأسر",     icon: <IconTeams /> });
    if (perms.includes("committees")) extra.push({ href: "/committees", label: "اللجان",     icon: <IconCommittee /> });
    if (extra.length === 0) return supervisorNav;
    return [
      supervisorNav[0],
      { label: "صلاحيّاتٌ ممنوحة", items: extra },
      ...supervisorNav.slice(1),
    ];
  })();

  const baseGroups: NavGroup[] =
    session?.role === "SUPERVISOR" ? supervisorNavWithPerms : fullNav;

  // رابط «إدارة الأمراء» يظهر للمالك الأصل فقط، ضمن مجموعة الإعداد.
  const groups: NavGroup[] = session?.isOwner
    ? baseGroups.map(g => g.label === "الإعداد"
        ? { ...g, items: [...g.items, { href: "/settings/admins", label: "إدارة الأمراء", icon: <IconCrown /> }] }
        : g)
    : baseGroups;

  async function onLogout() {
    await clearSession();
    announceSessionChange();
    router.push("/login");
  }

  // Shared sidebar body — reused by the desktop aside and the mobile drawer.
  const sidebarBody = (
    <>
      <div className="border-b border-line px-5 py-5">
        <Link
          href={session?.role === "SUPERVISOR" ? "/my-team" : "/dashboard"}
          className="flex items-center justify-center"
          onClick={() => setDrawerOpen(false)}
        >
          <Logo size={96} priority />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map(g => (
          <div key={g.label} className="mb-5">
            <div className="px-2 pb-2 text-[11px] tracking-[.16em] text-text-3">{g.label}</div>
            {g.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`mb-[2px] flex items-center gap-2.5 rounded px-2.5 py-2 text-[14px] transition-colors ${
                    active
                      ? "bg-accent text-[#F4EEE2] font-medium"
                      : "text-text-2 hover:bg-surface-alt hover:text-text"
                  }`}
                >
                  <span className={active ? "text-accent-warm" : "text-text-3"}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.count && (
                    <span className={`num me-auto ms-auto text-[11px] ${active ? "opacity-85" : "opacity-70"}`}>
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Account block */}
      <div className="border-t border-line p-4">
        <div className="mb-2 text-[10px] tracking-[.16em] text-text-3">حسابك</div>
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-[13px] font-semibold" style={{ color: "#F4EEE2" }}>
            {session?.name?.[0] ?? "?"}
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[13px] font-medium text-text">
              {session ? session.name.split("—").pop()?.trim() ?? session.name : "زائر"}
            </span>
            <span className="text-[11px] text-text-3">
              {session ? `${roleLabel[session.role as keyof typeof roleLabel] ?? session.role}${session.isOwner ? " · Owner" : ""}` : "غير مسجّل"}
            </span>
          </div>
        </div>
        {session ? (
          <button
            onClick={onLogout}
            className="mt-3 w-full rounded border border-line-strong px-3 py-1.5 text-[12px] text-text-2 hover:border-accent hover:text-text"
          >
            تسجيل الخروج · تبديل الحساب
          </button>
        ) : (
          <Link
            href="/login"
            onClick={() => setDrawerOpen(false)}
            className="mt-3 block rounded border border-line-strong px-3 py-1.5 text-center text-[12px] text-text-2 hover:border-accent hover:text-text"
          >
            الدخول
          </Link>
        )}
      </div>
    </>
  );

  return (
    <>
    <div className="app-grid">
      {/* Sidebar — fixed on the right (RTL), stays put while the main area scrolls */}
      <aside className="app-sidebar border-l border-line bg-bg-raised">
        {sidebarBody}
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-col">
        {/* Mobile top bar */}
        <div className="app-mobilebar sticky top-0 z-30 items-center justify-between border-b border-line bg-bg-raised/95 px-4 py-2 backdrop-blur">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="فتح القائمة"
            className="grid h-9 w-9 place-items-center rounded border border-line-strong text-text-2 hover:border-accent hover:text-text"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          {session && <PointsBadge label={pointsLabel} value={pointsValue} />}
          {session ? (
            <button onClick={onLogout} className="text-[12px] text-accent">
              خروج
            </button>
          ) : (
            <span className="w-9" />
          )}
        </div>
        {/* شريطٌ علويّ لسطح المكتب — يحمل عدّاد النقاط الحيّ. */}
        {session && (
          <div className="app-desktopbar sticky top-0 z-20 hidden items-center justify-end border-b border-line bg-bg-raised/70 px-6 py-2 backdrop-blur md:flex">
            <PointsBadge label={pointsLabel} value={pointsValue} />
          </div>
        )}
        {/* مبدأٌ ثابت: فشل التحميل يظهر صراحةً (بدل قوائم فارغةٍ توحي بالحذف). */}
        <LoadErrorBanner />
        <main className="flex-1">{children}</main>
      </div>
    </div>

    {/* Mobile drawer — slides in from the right (RTL) */}
    <div className="app-drawer-wrap" data-open={drawerOpen} aria-hidden={!drawerOpen}>
      {/* Scrim */}
      <div onClick={() => setDrawerOpen(false)} className="app-scrim" />
      {/* Panel */}
      <aside className="app-drawer border-l border-line bg-bg-raised shadow-xl">
        <div className="flex items-center justify-end border-b border-line px-3 py-2">
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="إغلاق القائمة"
            className="grid h-8 w-8 place-items-center rounded text-text-3 hover:text-text"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {sidebarBody}
        </div>
      </aside>
    </div>

    {/* كشفٌ تلقائيّ لأيّ نشرٍ جديد → «تحديث الآن» دون تدخّلٍ يدويّ. */}
    <VersionWatcher />
    </>
  );
}

/* ─── عدّاد النقاط الحيّ ─── */
function PointsBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-accent-warm/40 bg-accent-warm/10 px-3 py-1 text-[13px]">
      <span className="text-accent-warm-2"><IconTrophy /></span>
      <span className="text-[11px] text-text-3">{label}</span>
      <span className="num font-semibold text-text">{value}</span>
    </span>
  );
}

/* ─── Icons ─── */
function IconHome()       { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>; }
function IconTeams()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 20c0-2 2-3.5 4-3.5s4 1.5 4 3.5"/></svg>; }
function IconCommittee()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 7h18M3 12h18M3 17h18"/></svg>; }
function IconStudents()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>; }
function IconSupervisor() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="7" r="3.5"/><path d="M6 21c0-3.3 2.7-6 6-6s6 2.7 6 6M20 8l1 1-3 3"/></svg>; }
function IconInvoice()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 10h18"/></svg>; }
function IconTrophy()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3M10 20h4M12 15v5"/></svg>; }
function IconSettings()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>; }
function IconUser()       { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>; }
function IconImage()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>; }
function IconCrown()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z"/></svg>; }
function IconTasks()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>; }
function IconMegaphone()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1zM14 8a4 4 0 0 1 0 8M18 5a8 8 0 0 1 0 14"/></svg>; }
