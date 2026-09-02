#!/usr/bin/env python3
"""أداة تكرار ضغطة Ctrl+Enter كل عدد محدد من الثواني.

التشغيل:
    pip install pynput
    python auto_ctrl_enter.py            # كل 3 ثوانٍ (الوضع الافتراضي)
    python auto_ctrl_enter.py -i 1.5     # كل ثانية ونصف
    python auto_ctrl_enter.py -n 20      # 20 ضغطة ثم يتوقف
    python auto_ctrl_enter.py -k alt+s   # اختصار آخر بدل Ctrl+Enter

أثناء العمل:
    Ctrl+Alt+S   تشغيل / إيقاف مؤقّت   (أو F8)
    Ctrl+Alt+Q   إنهاء الأداة           (أو F9 أو Ctrl+C)

ملاحظة: في كثير من اللابتوبات تكون مفاتيح F مخصّصة لوظائف الجهاز
(وضع الطيران، الصوت...)، لذلك استخدم Ctrl+Alt+S و Ctrl+Alt+Q.
"""

from __future__ import annotations

import argparse
import sys
import threading
import time

try:
    from pynput import keyboard
except ImportError:  # pragma: no cover - رسالة إرشادية فقط
    sys.exit(
        "الحزمة pynput غير مثبّتة.\n"
        "ثبّتها بالأمر:  pip install pynput"
    )


# أسماء المُعدِّلات المدعومة -> مفتاح pynput المقابل
MODIFIERS = {
    "ctrl": keyboard.Key.ctrl,
    "control": keyboard.Key.ctrl,
    "alt": keyboard.Key.alt,
    "shift": keyboard.Key.shift,
    "win": keyboard.Key.cmd,
    "cmd": keyboard.Key.cmd,
    "super": keyboard.Key.cmd,
}

# أسماء المفاتيح الخاصة (غير الحرفية)
SPECIAL_KEYS = {
    "enter": keyboard.Key.enter,
    "return": keyboard.Key.enter,
    "tab": keyboard.Key.tab,
    "space": keyboard.Key.space,
    "esc": keyboard.Key.esc,
    "escape": keyboard.Key.esc,
    "backspace": keyboard.Key.backspace,
    "delete": keyboard.Key.delete,
    "up": keyboard.Key.up,
    "down": keyboard.Key.down,
    "left": keyboard.Key.left,
    "right": keyboard.Key.right,
    "home": keyboard.Key.home,
    "end": keyboard.Key.end,
    "pageup": keyboard.Key.page_up,
    "pagedown": keyboard.Key.page_down,
}
SPECIAL_KEYS.update({f"f{i}": getattr(keyboard.Key, f"f{i}") for i in range(1, 13)})

# مجموعات تُستخدم لتتبّع المُعدِّلات المضغوطة أثناء رصد اختصارات التحكّم
CTRL_KEYS = {keyboard.Key.ctrl, keyboard.Key.ctrl_l, keyboard.Key.ctrl_r}
ALT_KEYS = {
    keyboard.Key.alt,
    keyboard.Key.alt_l,
    keyboard.Key.alt_r,
    getattr(keyboard.Key, "alt_gr", keyboard.Key.alt),
}


def is_letter(key, letter: str) -> bool:
    """هل المفتاح المضغوط هو الحرف المطلوب؟ يتعامل مع حالة الضغط مع Ctrl."""
    char = getattr(key, "char", None)
    if char:
        if char.lower() == letter:
            return True
        # Ctrl+حرف يُنتج حرف تحكّم (مثل \x13 لـ Ctrl+S)
        if len(char) == 1 and ord(char) == ord(letter) - 96:
            return True
    vk = getattr(key, "vk", None)
    return vk is not None and vk == ord(letter.upper())


def parse_combo(combo: str) -> tuple[list, object]:
    """يحوّل نصاً مثل 'ctrl+enter' إلى (قائمة المُعدِّلات، المفتاح الأساسي)."""
    parts = [p.strip().lower() for p in combo.split("+") if p.strip()]
    if not parts:
        raise ValueError("الاختصار فارغ")

    *mod_names, main_name = parts
    mods = []
    for name in mod_names:
        if name not in MODIFIERS:
            raise ValueError(f"مُعدِّل غير معروف: {name}")
        mods.append(MODIFIERS[name])

    if main_name in SPECIAL_KEYS:
        main = SPECIAL_KEYS[main_name]
    elif len(main_name) == 1:
        main = main_name
    else:
        raise ValueError(f"مفتاح غير معروف: {main_name}")

    return mods, main


