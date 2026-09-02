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

from classifier import Analysis, Cat, Part, analyze, find_danger
from explain import explain_request
from memory import Memory

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

# ------------------------------------------------- تحديد منطقة طلب الإذن
# الأزرار التي تُنهي منطقة الطلب
BUTTON_MARKERS = ("always allow", "allow once", "deny", "don't ask again")

# ترويسة الطلب: «Allow Claude to run …؟» — الفعل بعدها يحدّد نوع الأداة
PROMPT_HEADER = re.compile(r"^\s*Allow\s+Claude\s+to\s+(\w+)\b(.*)$", re.IGNORECASE)
PROMPT_QUESTION = re.compile(r"(do you want|would you like|proceed\?)", re.IGNORECASE)

# أقصى عدد أسطر نرجع بها للخلف بحثاً عن الترويسة
MAX_BLOCK_LINES = 40

# فعل الترويسة ⇒ اسم الأداة
VERB_TO_TOOL = {
    "run": "Bash", "execute": "Bash", "use": "Bash",
    "read": "Read", "view": "Read", "open": "Read",
    "write": "Write", "create": "Write",
    "edit": "Edit", "update": "Edit", "modify": "Edit",
    "fetch": "WebFetch", "search": "WebSearch",
}


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


def locate_prompt_block(text: str) -> str | None:
    """يعزل منطقة طلب الإذن من نصّ النافذة كاملاً.

    نافذة Claude Code تحوي الشريط الجانبي وكامل المحادثة وشريط الحالة —
    مئات الأسطر. البحث فيها كلها يلتقط جملاً عشوائية من المحادثة، ويُشعل
    قواعد الخطر على كلمات وردت في كلامك لا في الأمر المطلوب.

    فنحدّد المنطقة بين ترويسة الطلب وأزراره، ولا نحكم إلا عليها.
    """
    lines = [line.strip() for line in text.splitlines()]

    # آخر سطر يحمل زرّاً من أزرار الإذن هو نهاية المنطقة
    end = None
    for index in range(len(lines) - 1, -1, -1):
        low = lines[index].lower()
        if any(marker in low for marker in BUTTON_MARKERS):
            end = index
            break
    if end is None:
        return None

    # نرجع للخلف بحثاً عن ترويسة «Allow Claude to …» — وهي وحدها حدّ البداية.
    # سؤال «Do you want to proceed?» لا يصلح حدّاً، لأنه في تنسيق الطرفية
    # يأتي **بعد** الأمر لا قبله، فالتوقّف عنده يقتطع الأمر نفسه.
    start = max(0, end - MAX_BLOCK_LINES)
    for index in range(end - 1, start - 1, -1):
        if PROMPT_HEADER.match(lines[index]):
            start = index
            break

    block = [line for line in lines[start:end] if line]
    return "\n".join(block) if block else None


def extract_request(text: str) -> tuple[str, str] | None:
    """يستخرج (اسم الأداة، المُعامل). يعيد None إن تعذّر ذلك بثقة."""
    raw_lines = [line.strip().strip("`").strip() for line in text.splitlines()]

    # ١) ترويسة «Allow Claude to <فعل> …» — الشكل الذي يعرضه التطبيق فعلاً
    for index, line in enumerate(raw_lines):
        header = PROMPT_HEADER.match(line)
        if not header:
            continue
        tool = VERB_TO_TOOL.get(header.group(1).lower(), "Bash")
        argument = _pick_command(raw_lines, skip=index)
        return (tool, argument) if argument else None

    # ٢) ترويسة على هيئة اسم الأداة في سطر مستقلّ (تنسيق الطرفية)
    lines = [line for line in raw_lines
             if line and not UI_NOISE.match(line) and len(line) <= 300]
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


def _pick_command(lines: list[str], skip: int) -> str:
    """يختار سطر الأمر من منطقة الطلب: أطول سطر ليس ترويسةً ولا زرّاً."""
    best = ""
    for index, line in enumerate(lines):
        if index == skip or not line:
            continue
        low = line.lower()
        if any(marker in low for marker in BUTTON_MARKERS):
            continue
        if UI_NOISE.match(line) or PROMPT_HEADER.match(line):
            continue
        if len(line) > len(best):
            best = line
    return best


