#!/usr/bin/env python3
"""تشخيص: أيّ نافذة على جهازك تحمل طلب الإذن؟

النسخة الثالثة — لا تكتفي بالنوافذ التي عنوانها «claude».

  المرحلة ١: مسح سريع لكل نوافذ الجهاز، وقياس كم نصّاً تُعطي كلٌّ منها.
  المرحلة ٢: قراءة عميقة لأغنى النوافذ ولكل نافذة فيها علامات إذن.

النافذة الغنية بالنصّ هي لوحة المحادثة، أياً كان عنوانها. وإن لم تُعطِ
أيّ نافذة نصّاً وفيراً، فالتطبيق لا يكشف محتواه لـ UI Automation.

شغّله وطلبُ الإذن معروضٌ على الشاشة، ثم أرسل diagnose_report.txt

    python diagnose.py
"""

from __future__ import annotations

import ctypes
import ctypes.wintypes as wintypes
import sys
from pathlib import Path

REPORT = Path(__file__).with_name("diagnose_report.txt")
LINES: list[str] = []

MARKERS = ("always allow", "allow once", "deny", "do you want", "proceed")

SURVEY_DEPTH, SURVEY_NODES = 32, 600      # مسح سريع — عميق بما يكفي
                                          # لبلوغ محتوى تطبيقات Electron
DEEP_DEPTH, DEEP_NODES = 60, 4000         # قراءة كاملة


def say(text: str = "") -> None:
    LINES.append(text)
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode(), flush=True)


# =========================================================== نوافذ ويندوز
def visible_windows() -> list[tuple[int, str, str, int]]:
    """كل النوافذ الظاهرة: (المقبض، العنوان، الصنف، معرّف العملية)."""
    user32 = ctypes.windll.user32
    found: list[tuple[int, str, str, int]] = []
    proc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

    def callback(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        title_buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, title_buf, length + 1)
        class_buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, class_buf, 256)
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        found.append((hwnd, title_buf.value or "", class_buf.value or "", pid.value))
        return True

    user32.EnumWindows(proc(callback), 0)
    return found


def read_uia(hwnd: int, depth_cap: int, node_cap: int) -> list[str]:
    """نصوص شجرة إمكانية الوصول لنافذة، بحدود قابلة للضبط."""
    import uiautomation as auto

    try:
        control = auto.ControlFromHandle(hwnd)
    except Exception:
        return []
    if not control:
        return []

    chunks: list[str] = []

    def walk(node, depth: int = 0) -> None:
        if depth > depth_cap or len(chunks) > node_cap:
            return
        try:
            name = (node.Name or "").strip()
            if name:
                chunks.append(name)
            try:
                value = (node.GetValuePattern().Value or "").strip()
                if value and value != name:
                    chunks.append(value)
            except Exception:
                pass
            for child in node.GetChildren():
                walk(child, depth + 1)
        except Exception:
            return

    walk(control)
    return chunks


def markers_in(text: str) -> list[str]:
    low = text.lower()
    return [m for m in MARKERS if m in low]


