"""محرّك تصنيف طلبات الأذونات: هل هذا الطلب آمن للموافقة التلقائية؟

المبدأ الحاكم: **fail-closed** — الموافقة التلقائية لا تُمنح إلا لأمرٍ
مطابقٍ صراحةً لقائمة السماح. أيّ شيء آخر (خطِر، أو مجهول، أو نصّ لم
يُقرأ جيداً) يُصنَّف تنبيهاً ويُعرض على المستخدم بإطارٍ أحمر.

هذا الملف نقيّ من أي اعتماد على النظام حتى يمكن اختباره آلياً.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# ---------------------------------------------------------------- الأنماط الخطرة
# كل نمط: (المعرّف، التعبير النمطي، الشرح العربي)
DANGER_RULES: list[tuple[str, str, str]] = [
    # --- تدمير الملفات ---
    ("rm-recursive", r"\brm\s+(-[a-z]*\s+)*-[a-z]*[rf]", "حذف ملفات متكرّر/قسري"),
    ("win-del-force", r"\bdel\s+/[fsq]", "حذف قسري في ويندوز"),
    ("win-rmdir", r"\brmdir\s+/s", "حذف مجلد بمحتوياته"),
    ("ps-remove", r"Remove-Item\b[^|;]*-Recurse", "حذف متكرّر عبر PowerShell"),
    ("disk-write", r"\b(dd\s+if=|mkfs\b|format\s+[a-z]:)", "كتابة مباشرة على القرص أو تهيئته"),
    ("truncate-redirect", r">\s*/dev/(sd|nvme|disk)", "الكتابة فوق جهاز تخزين"),

    # --- تدمير في git ---
    ("git-force-push", r"git\s+push\b[^|;]*(--force(?!-with-lease)|\s-f\b)", "دفع قسري يمحو تاريخ الفرع"),
    ("git-hard-reset", r"git\s+reset\b[^|;]*--hard", "إلغاء التعديلات نهائياً"),
    ("git-clean", r"git\s+clean\b[^|;]*-[a-z]*[fd]", "حذف الملفات غير المتتبّعة"),
    ("git-history-rewrite", r"git\s+(filter-branch|filter-repo)", "إعادة كتابة تاريخ المستودع"),
    ("git-push-main", r"git\s+push\b[^|;]*\b(origin\s+)?(main|master)\b", "دفع مباشر إلى الفرع الرئيسي"),

    # --- الأسرار وبيانات الاعتماد ---
    ("secret-files", r"(\.env\b|\.pem\b|id_rsa|id_ed25519|\.ssh/|\.aws/|\.kube/config|"
                     r"\.npmrc|\.git-credentials|credentials\.json|serviceaccount)",
     "ملفّ يحتوي بيانات اعتماد أو مفاتيح"),
    ("secret-words", r"\b(api[_-]?key|secret[_-]?key|access[_-]?token|refresh[_-]?token|"
                     r"private[_-]?key|client[_-]?secret|passwd|password)\b",
     "إشارة صريحة إلى سرّ أو كلمة مرور"),
    ("keychain", r"\b(keychain|credential\s*manager|secretstorage|vault\s+read)\b",
     "قراءة من مخزن بيانات الاعتماد"),

    # --- تسريب البيانات إلى الخارج ---
    ("http-upload", r"\b(curl|wget|Invoke-WebRequest|Invoke-RestMethod)\b[^|;]*"
                    r"(-d\b|--data|-F\b|--form|-T\b|--upload-file|-Method\s+Post|--post)",
     "إرسال بيانات إلى خادم خارجي"),
    ("remote-copy", r"\b(scp|sftp|rsync)\b[^|;]*\S+@\S+:", "نسخ ملفات إلى جهاز بعيد"),
    ("netcat", r"\b(nc|ncat|netcat|telnet)\b\s+\S+\s+\d+", "فتح اتصال شبكي مباشر"),
    ("pipe-encode", r"\bbase64\b[^|;]*\|", "ترميز بيانات وتمريرها (نمط تسريب شائع)"),

    # --- تنفيذ كود من الإنترنت ---
    ("curl-pipe-shell", r"\b(curl|wget|iwr|Invoke-WebRequest)\b[^|]*\|\s*(sudo\s+)?(ba)?sh\b",
     "تنزيل سكربت وتنفيذه مباشرة"),
    ("iex", r"\b(iex|Invoke-Expression)\b", "تنفيذ نصّ ديناميكي في PowerShell"),
    ("ps-encoded", r"powershell(\.exe)?\s+.*-(enc|encodedcommand)\b", "أمر PowerShell مُعمّى"),

    # --- الصلاحيات والنظام ---
    ("sudo", r"\b(sudo|runas|Start-Process\b[^;]*-Verb\s+RunAs)\b", "تنفيذ بصلاحيات مرتفعة"),
    ("chmod-777", r"\bchmod\s+(-R\s+)?777\b", "منح صلاحيات كاملة للجميع"),
    ("user-mgmt", r"\b(net\s+user|useradd|Add-LocalGroupMember|net\s+localgroup)\b",
     "تعديل حسابات المستخدمين"),
    ("system-power", r"\b(shutdown|reboot|Restart-Computer|Stop-Computer)\b", "إيقاف أو إعادة تشغيل الجهاز"),
    ("registry-delete", r"\breg\s+delete\b|Remove-ItemProperty\b.*HKLM", "حذف من سجلّ ويندوز"),
    ("firewall", r"\b(iptables|netsh\s+advfirewall|ufw)\b", "تعديل جدار الحماية"),

    # --- النشر الخارجي ---
    ("publish", r"\b(npm\s+publish|twine\s+upload|docker\s+push|gh\s+release\s+create)\b",
     "نشر إلى سجلّ عامّ"),

    # --- قواعد البيانات ---
    ("sql-destructive", r"\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE)\b",
     "حذف جدول أو قاعدة بيانات"),
    ("sql-delete-all", r"\bDELETE\s+FROM\s+\w+\s*(;|$)", "حذف كل صفوف جدول بلا شرط"),
    ("migration-reset", r"\b(supabase\s+db\s+reset|prisma\s+migrate\s+reset|drizzle-kit\s+drop)\b",
     "إعادة تهيئة قاعدة البيانات"),

    # --- مسارات حسّاسة يُمنع تعديلها تلقائياً ---
    ("perm-settings", r"\.claude[/\\]settings|settings\.local\.json|\.mcp\.json",
     "تعديل ملفّ الأذونات نفسه — قد يوسّع الصلاحيات"),
    ("ci-workflow", r"\.github[/\\]workflows", "تعديل خطوط CI/CD"),
    ("git-internals", r"(^|[/\\])\.git[/\\](?!hub)", "تعديل داخل مجلد git الداخلي"),
    ("system-path", r"(C:\\Windows|C:\\Program\s+Files|/etc/|/usr/bin|/System/|System32)",
     "مسار من مسارات النظام"),
    ("hosts-file", r"(drivers[/\\]etc[/\\]hosts|/etc/hosts)", "ملفّ hosts"),
    ("parent-escape", r"\.\.[/\\]\.\.[/\\]", "مسار يخرج من حدود المشروع"),
]

DANGER_PATTERNS = [
    (rule_id, re.compile(pattern, re.IGNORECASE), why)
    for rule_id, pattern, why in DANGER_RULES
]

# ------------------------------------------------------------- قائمة السماح
# أوامر قراءة أو فحص لا تُعدّل شيئاً خارج المشروع.
SAFE_RULES: list[tuple[str, str]] = [
    ("git-read", r"^git\s+(status|diff|log|show|branch|remote|stash\s+list|"
                 r"rev-parse|describe|blame|shortlog|ls-files)\b"),
    ("git-fetch", r"^git\s+(fetch|pull)\b"),
    ("git-stage", r"^git\s+(add|restore\s+--staged)\b"),
    ("list-files", r"^(ls|dir|pwd|tree|Get-ChildItem|Get-Location)\b"),
    ("read-files", r"^(cat|head|tail|less|more|wc|file|stat|Get-Content)\b"),
    ("search", r"^(grep|rg|ripgrep|find|fd|ag|Select-String)\b"),
    ("node-scripts", r"^(npm|pnpm|yarn|bun)\s+(run\s+)?"
                     r"(test|lint|typecheck|type-check|build|format|check|ci|install|i)\b"),
    ("python-test", r"^(pytest|python\s+-m\s+pytest|tox|ruff|black|mypy|flake8)\b"),
    ("type-check", r"^(tsc|npx\s+tsc)\b"),
    ("echo", r"^echo\b"),
    ("which", r"^(which|where|whereis|type|command\s+-v)\b"),
    ("env-list", r"^(node|python3?|go|cargo|java)\s+--version\b"),
]

SAFE_PATTERNS = [(rule_id, re.compile(p, re.IGNORECASE)) for rule_id, p in SAFE_RULES]

# فواصل تسلسل الأوامر في الصدفة — نفحص كل مقطع على حدة
SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|]|\bthen\b|\bdo\b")


@dataclass
class Decision:
    """نتيجة التصنيف."""
    verdict: str            # "approve" أو "alert"
    reason: str             # شرح عربي موجز
    rule_id: str = ""       # معرّف القاعدة التي حسمت القرار
    matched: str = ""       # النصّ الذي طابق
    segments: list[str] = field(default_factory=list)

    @property
    def is_safe(self) -> bool:
        return self.verdict == "approve"


def split_segments(command: str) -> list[str]:
    """يقسّم أمراً مركّباً إلى مقاطع مستقلّة."""
    return [seg.strip() for seg in SEGMENT_SPLIT.split(command) if seg.strip()]


def find_danger(text: str) -> tuple[str, str, str] | None:
    """يعيد (المعرّف، الشرح، النصّ المطابق) لأول قاعدة خطر تُطابق، أو None."""
    for rule_id, pattern, why in DANGER_PATTERNS:
        match = pattern.search(text)
        if match:
            return rule_id, why, match.group(0).strip()
    return None


def classify(command: str) -> Decision:
    """يصنّف أمراً واحداً: هل يُوافَق عليه تلقائياً أم يُنبَّه عليه؟"""
    if command is None:
        return Decision("alert", "لا يوجد نصّ للفحص")

    text = command.strip()
    if not text:
        return Decision("alert", "نصّ الطلب فارغ — تعذّرت قراءته")

    # نصّ قصير جداً غالباً يعني فشل القراءة، لا أمراً حقيقياً
    if len(text) < 2:
        return Decision("alert", "نصّ الطلب أقصر من أن يُقرأ بثقة")

    # 1) الخطر أولاً — يُفحص على النصّ كاملاً قبل التقسيم
    danger = find_danger(text)
    if danger:
        rule_id, why, matched = danger
        return Decision("alert", why, rule_id, matched)

    # 2) كل مقطع من الأمر يجب أن يكون في قائمة السماح
    segments = split_segments(text)
    if not segments:
        return Decision("alert", "تعذّر تحليل بنية الأمر", segments=segments)

    for segment in segments:
        # فحص الخطر مرة أخرى على مستوى المقطع (حماية مضاعفة)
        danger = find_danger(segment)
        if danger:
            rule_id, why, matched = danger
            return Decision("alert", why, rule_id, matched, segments)

        if not any(pattern.search(segment) for _, pattern in SAFE_PATTERNS):
            return Decision(
                "alert",
                f"أمر غير معروف في قائمة السماح: «{segment[:60]}»",
                "unknown",
                segment,
                segments,
            )

    matched_rules = [
        rule_id
        for segment in segments
        for rule_id, pattern in SAFE_PATTERNS
        if pattern.search(segment)
    ]
    return Decision(
        "approve",
        "أمر قراءة/فحص معروف وآمن",
        ",".join(dict.fromkeys(matched_rules)),
        text,
        segments,
    )


# ==================================================== التصنيف حسب نوع الأداة
# مسار ملفّ مشروع اعتيادي (نسبيّ، بامتداد معروف)
SAFE_FILE = re.compile(
    r"^[\w.\-/\\ ]+\.(tsx?|jsx?|mjs|cjs|py|rb|go|rs|java|kt|php|md|mdx|json|ya?ml|"
    r"toml|css|scss|sass|less|html|svg|txt|sql|prisma|sh|bash|cmd|ps1|ahk|ini|cfg|"
    r"conf|lock|env\.example|gitignore|editorconfig)$",
    re.IGNORECASE,
)

# نمط بحث أو قالب ملفّات (Glob/Grep)
SAFE_GLOB = re.compile(r"^[\w.\-/\\*{}, ]+$")

READ_TOOLS = {"read", "glob", "grep", "notebookread", "ls"}
EDIT_TOOLS = {"write", "edit", "multiedit", "notebookedit"}
EXEC_TOOLS = {"bash", "task", "shell"}
NET_TOOLS = {"webfetch", "websearch"}


def classify_request(tool: str, argument: str, allow_edits: bool = True) -> Decision:
    """يصنّف طلب إذن حسب الأداة المطلوبة ومُعاملها.

    - أدوات القراءة  : تُقبل لمسارات المشروع الاعتيادية.
    - أدوات التعديل  : تُقبل لمسارات المشروع إن كان allow_edits مفعّلاً.
    - أدوات التنفيذ  : تُمرَّر إلى classify() لفحص الأمر نفسه.
    - أدوات الشبكة   : تُنبَّه دائماً (احتمال تسريب أو جلب محتوى خارجي).
    - أي أداة أخرى   : تُنبَّه (fail-closed).
    """
    name = (tool or "").strip().lower()
    arg = (argument or "").strip().strip("`\"'").strip()

    if not arg:
        return Decision("alert", "الطلب بلا مُعامل واضح", "no-argument")

    # الخطر يُفحص قبل كل شيء، أياً كانت الأداة
    danger = find_danger(arg)
    if danger:
        rule_id, why, matched = danger
        return Decision("alert", why, rule_id, matched)

    if name in EXEC_TOOLS:
        return classify(arg)

    if name in READ_TOOLS:
        if SAFE_FILE.match(arg) or SAFE_GLOB.match(arg):
            return Decision("approve", f"قراءة مسار مشروع اعتيادي ({name})", "read-path", arg)
        return Decision("alert", f"مسار قراءة غير معتاد: «{arg[:60]}»", "unknown-path", arg)

    if name in EDIT_TOOLS:
        if not allow_edits:
            return Decision("alert", "تعديل الملفات يحتاج موافقتك (allow_edits معطّل)",
                            "edits-disabled", arg)
        if SAFE_FILE.match(arg):
            return Decision("approve", f"تعديل ملفّ مشروع اعتيادي ({name})", "edit-path", arg)
        return Decision("alert", f"مسار تعديل غير معتاد: «{arg[:60]}»", "unknown-path", arg)

    if name in NET_TOOLS:
        return Decision("alert", f"طلب شبكة خارجية ({name}) — يحتاج مراجعتك", "network", arg)

    if not name:
        # لا اسم أداة: عامله كأمر صدفة
        return classify(arg)

    return Decision("alert", f"أداة غير معروفة: {name}", "unknown-tool", arg)
