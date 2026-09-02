"""اختبار وضع الغياب: القبول الشامل حتى توقفه — وحدوده."""

import pathlib
import tempfile

import claude_auto_approve as m
from memory import Memory


class FakeToasts:
    def __init__(self):
        self.cards = 0
        self.banner = False

    def notify(self, *_args, **_kwargs):
        self.cards += 1

    def resolve_all(self):
        self.cards = 0

    def show_banner(self, _guard):
        self.banner = True

    def hide_banner(self):
        self.banner = False


IDLE = "Claude Code\nجاهز"
UNKNOWN = "Bash command\n./deploy.sh\nDeny\nAlways allow\nAllow once"
DANGER = "Bash command\nrm -rf build\nDeny\nAlways allow\nAllow once"


def build():
    toasts = FakeToasts()
    store = Memory(path=pathlib.Path(tempfile.mkdtemp()) / "learned.json").load()
    guard = m.Guard(0.1, live=True, allow_edits=True, auto_deny=False,
                    keywords=("claude",), toasts=toasts, memory=store)
    state = {"text": IDLE}
    m.find_claude_windows = lambda _kw: [(1, "Claude")]
    m.read_window_text = lambda _hwnd: state["text"]
    m.is_foreground = lambda _hwnd: True
    m.focus_window = lambda _hwnd, tries=3: True
    guard.sent = []
    guard.send_approve = lambda always: guard.sent.append("approve")
    return guard, toasts, state


def run() -> int:
    failures = []

    def check(label, condition, detail=""):
        print(f"  {'✅' if condition else '❌'} {label}")
        if not condition:
            failures.append(f"{label} {detail}")

    guard, toasts, state = build()

    def show(text):
        """يعرض طلباً جديداً بعد أن يُحسم السابق."""
        state["text"] = IDLE
        guard.tick()
        toasts.cards = 0
        guard.sent.clear()
        state["text"] = text
        guard.tick()

    print("\n▸ قبل وضع الغياب")
    show(UNKNOWN)
    check("الأمر المجهول يعرض بطاقة وينتظر قرارك",
          toasts.cards == 1 and not guard.sent)

    print("\n▸ بعد «اقبل كل شيء حتى أوقفه»")
    guard.set_away(True)
    check("شريط الحالة ظهر", toasts.banner)

    show(UNKNOWN)
    check("الأمر المجهول يُقبل مباشرةً بلا بطاقة",
          not toasts.cards and guard.sent == ["approve"],
          f"بطاقات={toasts.cards} موافقات={guard.sent}")

    show(DANGER)
    check("الأمر الخطِر يبقى موقوفاً رغم الغياب",
          toasts.cards == 1 and not guard.sent,
          f"بطاقات={toasts.cards} موافقات={guard.sent}")

    check("العدّادات صحيحة (قُبل ١ · أُوقف ١)",
          guard.away_approved == 1 and guard.away_held == 1,
          f"{guard.away_approved}/{guard.away_held}")

    print("\n▸ بعد «إيقاف»")
    guard.set_away(False)
    check("شريط الحالة اختفى", not toasts.banner)

    show(UNKNOWN)
    check("عادت البطاقة للأمر المجهول",
          toasts.cards == 1 and not guard.sent)

    print("\n▸ التبديل بالاختصار")
    guard.toggle_away()
    check("Ctrl+Alt+A يفعّل الوضع", guard.away and toasts.banner)
    guard.toggle_away()
    check("والضغطة الثانية توقفه", not guard.away and not toasts.banner)

    print()
    if failures:
        print(f"فشل {len(failures)}:")
        for item in failures:
            print("  ❌", item)
        return 1
    print("✅ وضع الغياب سليم")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
