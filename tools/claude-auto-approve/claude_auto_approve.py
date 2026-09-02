#!/usr/bin/env python3
"""حارس أذونات Claude Code — يفهم كل طلب، يصنّفه، ثم يقبل أو ينبّهك.

كيف يعمل:
  1. يجد نافذة Claude Code **بالاسم** ويلتصق بها. تنقّلك بين التطبيقات
     لا يعنيه: لا يقرأ نافذةً أخرى ولا يرسل مفاتيح إليها أبداً.
  2. يقرأ نصّ الطلب من تلك النافذة (عبر UI Automation) ولو كانت في الخلفية.
  3. يصنّفه بالعربية ويقرّر.
  4. مقبول  → يضغط الموافقة (فقط إن كانت نافذة Claude Code هي النشطة).
     مرفوض  → بطاقة حمراء في زاوية الشاشة التي عليها مؤشّرك، والقرار لك.

بلا أي صوت. اللون الأحمر وحده هو التنبيه.

    python claude_auto_approve.py                # الوضع الاعتيادي
    python claude_auto_approve.py --auto-deny    # بعد أن تثق به: يرفض بنفسه
    python claude_auto_approve.py --dry-run      # معاينة بلا ضغط

اختصارات: Ctrl+Alt+S تشغيل/إيقاف | Ctrl+Alt+Q إنهاء
"""

from __future__ import annotations

import argparse
import ctypes
import ctypes.wintypes as wintypes
import datetime as dt
import queue
import re
import sys
import threading
import time
from pathlib import Path

from classifier import Cat, Decision, classify_request, find_danger

LOG_PATH = Path(__file__).with_name("auto_approve.log")

DEFAULT_WINDOW_KEYWORDS = ("claude",)

ALWAYS_ALLOW_MARKERS = ("always allow", "don't ask again", "dont ask again")
ALLOW_ONCE_MARKERS = ("allow once", "yes, proceed", "yes, and", "allow")

UI_NOISE = re.compile(
    r"^\s*(\d+\.\s*)?(always allow|allow once|allow|deny|no|yes|esc|enter|ctrl|shift|tab|"
    r"do you want|what would you like|claude|thinking|permission|"
    r"press|select|choose|\W*)\s*$",
    re.IGNORECASE,
)

TOOL_HEADER = re.compile(
    r"^\s*(Bash|Read|Write|Edit|MultiEdit|Glob|Grep|WebFetch|WebSearch|"
    r"NotebookEdit|NotebookRead|Task|LS)\b\s*(command|tool|file|call)?\s*[:\-–]?\s*",
    re.IGNORECASE,
)


# ============================================================ نوافذ ويندوز
def _user32():
    return ctypes.windll.user32


def find_claude_window(keywords: tuple[str, ...]) -> tuple[int | None, str]:
    """يبحث عن نافذة Claude Code بالاسم بين كل النوافذ الظاهرة.

    لا يعتمد على النافذة النشطة — لذلك يبقى ملتصقاً بـ Claude Code
    مهما تنقّل المستخدم بين التطبيقات.
    """
    try:
        user32 = _user32()
    except AttributeError:
        return None, ""

    found: list[tuple[int, str]] = []
    enum_proc = ctypes.WINFUNCTYPE(
        ctypes.c_bool, wintypes.HWND, wintypes.LPARAM
    )

    def callback(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return True
        buffer = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buffer, length + 1)
        title = buffer.value or ""
        if any(word in title.lower() for word in keywords):
            found.append((hwnd, title))
        return True

    try:
        user32.EnumWindows(enum_proc(callback), 0)
    except Exception:
        return None, ""

    return found[0] if found else (None, "")


def is_foreground(hwnd: int) -> bool:
    """هل هذه النافذة هي النشطة الآن؟"""
    try:
        return _user32().GetForegroundWindow() == hwnd
    except Exception:
        return False


