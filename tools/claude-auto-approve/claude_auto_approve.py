#!/usr/bin/env python3
"""موافقة تلقائية ذكية على نوافذ أذونات Claude Code — مع حارس أمان.

المنطق كل دورة:
  1. هل النافذة النشطة هي Claude Code؟ إن لا → تجاهل تماماً.
  2. اقرأ نصّ النافذة (عبر UI Automation، وليس تخميناً بالبكسل).
  3. هل يوجد طلب إذن معروض؟ إن لا → لا تفعل شيئاً.
  4. استخرج الأمر المطلوب وصنّفه.
  5. آمن  → اضغط «Always allow» (أو الخيار الوحيد إن كان واحداً).
     خطِر أو مجهول → إطارٌ أحمر حول الشاشة + توقّف + تسجيل، ولا ضغط.

الوضع الافتراضي **مراقبة فقط** (لا يضغط شيئاً) حتى تتحقّق من السجلّ.
شغّله بـ --live بعد أن تطمئن.

    python claude_auto_approve.py            # مراقبة فقط
    python claude_auto_approve.py --live     # تفعيل الضغط الفعلي

اختصارات: Ctrl+Alt+S تشغيل/إيقاف | Ctrl+Alt+Q إنهاء
"""

from __future__ import annotations

import argparse
import ctypes
import datetime as dt
import re
import sys
import threading
import time
from pathlib import Path

from classifier import Decision, classify_request, find_danger

LOG_PATH = Path(__file__).with_name("auto_approve.log")

# عناوين النوافذ التي تُعدّ Claude Code
WINDOW_KEYWORDS = ("claude",)

# العبارات التي تدلّ على وجود نافذة إذن معروضة
ALWAYS_ALLOW_MARKERS = ("always allow", "don't ask again", "dont ask again", "لا تسأل مجدداً")
ALLOW_ONCE_MARKERS = ("allow once", "yes, proceed", "allow", "نعم")
DENY_MARKERS = ("deny", "no,", "reject", "لا،")

# الأسطر التي نتجاهلها عند البحث عن الأمر (نصوص واجهة لا أوامر)
UI_NOISE = re.compile(
    r"^\s*(\d+\.\s*)?(always allow|allow once|allow|deny|no|yes|esc|enter|ctrl|shift|tab|"
    r"do you want|what would you like|claude|thinking|permission|"
    r"press|select|choose|\W*)\s*$",
    re.IGNORECASE,
)

# أسماء أدوات Claude Code التي قد تسبق الأمر
TOOL_HEADER = re.compile(
    r"^\s*(Bash|Read|Write|Edit|MultiEdit|Glob|Grep|WebFetch|WebSearch|"
    r"NotebookEdit|NotebookRead|Task|LS)\b\s*(command|tool|file|call)?\s*[:\-–]?\s*",
    re.IGNORECASE,
)


# ============================================================== أدوات النظام
def foreground_window_title() -> str:
    """عنوان النافذة النشطة حالياً (ويندوز فقط، بلا مكتبات خارجية)."""
    try:
        user32 = ctypes.windll.user32
        hwnd = user32.GetForegroundWindow()
        length = user32.GetWindowTextLengthW(hwnd)
        buffer = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buffer, length + 1)
        return buffer.value or ""
    except Exception:
        return ""


def is_claude_window(title: str) -> bool:
    """هل النافذة النشطة تخصّ Claude Code؟"""
    low = title.lower()
    return any(keyword in low for keyword in WINDOW_KEYWORDS)


def read_window_text() -> str:
    """يقرأ النصّ المرئي في النافذة النشطة عبر UI Automation.

    نقرأ النصّ الحقيقي من شجرة إمكانية الوصول، لا من صورة الشاشة —
    أدقّ بكثير من OCR ولا يتأثّر بحجم الخطّ أو الوضع الليلي.
    """
    try:
        import uiautomation as auto
    except ImportError:
        raise RuntimeError(
            "المكتبة uiautomation غير مثبّتة.\n"
            "ثبّتها بالأمر:  pip install uiautomation"
        )

    window = auto.GetForegroundControl()
    if not window:
        return ""

    chunks: list[str] = []

    def walk(control, depth: int = 0) -> None:
        if depth > 25 or len(chunks) > 400:
            return
        try:
            name = (control.Name or "").strip()
            if name:
                chunks.append(name)
            for child in control.GetChildren():
                walk(child, depth + 1)
        except Exception:
            return

    walk(window)
    return "\n".join(chunks)


# ========================================================== تحليل نافذة الإذن
class Prompt:
    """طلب إذن مُكتشَف على الشاشة."""

    def __init__(self, text: str, has_always: bool, has_once: bool) -> None:
        self.text = text
        self.has_always = has_always
        self.has_once = has_once

    @property
    def option_count(self) -> int:
        return int(self.has_always) + int(self.has_once)


