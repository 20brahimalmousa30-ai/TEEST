#!/usr/bin/env python3
"""تشخيص: ماذا ترى الأداة على جهازك؟

يفحص ثلاث نقاط بالترتيب ويقول أين تقف المشكلة:
  1. هل يجد نافذة Claude Code أصلاً؟
  2. هل يستطيع قراءة نصّ من داخلها؟
  3. هل يتعرّف على طلب الإذن في ذلك النصّ؟

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


def say(text: str = "") -> None:
    """يطبع على الشاشة ويحفظ في التقرير."""
    LINES.append(text)
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode(), flush=True)


def all_windows() -> list[tuple[int, str, str]]:
    """كل النوافذ الظاهرة: (المقبض، العنوان، اسم الصنف)."""
    user32 = ctypes.windll.user32
    found: list[tuple[int, str, str]] = []
    proc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

    def callback(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return True
        title_buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, title_buf, length + 1)
        class_buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, class_buf, 256)
        found.append((hwnd, title_buf.value or "", class_buf.value or ""))
        return True

    user32.EnumWindows(proc(callback), 0)
    return found


def read_uia(hwnd: int, limit: int = 500) -> list[str]:
    """يقرأ النصوص من شجرة إمكانية الوصول لنافذة محدّدة."""
    import uiautomation as auto

    control = auto.ControlFromHandle(hwnd)
    if not control:
        return []

    chunks: list[str] = []

    def walk(node, depth: int = 0) -> None:
        if depth > 25 or len(chunks) > limit:
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
    return chunks


def main() -> int:
    if sys.platform != "win32":
        say("هذه الأداة تعمل على ويندوز فقط.")
        return 1

    say("=" * 70)
    say("  تشخيص حارس أذونات Claude Code")
    say("=" * 70)

    # ---------------------------------------------------- ١) النوافذ
    say("\n[1] كل النوافذ الظاهرة على الجهاز:\n")
    windows = all_windows()
    for hwnd, title, cls in windows:
        say(f"    hwnd={hwnd:<10} class={cls:<28} title={title[:70]}")

    matches = [w for w in windows if "claude" in w[1].lower()]
    say(f"\n    عدد النوافذ الظاهرة: {len(windows)}")
    say(f"    المطابقة لكلمة «claude»: {len(matches)}")

    if not matches:
        say("\n    ⛔ لا توجد نافذة عنوانها يحتوي «claude».")
        say("       انظر إلى القائمة أعلاه واختر العنوان الصحيح، ثم شغّل:")
        say('         python claude_auto_approve.py --window "جزء من العنوان"')
        write_report()
        return 0

    # ------------------------------------------------- ٢) قراءة النصّ
    try:
        import uiautomation  # noqa: F401
    except ImportError:
        say("\n    ⛔ المكتبة uiautomation غير مثبّتة.")
        say("       ثبّتها:  pip install uiautomation")
        write_report()
        return 0

    for hwnd, title, cls in matches:
        say("\n" + "=" * 70)
        say(f"[2] قراءة النافذة: {title[:60]}")
        say(f"    class={cls}")
        say("=" * 70)

        try:
            chunks = read_uia(hwnd)
        except Exception as exc:
            say(f"    ⛔ فشلت القراءة: {type(exc).__name__}: {exc}")
            continue

        say(f"    عدد النصوص المقروءة: {len(chunks)}")
        if not chunks:
            say("    ⛔ لم يُقرأ أي نصّ من هذه النافذة.")
            continue

        say("\n    --- أول 60 نصّاً ---")
        for index, chunk in enumerate(chunks[:60], 1):
            say(f"    {index:3}. {chunk[:100]}")

        # -------------------------------------------- ٣) كشف الطلب
        text = "\n".join(chunks)
        say("\n" + "-" * 70)
        say("[3] هل يوجد طلب إذن في هذا النصّ؟")
        low = text.lower()
        for marker in ("always allow", "allow once", "deny", "esc"):
            say(f"    «{marker}» موجودة؟ {'نعم ✅' if marker in low else 'لا'}")

        try:
            from claude_auto_approve import detect_prompt, evaluate
            prompt = detect_prompt(text)
            if prompt is None:
                say("\n    ⛔ لم تتعرّف الأداة على طلب إذن في هذا النصّ.")
            else:
                say(f"\n    ✅ اكتُشف طلب إذن (Always allow: {prompt.has_always})")
                analysis, tool, argument = evaluate(text)
                say(f"       الأداة   : {tool}")
                say(f"       المُعامل : {argument[:120]}")
                say(f"       الحكم    : {analysis.verdict}")
                say(f"       التصنيف  : {analysis.category}")
                say(f"       يريد     : {analysis.intent}")
        except Exception as exc:
            say(f"    ⛔ خطأ في التحليل: {type(exc).__name__}: {exc}")

    write_report()
    return 0


def write_report() -> None:
    try:
        REPORT.write_text("\n".join(LINES), encoding="utf-8")
        print(f"\n\nحُفظ التقرير في: {REPORT}")
        print("افتحه بالمفكرة وأرسل محتواه.")
    except OSError as exc:
        print(f"تعذّر حفظ التقرير: {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