def cursor_work_area() -> tuple[int, int, int, int]:
    """حدود مساحة العمل في الشاشة التي عليها مؤشّر الفأرة.

    بهذا تظهر البطاقة على الشاشة التي ينظر إليها المستخدم فعلاً،
    لا على الشاشة الرئيسية دائماً.
    """
    class POINT(ctypes.Structure):
        _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]

    class MONITORINFO(ctypes.Structure):
        _fields_ = [
            ("cbSize", ctypes.c_ulong),
            ("rcMonitor", wintypes.RECT),
            ("rcWork", wintypes.RECT),
            ("dwFlags", ctypes.c_ulong),
        ]

    try:
        user32 = _user32()
        point = POINT()
        user32.GetCursorPos(ctypes.byref(point))
        monitor = user32.MonitorFromPoint(point, 2)  # MONITOR_DEFAULTTONEAREST
        info = MONITORINFO()
        info.cbSize = ctypes.sizeof(MONITORINFO)
        user32.GetMonitorInfoW(monitor, ctypes.byref(info))
        work = info.rcWork
        return work.left, work.top, work.right, work.bottom
    except Exception:
        return 0, 0, 1920, 1040


def read_window_text(hwnd: int) -> str:
    """يقرأ النصّ المرئي داخل نافذة محدّدة عبر UI Automation.

    نصّ حقيقي من شجرة إمكانية الوصول — لا OCR ولا تخمين بالبكسل —
    ويعمل حتى لو كانت النافذة في الخلفية.
    """
    try:
        import uiautomation as auto
    except ImportError:
        raise RuntimeError(
            "المكتبة uiautomation غير مثبّتة. ثبّتها بالأمر: pip install uiautomation"
        )

    control = auto.ControlFromHandle(hwnd)
    if not control:
        return ""

    chunks: list[str] = []

    def walk(node, depth: int = 0) -> None:
        if depth > 25 or len(chunks) > 400:
            return
        try:
            name = (node.Name or "").strip()
            if name:
                chunks.append(name)
            for child in node.GetChildren():
                walk(child, depth + 1)
        except Exception:
            return

    walk(control)
    return "\n".join(chunks)


# ======================================================== تحليل نافذة الإذن
class Prompt:
    def __init__(self, has_always: bool, has_once: bool) -> None:
        self.has_always = has_always
        self.has_once = has_once


def detect_prompt(text: str) -> Prompt | None:
    """هل النصّ يحتوي طلب إذن؟ وما الخيارات المتاحة؟"""
    low = text.lower()
    has_always = any(marker in low for marker in ALWAYS_ALLOW_MARKERS)
    has_once = any(marker in low for marker in ALLOW_ONCE_MARKERS)
    if not (has_always or has_once):
        return None
    return Prompt(has_always, has_once)


def extract_request(text: str) -> tuple[str, str] | None:
    """يستخرج (اسم الأداة، المُعامل). يعيد None إن تعذّر ذلك بثقة."""
    lines: list[str] = []
    for raw in text.splitlines():
        line = raw.strip().strip("`").strip()
        if not line or UI_NOISE.match(line) or len(line) > 300:
            continue
        lines.append(line)

    if not lines:
        return None

    for index, line in enumerate(lines):
        header = TOOL_HEADER.match(line)
        if not header:
            continue
        tool = header.group(1)
        remainder = line[header.end():].strip()
        if remainder:
            return tool, remainder
        if index + 1 < len(lines):
            return tool, lines[index + 1]
        return None

    for line in lines:
        if re.match(r"^[\w./\\$~-]+(\s|$)", line):
            return "", line

    return None


def evaluate(text: str, allow_edits: bool = True) -> tuple[Decision, str | None]:
    """يقيّم نصّ نافذة الإذن ويعيد (القرار، وصف الطلب المعروض للمستخدم)."""
    # نستخرج الطلب أولاً حتى تعرض البطاقة الأمر كاملاً حتى عند اكتشاف خطر
    request = extract_request(text)
    label = f"{request[0]} {request[1]}".strip() if request else None

    # الخطر يُفحص على النصّ كاملاً — يلتقط إشارة الخطر أينما وردت،
    # حتى لو فشل الاستخراج أو ورد الخطر في سطر وصفيّ.
    danger = find_danger(text)
    if danger:
        rule_id, category, why, matched = danger
        return Decision("alert", category, why, rule_id, matched), label or matched

    if request is None:
        return Decision("alert", Cat.UNREADABLE,
                        "تعذّرت قراءة نصّ الطلب — لم أوافق احتياطاً", "no-request"), None

    tool, argument = request
    return classify_request(tool, argument, allow_edits), label


