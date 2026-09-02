"""ذاكرة القرارات: الأمر الذي حسمتَه مرة، لا تُسأل عنه مرة أخرى.

تُخزَّن القرارات في `learned.json` بجوار الأداة. كل مدخلة تحمل الحكم
الذي اخترتَه، وتصنيفه، وشرحه، وعدد مرات تطبيقه.

قيدان يحفظان الأمان:
  1. لا يُحفظ «اقبل دائماً» إلا لما رُفض بسبب «لا أعرف هذا الأمر».
     ما رُفض بقاعدة خطر صريحة يبقى يسألك كل مرة.
  2. عند استرجاع قرار محفوظ تُعاد قواعد الخطر على الأمر من جديد،
     فلو تغيّرت القواعد أو تغيّر الأمر، تُهمَل الذاكرة ويُعاد الحكم.
"""

from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_PATH = Path(__file__).with_name("learned.json")

WHITESPACE = re.compile(r"\s+")


def normalize(tool: str, argument: str) -> str:
    """مفتاح موحّد للأمر: يتجاهل فروق المسافات وعلامات الاقتباس."""
    name = (tool or "").strip().lower()
    arg = (argument or "").strip().strip("`\"'").strip()
    arg = WHITESPACE.sub(" ", arg)
    return f"{name}|{arg}"


@dataclass
class Entry:
    verdict: str          # approve أو reject
    category: str
    intent: str
    count: int = 0
    first_seen: str = ""
    last_seen: str = ""

    def as_dict(self) -> dict:
        return {
            "verdict": self.verdict,
            "category": self.category,
            "intent": self.intent,
            "count": self.count,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
        }


@dataclass
class Memory:
    """قرارات محفوظة تُطبَّق تلقائياً على الأوامر المتكرّرة."""

    path: Path = DEFAULT_PATH
    entries: dict[str, Entry] = field(default_factory=dict)

    # ------------------------------------------------------------ التحميل
    def load(self) -> "Memory":
        if not self.path.exists():
            return self
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return self
        for key, value in (raw or {}).items():
            if not isinstance(value, dict) or "verdict" not in value:
                continue
            self.entries[key] = Entry(
                verdict=value.get("verdict", ""),
                category=value.get("category", ""),
                intent=value.get("intent", ""),
                count=int(value.get("count", 0) or 0),
                first_seen=value.get("first_seen", ""),
                last_seen=value.get("last_seen", ""),
            )
        return self

    def save(self) -> None:
        payload = {key: entry.as_dict() for key, entry in self.entries.items()}
        try:
            self.path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError:
            pass

    # ----------------------------------------------------------- الاستعمال
    def recall(self, tool: str, argument: str) -> Entry | None:
        """يعيد القرار المحفوظ لهذا الأمر، أو None إن لم يُحفظ من قبل."""
        return self.entries.get(normalize(tool, argument))

    def apply(self, tool: str, argument: str) -> Entry | None:
        """يسترجع القرار ويزيد عدّاد تطبيقه."""
        entry = self.recall(tool, argument)
        if entry is None:
            return None
        entry.count += 1
        entry.last_seen = dt.datetime.now().isoformat(timespec="seconds")
        self.save()
        return entry

    def learn(self, tool: str, argument: str, verdict: str,
              category: str, intent: str) -> Entry:
        """يحفظ قرارك لهذا الأمر ليُطبَّق تلقائياً فيما بعد."""
        key = normalize(tool, argument)
        now = dt.datetime.now().isoformat(timespec="seconds")
        entry = Entry(verdict, category, intent, 0, now, now)
        self.entries[key] = entry
        self.save()
        return entry

    def forget(self, key: str) -> bool:
        if key in self.entries:
            del self.entries[key]
            self.save()
            return True
        return False

    def clear(self) -> int:
        count = len(self.entries)
        self.entries.clear()
        self.save()
        return count

    # ------------------------------------------------------------- العرض
    def rows(self) -> list[tuple[str, Entry]]:
        """المدخلات مرتّبة بحسب كثرة الاستعمال."""
        return sorted(self.entries.items(), key=lambda kv: -kv[1].count)


def _cli() -> int:
    """عرض الذاكرة وإدارتها:  python memory.py [--forget KEY | --clear]"""
    import sys

    memory = Memory().load()
    args = sys.argv[1:]

    if args and args[0] == "--clear":
        print(f"حُذفت {memory.clear()} مدخلة. عادت الأداة تسأل عن كل شيء.")
        return 0

    if len(args) >= 2 and args[0] == "--forget":
        key = " ".join(args[1:])
        print("حُذفت المدخلة." if memory.forget(key) else "لا توجد مدخلة بهذا المفتاح.")
        return 0

    rows = memory.rows()
    if not rows:
        print("الذاكرة فارغة — لم تعلّم الأداة أيّ قرار بعد.")
        return 0

    print("=" * 78)
    print(f"  قرارات محفوظة: {len(rows)}")
    print("=" * 78)
    for key, entry in rows:
        mark = "✅ يُقبل دائماً" if entry.verdict == "approve" else "⛔ يُرفض دائماً"
        print(f"\n{mark}   (طُبّق {entry.count} مرة)")
        print(f"  الأمر    : {key}")
        print(f"  التصنيف  : {entry.category}")
        print(f"  الشرح    : {entry.intent}")
    print("\n" + "=" * 78)
    print("لحذف مدخلة:  python memory.py --forget \"bash|npm run seed\"")
    print("لمسح الكل :  python memory.py --clear")
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())
