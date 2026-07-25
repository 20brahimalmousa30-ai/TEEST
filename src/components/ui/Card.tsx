import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  action?: ReactNode;
  padded?: boolean;
};

export function Card({ title, action, padded = true, className, children, ...rest }: CardProps) {
  return (
    <div className={`rounded-md border border-line bg-surface ${className ?? ""}`} {...rest}>
      {(title || action) && (
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3">
          {title && <h3 className="text-[15px] font-semibold text-text">{title}</h3>}
          {action}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </div>
  );
}
