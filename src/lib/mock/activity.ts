export type Activity = {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  kind: "add" | "edit" | "remove" | "pay" | "auth" | "note";
};

export const activity: Activity[] = [
  { id: "a1",  time: "قبل ٧ دقائق",   actor: "نائب الأمير",            action: "أضاف فاتورة",         target: "شركة العالميّة للنقل — 34,500 ر.س",  kind: "add"  },
  { id: "a2",  time: "قبل ٢٢ دقيقة",  actor: "المشرف: نورة الغامدي",    action: "سجّلت حضور",           target: "٤١ طالبةً من فريق رَواسي",          kind: "add"  },
  { id: "a3",  time: "قبل ساعة",       actor: "الأمير الأصل",           action: "اعتمد سداداً",         target: "فريق المرتفعات — دفعة نهائيّة",     kind: "pay"  },
  { id: "a4",  time: "قبل ساعتين",    actor: "المشرف: أحمد الشهري",     action: "أضاف طلاباً",         target: "٣ طلابٍ إلى فريق المرتفعات",         kind: "add"  },
  { id: "a5",  time: "قبل ٣ ساعات",   actor: "نائب الأمير",            action: "عدّل حقلاً في نموذج التسجيل", target: "حقل «الحالة الصحيّة»",         kind: "edit" },
  { id: "a6",  time: "قبل ٤ ساعات",   actor: "المشرف: خالد آل مساعد",   action: "أرسل رسالة واتساب",   target: "لأولياء أمور فريق السَّرَاة",         kind: "note" },
  { id: "a7",  time: "الأمس ٢١:٠٤",   actor: "الأمير الأصل",           action: "أزال مشرفاً",          target: "خرج المشرف: عزيز الفيفي",           kind: "remove" },
  { id: "a8",  time: "الأمس ١٩:٤٧",   actor: "النظام",                action: "استخرج بيانات فاتورة بالذكاء الاصطناعي", target: "INV-1448-015 — تلقائيّاً", kind: "add" },
];