# ============================================================ بطاقة التنبيه
class ToastManager:
    """بطاقات حمراء صغيرة في زاوية الشاشة — بلا صوت وبلا سرقة تركيز."""

    WIDTH = 430
    MARGIN = 18
    GAP = 10

    def __init__(self, seconds: float = 12.0) -> None:
        self.seconds = seconds
        self.queue: queue.Queue = queue.Queue()
        self._root = None
        self._cards: list = []

    # --------------------------------------------------------- الواجهة العامة
    def notify(self, decision: Decision, subject: str) -> None:
        """يُستدعى من أي خيط — يضع البطاقة في الطابور فقط."""
        self.queue.put((decision, subject))

    def run(self, should_stop) -> None:
        """يُشغَّل في الخيط الرئيسي: حلقة tkinter مع فحص الطابور."""
        import tkinter as tk

        self._root = tk.Tk()
        self._root.withdraw()

        def pump() -> None:
            if should_stop():
                self._root.quit()
                return
            while True:
                try:
                    decision, subject = self.queue.get_nowait()
                except queue.Empty:
                    break
                try:
                    self._build_card(decision, subject)
                except Exception:
                    pass
            self._root.after(200, pump)

        self._root.after(200, pump)
        self._root.mainloop()

    # ------------------------------------------------------------ البناء
    def _build_card(self, decision: Decision, subject: str) -> None:
        import tkinter as tk

        card = tk.Toplevel(self._root)
        card.overrideredirect(True)
        card.attributes("-topmost", True)
        card.configure(bg="#dc2626")          # الإطار الأحمر

        body = tk.Frame(card, bg="#171717", padx=16, pady=12)
        body.pack(padx=3, pady=3, fill="both", expand=True)

        tk.Label(body, text="⛔  طلب مرفوض", bg="#171717", fg="#f87171",
                 font=("Segoe UI", 12, "bold"), anchor="e",
                 justify="right").pack(fill="x")

        tk.Label(body, text=f"التصنيف: {decision.category}", bg="#171717",
                 fg="#fca5a5", font=("Segoe UI", 11, "bold"), anchor="e",
                 justify="right", wraplength=self.WIDTH - 40).pack(fill="x", pady=(6, 0))

        tk.Label(body, text=decision.reason, bg="#171717", fg="#e5e5e5",
                 font=("Segoe UI", 10), anchor="e", justify="right",
                 wraplength=self.WIDTH - 40).pack(fill="x", pady=(4, 0))

        if subject:
            tk.Label(body, text=subject[:150], bg="#171717", fg="#a3a3a3",
                     font=("Consolas", 9), anchor="e", justify="right",
                     wraplength=self.WIDTH - 40).pack(fill="x", pady=(8, 0))

        tk.Label(body, text="قرّر بنفسك في نافذة Claude Code · انقر لإخفاء البطاقة",
                 bg="#171717", fg="#737373", font=("Segoe UI", 8), anchor="e",
                 justify="right").pack(fill="x", pady=(10, 0))

        card.update_idletasks()
        self._place(card)

        def dismiss(_event=None) -> None:
            if card in self._cards:
                self._cards.remove(card)
            card.destroy()
            self._restack()

        card.bind("<Button-1>", dismiss)
        for child in body.winfo_children():
            child.bind("<Button-1>", dismiss)
        card.after(int(self.seconds * 1000), dismiss)

        self._cards.append(card)

    def _place(self, card) -> None:
        left, top, right, bottom = cursor_work_area()
        height = card.winfo_reqheight()
        offset = sum(c.winfo_reqheight() + self.GAP for c in self._cards)
        x = right - self.WIDTH - self.MARGIN
        y = bottom - height - self.MARGIN - offset
        if y < top:
            y = top + self.MARGIN
        card.geometry(f"{self.WIDTH}x{height}+{int(x)}+{int(y)}")

    def _restack(self) -> None:
        left, top, right, bottom = cursor_work_area()
        offset = 0
        for card in reversed(self._cards):
            try:
                height = card.winfo_reqheight()
                x = right - self.WIDTH - self.MARGIN
                y = bottom - height - self.MARGIN - offset
                card.geometry(f"{self.WIDTH}x{height}+{int(x)}+{int(y)}")
                offset += height + self.GAP
            except Exception:
                continue


