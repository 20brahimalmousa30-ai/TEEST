"""محرّك فهم وتصنيف طلبات أذونات Claude Code.

لكل طلب يُنتج المحرّك ثلاثة أشياء:
    1. تصنيفاً عربياً يشرح ماذا يعني الأمر  (مثل: «تشغيل الاختبارات»)
    2. قراراً: قبول أو رفض
    3. سبباً مفهوماً عند الرفض

المبدأ الحاكم: **الشكّ يعني الرفض** — لا يُقبل إلا ما يُفهم ويُعرف صراحةً.
هذا الملف نقيّ من أي اعتماد على النظام حتى يمكن اختباره آلياً.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


# ================================================================= التصنيفات
class Cat:
    """أسماء التصنيفات بالعربية."""

    # --- آمنة ---
    READ = "قراءة ملفات"
    SEARCH = "بحث في الكود"
    GIT_STATUS = "فحص حالة git"
    GIT_SYNC = "جلب تحديثات git"
    GIT_STAGE = "تجهيز تغييرات git"
    TEST = "تشغيل الاختبارات"
    BUILD = "بناء المشروع"
    LINT = "فحص جودة الكود"
    INSTALL = "تثبيت حزم المشروع"
    SYSINFO = "معلومات النظام"
    EDIT = "تعديل ملفّ مشروع"

    # --- خطرة ---
    DELETE = "حذف ملفات"
    DISK = "كتابة مباشرة على القرص"
    GIT_DESTROY = "تدمير تاريخ git"
    SECRETS = "وصول إلى أسرار وبيانات اعتماد"
    EXFIL = "إرسال بيانات إلى الخارج"
    RCE = "تنفيذ كود من الإنترنت"
    PRIV = "رفع الصلاحيات"
    SYSTEM = "تحكّم بالنظام"
    PUBLISH = "نشر إلى سجلّ عامّ"
    DB = "تعديل قاعدة البيانات"
    PERMS = "تعديل ملفّ الأذونات"
    SENSITIVE = "مسار حسّاس"
    NETWORK = "طلب شبكة خارجي"

    # --- غير محسومة ---
    UNKNOWN = "أمر غير معروف"
    UNREADABLE = "طلب تعذّرت قراءته"


# ------------------------------------------------- قواعد الخطر: (معرّف، نمط، تصنيف، سبب)
DANGER_RULES: list[tuple[str, str, str, str]] = [
    # --- تدمير الملفات ---
    ("rm-recursive", r"\brm\s+(-[a-z]*\s+)*-[a-z]*[rf]", Cat.DELETE,
     "حذف متكرّر أو قسري — قد يمحو عملاً غير محفوظ بلا رجعة"),
    ("win-del-force", r"\bdel\s+/[fsq]", Cat.DELETE,
     "حذف قسري في ويندوز يتجاوز سلّة المحذوفات"),
    ("win-rmdir", r"\brmdir\s+/s", Cat.DELETE, "حذف مجلد بكل محتوياته"),
    ("ps-remove", r"Remove-Item\b[^|;]*-Recurse", Cat.DELETE,
     "حذف متكرّر عبر PowerShell"),
    ("disk-write", r"\b(dd\s+if=|mkfs\b|format\s+[a-z]:)", Cat.DISK,
     "كتابة على القرص مباشرةً أو تهيئته — تدمير كامل للبيانات"),
    ("device-redirect", r">\s*/dev/(sd|nvme|disk)", Cat.DISK,
     "الكتابة فوق جهاز تخزين"),

    # --- تدمير في git ---
    ("git-force-push", r"git\s+push\b[^|;]*(--force(?!-with-lease)|\s-f\b)", Cat.GIT_DESTROY,
     "دفع قسري يمحو تاريخ الفرع على الخادم"),
    ("git-hard-reset", r"git\s+reset\b[^|;]*--hard", Cat.GIT_DESTROY,
     "إلغاء كل التعديلات غير المحفوظة نهائياً"),
    ("git-clean", r"git\s+clean\b[^|;]*-[a-z]*[fd]", Cat.GIT_DESTROY,
     "حذف كل الملفات غير المتتبّعة في المستودع"),
    ("git-history-rewrite", r"git\s+(filter-branch|filter-repo)", Cat.GIT_DESTROY,
     "إعادة كتابة تاريخ المستودع كاملاً"),
    ("git-push-main", r"git\s+push\b[^|;]*\b(origin\s+)?(main|master)\b", Cat.GIT_DESTROY,
     "دفع مباشر إلى الفرع الرئيسي دون مراجعة"),

    # --- الأسرار ---
    ("secret-files", r"(\.env\b|\.pem\b|id_rsa|id_ed25519|\.ssh/|\.aws/|\.kube/config|"
                     r"\.npmrc|\.git-credentials|credentials\.json|serviceaccount)",
     Cat.SECRETS, "الملفّ يحتوي مفاتيح أو بيانات اعتماد"),
    ("secret-words", r"\b(api[_-]?key|secret[_-]?key|access[_-]?token|refresh[_-]?token|"
                     r"private[_-]?key|client[_-]?secret|passwd|password)\b",
     Cat.SECRETS, "إشارة صريحة إلى سرّ أو كلمة مرور"),
    ("keychain", r"\b(keychain|credential\s*manager|secretstorage|vault\s+read)\b",
     Cat.SECRETS, "قراءة من مخزن بيانات الاعتماد"),

    # --- تسريب البيانات ---
    ("http-upload", r"\b(curl|wget|Invoke-WebRequest|Invoke-RestMethod)\b[^|;]*"
                    r"(-d\b|--data|-F\b|--form|-T\b|--upload-file|-Method\s+Post|--post)",
     Cat.EXFIL, "يرفع بيانات من جهازك إلى خادم خارجي"),
    ("remote-copy", r"\b(scp|sftp|rsync)\b[^|;]*\S+@\S+:", Cat.EXFIL,
     "ينسخ ملفات إلى جهاز بعيد"),
    ("netcat", r"\b(nc|ncat|netcat|telnet)\b\s+\S+\s+\d+", Cat.EXFIL,
     "يفتح اتصالاً شبكياً مباشراً — قناة تسريب شائعة"),
    ("pipe-encode", r"\bbase64\b[^|;]*\|", Cat.EXFIL,
     "يُرمّز بيانات ويمرّرها — نمط إخفاء تسريب"),

    # --- تنفيذ كود من الإنترنت ---
    ("curl-pipe-shell", r"\b(curl|wget|iwr|Invoke-WebRequest)\b[^|]*\|\s*(sudo\s+)?(ba)?sh\b",
     Cat.RCE, "ينزّل سكربتاً من الإنترنت وينفّذه دون أن تراه"),
    ("iex", r"\b(iex|Invoke-Expression)\b", Cat.RCE,
     "ينفّذ نصّاً ديناميكياً — يُخفي ما سيُنفَّذ فعلاً"),
    ("ps-encoded", r"powershell(\.exe)?\s+.*-(enc|encodedcommand)\b", Cat.RCE,
     "أمر PowerShell مُعمّى لا يمكن قراءته"),

    # --- الصلاحيات ---
    ("sudo", r"\b(sudo|runas|Start-Process\b[^;]*-Verb\s+RunAs)\b", Cat.PRIV,
     "ينفّذ بصلاحيات المسؤول — يتجاوز كل الحواجز"),
    ("chmod-777", r"\bchmod\s+(-R\s+)?777\b", Cat.PRIV,
     "يمنح صلاحيات كاملة لكل مستخدمي الجهاز"),
    ("user-mgmt", r"\b(net\s+user|useradd|Add-LocalGroupMember|net\s+localgroup)\b",
     Cat.PRIV, "يعدّل حسابات المستخدمين على الجهاز"),

    # --- النظام ---
    ("system-power", r"\b(shutdown|reboot|Restart-Computer|Stop-Computer)\b", Cat.SYSTEM,
     "يُطفئ الجهاز أو يعيد تشغيله"),
    ("registry-delete", r"\breg\s+delete\b|Remove-ItemProperty\b.*HKLM", Cat.SYSTEM,
     "يحذف من سجلّ ويندوز — قد يعطّل برامج"),
    ("firewall", r"\b(iptables|netsh\s+advfirewall|ufw)\b", Cat.SYSTEM,
     "يعدّل جدار الحماية"),

    # --- النشر ---
    ("publish", r"\b(npm\s+publish|twine\s+upload|docker\s+push|gh\s+release\s+create)\b",
     Cat.PUBLISH, "ينشر للعلن — لا يمكن التراجع عنه بسهولة"),

    # --- قواعد البيانات ---
    ("sql-destructive", r"\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE)\b", Cat.DB,
     "يحذف جدولاً أو قاعدة بيانات كاملة"),
    ("sql-delete-all", r"\bDELETE\s+FROM\s+\w+\s*(;|$)", Cat.DB,
     "يحذف كل صفوف الجدول بلا شرط"),
    ("migration-reset", r"\b(supabase\s+db\s+reset|prisma\s+migrate\s+reset|drizzle-kit\s+drop)\b",
     Cat.DB, "يُعيد تهيئة قاعدة البيانات ويمحو محتواها"),

    # --- مسارات حسّاسة ---
    ("perm-settings", r"\.claude[/\\]settings|settings\.local\.json|\.mcp\.json", Cat.PERMS,
     "تعديل ملفّ الأذونات نفسه — قد يوسّع الصلاحيات من خلف ظهرك"),
    ("ci-workflow", r"\.github[/\\]workflows", Cat.SENSITIVE,
     "تعديل خطوط CI/CD — يُنفَّذ آلياً على الخادم"),
    ("git-internals", r"(^|[/\\])\.git[/\\](?!hub)", Cat.SENSITIVE,
     "تعديل داخل مجلد git الداخلي"),
    ("system-path", r"(C:\\Windows|C:\\Program\s+Files|/etc/|/usr/bin|/System/|System32)",
     Cat.SENSITIVE, "مسار من مسارات النظام"),
    ("hosts-file", r"(drivers[/\\]etc[/\\]hosts|/etc/hosts)", Cat.SENSITIVE,
     "ملفّ hosts — يُستخدم لإعادة توجيه المواقع"),
    ("parent-escape", r"\.\.[/\\]\.\.[/\\]", Cat.SENSITIVE,
     "مسار يخرج من حدود المشروع"),
]

DANGER_PATTERNS = [
    (rule_id, re.compile(pattern, re.IGNORECASE), category, why)
    for rule_id, pattern, category, why in DANGER_RULES
]

# --------------------------------------------- قائمة السماح: (معرّف، نمط، تصنيف)
SAFE_RULES: list[tuple[str, str, str]] = [
    ("git-read", r"^git\s+(status|diff|log|show|branch|remote|stash\s+list|"
                 r"rev-parse|describe|blame|shortlog|ls-files)\b", Cat.GIT_STATUS),
    ("git-fetch", r"^git\s+(fetch|pull)\b", Cat.GIT_SYNC),
    ("git-stage", r"^git\s+(add|restore\s+--staged)\b", Cat.GIT_STAGE),
    ("list-files", r"^(ls|dir|pwd|tree|Get-ChildItem|Get-Location)\b", Cat.READ),
    ("read-files", r"^(cat|head|tail|less|more|wc|file|stat|Get-Content)\b", Cat.READ),
    ("search", r"^(grep|rg|ripgrep|find|fd|ag|Select-String)\b", Cat.SEARCH),
    ("node-test", r"^(npm|pnpm|yarn|bun)\s+(run\s+)?test\b", Cat.TEST),
    ("node-lint", r"^(npm|pnpm|yarn|bun)\s+(run\s+)?"
                  r"(lint|format|check|typecheck|type-check)\b", Cat.LINT),
    ("node-build", r"^(npm|pnpm|yarn|bun)\s+(run\s+)?build\b", Cat.BUILD),
    ("node-install", r"^(npm|pnpm|yarn|bun)\s+(ci|install|i)\b", Cat.INSTALL),
    ("python-test", r"^(pytest|python\s+-m\s+pytest|tox)\b", Cat.TEST),
    ("python-lint", r"^(ruff|black|mypy|flake8|isort)\b", Cat.LINT),
    ("type-check", r"^(tsc|npx\s+tsc)\b", Cat.LINT),
    ("echo", r"^echo\b", Cat.SYSINFO),
    ("which", r"^(which|where|whereis|type|command\s+-v)\b", Cat.SYSINFO),
    ("version", r"^(node|python3?|go|cargo|java|npm|git)\s+--version\b", Cat.SYSINFO),
]

SAFE_PATTERNS = [
    (rule_id, re.compile(pattern, re.IGNORECASE), category)
    for rule_id, pattern, category in SAFE_RULES
]

SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|]|\bthen\b|\bdo\b")


@dataclass
class Decision:
    """نتيجة فحص طلب واحد."""

    verdict: str                 # "approve" (قبول) أو "alert" (رفض)
    category: str                # التصنيف العربي
    reason: str                  # سبب الرفض، أو وصف موجز عند القبول
    rule_id: str = ""
    matched: str = ""
    segments: list[str] = field(default_factory=list)

    @property
    def is_safe(self) -> bool:
        return self.verdict == "approve"

    @property
    def label(self) -> str:
        """سطر عربي جاهز للعرض."""
        mark = "✅ قبول" if self.is_safe else "⛔ رفض"
        return f"{mark} | التصنيف: {self.category}"


def split_segments(command: str) -> list[str]:
    """يقسّم أمراً مركّباً إلى مقاطع مستقلّة."""
    return [seg.strip() for seg in SEGMENT_SPLIT.split(command) if seg.strip()]


def find_danger(text: str) -> tuple[str, str, str, str] | None:
    """يعيد (المعرّف، التصنيف، السبب، النصّ المطابق) لأول قاعدة خطر، أو None."""
    for rule_id, pattern, category, why in DANGER_PATTERNS:
        match = pattern.search(text)
        if match:
            return rule_id, category, why, match.group(0).strip()
    return None


def match_safe(segment: str) -> tuple[str, str] | None:
    """يعيد (المعرّف، التصنيف) لأول قاعدة سماح تُطابق المقطع، أو None."""
    for rule_id, pattern, category in SAFE_PATTERNS:
        if pattern.search(segment):
            return rule_id, category
    return None


def classify(command: str) -> Decision:
    """يفهم أمر صدفة ويصنّفه ويقرّر قبوله أو رفضه."""
    if not command or not command.strip():
        return Decision("alert", Cat.UNREADABLE, "نصّ الطلب فارغ — تعذّرت قراءته")

    text = command.strip()
    if len(text) < 2:
        return Decision("alert", Cat.UNREADABLE, "النصّ أقصر من أن يُفهم بثقة")

    # 1) الخطر أولاً على النصّ كاملاً
    danger = find_danger(text)
    if danger:
        rule_id, category, why, matched = danger
        return Decision("alert", category, why, rule_id, matched)

    # 2) كل مقطع يجب أن يكون معروفاً في قائمة السماح
    segments = split_segments(text)
    categories: list[str] = []

    for segment in segments:
        danger = find_danger(segment)
        if danger:
            rule_id, category, why, matched = danger
            return Decision("alert", category, why, rule_id, matched, segments)

        safe = match_safe(segment)
        if safe is None:
            return Decision(
                "alert", Cat.UNKNOWN,
                f"لا أعرف ماذا يفعل هذا الأمر: «{segment[:70]}» — لم أقبله احتياطاً",
                "unknown", segment, segments,
            )
        categories.append(safe[1])

    unique = list(dict.fromkeys(categories))
    return Decision(
        "approve", " + ".join(unique), "أمر معروف لا يُعدّل شيئاً خارج المشروع",
        "safe", text, segments,
    )


# ==================================================== التصنيف حسب نوع الأداة
SAFE_FILE = re.compile(
    r"^[\w.\-/\\ ]+\.(tsx?|jsx?|mjs|cjs|py|rb|go|rs|java|kt|php|md|mdx|json|ya?ml|"
    r"toml|css|scss|sass|less|html|svg|txt|sql|prisma|sh|bash|cmd|ps1|ahk|ini|cfg|"
    r"conf|lock|gitignore|editorconfig)$",
    re.IGNORECASE,
)
SAFE_GLOB = re.compile(r"^[\w.\-/\\*{}, ]+$")

READ_TOOLS = {"read", "glob", "grep", "notebookread", "ls"}
EDIT_TOOLS = {"write", "edit", "multiedit", "notebookedit"}
EXEC_TOOLS = {"bash", "task", "shell"}
NET_TOOLS = {"webfetch", "websearch"}


def classify_request(tool: str, argument: str, allow_edits: bool = True) -> Decision:
    """يفهم طلب إذن كاملاً (أداة + مُعامل) ويصنّفه ويقرّر."""
    name = (tool or "").strip().lower()
    arg = (argument or "").strip().strip("`\"'").strip()

    if not arg:
        return Decision("alert", Cat.UNREADABLE, "الطلب بلا مُعامل واضح", "no-argument")

    # الخطر يُفحص قبل كل شيء، أياً كانت الأداة
    danger = find_danger(arg)
    if danger:
        rule_id, category, why, matched = danger
        return Decision("alert", category, why, rule_id, matched)

    if name in EXEC_TOOLS or not name:
        return classify(arg)

    if name in READ_TOOLS:
        if SAFE_FILE.match(arg) or SAFE_GLOB.match(arg):
            category = Cat.SEARCH if name in {"glob", "grep"} else Cat.READ
            return Decision("approve", category,
                            "قراءة ملفّ داخل المشروع لا تُعدّل شيئاً", "read-path", arg)
        return Decision("alert", Cat.UNKNOWN,
                        f"مسار قراءة غير معتاد: «{arg[:60]}»", "unknown-path", arg)

    if name in EDIT_TOOLS:
        if not allow_edits:
            return Decision("alert", Cat.EDIT,
                            "الموافقة التلقائية على تعديل الملفات معطّلة بطلبك",
                            "edits-disabled", arg)
        if SAFE_FILE.match(arg):
            return Decision("approve", Cat.EDIT,
                            "تعديل ملفّ مشروع اعتيادي", "edit-path", arg)
        return Decision("alert", Cat.UNKNOWN,
                        f"مسار تعديل غير معتاد: «{arg[:60]}»", "unknown-path", arg)

    if name in NET_TOOLS:
        return Decision("alert", Cat.NETWORK,
                        "طلب إلى الإنترنت — قد يجلب محتوى غير موثوق أو يُرسل بيانات",
                        "network", arg)

    return Decision("alert", Cat.UNKNOWN, f"أداة غير معروفة: {name}", "unknown-tool", arg)