def detect_prompt(text: str) -> Prompt | None:
    """هل النصّ يحتوي نافذة إذن؟ وما الخيارات المتاحة فيها؟"""
    low = text.lower()
    has_always = any(m in low for m in ALWAYS_ALLOW_MARKERS)
    has_once = any(m in low for m in ALLOW_ONCE_MARKERS)

    if not (has_always or has_once):
        return None
    return Prompt(text, has_always, has_once)


def extract_request(text: str) -> tuple[str, str] | None:
    """يستخرج (اسم الأداة، المُعامل) من نصّ نافذة الإذن.

    يعيد None إن تعذّر الاستخراج بثقة — وعندها تُصنَّف الحالة تنبيهاً
    التزاماً بمبدأ «الشكّ يعني التوقّف».
    """
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
        if remainder:                       # الأداة والمُعامل في نفس السطر
            return tool, remainder
        if index + 1 < len(lines):          # المُعامل في السطر التالي
            return tool, lines[index + 1]
        return None

    # لا اسم أداة: أول سطر ذي طابع تنفيذي يُعامَل كأمر صدفة
    for line in lines:
        if re.match(r"^[\w./\\$~-]+(\s|$)", line):
            return "", line

    return None


def evaluate(text: str, allow_edits: bool = True) -> tuple[Decision, str | None]:
    """يقيّم نافذة الإذن كاملةً ويعيد (القرار، وصف الطلب المستخرج)."""
    # 1) فحص الخطر على النصّ الكامل — يلتقط أي إشارة خطر أينما وردت،
    #    حتى لو فشل استخراج الأمر أو ورد الخطر في سطر وصفيّ.
    danger = find_danger(text)
    if danger:
        rule_id, why, matched = danger
        return Decision("alert", why, rule_id, matched), None

    # 2) استخراج (الأداة، المُعامل)
    request = extract_request(text)
    if request is None:
        return Decision("alert", "تعذّر استخراج نصّ الطلب بثقة", "no-request"), None

    tool, argument = request
    label = f"{tool} {argument}".strip()

    # 3) التصنيف حسب نوع الأداة
    return classify_request(tool, argument, allow_edits), label


# ============================================================ الإطار الأحمر
def show_red_alert(decision: Decision, command: str | None) -> None:
    """يرسم إطاراً أحمر حول الشاشة مع سبب التنبيه."""
    def _run() -> None:
        try:
            import tkinter as tk
        except ImportError:
            print("\a[تنبيه] tkinter غير متاح — لا يمكن رسم الإطار.")
            return

        root = tk.Tk()
        root.attributes("-fullscreen", True)
        root.attributes("-topmost", True)
        root.overrideredirect(True)
        try:
            # اللون الأسود يصبح شفافاً وقابلاً للنقر من خلاله (ويندوز)
            root.attributes("-transparentcolor", "black")
        except tk.TclError:
            root.attributes("-alpha", 0.35)
        root.configure(bg="black")

        width = root.winfo_screenwidth()
        height = root.winfo_screenheight()
        canvas = tk.Canvas(root, width=width, height=height,
                           bg="black", highlightthickness=0)
        canvas.pack()

        thickness = 14
        canvas.create_rectangle(
            thickness // 2, thickness // 2,
            width - thickness // 2, height - thickness // 2,
            outline="#e02424", width=thickness,
        )

        label = f"⚠ طلب يحتاج مراجعتك: {decision.reason}"
        if command:
            label += f"\n{command[:120]}"
        elif decision.matched:
            label += f"\n{decision.matched[:120]}"
        label += "\n\n(اضغط أيّ مفتاح لإخفاء التنبيه)"

        canvas.create_text(
            width // 2, 60, text=label, fill="#e02424",
            font=("Segoe UI", 16, "bold"), justify="center",
        )

        root.bind("<Key>", lambda _event: root.destroy())
        root.bind("<Button-1>", lambda _event: root.destroy())
        root.after(20000, root.destroy)  # يختفي تلقائياً بعد 20 ثانية
        root.focus_force()
        root.mainloop()

    threading.Thread(target=_run, daemon=True).start()
    print("\a", end="", flush=True)  # صافرة تنبيه


# ================================================================== التسجيل
def log(action: str, detail: str) -> None:
    stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{stamp}] {action}: {detail}"
    print(line, flush=True)
    try:
        with LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass


