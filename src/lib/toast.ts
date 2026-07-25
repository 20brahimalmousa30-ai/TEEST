export type ToastKind = "ok" | "info" | "warn" | "critical";

export type ToastDetail = { msg: string; kind: ToastKind; sub?: string };

const EVT = "maali.toast";

export function fireToast(msg: string, opts: { kind?: ToastKind; sub?: string } = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(EVT, {
      detail: { msg, kind: opts.kind ?? "ok", sub: opts.sub },
    })
  );
}

export const TOAST_EVENT = EVT;
