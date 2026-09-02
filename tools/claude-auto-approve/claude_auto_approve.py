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

التحكّم: لوحة صغيرة أسفل الشاشة، أو اختصارات قابلة للتغيير
(الافتراضي: Ctrl+Alt+Shift+P إيقاف · +G غياب · +X إنهاء)
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

# حدود مسح شجرة إمكانية الوصول
READ_DEPTH = 60
READ_NODES = 4000

ALWAYS_ALLOW_MARKERS = ("always allow", "don't ask again", "dont ask again")
ALLOW_ONCE_MARKERS = ("allow once", "yes, proceed", "yes, and")
DENY_MARKERS = ("deny", "no, and tell claude")

# أزرار نافذة الإذن. الكشف يشترط اجتماع زرّين مختلفين على الأقل ضمن
# مدى قريب — لأن ذكر «Always allow» وحده قد يرد في نصّ المحادثة نفسها
# (كأن تسأل Claude عن هذه الأداة) فيُشعل كشفاً كاذباً.
PROMPT_BUTTONS = ALWAYS_ALLOW_MARKERS + ALLOW_ONCE_MARKERS + DENY_MARKERS
CLUSTER_SPAN = 12          # أقصى مسافة بالأسطر بين أزرار الطلب الواحد

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


# نوافذ لا يمكن أن تحمل طلب إذن، وقد يطابق عنوانها الكلمة المفتاحية
# لمجرّد أنه يعرض اسم ملفّ من ملفات الأداة (مفكرة، مستكشف، طرفية…).
EXCLUDED_CLASSES = {
    "notepad",                          # المفكرة
    "cabinetwclass", "explorewclass",   # مستكشف الملفات ونتائج البحث
    "consolewindowclass",               # موجّه الأوامر
    "casadia_hosting_window_class",
    "cascadia_hosting_window_class",    # Windows Terminal
    "shell_traywnd", "progman",         # شريط المهام وسطح المكتب
    "tkTopLevel".lower(),               # بطاقات الأداة نفسها
}


def enum_windows(include_untitled: bool = False) -> list[tuple[int, str, int]]:
    """كل النوافذ الظاهرة الصالحة: (المقبض، العنوان، معرّف العملية)."""
    try:
        user32 = _user32()
    except AttributeError:
        return []

    found: list[tuple[int, str, int]] = []
    enum_proc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

    def callback(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0 and not include_untitled:
            return True

        class_buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, class_buf, 256)
        if (class_buf.value or "").lower() in EXCLUDED_CLASSES:
            return True

        buffer = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buffer, length + 1)
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        found.append((hwnd, buffer.value or "", pid.value))
        return True

    try:
        user32.EnumWindows(enum_proc(callback), 0)
    except Exception:
        return []
    return found


def find_claude_windows(keywords: tuple[str, ...]) -> list[tuple[int, str]]:
    """كل نوافذ Claude Code: المعنونة المطابقة، ثم شقيقاتها بلا عنوان.

    طلب الإذن قد يُعرض في نافذةٍ منفصلة بلا عنوان، فالاكتفاء بأول نافذة
    معنونة يجعل الحارس يقرأ الشريط الجانبي ولا يرى الطلب أبداً.

    لا يعتمد على النافذة النشطة — لذلك يبقى ملتصقاً بـ Claude Code
    مهما تنقّل المستخدم بين التطبيقات.
    """
    titled = enum_windows()
    matches = [(hwnd, title, pid) for hwnd, title, pid in titled
               if any(word in title.lower() for word in keywords)]
    if not matches:
        return []

    pids = {pid for _hwnd, _title, pid in matches}
    known = {hwnd for hwnd, _title, _pid in matches}
    siblings = [(hwnd, title) for hwnd, title, pid in enum_windows(include_untitled=True)
                if pid in pids and hwnd not in known]

    return [(hwnd, title) for hwnd, title, _pid in matches] + siblings


def is_foreground(hwnd: int) -> bool:
    """هل هذه النافذة هي النشطة الآن؟"""
    try:
        return _user32().GetForegroundWindow() == hwnd
    except Exception:
        return False


