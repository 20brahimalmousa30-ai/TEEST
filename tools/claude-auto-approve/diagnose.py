#!/usr/bin/env python3
"""تشخيص: ماذا ترى الأداة على جهازك؟

النسخة الثانية — تعالج احتمالين فاتا النسخة الأولى:
  • نافذة الإذن قد تكون نافذةً منفصلة **بلا عنوان**، فنبحث عن كل نوافذ
    عملية Claude Code لا عن المعنونة فقط.
  • حدود العمق قد توقف المسح قبل الوصول إلى الطلب، فنرفعها كثيراً.

شغّله ونافذةُ الإذن معروضةٌ على الشاشة، ثم أرسل diagnose_report.txt

    python diagnose.py
"""

from __future__ import annotations

import ctypes
import ctypes.wintypes as wintypes
import sys
from pathlib import Path

REPORT = Path(__file__).with_name("diagnose_report.txt")
LINES: list[str] = []

MAX_DEPTH = 60
MAX_CHUNKS = 4000

MARKERS = ("always allow", "allow once", "deny", "do you want", "proceed")


def say(text: str = "") -> None:
    LINES.append(text)
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode(), flush=True)


# =========================================================== نوافذ ويندوز
def window_info(hwnd: int) -> tuple[str, str, int]:
    """(العنوان، اسم الصنف، معرّف العملية) لنافذة."""
    user32 = ctypes.windll.user32
    length = user32.GetWindowTextLengthW(hwnd)
    title_buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, title_buf, length + 1)
    class_buf = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, class_buf, 256)
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return title_buf.value or "", class_buf.value or "", pid.value