class AutoPresser:
    def __init__(self, combo: str, interval: float, count: int) -> None:
        self.mods, self.main = parse_combo(combo)
        self.combo_label = combo
        self.interval = interval
        self.count = count  # 0 = بلا حدّ

        self._controller = keyboard.Controller()
        self._running = threading.Event()   # هل الضغط التلقائي مفعَّل؟
        self._stopped = threading.Event()   # هل طُلب الإنهاء؟
        self._sent = 0

    # ------------------------------------------------------------------ الضغط
    def press_once(self) -> None:
        for mod in self.mods:
            self._controller.press(mod)
        try:
            self._controller.press(self.main)
            self._controller.release(self.main)
        finally:
            for mod in reversed(self.mods):
                self._controller.release(mod)

    def _loop(self) -> None:
        while not self._stopped.is_set():
            # ننتظر التفعيل، مع فحص دوري لطلب الإنهاء
            if not self._running.wait(timeout=0.2):
                continue

            self.press_once()
            self._sent += 1
            print(f"  ↳ [{self._sent}] أُرسل {self.combo_label}", flush=True)

            if self.count and self._sent >= self.count:
                print(f"\nاكتمل العدد المطلوب ({self.count}). إنهاء.")
                self.stop()
                return

            # تقسيم الانتظار حتى تبقى الاستجابة لـ F8/F9 فورية
            waited = 0.0
            step = 0.05
            while waited < self.interval and not self._stopped.is_set():
                if not self._running.is_set():
                    break
                time.sleep(step)
                waited += step

    # --------------------------------------------------------------- التحكّم
    def toggle(self) -> None:
        if self._running.is_set():
            self._running.clear()
            print("\n[متوقّف مؤقتاً] اضغط Ctrl+Alt+S للاستئناف.", flush=True)
        else:
            self._running.set()
            print("\n[يعمل] Ctrl+Alt+S = إيقاف مؤقّت | Ctrl+Alt+Q = إنهاء.", flush=True)

    def stop(self) -> None:
        self._running.clear()
        self._stopped.set()

    @property
    def stopped(self) -> bool:
        return self._stopped.is_set()

    def run(self, start_now: bool, countdown: float) -> None:
        worker = threading.Thread(target=self._loop, daemon=True)
        worker.start()

        held = set()

        def on_press(key):
            if key in CTRL_KEYS or key in ALT_KEYS:
                held.add(key)
                return None

            ctrl = bool(held & CTRL_KEYS)
            alt = bool(held & ALT_KEYS)

            if key == keyboard.Key.f8 or (ctrl and alt and is_letter(key, "s")):
                self.toggle()
            elif key == keyboard.Key.f9 or (ctrl and alt and is_letter(key, "q")):
                print("\nإنهاء بطلب المستخدم.")
                self.stop()
                return False  # أوقِف المستمع
            return None

        def on_release(key):
            held.discard(key)
            return None

        listener = keyboard.Listener(on_press=on_press, on_release=on_release)
        listener.start()

        if start_now:
            for remaining in range(int(countdown), 0, -1):
                print(f"البدء خلال {remaining}... (انتقل الآن إلى النافذة الهدف)", flush=True)
                time.sleep(1)
            self.toggle()
        else:
            print("جاهز. اضغط Ctrl+Alt+S للبدء.", flush=True)

        try:
            while not self.stopped:
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("\nإنهاء (Ctrl+C).")
            self.stop()
        finally:
            listener.stop()
            worker.join(timeout=1)
            print(f"إجمالي الضغطات المُرسلة: {self._sent}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="تكرار ضغطة اختصار لوحة المفاتيح (افتراضياً Ctrl+Enter) كل عدد من الثواني.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="أثناء التشغيل:  Ctrl+Alt+S = تشغيل/إيقاف مؤقّت   |   Ctrl+Alt+Q = إنهاء",
    )
    parser.add_argument("-i", "--interval", type=float, default=3.0,
                        help="الفاصل الزمني بالثواني (الافتراضي: 3)")
    parser.add_argument("-k", "--keys", default="ctrl+enter",
                        help="الاختصار المطلوب، مثل: ctrl+enter أو alt+s (الافتراضي: ctrl+enter)")
    parser.add_argument("-n", "--count", type=int, default=0,
                        help="عدد الضغطات ثم التوقف تلقائياً (0 = بلا حدّ، وهو الافتراضي)")
    parser.add_argument("-d", "--delay", type=float, default=3.0,
                        help="مهلة العدّ التنازلي قبل البدء بالثواني (الافتراضي: 3)")
    parser.add_argument("--wait", action="store_true",
                        help="لا تبدأ تلقائياً؛ انتظر ضغط Ctrl+Alt+S")
    args = parser.parse_args()

    if args.interval <= 0:
        parser.error("--interval يجب أن يكون أكبر من صفر")
    if args.count < 0:
        parser.error("--count لا يمكن أن يكون سالباً")

    try:
        presser = AutoPresser(args.keys, args.interval, args.count)
    except ValueError as exc:
        parser.error(str(exc))
        return 2

    print("=" * 52)
    print("  أداة التكرار التلقائي للاختصار")
    print("=" * 52)
    print(f"  الاختصار      : {args.keys}")
    print(f"  كل            : {args.interval} ثانية")
    print(f"  عدد الضغطات   : {'بلا حدّ' if not args.count else args.count}")
    print("  Ctrl+Alt+S = تشغيل/إيقاف مؤقّت   |   Ctrl+Alt+Q = إنهاء")
    print("  (يعمل أيضاً F8 و F9 إن لم تكن محجوزة لوظائف اللابتوب)")
    print("=" * 52)

    presser.run(start_now=not args.wait, countdown=args.delay)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