# ================================================================== التسجيل
def log(action: str, detail: str) -> None:
    stamp = dt.datetime.now().strftime("%H:%M:%S")
    line = f"[{stamp}] {action}: {detail}"
    print(line, flush=True)
    try:
        with LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(f"{dt.date.today()} {line}\n")
    except OSError:
        pass


# =================================================================== الحارس
class Guard:
    def __init__(self, interval: float, live: bool, allow_edits: bool,
                 auto_deny: bool, keywords: tuple[str, ...],
                 toasts: ToastManager) -> None:
        self.interval = interval
        self.live = live
        self.allow_edits = allow_edits
        self.auto_deny = auto_deny
        self.keywords = keywords
        self.toasts = toasts

        self._running = threading.Event()
        self._stopped = threading.Event()
        self._handled_text = ""
        self._waiting_text = ""
        self.approved = 0
        self.rejected = 0

        from pynput import keyboard
        self._keyboard = keyboard
        self._controller = keyboard.Controller()

    # ------------------------------------------------------------- الضغط
    def send_approve(self, always: bool) -> None:
        key = self._keyboard.Key
        self._controller.press(key.ctrl)
        if always:
            self._controller.press(key.shift)
        try:
            self._controller.press(key.enter)
            self._controller.release(key.enter)
        finally:
            if always:
                self._controller.release(key.shift)
            self._controller.release(key.ctrl)

    def send_deny(self) -> None:
        key = self._keyboard.Key
        self._controller.press(key.esc)
        self._controller.release(key.esc)

    # -------------------------------------------------------------- الدورة
    def tick(self) -> None:
        hwnd, _title = find_claude_window(self.keywords)
        if hwnd is None:
            return

        try:
            text = read_window_text(hwnd)
        except RuntimeError as exc:
            log("خطأ", str(exc))
            self._running.clear()
            return

        if not text.strip() or text == self._handled_text:
            return

        prompt = detect_prompt(text)
        if prompt is None:
            return

        decision, request = evaluate(text, self.allow_edits)
        subject = request or decision.matched or "(غير معروف)"

        # ------------------------------------------------------ مقبول
        if decision.is_safe:
            if not self.live:
                self._handled_text = text
                log("👁 معاينة", f"[{decision.category}] {subject}")
                return

            # لا نرسل مفاتيح إلا ونافذة Claude Code هي النشطة —
            # وإلا ذهبت الضغطة إلى التطبيق الذي تعمل عليه أنت.
            if not is_foreground(hwnd):
                if self._waiting_text != text:
                    self._waiting_text = text
                    log("⏳ بانتظارك", f"[{decision.category}] {subject} — سأوافق حين تعود إلى Claude Code")
                return

            self._waiting_text = ""
            self._handled_text = text
            self.send_approve(always=prompt.has_always)
            self.approved += 1
            choice = "Always allow" if prompt.has_always else "الخيار الوحيد"
            log("✅ قبول", f"[{decision.category}] {subject} → {choice}")
            return

        # ------------------------------------------------------- مرفوض
        self._handled_text = text
        self.rejected += 1
        log("⛔ رفض", f"[{decision.category}] {subject}")
        log("   السبب", decision.reason)

        self.toasts.notify(decision, subject)

        if self.live and self.auto_deny:
            if is_foreground(hwnd):
                self.send_deny()
                log("   الإجراء", "أُرسل الرفض (Esc)")
            else:
                log("   الإجراء", "الرفض التلقائي مؤجّل — Claude Code ليست النافذة النشطة")

    def _loop(self) -> None:
        while not self._stopped.is_set():
            if not self._running.wait(timeout=0.2):
                continue
            try:
                self.tick()
            except Exception as exc:
                log("خطأ", f"{type(exc).__name__}: {exc}")
            waited = 0.0
            while (waited < self.interval and self._running.is_set()
                   and not self._stopped.is_set()):
                time.sleep(0.05)
                waited += 0.05

    # ------------------------------------------------------------- التحكّم
    def toggle(self) -> None:
        if self._running.is_set():
            self._running.clear()
            log("⏸ إيقاف مؤقّت", "Ctrl+Alt+S للاستئناف")
        else:
            self._running.set()
            log("▶ تشغيل", "فعّال" if self.live else "معاينة")

    def stop(self) -> None:
        self._running.clear()
        self._stopped.set()

    @property
    def stopped(self) -> bool:
        return self._stopped.is_set()

    def start_background(self) -> None:
        """يبدأ خيط الفحص وخيط الاختصارات؛ الواجهة تبقى للخيط الرئيسي."""
        threading.Thread(target=self._loop, daemon=True).start()

        keyboard = self._keyboard
        ctrl_keys = {keyboard.Key.ctrl, keyboard.Key.ctrl_l, keyboard.Key.ctrl_r}
        alt_keys = {keyboard.Key.alt, keyboard.Key.alt_l, keyboard.Key.alt_r}
        held: set = set()

        def matches(key, letter: str) -> bool:
            char = getattr(key, "char", None)
            if char:
                if char.lower() == letter:
                    return True
                if len(char) == 1 and ord(char) == ord(letter) - 96:
                    return True
            vk = getattr(key, "vk", None)
            return vk is not None and vk == ord(letter.upper())

        def on_press(key):
            if key in ctrl_keys or key in alt_keys:
                held.add(key)
                return None
            combo = bool(held & ctrl_keys) and bool(held & alt_keys)
            if combo and matches(key, "s"):
                self.toggle()
            elif combo and matches(key, "q"):
                self.stop()
                return False
            return None

        keyboard.Listener(on_press=on_press,
                          on_release=lambda k: held.discard(k)).start()
        self._running.set()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="حارس أذونات Claude Code: يفهم كل طلب، يصنّفه، ثم يقبل أو ينبّهك.",
        epilog="Ctrl+Alt+S = تشغيل/إيقاف | Ctrl+Alt+Q = إنهاء",
    )
    parser.add_argument("-i", "--interval", type=float, default=3.0,
                        help="الفاصل بين الفحوص بالثواني (الافتراضي: 3)")
    parser.add_argument("--dry-run", action="store_true",
                        help="معاينة: يعرض قراره دون أن يضغط شيئاً")
    parser.add_argument("--auto-deny", action="store_true",
                        help="بعد أن تثق به: يرفض بنفسه بدل تركه لك")
    parser.add_argument("--no-edits", action="store_true",
                        help="لا توافق تلقائياً على كتابة/تعديل الملفات")
    parser.add_argument("--window", default="claude",
                        help="جزء من عنوان نافذة Claude Code (الافتراضي: claude)")
    parser.add_argument("--toast-seconds", type=float, default=12.0,
                        help="مدة بقاء البطاقة الحمراء بالثواني (الافتراضي: 12)")
    args = parser.parse_args()

    if sys.platform != "win32":
        print("تحذير: هذه الأداة لويندوز؛ قراءة النوافذ لن تعمل على هذا النظام.")

    live = not args.dry_run
    keywords = tuple(w.strip().lower() for w in args.window.split(",") if w.strip())

    print("=" * 62)
    print("  حارس أذونات Claude Code")
    print("=" * 62)
    print(f"  الوضع         : {'⚡ فعّال' if live else '👁 معاينة — لا يضغط شيئاً'}")
    print(f"  النافذة المراقَبة: عنوان يحتوي «{args.window}»")
    print(f"  فحص كل        : {args.interval} ثانية")
    print(f"  تعديل الملفات : {'مرفوض' if args.no_edits else 'مقبول تلقائياً'}")
    print(f"  عند الرفض     : {'يرفض بنفسه (Esc)' if args.auto_deny else 'بطاقة حمراء والقرار لك'}")
    print("  بلا صوت · Ctrl+Alt+S تشغيل/إيقاف · Ctrl+Alt+Q إنهاء")
    print("=" * 62)

    toasts = ToastManager(args.toast_seconds)
    guard = Guard(args.interval, live, not args.no_edits,
                  args.auto_deny, keywords, toasts)
    guard.start_background()

    try:
        toasts.run(lambda: guard.stopped)
    except KeyboardInterrupt:
        guard.stop()
    finally:
        log("إنهاء", f"مقبول: {guard.approved} | مرفوض: {guard.rejected}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