def all_windows(include_untitled: bool = False) -> list[tuple[int, str, str, int]]:
    """كل النوافذ الظاهرة: (المقبض، العنوان، الصنف، معرّف العملية)."""
    user32 = ctypes.windll.user32
    found: list[tuple[int, str, str, int]] = []
    proc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

    def callback(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        title, cls, pid = window_info(hwnd)
        if title or include_untitled:
            found.append((hwnd, title, cls, pid))
        return True

    user32.EnumWindows(proc(callback), 0)
    return found


def read_uia(hwnd: int) -> list[str]:
    """يقرأ كل النصوص من شجرة إمكانية الوصول لنافذة، بعمق كبير."""
    import uiautomation as auto

    control = auto.ControlFromHandle(hwnd)
    if not control:
        return []

    chunks: list[str] = []

    def walk(node, depth: int = 0) -> None:
        if depth > MAX_DEPTH or len(chunks) > MAX_CHUNKS:
            return
        try:
            name = (node.Name or "").strip()
            if name:
                chunks.append(name)
            value = ""
            try:                       # بعض العناصر تحمل نصّها في Value لا Name
                pattern = node.GetValuePattern()
                value = (pattern.Value or "").strip()
            except Exception:
                pass
            if value and value != name:
                chunks.append(value)
            for child in node.GetChildren():
                walk(child, depth + 1)
        except Exception:
            return

    walk(control)
    return chunks


def scan(hwnd: int, title: str, cls: str, tag: str) -> bool:
    """يفحص نافذة واحدة ويقول هل وجد فيها طلب إذن."""
    say("\n" + "=" * 72)
    say(f"[{tag}] hwnd={hwnd}  class={cls}")
    say(f"      title={title[:70] or '(بلا عنوان)'}")
    say("=" * 72)

    try:
        chunks = read_uia(hwnd)
    except Exception as exc:
        say(f"   ⛔ فشلت القراءة: {type(exc).__name__}: {exc}")
        return False

    say(f"   عدد النصوص المقروءة: {len(chunks)}")
    if not chunks:
        say("   ⛔ لم يُقرأ أي نصّ.")
        return False

    text = "\n".join(chunks)
    low = text.lower()
    hits = [m for m in MARKERS if m in low]

    say("   العلامات الموجودة: " + (", ".join(hits) if hits else "لا شيء"))

    if not hits:
        say("\n   --- أول 25 نصّاً (عيّنة) ---")
        for index, chunk in enumerate(chunks[:25], 1):
            say(f"   {index:4}. {chunk[:110]}")
        return False

    say("\n   ✅✅ هذه هي النافذة التي تحمل طلب الإذن")
    say("\n   --- النصّ الكامل ---")
    for index, chunk in enumerate(chunks, 1):
        say(f"   {index:4}. {chunk[:160]}")

    try:
        from claude_auto_approve import detect_prompt, evaluate
        prompt = detect_prompt(text)
        say("\n   --- تحليل الأداة ---")
        if prompt is None:
            say("   ⛔ detect_prompt لم يتعرّف عليه رغم وجود العلامات.")
        else:
            say(f"   ✅ اكتُشف الطلب (Always allow: {prompt.has_always})")
            analysis, tool, argument = evaluate(text)
            say(f"      الأداة  : {tool!r}")
            say(f"      المُعامل: {argument[:150]!r}")
            say(f"      الحكم   : {analysis.verdict}")
            say(f"      التصنيف : {analysis.category}")
            say(f"      يريد    : {analysis.intent}")
            for part in analysis.parts:
                say(f"        {part.mark} {part.text[:90]}  [{part.category}]")
    except Exception as exc:
        say(f"   ⛔ خطأ في التحليل: {type(exc).__name__}: {exc}")

    return True


def main() -> int:
    if sys.platform != "win32":
        say("هذه الأداة تعمل على ويندوز فقط.")
        write_report()
        return 1

    say("=" * 72)
    say("  تشخيص حارس أذونات Claude Code — النسخة ٢")
    say("=" * 72)

    titled = all_windows()
    say(f"\n[1] النوافذ المعنونة الظاهرة: {len(titled)}\n")
    for hwnd, title, cls, pid in titled:
        say(f"    hwnd={hwnd:<10} pid={pid:<7} class={cls:<26} {title[:60]}")

    matches = [w for w in titled if "claude" in w[1].lower()]
    say(f"\n    المطابقة لكلمة «claude»: {len(matches)}")

    if not matches:
        say("\n    ⛔ لا نافذة عنوانها يحتوي «claude». اختر العنوان الصحيح من")
        say('       القائمة أعلاه وشغّل: python claude_auto_approve.py --window "..."')
        write_report()
        return 0

    try:
        import uiautomation  # noqa: F401
    except ImportError:
        say("\n    ⛔ المكتبة uiautomation غير مثبّتة: pip install uiautomation")
        write_report()
        return 0

    # ------------------------------------------------ ٢) النوافذ المعنونة
    found = False
    for hwnd, title, cls, _pid in matches:
        if scan(hwnd, title, cls, "نافذة معنونة"):
            found = True

    # ------------------ ٣) كل نوافذ عملية Claude، بما فيها بلا عنوان
    if not found:
        pids = {w[3] for w in matches}
        everything = all_windows(include_untitled=True)
        siblings = [w for w in everything
                    if w[3] in pids and w[0] not in {m[0] for m in matches}]

        say("\n" + "#" * 72)
        say(f"[2] نوافذ أخرى لنفس العملية (بما فيها بلا عنوان): {len(siblings)}")
        say("#" * 72)

        for hwnd, title, cls, _pid in siblings:
            if scan(hwnd, title, cls, "نافذة شقيقة"):
                found = True

    say("\n" + "=" * 72)
    if found:
        say("  ✅ عُثر على طلب الإذن. انسخ القسم المعلّم بـ ✅✅ وأرسله.")
    else:
        say("  ⛔ لم يظهر طلب الإذن في أي نافذة.")
        say("     تأكّد أن نافذة الإذن كانت معروضةً على الشاشة أثناء التشغيل،")
        say("     ثم أعد المحاولة. إن تكرّر، فالتطبيق لا يكشف الطلب لـ UIA.")
    say("=" * 72)

    write_report()
    return 0


def write_report() -> None:
    try:
        REPORT.write_text("\n".join(LINES), encoding="utf-8")
        print(f"\n\nSaved: {REPORT}")
        print("Open it in Notepad and send the contents.")
    except OSError as exc:
        print(f"Could not save report: {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
