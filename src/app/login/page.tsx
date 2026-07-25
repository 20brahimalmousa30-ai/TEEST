import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginPanel } from "./LoginPanel";

export const metadata = { title: "تسجيل الدخول — معالي أبها ١٤٤٨هـ" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Left panel — atmosphere */}
      <section
        className="relative hidden overflow-hidden border-l border-line lg:block"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(184,149,90,.22) 0%, transparent 55%), linear-gradient(180deg, var(--bg-raised) 0%, var(--bg) 100%)",
        }}
      >
        <div className="relative flex h-full flex-col justify-between p-12">
          <div>
            <Link href="/" className="inline-flex">
              <Logo size={120} priority />
            </Link>
          </div>

          <div>
            <p className="mb-4 text-[12px] tracking-[.16em] text-accent-warm-2">منصّةُ معالي · من مرتفعات عَسير</p>
            <h1
              className="text-balance text-[42px] leading-[1.15] font-medium tracking-tight text-text"
              style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}
            >
              «فما بلغَ من أدركَ المعالي منزلاً، إلاّ الذي جدَّ وسارَ على قدَمِ»
            </h1>
            <p className="mt-6 max-w-[48ch] text-[15px] leading-[1.9] text-text-2">
              رحلةُ أربعمئةِ طالبٍ ومئتَي مشرفٍ من مرتفعات عَسير — تُدارُ من هذه اللوحة، وتُقرأُ من هذا الاسم.
            </p>
          </div>

          <div className="flex items-baseline justify-between text-[12px] text-text-3">
            <span>أبها · ١٤٤٨هـ</span>
            <span className="disp text-accent">منصّةُ معالي</span>
          </div>
        </div>
      </section>

      {/* Right panel — form */}
      <section className="relative flex items-start justify-center overflow-y-auto p-6 sm:p-10">
        <div className="w-full max-w-[460px] py-4">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size={48} withText />
          </div>
          <LoginPanel />
        </div>
      </section>
    </main>
  );
}
