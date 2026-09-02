; ================================================================
;  أداة تكرار Ctrl+Enter كل 3 ثوانٍ  —  AutoHotkey v2
;  لا تحتاج بايثون. حمّل AutoHotkey v2 من autohotkey.com ثم
;  انقر نقراً مزدوجاً على هذا الملف.
;
;  F8 = تشغيل / إيقاف مؤقّت
;  F9 = إنهاء الأداة
; ================================================================

#Requires AutoHotkey v2.0
#SingleInstance Force

; ---- الإعدادات ----
global IntervalMs := 3000       ; الفاصل الزمني بالمللي ثانية (3000 = 3 ثوانٍ)
global Combo      := "^{Enter}" ; ^ = Ctrl ، ! = Alt ، + = Shift ، # = Win
; -------------------

global Running := false
global SentCount := 0

Notify("جاهز — اضغط F8 للبدء، F9 للإنهاء", 2500)

F8:: {
    global Running, IntervalMs
    Running := !Running
    if (Running) {
        SetTimer(SendCombo, IntervalMs)
        Notify("يعمل ▶  كل " . (IntervalMs / 1000) . " ثانية", 1500)
    } else {
        SetTimer(SendCombo, 0)
        Notify("متوقّف ⏸  (F8 للاستئناف)", 1500)
    }
}

F9:: {
    global SentCount
    Notify("إنهاء — إجمالي الضغطات: " . SentCount, 1000)
    Sleep(1000)
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
