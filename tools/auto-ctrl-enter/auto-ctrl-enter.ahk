; ================================================================
;  أداة تكرار Ctrl+Enter كل 3 ثوانٍ  —  AutoHotkey v2
;  لا تحتاج بايثون. ثبّت AutoHotkey v2 من autohotkey.com ثم
;  انقر نقراً مزدوجاً على هذا الملف.
;
;  تشغيل / إيقاف مؤقّت :  Ctrl+Alt+S     (أو F8)
;  إنهاء الأداة        :  Ctrl+Alt+Q     (أو F9)
;
;  ملاحظة: في كثير من اللابتوبات تكون مفاتيح F مخصّصة لوظائف
;  الجهاز (وضع الطيران، الصوت...)، لذلك استخدم Ctrl+Alt+S
;  و Ctrl+Alt+Q فهي تعمل دائماً.
; ================================================================

#Requires AutoHotkey v2.0
#SingleInstance Force

; ---- الإعدادات ----
global IntervalMs := 3000       ; الفاصل الزمني بالمللي ثانية (3000 = 3 ثوانٍ)
global Combo      := "^{Enter}" ; ^ = Ctrl ، ! = Alt ، + = Shift ، # = Win
; -------------------

global Running := false
global SentCount := 0

Notify("جاهز — Ctrl+Alt+S للبدء | Ctrl+Alt+Q للإنهاء", 4000)

; --- اختصارات التشغيل/الإيقاف ---
^!s::ToggleRun()
F8::ToggleRun()

; --- اختصارات الإنهاء ---
^!q::QuitApp()
F9::QuitApp()

ToggleRun() {
    global Running, IntervalMs, SentCount
    Running := !Running
    if (Running) {
        SetTimer(SendCombo, IntervalMs)
        Notify("يعمل ▶  كل " . (IntervalMs / 1000) . " ثانية", 1500)
    } else {
        SetTimer(SendCombo, 0)
        Notify("متوقّف ⏸  (" . SentCount . " ضغطة) — Ctrl+Alt+S للاستئناف", 2000)
    }
}

QuitApp() {
    global SentCount
    SetTimer(SendCombo, 0)
    Notify("إنهاء — إجمالي الضغطات: " . SentCount, 1200)
    Sleep(1200)
    ExitApp()
}

SendCombo() {
    global Combo, SentCount
    SentCount += 1
    Send(Combo)
}

Notify(text, durationMs) {
    ToolTip(text)
    SetTimer(() => ToolTip(), -durationMs)
}