# =================================================================== الأداة
class AutoApprover:
    def __init__(self, interval: float, live: bool, allow_edits: bool = True) -> None:
        self.interval = interval
        self.live = live
        self.allow_edits = allow_edits
        self._running = threading.Event()
        self._stopped = threading.Event()
        self._last_text = ""
        self.approved = 0
        self.alerted = 0

        from pynput import keyboard
        self._keyboard = keyboard
        self._controller = keyboard.Controller()

    # ------------------------------------------------------------- الضغط
    def send(self, always: bool) -> None:
        """يرسل اختصار الموافقة. always=True ⇒ Ctrl+Shift+Enter."""
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

    # -------------------------------------------------------------- الدورة
    def tick(self) -> None:
        title = foreground_window_title()
        if not is_claude_window(title):
            return

        try:
            text = read_window_text()
        except RuntimeError as exc:
            log("خطأ", str(exc).replace("\n", " "))
            self._running.clear()
            return

        if not text.strip() or text == self._last_text:
            return

        prompt = detect_prompt(text)
        if prompt is None:
            return

        self._last_text = text
        decision, command = evaluate(text, self.allow_edits)

        if not decision.is_safe:
            self.alerted += 1
            log("تنبيه ⛔", f"{decision.reason} | {decision.matched[:80]}")
            show_red_alert(decision, command)
            self._running.clear()   # توقّف حتى يراجع المستخدم
            log("إيقاف", "الأداة متوقّفة — راجع الطلب ثم Ctrl+Alt+S للاستئناف")
            return

        choice = "Always allow" if prompt.has_always else "الخيار الوحيد"
        if self.live:
            self.send(always=prompt.has_always)
            self.approved += 1
            log("موافقة ✅", f"{choice} | {command}")
        else:
            log("مراقبة 👁", f"كنت سأضغط [{choice}] | {command}")

    def _loop(self) -> None:
        while not self._stopped.is_set():
            if not self._running.wait(timeout=0.2):
                continue
            try:
                self.tick()
            except Exception as exc:  # لا نُسقط الأداة بسبب خطأ عابر
                log("خطأ", f"{type(exc).__name__}: {exc}")
            waited = 0.0
            while waited < self.interval and self._running.is_set() \
                    and not self._stopped.is_set():
                time.sleep(0.05)
                waited += 0.05

    # ------------------------------------------------------------- التحكّم
    def toggle(self) -> None:
        if self._running.is_set():
            self._running.clear()
            log("إيقاف مؤقّت", "Ctrl+Alt+S للاستئناف")
        else:
            self._running.set()
            mode = "تشغيل فعلي" if self.live else "مراقبة فقط"
            log("تشغيل", f"الوضع: {mode}")

    def stop(self) -> None:
        self._running.clear()
        self._stopped.set()

    def run(self) -> None:
        keyboard = self._keyboard
        worker = threading.Thread(target=self._loop, daemon=True)
        worker.start()

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

        listener = keyboard.Listener(
            on_press=on_press, on_release=lambda k: held.discard(k)
        )
        listener.start()

        self._running.set()
        try:
            while not self._stopped.is_set():
                time.sleep(0.1)
        except KeyboardInterrupt:
            self.stop()
        finally:
            listener.stop()
            log("إنهاء", f"موافقات: {self.approved} | تنبيهات: {self.alerted}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="موافقة تلقائية على أذونات Claude Code مع حارس أمان.",
        epilog="Ctrl+Alt+S = تشغيل/إيقاف | Ctrl+Alt+Q = إنهاء",
    )
    parser.add_argument("-i", "--interval", type=float, default=3.0,
                        help="الفاصل بين الفحوص بالثواني (الافتراضي: 3)")
    parser.add_argument("--live", action="store_true",
                        help="فعّل الضغط الحقيقي (بدونه: مراقبة وتسجيل فقط)")
    parser.add_argument("--no-edits", action="store_true",
                        help="لا توافق تلقائياً على كتابة/تعديل الملفات")
    args = parser.parse_args()

    if sys.platform != "win32":
        print("تحذير: هذه الأداة مصمّمة لويندوز؛ قراءة النوافذ لن تعمل هنا.")

    mode = "⚡ تشغيل فعلي — سيضغط الموافقة" if args.live else "👁 مراقبة فقط — لن يضغط شيئاً"
    print("=" * 60)
    print("  حارس أذونات Claude Code")
    print("=" * 60)
    print(f"  الوضع        : {mode}")
    print(f"  فحص كل       : {args.interval} ثانية")
    print(f"  تعديل الملفات: {'مرفوض — يسألك' if args.no_edits else 'مقبول تلقائياً'}")
    print(f"  السجلّ        : {LOG_PATH}")
    print("  Ctrl+Alt+S = تشغيل/إيقاف   |   Ctrl+Alt+Q = إنهاء")
    print("=" * 60)

    AutoApprover(args.interval, args.live, not args.no_edits).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
