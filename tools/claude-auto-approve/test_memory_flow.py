"""اختبار التعلّم: الأمر الذي تحسمه مرة، لا تُسأل عنه مرة أخرى.

يُحاكي نافذة Claude Code ونقرات أزرار البطاقة، دون الحاجة إلى ويندوز.
"""

import pathlib
import tempfile

import claude_auto_approve as m
from memory import Memory


class FakeToasts:
    def __init__(self):
        self.shown = []
        self.visible = 0
        self.last_actions = {}
        self.last_analysis = None

    def notify(self, analysis, subject, actions=None):
        self.shown.append(analysis.category)
        self.visible += 1
        self.last_actions = actions or {}
        self.last_analysis = analysis

    def resolve_all(self):
        self.visible = 0


IDLE = "Claude Code\nجاهز"
UNKNOWN = "Bash command\n./deploy.sh\nAlways allow\nAllow once"
DANGER = "Bash command\nrm -rf build\nAlways allow\nAllow once"


def build():
    toasts = FakeToasts()
    store = Memory(path=pathlib.Path(tempfile.mkdtemp()) / "learned.json").load()
    guard = m.Guard(0.1, live=True, allow_edits=True, auto_deny=False,
                    keywords=("claude",), toasts=toasts, memory=store)
    state = {"text": IDLE}
    m.find_claude_windows = lambda _kw: [(1, "Claude Code")]
    m.read_window_text = lambda _hwnd: state["text"]
    m.is_foreground = lambda _hwnd: True
    m.focus_window = lambda _hwnd, tries=3: True
    guard.sent = []
    guard.send_approve = lambda always: guard.sent.append(("approve", always))
    guard.send_deny = lambda: guard.sent.append(("deny", None))
    return guard, toasts, store, state


def run() -> int:
    failures = []

    def check(label, condition, detail=""):
        print(f"  {'✅' if condition else '❌'} {label}")
        if not condition:
            failures.append(f"{label} {detail}")

    # ================= أمر مجهول: يُعرض، ثم يُتعلَّم، ثم يُطبَّق تلقائياً
    print("\n▸ أمر مجهول «./deploy.sh»")
    guard, toasts, store, state = build()

    state["text"] = UNKNOWN
    guard.tick()
    check("أول مرة: تظهر بطاقة", toasts.visible == 1)
    check("زرّ «اقبل دائماً» متاح (السبب: لا أعرفه، لا خطر)",
          toasts.last_actions.get("always") is not None)
    check("الشرح بالعربية معروض",
          "deploy.sh" in (toasts.last_analysis.intent or ""))

    print("\n  … تضغط «اقبل دائماً»")
    toasts.last_actions["always"]()
    check("حُفظ القرار في الذاكرة", store.recall("Bash", "./deploy.sh") is not None)
    check("وأُرسلت الموافقة", ("approve", True) in guard.sent)

    print("\n  … يظهر الأمر نفسه مرة أخرى")
    state["text"] = IDLE
    guard.tick()
    toasts.shown.clear()
    guard.sent.clear()
    state["text"] = UNKNOWN
    guard.tick()
    check("لا بطاقة هذه المرة", toasts.shown == [], str(toasts.shown))
    check("وُوفق عليه مباشرةً", ("approve", True) in guard.sent, str(guard.sent))
    check("عدّاد التطبيق ارتفع", store.recall("Bash", "./deploy.sh").count >= 1)

    # ================= أمر خطِر: «اقبل دائماً» ممنوع، و«ارفض دائماً» يعمل
    print("\n▸ أمر خطِر «rm -rf build»")
    guard, toasts, store, state = build()

    state["text"] = DANGER
    guard.tick()
    check("تظهر بطاقة", toasts.visible == 1)
    check("زرّ «اقبل دائماً» ممنوع (رُفض بقاعدة خطر صريحة)",
          toasts.last_actions.get("always") is None)
    check("زرّ «ارفض دائماً» متاح", toasts.last_actions.get("never") is not None)

    print("\n  … تضغط «ارفض دائماً»")
    toasts.last_actions["never"]()
    entry = store.recall("Bash", "rm -rf build")
    check("حُفظ كرفض دائم", entry is not None and entry.verdict == "reject")

    print("\n  … يظهر الأمر نفسه مرة أخرى")
    state["text"] = IDLE
    guard.tick()
    toasts.shown.clear()
    guard.sent.clear()
    state["text"] = DANGER
    guard.tick()
    check("لا بطاقة — رُفض بصمت", toasts.shown == [], str(toasts.shown))
    check("ولم تُرسل أي موافقة", ("approve", True) not in guard.sent)

    # ============ القبول المحفوظ لا يتجاوز قاعدة خطر لو تغيّر الأمر
    print("\n▸ قبول محفوظ لأمر صار خطِراً")
    guard, toasts, store, state = build()
    store.learn("Bash", "rm -rf build", "approve", "أمر غير معروف", "قديم")
    state["text"] = DANGER
    guard.tick()
    check("تُهمَل الذاكرة وتظهر البطاقة", toasts.visible == 1)
    check("ولم تُرسل موافقة", ("approve", True) not in guard.sent, str(guard.sent))

    print()
    if failures:
        print(f"فشل {len(failures)}:")
        for f in failures:
            print("  ❌", f)
        return 1
    print("✅ نجحت كل حالات التعلّم")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