def main() -> int:
    if sys.platform != "win32":
        say("هذه الأداة تعمل على ويندوز فقط.")
        write_report()
        return 1

    say("=" * 76)
    say("  تشخيص: أين يعيش طلب الإذن؟")
    say("=" * 76)

    try:
        import uiautomation  # noqa: F401
    except ImportError:
        say("\n⛔ المكتبة uiautomation غير مثبّتة:  pip install uiautomation")
        write_report()
        return 0

    windows = visible_windows()
    say(f"\n[1] مسح {len(windows)} نافذة ظاهرة — قياس النصّ في كلٍّ منها\n")

    surveyed: list[tuple[int, int, list[str], str, str]] = []
    for hwnd, title, cls, pid in windows:
        chunks = read_uia(hwnd, SURVEY_DEPTH, SURVEY_NODES)
        text = "\n".join(chunks)
        hits = markers_in(text)
        surveyed.append((len(text), hwnd, hits, title, cls))

    surveyed.sort(reverse=True)

    say(f"    {'حروف':>7}  {'علامات إذن':<12} {'الصنف':<26} العنوان")
    say("    " + "-" * 88)
    for size, hwnd, hits, title, cls in surveyed:
        flag = "✅ " + ",".join(hits) if hits else ""
        say(f"    {size:>7}  {flag:<12} {cls[:25]:<26} {title[:44] or '(بلا عنوان)'}")

    # ------------------------------------------- المرحلة ٢: قراءة عميقة
    with_markers = [row for row in surveyed if row[2]]
    richest = [row for row in surveyed if row[0] > 0][:3]

    # أيّ نافذة عنوانها يحتوي «claude» تُقرأ بعمق مهما بدت فقيرة في المسح
    # السريع — محتوى تطبيقات Electron يقع عميقاً وقد يخدع القياس السطحي.
    named = [row for row in surveyed
             if "claude" in row[3].lower() and row not in with_markers]

    targets = with_markers + named if with_markers else richest + named
    seen: set = set()
    targets = [row for row in targets
               if not (row[1] in seen or seen.add(row[1]))]

    if not targets:
        say("\n⛔ لم تُعطِ أيّ نافذة نصّاً. التطبيق لا يكشف محتواه لـ UI Automation.")
        write_report()
        return 0

    say("\n" + "#" * 76)
    say(f"[2] قراءة عميقة لـ {len(targets)} نافذة"
        f"{' تحمل علامات إذن' if with_markers else ' هي الأغنى نصّاً'}")
    say("#" * 76)

    found = False
    for _size, hwnd, _hits, title, cls in targets:
        say("\n" + "=" * 76)
        say(f"  hwnd={hwnd}  class={cls}")
        say(f"  title={title[:60] or '(بلا عنوان)'}")
        say("=" * 76)

        chunks = read_uia(hwnd, DEEP_DEPTH, DEEP_NODES)
        text = "\n".join(chunks)
        hits = markers_in(text)
        say(f"  نصوص: {len(chunks)}   حروف: {len(text)}   علامات: "
            + (", ".join(hits) if hits else "لا شيء"))

        if not hits:
            say("\n  --- عيّنة (أول 20 نصّاً) ---")
            for index, chunk in enumerate(chunks[:20], 1):
                say(f"  {index:4}. {chunk[:110]}")
            continue

        found = True
        say("\n  ✅✅ هذه النافذة تحمل طلب الإذن — النصّ الكامل:\n")
        for index, chunk in enumerate(chunks, 1):
            say(f"  {index:4}. {chunk[:160]}")

        try:
            from claude_auto_approve import detect_prompt, evaluate, locate_prompt_block
            say("\n  --- تحليل الأداة ---")
            block = locate_prompt_block(text)
            say("  منطقة الطلب المعزولة:")
            for line in (block or "(تعذّر العزل)").splitlines():
                say(f"      {line[:130]}")

            if detect_prompt(text) is None:
                say("  ⛔ detect_prompt لم يتعرّف عليه رغم وجود العلامات.")
            else:
                analysis, tool, argument = evaluate(text)
                say(f"  الأداة  : {tool!r}")
                say(f"  المُعامل: {argument[:150]!r}")
                say(f"  الحكم   : {analysis.verdict}   التصنيف: {analysis.category}")
                say(f"  يريد    : {analysis.intent}")
                for part in analysis.parts:
                    say(f"    {part.mark} {part.text[:90]}  [{part.category}]")
        except Exception as exc:
            say(f"  ⛔ خطأ في التحليل: {type(exc).__name__}: {exc}")

    say("\n" + "=" * 76)
    if found:
        say("  ✅ عُثر على الطلب. أرسل التقرير كاملاً.")
    else:
        say("  ⛔ لا نافذة تحمل علامات إذن.")
        say("     تأكّد أن طلب الإذن كان معروضاً على الشاشة أثناء التشغيل.")
    say("=" * 76)

    write_report()
    return 0


def write_report() -> None:
    try:
        REPORT.write_text("\n".join(LINES), encoding="utf-8")
        print(f"\n\nSaved: {REPORT}")
        print("Attach this file (do not screenshot it).")
    except OSError as exc:
        print(f"Could not save report: {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