def evaluate(text: str, allow_edits: bool = True) -> tuple[Analysis, str, str]:
    """يحلّل نصّ نافذة الإذن ويعيد (التحليل، اسم الأداة، المُعامل).

    نعزل منطقة الطلب أولاً ولا نحكم إلا عليها: نافذة Claude Code تحوي
    محادثتك كاملة، وفحصها كلّها يُشعل قواعد الخطر على كلمات وردت في
    كلامك لا في الأمر المطلوب.
    """
    block = locate_prompt_block(text) or text
    request = extract_request(block)

    # فحص الخطر داخل منطقة الطلب — يلتقط الخطر أينما ورد فيها،
    # حتى لو فشل الاستخراج أو ورد في سطر وصفيّ داخل الطلب.
    danger = find_danger(block)
    if danger:
        _rule_id, category, why, matched = danger
        tool, argument = request if request else ("", matched)
        intent = explain_request(tool, argument)
        part = Part(argument, "alert", category, why, intent)
        return Analysis("reject", category, intent,
                        "الاقتراح: الرفض", why, [part]), tool, argument

    if request is None:
        part = Part("", "alert", Cat.UNREADABLE, "تعذّرت قراءة نصّ الطلب", "")
        return Analysis("reject", Cat.UNREADABLE,
                        "طلب تعذّرت قراءته من النافذة",
                        "الاقتراح: الرفض",
                        "تعذّرت قراءة نصّ الطلب — لم أوافق احتياطاً",
                        [part]), "", ""

    tool, argument = request
    return analyze(tool, argument, allow_edits), tool, argument


