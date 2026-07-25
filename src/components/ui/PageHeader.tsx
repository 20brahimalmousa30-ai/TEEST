import Link from "next/link";
import type { ReactNode } from "react";

type Crumb = { href?: string; label: string };

export function PageHeader({
  eyebrow,
  crumbs,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  crumbs?: Crumb[];
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        {eyebrow && (
          <div className="mb-2 flex items-center gap-3">
            <span className="h-px w-6 bg-accent-warm" />
            <span className="eyebrow">{eyebrow}</span>
          </div>
        )}
        {crumbs && crumbs.length > 0 && (
          <div className="mb-1 text-[12px] text-text-3">
            {crumbs.map((c, i) => (
              <span key={i}>
                {c.href ? (
                  <Link href={c.href} className="hover:text-accent">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
                {i < crumbs.length - 1 && <span className="mx-2">›</span>}
              </span>
            ))}
          </div>
        )}
        <h1
          className="text-[26px] font-semibold leading-tight tracking-tight"
          style={{ fontFamily: "var(--font-messiri), var(--font-cairo), serif" }}
        >
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 max-w-[68ch] text-[14px] text-text-2">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