def focus_window(hwnd: int, tries: int = 3) -> bool:
    """يُحضِر نافذة إلى المقدّمة ويتأكّد أنها صارت النشطة.

    لا يُستدعى إلا استجابةً لنقرة صريحة منك على أحد أزرار البطاقة —
    فحين تنقر «وافق» تكون البطاقة هي النافذة النشطة لا Claude Code،
    وبغير إحضارها تذهب الضغطة إلى الفراغ.
    """
    try:
        user32 = _user32()
    except AttributeError:
        return False

    for _attempt in range(tries):
        try:
            if user32.IsIconic(hwnd):
                user32.ShowWindow(hwnd, 9)      # SW_RESTORE
            user32.SetForegroundWindow(hwnd)
            user32.BringWindowToTop(hwnd)
        except Exception:
            return False
        time.sleep(0.12)
        if is_foreground(hwnd):
            return True
    return is_foreground(hwnd)


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
        # محتوى صفحة الويب داخل المتصفّح يقع أعمق من عشرين مستوى بكثير،
        # وحدٌّ ضيّق هنا يعني قراءة إطار المتصفّح دون الصفحة نفسها.
        if depth > READ_DEPTH or len(chunks) > READ_NODES:
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


def find_button_cluster(lines: list[str]) -> tuple[int, int, set[str]] | None:
    """يجد تجمّع أزرار الإذن: (أول سطر، آخر سطر، الأزرار الموجودة).

    نشترط زرّين مختلفين على الأقل متقاربَين، لا مجرّد ورود عبارة واحدة —
    فنافذة Claude Code تعرض محادثتك، وقد يرد فيها ذكر «Always allow»
    ككلامٍ لا كزرّ، فيظنّ الحارس أن هناك طلباً وهو يقرأ حديثاً عن الأزرار.
    """
    hits: list[tuple[int, str]] = []
    for index, line in enumerate(lines):
        low = line.strip().lower()
        for marker in PROMPT_BUTTONS:
            if marker in low:
                hits.append((index, marker))
                break

    if len(hits) < 2:
        return None

    # نافذة منزلقة: نبحث عن أقرب مجموعة تضمّ زرّين مختلفين
    for start in range(len(hits)):
        group = [hit for hit in hits
                 if hit[0] - hits[start][0] <= CLUSTER_SPAN and hit[0] >= hits[start][0]]
        markers = {marker for _index, marker in group}
        if len(markers) >= 2:
            return group[0][0], group[-1][0], markers

    return None


def detect_prompt(text: str) -> Prompt | None:
    """هل النصّ يحتوي طلب إذن حقيقياً؟ وما الخيارات المتاحة؟"""
    cluster = find_button_cluster(text.splitlines())
    if cluster is None:
        return None

    _start, _end, markers = cluster
    has_always = any(marker in markers for marker in ALWAYS_ALLOW_MARKERS)
    has_once = any(marker in markers for marker in ALLOW_ONCE_MARKERS)
    return Prompt(has_always, has_once)


def locate_prompt_block(text: str) -> str | None:
    """يعزل منطقة طلب الإذن من نصّ النافذة كاملاً.

    نافذة Claude Code تحوي الشريط الجانبي وكامل المحادثة وشريط الحالة —
    مئات الأسطر. البحث فيها كلها يلتقط جملاً عشوائية من المحادثة، ويُشعل
    قواعد الخطر على كلمات وردت في كلامك لا في الأمر المطلوب.

    فنحدّد المنطقة بين ترويسة الطلب وأزراره، ولا نحكم إلا عليها.
    """
    lines = [line.strip() for line in text.splitlines()]

    # بداية تجمّع الأزرار هي نهاية منطقة الطلب — لا أيّ ذكرٍ متفرّق لها
    cluster = find_button_cluster(lines)
    if cluster is None:
        return None
    end = cluster[0]

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
class Palette:
    """ألوان الواجهة — داكنة هادئة، والتمييز باللون لا بالضجيج."""

    SHELL = "#0d0d0f"       # حافة البطاقة
    SURFACE = "#17171b"     # خلفية المحتوى
    INSET = "#101013"       # خلفية قائمة الأجزاء
    TEXT = "#ededf0"
    MUTED = "#8b8b95"
    FAINT = "#5c5c66"

    DANGER = "#ef4444"
    WARN = "#f59e0b"
    SAFE = "#34d399"
    AWAY = "#8b5cf6"

    BTN_ONCE = "#2563eb"
    BTN_ALWAYS = "#15803d"
    BTN_NEVER = "#b91c1c"
    BTN_AWAY = "#7c3aed"
    BTN_MUTED = "#2a2a30"


