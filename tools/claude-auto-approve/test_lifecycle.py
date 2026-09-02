"""اختبار دورة حياة البطاقة الحمراء: متى تظهر ومتى تختفي.

يُحاكي نافذة Claude Code بسلسلة نصوص متعاقبة دون الحاجة إلى ويندوز.
"""

import claude_auto_approve as m


class FakeToasts:
    """بديل ToastManager يسجّل الأوامر بدل رسم واجهة."""

    def __init__(self):
        self.events = []
        self.visible = 0

    def notify(self, decision, subject):
        self.events.append(("show", decision.category))
        self.visible += 1

    def resolve_all(self):
        self.events.append(("hide", None))
        self.visible = 0


IDLE = "Claude Code\nجاهز"
SAFE = "Bash command\nnpm test\nAlways allow\nAllow once"
DANGER = "Bash command\nrm -rf build\nAlways allow\nAllow once"
DANGER2 = "Bash command\ncat .env\nAlways allow\nAllow once"

# (الوصف، نصّ النافذة، هل النافذة نشطة، عدد البطاقات المتوقّع بعدها)
STEPS = [
    ("لا يوجد طلب",              IDLE,    True,  0),
    ("طلب خطِر ⇒ تظهر بطاقة",     DANGER,  True,  1),
    ("الطلب ما زال معروضاً",      DANGER,  True,  1),
    ("الطلب ما زال معروضاً",      DANGER,  True,  1),
    ("اخترتَ ⇒ تختفي البطاقة",    IDLE,    True,  0),
    ("طلب خطِر آخر",             DANGER2, True,  1),
    ("طلب خطِر ثالث يحلّ محلّه",   DANGER,  True,  1),
    ("اخترتَ ⇒ تختفي",           IDLE,    True,  0),
    ("طلب آمن ⇒ لا بطاقة",       SAFE,    True,  0),
]


def run() -> int:
    toasts = FakeToasts()
    guard = m.Guard(0.1, live=True, allow_edits=True, auto_deny=False,
                    keywords=("claude",), toasts=toasts)

    state = {"text": IDLE, "focused": True}
    m.find_claude_window = lambda _kw: (1, "Claude Code")
    m.read_window_text = lambda _hwnd: state["text"]
    m.is_foreground = lambda _hwnd: state["focused"]
    guard.send_approve = lambda always: toasts.events.append(("approve", always))

    failures = []
    for name, text, focused, expected in STEPS:
        state["text"] = text
        state["focused"] = focused
        guard.tick()
        status = "✅" if toasts.visible == expected else "❌"
        if toasts.visible != expected:
            failures.append(f"{name}: بطاقات={toasts.visible} والمتوقّع={expected}")
        print(f"  {status} {name:32} → بطاقات ظاهرة: {toasts.visible}")

    print()
    print("  تسلسل الأحداث:", " → ".join(
        f"{a}{'/' + str(b) if b is not None else ''}" for a, b in toasts.events))
    print(f"  مقبول: {guard.approved} | مرفوض: {guard.rejected}")
    print()

    if failures:
        print("فشل:")
        for f in failures:
            print("  ❌", f)
        return 1
    print("✅ دورة الحياة صحيحة")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