# ============================================================ بطاقة التنبيه
class ToastManager:
    """بطاقات حمراء صغيرة في زاوية الشاشة — بلا صوت وبلا سرقة تركيز."""

    WIDTH = 430
    MARGIN = 18
    GAP = 10

    def __init__(self, seconds: float = 0.0) -> None:
        # 0 = تبقى البطاقة حتى تُحسم في Claude Code أو تُنقر
        self.seconds = seconds
        self.queue: queue.Queue = queue.Queue()
        self._root = None
        self._cards: list = []

    # --------------------------------------------------------- الواجهة العامة
    def notify(self, analysis: Analysis, subject: str, actions: dict) -> None:
        """يُستدعى من أي خيط — يضع طلب عرض البطاقة في الطابور.

        `actions` يربط أزرار البطاقة بدوالّ الحارس:
        once (وافق مرة) · always (اقبل دائماً) · never (ارفض دائماً)
        """
        self.queue.put(("show", (analysis, subject, actions), None))

    def resolve_all(self) -> None:
        """يُخفي كل البطاقات — يُستدعى حين يختفي الطلب من نافذة Claude Code."""
        self.queue.put(("hide", None, None))

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
                    action, payload, _extra = self.queue.get_nowait()
                except queue.Empty:
                    break
                try:
                    if action == "show":
                        self._build_card(*payload)
                    else:
                        self._clear_cards()
                except Exception as exc:
                    log("خطأ", f"تعذّر رسم البطاقة: {type(exc).__name__}: {exc}")
            self._root.after(200, pump)

        self._root.after(200, pump)
        self._root.mainloop()

    # ------------------------------------------------------------ البناء
    def _build_card(self, analysis: Analysis, subject: str, actions: dict) -> None:
        import tkinter as tk

        partial = analysis.verdict == "partial"
        accent = "#f59e0b" if partial else "#dc2626"   # برتقالي للجزئي، أحمر للمرفوض
        heading = "⚠  طلب جزئيّ" if partial else "⛔  طلب مرفوض"

        card = tk.Toplevel(self._root)
        card.overrideredirect(True)
        card.attributes("-topmost", True)
        card.configure(bg=accent)

        body = tk.Frame(card, bg="#171717", padx=16, pady=12)
        body.pack(padx=3, pady=3, fill="both", expand=True)
        wrap = self.WIDTH - 44

        def line(text, color, size, weight="normal", font="Segoe UI", pad=(0, 0)):
            tk.Label(body, text=text, bg="#171717", fg=color,
                     font=(font, size, weight), anchor="e", justify="right",
                     wraplength=wrap).pack(fill="x", pady=pad)

        line(heading, accent, 12, "bold")
        line(f"يريد: {analysis.intent}", "#e5e5e5", 10, pad=(6, 0))

        # --- تفصيل الأجزاء ---
        if analysis.parts:
            frame = tk.Frame(body, bg="#0f0f0f", padx=10, pady=8)
            frame.pack(fill="x", pady=(10, 0))
            for part in analysis.parts:
                color = "#4ade80" if part.is_safe else "#f87171"
                tk.Label(frame, text=f"{part.mark}  {part.text[:70]}",
                         bg="#0f0f0f", fg=color, font=("Consolas", 9),
                         anchor="e", justify="right", wraplength=wrap - 20
                         ).pack(fill="x")
                tk.Label(frame, text=f"{part.category} — {part.intent[:80]}",
                         bg="#0f0f0f", fg="#8a8a8a", font=("Segoe UI", 8),
                         anchor="e", justify="right", wraplength=wrap - 20
                         ).pack(fill="x", pady=(0, 6))

        line(analysis.suggestion, accent, 10, "bold", pad=(10, 0))

        # --- الأزرار ---
        buttons = tk.Frame(body, bg="#171717")
        buttons.pack(fill="x", pady=(12, 0))

        def wrap_action(callback, note: str):
            def handler() -> None:
                try:
                    callback()
                except Exception as exc:
                    log("خطأ", f"{note}: {type(exc).__name__}: {exc}")
                dismiss()
            return handler

        def add_button(text, command, bg, fg="#ffffff"):
            tk.Button(buttons, text=text, command=command, bg=bg, fg=fg,
                      font=("Segoe UI", 9), relief="flat", padx=10, pady=4,
                      cursor="hand2", activebackground=bg, borderwidth=0
                      ).pack(side="right", padx=(6, 0))

        add_button("تجاهل", lambda: dismiss(), "#404040", "#d4d4d4")
        if actions.get("never"):
            add_button("ارفض دائماً",
                       wrap_action(actions["never"], "رفض دائم"), "#7f1d1d")
        if actions.get("always"):
            add_button("اقبل دائماً",
                       wrap_action(actions["always"], "قبول دائم"), "#166534")
        if actions.get("once"):
            add_button("وافق مرة واحدة",
                       wrap_action(actions["once"], "موافقة لمرة"), "#1d4ed8")

        if not analysis.learnable:
            line("«اقبل دائماً» غير متاح — رُفض بقاعدة خطر صريحة",
                 "#737373", 8, pad=(8, 0))

        line("تختفي حين تختار في نافذة Claude Code", "#737373", 8, pad=(6, 0))

        card.update_idletasks()
        self._place(card)

        def dismiss(_event=None) -> None:
            if card in self._cards:
                self._cards.remove(card)
            card.destroy()
            self._restack()

        if self.seconds > 0:
            card.after(int(self.seconds * 1000), dismiss)

        self._cards.append(card)

    def _clear_cards(self) -> None:
        """يُغلق كل البطاقات المعروضة."""
        for card in list(self._cards):
            try:
                card.destroy()
            except Exception:
                pass
        self._cards.clear()

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
                 toasts: ToastManager, memory: Memory | None = None) -> None:
        self.interval = interval
        self.live = live
        self.allow_edits = allow_edits
        self.auto_deny = auto_deny
        self.keywords = keywords
        self.toasts = toasts
        self.memory = memory if memory is not None else Memory().load()

        self._running = threading.Event()
        self._stopped = threading.Event()
        self._handled_text = ""
        self._waiting_text = ""
        self._alert_showing = False
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

        if not text.strip():
            return

        prompt = detect_prompt(text)
        if prompt is None:
            # لم يعد هناك طلب معروض ⇒ حُسم الطلب في Claude Code، فتُخفى البطاقة.
            # ونمسح ذاكرة النصّ المعالَج حتى يُعامَل ظهور الأمر نفسه لاحقاً
            # كطلب جديد لا كتكرارٍ يُتجاهَل.
            self._handled_text = ""
            if self._alert_showing:
                self.toasts.resolve_all()
                self._alert_showing = False
                log("↩ حُسم", "اختفى الطلب من النافذة — أُخفيت البطاقة")
            return

        if text == self._handled_text:
            return

        analysis, tool, argument = evaluate(text, self.allow_edits)
        subject = f"{tool} {argument}".strip() or "(غير معروف)"

        # --------------------------------------- ١) قرار محفوظ لأمر متكرّر
        remembered = self.memory.recall(tool, argument)
        if remembered is not None:
            # الرفض المحفوظ يُطبَّق دائماً. أما القبول المحفوظ فلا يُطبَّق
            # إلا إن بقي الطلب من النوع الذي يجوز تعلّمه — فلو صار يطابق
            # قاعدة خطر صريحة (تغيّر الأمر أو تحدّثت القواعد) نتجاهل الذاكرة.
            honour = remembered.verdict == "reject" or analysis.learnable
            if honour:
                self.memory.apply(tool, argument)
                self._handled_text = text
                if remembered.verdict == "approve":
                    self._approve(hwnd, prompt, analysis, subject, text,
                                  note="قرار محفوظ")
                else:
                    self.rejected += 1
                    log("⛔ رفض محفوظ", f"[{remembered.category}] {subject}")
                    if self.live and self.auto_deny and is_foreground(hwnd):
                        self.send_deny()
                return
            log("⚠ تُجوهلت الذاكرة", f"{subject} — صار يطابق قاعدة خطر")

        # --------------------------------------------------- ٢) طلب مقبول
        if analysis.is_safe:
            self._approve(hwnd, prompt, analysis, subject, text)
            return

        # ------------------------------------------ ٣) مرفوض أو جزئيّ
        self._handled_text = text
        self.rejected += 1
        head = "⚠ جزئيّ" if analysis.verdict == "partial" else "⛔ رفض"
        log(head, f"[{analysis.category}] {subject}")
        log("   يريد", analysis.intent)
        log("   السبب", analysis.reason)
        log("   ↪", analysis.suggestion)

        if self._alert_showing:
            self.toasts.resolve_all()
        self.toasts.notify(analysis, subject,
                           self._card_actions(hwnd, prompt, analysis, tool, argument))
        self._alert_showing = True

        if self.live and self.auto_deny:
            if is_foreground(hwnd):
                self.send_deny()
                log("   الإجراء", "أُرسل الرفض (Esc)")
            else:
                log("   الإجراء", "الرفض التلقائي مؤجّل — Claude Code ليست النافذة النشطة")

    # --------------------------------------------------------- الموافقة
    def _approve(self, hwnd: int, prompt: Prompt, analysis: Analysis,
                 subject: str, text: str, note: str = "") -> None:
        """يوافق على الطلب، بشرط أن تكون نافذة Claude Code هي النشطة."""
        if not self.live:
            self._handled_text = text
            log("👁 معاينة", f"[{analysis.category}] {subject}")
            return

        # لا نرسل مفاتيح إلا ونافذة Claude Code هي النشطة —
        # وإلا ذهبت الضغطة إلى التطبيق الذي تعمل عليه أنت.
        if not is_foreground(hwnd):
            if self._waiting_text != text:
                self._waiting_text = text
                log("⏳ بانتظارك",
                    f"[{analysis.category}] {subject} — سأوافق حين تعود إلى Claude Code")
            self._handled_text = ""
            return

        self._waiting_text = ""
        self._handled_text = text
        self.send_approve(always=prompt.has_always)
        self.approved += 1
        choice = "Always allow" if prompt.has_always else "الخيار الوحيد"
        suffix = f" ({note})" if note else ""
        log("✅ قبول" + suffix, f"[{analysis.category}] {subject} → {choice}")

    # ------------------------------------------------- أزرار البطاقة
    def _card_actions(self, hwnd: int, prompt: Prompt, analysis: Analysis,
                      tool: str, argument: str) -> dict:
        """يربط أزرار البطاقة بالإجراءات الفعلية."""

        def approve_once() -> None:
            if not is_foreground(hwnd):
                log("⏳ مؤجّل", "انتقل إلى نافذة Claude Code ثم أعد المحاولة")
                return
            self.send_approve(always=prompt.has_always)
            self.approved += 1
            log("✅ وافقتَ مرة", f"[{analysis.category}] {tool} {argument}".strip())

        def approve_always() -> None:
            self.memory.learn(tool, argument, "approve",
                              analysis.category, analysis.intent)
            log("📚 تعلّم", f"سيُقبل تلقائياً من الآن: {tool} {argument}".strip())
            approve_once()

        def reject_always() -> None:
            self.memory.learn(tool, argument, "reject",
                              analysis.category, analysis.intent)
            log("📚 تعلّم", f"سيُرفض تلقائياً من الآن: {tool} {argument}".strip())
            if self.live and is_foreground(hwnd):
                self.send_deny()

        return {
            "once": approve_once,
            "always": approve_always if analysis.learnable else None,
            "never": reject_always,
        }

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
    parser.add_argument("--toast-seconds", type=float, default=0.0,
                        help="إخفاء البطاقة بعد عدد ثوانٍ. الافتراضي 0 = تبقى "
                             "حتى تختار في Claude Code أو تنقرها")
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
    memory = Memory().load()
    print(f"  قرارات محفوظة : {len(memory.entries)} (راجعها بـ python memory.py)")
    print("  بلا صوت · Ctrl+Alt+S تشغيل/إيقاف · Ctrl+Alt+Q إنهاء")
    print("=" * 62)

    toasts = ToastManager(args.toast_seconds)
    guard = Guard(args.interval, live, not args.no_edits,
                  args.auto_deny, keywords, toasts, memory)
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