class ToastManager:
    """بطاقات في زاوية الشاشة — بلا صوت وبلا سرقة تركيز."""

    WIDTH = 460
    MARGIN = 18
    GAP = 12

    def __init__(self, seconds: float = 0.0) -> None:
        # 0 = تبقى البطاقة حتى تُحسم في Claude Code أو تُنقر
        self.seconds = seconds
        self.queue: queue.Queue = queue.Queue()
        self._root = None
        self._cards: list = []
        self._banner = None
        self._panel = None

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

    def show_banner(self, guard) -> None:
        """يعرض شريط «القبول الشامل مُفعّل» مع زرّ إيقافه."""
        self.queue.put(("banner", guard, None))

    def hide_banner(self) -> None:
        self.queue.put(("unbanner", None, None))

    def show_panel(self, guard) -> None:
        """يعرض لوحة التحكّم الصغيرة — تغني عن الاختصارات."""
        self.queue.put(("panel", guard, None))

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
                    elif action == "banner":
                        self._build_banner(payload)
                    elif action == "unbanner":
                        self._destroy_banner()
                    elif action == "panel":
                        self._build_panel(payload)
                    else:
                        self._clear_cards()
                except Exception as exc:
                    log("خطأ", f"تعذّر رسم البطاقة: {type(exc).__name__}: {exc}")
            self._root.after(200, pump)

        self._root.after(200, pump)
        self._root.mainloop()

    # ------------------------------------------------------- أدوات الرسم
    @staticmethod
    def _button(parent, text, command, bg, fg="#ffffff", small=False):
        """زرّ مسطّح مع تفاعل عند مرور المؤشّر."""
        import tkinter as tk

        button = tk.Button(
            parent, text=text, command=command, bg=bg, fg=fg,
            font=("Segoe UI", 8 if small else 9, "bold"), relief="flat",
            padx=9 if small else 12, pady=3 if small else 6,
            cursor="hand2", borderwidth=0, highlightthickness=0,
            activebackground=bg, activeforeground=fg,
        )
        button.bind("<Enter>", lambda _e: button.config(bg=ToastManager._lift(bg)))
        button.bind("<Leave>", lambda _e: button.config(bg=bg))
        return button

    @staticmethod
    def _lift(color: str, amount: int = 22) -> str:
        """يُفتّح لوناً سداسياً قليلاً — لتأثير مرور المؤشّر."""
        try:
            r, g, b = (int(color[i:i + 2], 16) for i in (1, 3, 5))
        except (ValueError, IndexError):
            return color
        return "#%02x%02x%02x" % tuple(min(255, c + amount) for c in (r, g, b))

    # ------------------------------------------------------------ البناء
    def _build_card(self, analysis: Analysis, subject: str, actions: dict) -> None:
        import tkinter as tk

        partial = analysis.verdict == "partial"
        accent = Palette.WARN if partial else Palette.DANGER
        heading = "طلب جزئيّ" if partial else "طلب مرفوض"
        icon = "◐" if partial else "✕"

        safe_count = len(analysis.safe_parts)
        total = len(analysis.parts)

        card = tk.Toplevel(self._root)
        card.overrideredirect(True)
        card.attributes("-topmost", True)
        card.configure(bg=Palette.SHELL)

        body = tk.Frame(card, bg=Palette.SURFACE)
        body.pack(padx=1, pady=1, fill="both", expand=True)
        wrap = self.WIDTH - 52

        # ---- شريط لوني علوي يحمل نوع الحكم ----
        tk.Frame(body, bg=accent, height=3).pack(fill="x")

        head = tk.Frame(body, bg=Palette.SURFACE, padx=18, pady=13)
        head.pack(fill="x")
        tk.Label(head, text=f"{heading}  {icon}", bg=Palette.SURFACE, fg=accent,
                 font=("Segoe UI", 12, "bold"), anchor="e").pack(side="right")
        if total > 1:
            tk.Label(head, text=f"{safe_count}/{total} آمن", bg=Palette.SURFACE,
                     fg=Palette.FAINT, font=("Consolas", 9), anchor="w"
                     ).pack(side="left")

        content = tk.Frame(body, bg=Palette.SURFACE, padx=18)
        content.pack(fill="x")

        def line(parent, text, color, size, weight="normal",
                 font="Segoe UI", pad=(0, 0), width=None):
            tk.Label(parent, text=text, bg=parent["bg"], fg=color,
                     font=(font, size, weight), anchor="e", justify="right",
                     wraplength=width or wrap).pack(fill="x", pady=pad)

        line(content, analysis.intent, Palette.TEXT, 10)

        # ---- الأجزاء ----
        if analysis.parts:
            inset = tk.Frame(content, bg=Palette.INSET, padx=12, pady=10)
            inset.pack(fill="x", pady=(12, 0))
            for index, part in enumerate(analysis.parts):
                if index:
                    tk.Frame(inset, bg="#1c1c22", height=1).pack(fill="x", pady=7)
                row = tk.Frame(inset, bg=Palette.INSET)
                row.pack(fill="x")
                colour = Palette.SAFE if part.is_safe else Palette.DANGER
                tk.Label(row, text="●", bg=Palette.INSET, fg=colour,
                         font=("Segoe UI", 9)).pack(side="left")
                tk.Label(row, text=part.text[:72], bg=Palette.INSET,
                         fg=Palette.TEXT if part.is_safe else "#f5a5a5",
                         font=("Consolas", 9), anchor="e", justify="right",
                         wraplength=wrap - 40).pack(side="right", fill="x", expand=True)
                tk.Label(inset, text=f"{part.category} · {part.intent[:70]}",
                         bg=Palette.INSET, fg=Palette.MUTED, font=("Segoe UI", 8),
                         anchor="e", justify="right", wraplength=wrap - 24
                         ).pack(fill="x")

        line(content, analysis.suggestion.replace("الاقتراح: ", "↪ "),
             accent, 10, "bold", pad=(13, 0))

        if not analysis.learnable:
            line(content, "«اقبل دائماً» غير متاح — رُفض بقاعدة خطر صريحة",
                 Palette.FAINT, 8, pad=(5, 0))

        # ---- الأزرار ----
        def wrap_action(callback, note: str):
            def handler() -> None:
                try:
                    callback()
                except Exception as exc:
                    log("خطأ", f"{note}: {type(exc).__name__}: {exc}")
                dismiss()
            return handler

        row_main = tk.Frame(body, bg=Palette.SURFACE, padx=18, pady=14)
        row_main.pack(fill="x")

        self._button(row_main, "تجاهل", lambda: dismiss(),
                     Palette.BTN_MUTED, Palette.MUTED).pack(side="right")
        if actions.get("never"):
            self._button(row_main, "ارفض دائماً",
                         wrap_action(actions["never"], "رفض دائم"),
                         Palette.BTN_NEVER).pack(side="right", padx=(0, 7))
        if actions.get("always"):
            self._button(row_main, "اقبل دائماً",
                         wrap_action(actions["always"], "قبول دائم"),
                         Palette.BTN_ALWAYS).pack(side="right", padx=(0, 7))
        if actions.get("once"):
            self._button(row_main, "وافق الآن",
                         wrap_action(actions["once"], "موافقة لمرة"),
                         Palette.BTN_ONCE).pack(side="right", padx=(0, 7))

        # ---- صفّ وضع الغياب ----
        if actions.get("away"):
            away_row = tk.Frame(body, bg=Palette.SURFACE, padx=18, pady=(0, 12))
            away_row.pack(fill="x")
            self._button(away_row, "🌙 اقبل كل شيء حتى أوقفه",
                         wrap_action(actions["away"], "وضع الغياب"),
                         Palette.BTN_AWAY, small=True).pack(side="right")
            tk.Label(away_row, text="للغياب عن الجهاز · قواعد الخطر تبقى تسألك",
                     bg=Palette.SURFACE, fg=Palette.FAINT, font=("Segoe UI", 8),
                     anchor="w").pack(side="left")

        tk.Frame(body, bg="#1c1c22", height=1).pack(fill="x")
        tk.Label(body, text="تختفي حين تختار في نافذة Claude Code",
                 bg=Palette.SURFACE, fg=Palette.FAINT, font=("Segoe UI", 8),
                 anchor="e", padx=18, pady=8).pack(fill="x")

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

    # ------------------------------------------------- شريط وضع الغياب
    def _build_banner(self, guard) -> None:
        """شريط ثابت أعلى الشاشة ما دام القبول الشامل مُفعّلاً."""
        import tkinter as tk

        self._destroy_banner()

        banner = tk.Toplevel(self._root)
        banner.overrideredirect(True)
        banner.attributes("-topmost", True)
        banner.configure(bg=Palette.AWAY)

        body = tk.Frame(banner, bg=Palette.SURFACE, padx=16, pady=9)
        body.pack(padx=2, pady=2, fill="both", expand=True)

        tk.Label(body, text="🌙  القبول الشامل مُفعّل", bg=Palette.SURFACE,
                 fg=Palette.AWAY, font=("Segoe UI", 10, "bold")).pack(side="right")

        counter = tk.Label(body, text="", bg=Palette.SURFACE, fg=Palette.MUTED,
                           font=("Consolas", 9))
        counter.pack(side="right", padx=14)

        self._button(body, "إيقاف", lambda: guard.set_away(False),
                     Palette.BTN_NEVER, small=True).pack(side="left")
        tk.Label(body, text=str(guard.hotkeys["away"]), bg=Palette.SURFACE,
                 fg=Palette.FAINT, font=("Consolas", 8)).pack(side="left", padx=(0, 10))

        def refresh() -> None:
            if self._banner is not banner:
                return
            try:
                counter.config(text=f"قُبل {guard.away_approved}"
                                    f"  ·  أُوقف {guard.away_held}")
                banner.after(1000, refresh)
            except Exception:
                pass

        banner.update_idletasks()
        left, top, right, _bottom = cursor_work_area()
        width = banner.winfo_reqwidth()
        banner.geometry(f"+{int((left + right - width) // 2)}+{int(top + 12)}")

        self._banner = banner
        refresh()

    def _destroy_banner(self) -> None:
        if self._banner is not None:
            try:
                self._banner.destroy()
            except Exception:
                pass
            self._banner = None

    # -------------------------------------------------- لوحة التحكّم
    def _build_panel(self, guard) -> None:
        """شريط تحكّم صغير دائم — يغني عن الاختصارات ولا يتعارض مع شيء.

        يُوضع في الزاوية المقابلة للبطاقات حتى لا يحجبها، ويمكن سحبه
        بالفأرة إلى أي مكان.
        """
        import tkinter as tk

        if self._panel is not None:
            return

        panel = tk.Toplevel(self._root)
        panel.overrideredirect(True)
        panel.attributes("-topmost", True)
        panel.attributes("-alpha", 0.93)
        panel.configure(bg=Palette.SHELL)

        body = tk.Frame(panel, bg=Palette.SURFACE, padx=10, pady=6)
        body.pack(padx=1, pady=1)

        dot = tk.Label(body, text="●", bg=Palette.SURFACE, fg=Palette.SAFE,
                       font=("Segoe UI", 11))
        dot.pack(side="left")

        state = tk.Label(body, text="", bg=Palette.SURFACE, fg=Palette.MUTED,
                         font=("Segoe UI", 8), width=9, anchor="w")
        state.pack(side="left", padx=(3, 8))

        pause_btn = self._button(body, "إيقاف مؤقّت", guard.toggle,
                                 Palette.BTN_MUTED, Palette.TEXT, small=True)
        pause_btn.pack(side="left", padx=(0, 5))

        away_btn = self._button(body, "🌙 غياب", guard.toggle_away,
                                Palette.BTN_AWAY, small=True)
        away_btn.pack(side="left", padx=(0, 5))

        self._button(body, "إنهاء", guard.stop, Palette.BTN_NEVER,
                     small=True).pack(side="left")

        # --- السحب بالفأرة ---
        drag = {"x": 0, "y": 0}

        def grab(event) -> None:
            drag["x"], drag["y"] = event.x_root, event.y_root

        def move(event) -> None:
            dx, dy = event.x_root - drag["x"], event.y_root - drag["y"]
            drag["x"], drag["y"] = event.x_root, event.y_root
            panel.geometry(f"+{panel.winfo_x() + dx}+{panel.winfo_y() + dy}")

        for widget in (body, dot, state):
            widget.bind("<Button-1>", grab)
            widget.bind("<B1-Motion>", move)

        def refresh() -> None:
            if self._panel is not panel:
                return
            try:
                if guard.away:
                    dot.config(fg=Palette.AWAY)
                    state.config(text="غياب", fg=Palette.AWAY)
                    away_btn.config(text="🌙 إيقاف الغياب")
                elif guard.paused:
                    dot.config(fg=Palette.WARN)
                    state.config(text="متوقّف", fg=Palette.WARN)
                    away_btn.config(text="🌙 غياب")
                else:
                    dot.config(fg=Palette.SAFE)
                    state.config(text="يعمل", fg=Palette.MUTED)
                    away_btn.config(text="🌙 غياب")
                pause_btn.config(text="استئناف" if guard.paused else "إيقاف مؤقّت")
                panel.after(700, refresh)
            except Exception:
                pass

        panel.update_idletasks()
        left, _top, _right, bottom = cursor_work_area()
        panel.geometry(f"+{int(left + self.MARGIN)}"
                       f"+{int(bottom - panel.winfo_reqheight() - self.MARGIN)}")

        self._panel = panel
        refresh()

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


# ============================================================== الاختصارات
MODIFIER_NAMES = {"ctrl", "control", "alt", "shift", "win", "cmd", "super"}
MODIFIER_ALIASES = {"control": "ctrl", "cmd": "win", "super": "win"}


class Hotkey:
    """اختصار لوحة مفاتيح: مجموعة مُعدِّلات وحرف واحد."""

    def __init__(self, mods: set[str], letter: str) -> None:
        self.mods = mods
        self.letter = letter

    def __str__(self) -> str:
        order = [m for m in ("ctrl", "alt", "shift", "win") if m in self.mods]
        return "+".join(order + [self.letter]).replace("ctrl", "Ctrl") \
            .replace("alt", "Alt").replace("shift", "Shift").replace("win", "Win")

    @classmethod
    def parse(cls, spec: str) -> "Hotkey":
        """يحوّل نصّاً مثل «ctrl+alt+shift+p» إلى اختصار."""
        parts = [p.strip().lower() for p in spec.split("+") if p.strip()]
        if len(parts) < 2:
            raise ValueError(f"اختصار غير صالح: «{spec}» — مثال صحيح: ctrl+alt+shift+p")

        *mod_names, letter = parts
        if len(letter) != 1 or not letter.isalpha():
            raise ValueError(f"«{letter}» ليس حرفاً مفرداً في الاختصار «{spec}»")

        mods = set()
        for name in mod_names:
            if name not in MODIFIER_NAMES:
                raise ValueError(f"مُعدِّل غير معروف: «{name}» في «{spec}»")
            mods.add(MODIFIER_ALIASES.get(name, name))

        return cls(mods, letter)


# الافتراضي: ثلاثة مُعدِّلات معاً — نادراً ما تحجزها التطبيقات أو اللابتوب
DEFAULT_HOTKEYS = {
    "pause": Hotkey({"ctrl", "alt", "shift"}, "p"),
    "away": Hotkey({"ctrl", "alt", "shift"}, "g"),
    "quit": Hotkey({"ctrl", "alt", "shift"}, "x"),
}


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
                 toasts: ToastManager, memory: Memory | None = None,
                 hotkeys: dict | None = None) -> None:
        self.interval = interval
        self.live = live
        self.allow_edits = allow_edits
        self.auto_deny = auto_deny
        self.keywords = keywords
        self.toasts = toasts
        self.memory = memory if memory is not None else Memory().load()
        self.hotkeys = hotkeys if hotkeys is not None else DEFAULT_HOTKEYS

        self._running = threading.Event()
        self._stopped = threading.Event()
        self._handled_text = ""
        self._waiting_text = ""
        self._alert_showing = False
        self._last_hwnd: int | None = None
        self._last_note = ""
        self.approved = 0
        self.rejected = 0

        # وضع الغياب: يقبل حتى ما لا يعرفه، حتى توقفه بنفسك.
        # قواعد الخطر تبقى نافذة — لا يُقبل حذفٌ ولا تسريبٌ ولا وصولٌ
        # إلى أسرار وأنت بعيد عن الجهاز، بل تُحفظ وتنتظر عودتك.
        self.away = False
        self.away_approved = 0
        self.away_held = 0

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
    def _note(self, key: str, action: str, detail: str) -> None:
        """يسجّل السطر مرة واحدة فقط عند تغيّر الحالة — لا يُغرق السجلّ."""
        if self._last_note == key:
            return
        self._last_note = key
        log(action, detail)

    def tick(self) -> None:
        windows = find_claude_windows(self.keywords)
        if not windows:
            self._note("no-window", "🔍 لا نافذة",
                       f"لم أجد نافذة عنوانها يحتوي «{'/'.join(self.keywords)}»")
            return

        # نجرّب النافذة التي حملت الطلب آخر مرة أولاً، ثم الباقي
        if self._last_hwnd:
            windows.sort(key=lambda item: 0 if item[0] == self._last_hwnd else 1)

        hwnd = None
        text = ""
        read_title = ""
        for candidate, title in windows:
            try:
                candidate_text = read_window_text(candidate)
            except RuntimeError as exc:
                log("خطأ", str(exc))
                self._running.clear()
                return
            except Exception:
                continue

            if not candidate_text.strip():
                continue
            if detect_prompt(candidate_text) is not None:
                hwnd, text = candidate, candidate_text
                self._last_hwnd = candidate
                self._note(f"reading:{candidate}", "🔎 أقرأ",
                           f"«{title[:50] or 'نافذة بلا عنوان'}» — {len(candidate_text)} حرفاً")
                break
            # احتياطاً: نحتفظ بالنافذة **الأغنى نصّاً** لا بأولها — فأول
            # نافذة قد تكون شريطاً جانبياً بينما اللوحة الحقيقية بعدها،
            # والإبلاغ عن الأولى يخفي أن القراءة تصل إلى المكان الصحيح.
            if len(candidate_text) > len(text):
                hwnd, text, read_title = candidate, candidate_text, title

        if hwnd is None or not text.strip():
            self._note("no-text", "🔍 لا نصّ",
                       f"وجدت {len(windows)} نافذة لكن لم أقرأ نصّاً منها")
            return

        prompt = detect_prompt(text)
        if prompt is None:
            # نُدرج المقبض والحجم في المفتاح ليُعاد التسجيل لو تغيّرت
            # النافذة أو قفز حجم النصّ — بهذا نعرف أنقرأ اللوحة الصحيحة.
            self._note(
                f"idle:{hwnd}:{len(text) // 500}",
                "🔎 مراقبة",
                f"أقرأ «{read_title[:40] or 'نافذة بلا عنوان'}» "
                f"({len(windows)} نافذة، {len(text)} حرفاً) — لا طلب معروض",
            )
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

        # ------------------------------- ٣) وضع الغياب: يقبل المجهول
        if self.away and analysis.learnable:
            self._handled_text = text
            self.away_approved += 1
            log("🌙 قبول (غياب)", f"[{analysis.category}] {subject}")
            self._approve(hwnd, prompt, analysis, subject, text, note="وضع الغياب")
            return

        if self.away:
            # قاعدة خطر صريحة: لا تُقبل ولو كنت غائباً
            self.away_held += 1
            log("🌙 أُوقف رغم الغياب", f"[{analysis.category}] {subject} — ينتظر عودتك")

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
            # نقرتك إجراء صريح، فنُحضِر نافذة Claude Code ثم نضغط —
            # وإلا ذهبت الضغطة إلى البطاقة التي نقرتَها للتوّ.
            if not focus_window(hwnd):
                log("⏳ مؤجّل", "تعذّر إحضار نافذة Claude Code — افتحها وأعد المحاولة")
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
            if self.live and focus_window(hwnd):
                self.send_deny()

        def accept_all() -> None:
            self.set_away(True)
            approve_once()

        return {
            "once": approve_once,
            "always": approve_always if analysis.learnable else None,
            "never": reject_always,
            "away": accept_all,
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

    # --------------------------------------------------------- وضع الغياب
    def set_away(self, active: bool) -> None:
        """يفعّل القبول الشامل أو يوقفه، ويُظهر شريط الحالة أو يُخفيه."""
        if self.away == active:
            return
        self.away = active
        if active:
            self.away_approved = self.away_held = 0
            log("🌙 وضع الغياب", f"قبول شامل — {self.hotkeys['away']} أو زرّ الإيقاف لإنهائه")
            self.toasts.show_banner(self)
        else:
            log("☀ انتهى الغياب",
                f"قُبل تلقائياً: {self.away_approved} | أُوقف للمراجعة: {self.away_held}")
            self.toasts.hide_banner()

    def toggle_away(self) -> None:
        self.set_away(not self.away)

    # ------------------------------------------------------------- التحكّم
    def toggle(self) -> None:
        if self._running.is_set():
            self._running.clear()
            log("⏸ إيقاف مؤقّت", f"{self.hotkeys['pause']} أو زرّ اللوحة للاستئناف")
        else:
            self._running.set()
            log("▶ تشغيل", "فعّال" if self.live else "معاينة")

    def stop(self) -> None:
        self._running.clear()
        self._stopped.set()

    @property
    def stopped(self) -> bool:
        return self._stopped.is_set()

    @property
    def paused(self) -> bool:
        return not self._running.is_set()

    def start_background(self) -> None:
        """يبدأ خيط الفحص وخيط الاختصارات؛ الواجهة تبقى للخيط الرئيسي."""
        threading.Thread(target=self._loop, daemon=True).start()

        keyboard = self._keyboard
        groups = {
            "ctrl": {keyboard.Key.ctrl, keyboard.Key.ctrl_l, keyboard.Key.ctrl_r},
            "alt": {keyboard.Key.alt, keyboard.Key.alt_l, keyboard.Key.alt_r,
                    getattr(keyboard.Key, "alt_gr", keyboard.Key.alt)},
            "shift": {keyboard.Key.shift, keyboard.Key.shift_l, keyboard.Key.shift_r},
            "win": {keyboard.Key.cmd, getattr(keyboard.Key, "cmd_l", keyboard.Key.cmd),
                    getattr(keyboard.Key, "cmd_r", keyboard.Key.cmd)},
        }
        all_mods = set().union(*groups.values())
        held: set = set()

        def held_mods() -> set[str]:
            return {name for name, keys in groups.items() if held & keys}

        def is_letter(key, letter: str) -> bool:
            char = getattr(key, "char", None)
            if char:
                if char.lower() == letter:
                    return True
                # Ctrl+حرف يُنتج حرف تحكّم، و Shift يُنتج الحرف الكبير
                if len(char) == 1 and ord(char) == ord(letter) - 96:
                    return True
            vk = getattr(key, "vk", None)
            return vk is not None and vk == ord(letter.upper())

        def on_press(key):
            if key in all_mods:
                held.add(key)
                return None
            mods = held_mods()
            for action, hotkey in self.hotkeys.items():
                if hotkey.mods == mods and is_letter(key, hotkey.letter):
                    if action == "pause":
                        self.toggle()
                    elif action == "away":
                        self.toggle_away()
                    elif action == "quit":
                        self.stop()
                        return False
                    break
            return None

        keyboard.Listener(on_press=on_press,
                          on_release=lambda k: held.discard(k)).start()
        self._running.set()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="حارس أذونات Claude Code: يفهم كل طلب، يصنّفه، ثم يقبل أو ينبّهك.",
        epilog="التحكّم من لوحة الشاشة الصغيرة، أو بالاختصارات أدناه.",
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
    parser.add_argument("--key-pause", default="ctrl+alt+shift+p",
                        help="اختصار الإيقاف المؤقّت (الافتراضي: ctrl+alt+shift+p)")
    parser.add_argument("--key-away", default="ctrl+alt+shift+g",
                        help="اختصار وضع الغياب (الافتراضي: ctrl+alt+shift+g)")
    parser.add_argument("--key-quit", default="ctrl+alt+shift+x",
                        help="اختصار الإنهاء (الافتراضي: ctrl+alt+shift+x)")
    parser.add_argument("--no-panel", action="store_true",
                        help="لا تعرض لوحة التحكّم الصغيرة على الشاشة")
    parser.add_argument("--toast-seconds", type=float, default=0.0,
                        help="إخفاء البطاقة بعد عدد ثوانٍ. الافتراضي 0 = تبقى "
                             "حتى تختار في Claude Code أو تنقرها")
    args = parser.parse_args()

    if sys.platform != "win32":
        print("تحذير: هذه الأداة لويندوز؛ قراءة النوافذ لن تعمل على هذا النظام.")

    live = not args.dry_run
    keywords = tuple(w.strip().lower() for w in args.window.split(",") if w.strip())

    try:
        hotkeys = {
            "pause": Hotkey.parse(args.key_pause),
            "away": Hotkey.parse(args.key_away),
            "quit": Hotkey.parse(args.key_quit),
        }
    except ValueError as exc:
        parser.error(str(exc))
        return 2

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
    print(f"  إيقاف مؤقّت   : {hotkeys['pause']}")
    print(f"  وضع الغياب    : {hotkeys['away']}")
    print(f"  إنهاء         : {hotkeys['quit']}")
    if not args.no_panel:
        print("  ولوحة تحكّم صغيرة أسفل الشاشة تغني عن الاختصارات (اسحبها كما تشاء)")
    print("=" * 62)

    toasts = ToastManager(args.toast_seconds)
    guard = Guard(args.interval, live, not args.no_edits,
                  args.auto_deny, keywords, toasts, memory, hotkeys)
    guard.start_background()
    if not args.no_panel:
        toasts.show_panel(guard)

    try:
        toasts.run(lambda: guard.stopped)
    except KeyboardInterrupt:
        guard.stop()
    finally:
        log("إنهاء", f"مقبول: {guard.approved} | مرفوض: {guard.rejected}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
