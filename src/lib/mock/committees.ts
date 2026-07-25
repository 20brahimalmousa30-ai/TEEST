import type { Committee } from "./types";

export const committees: Committee[] = [
  { id: "c1", name: "لجنة السلامة",       supervisorIds: ["s1", "s10"],       color: "#B54A2E", description: "خطط الإخلاء، الإسعافات الأوّليّة، الطوارئ الميدانيّة." },
  { id: "c2", name: "اللجنة العلميّة",     supervisorIds: ["s3", "s12"],        color: "#1E4635", description: "المحاضرات، الحلقات، البرنامج البنائيّ، وشهادات الإنجاز." },
  { id: "c3", name: "لجنة التغذية",        supervisorIds: ["s4", "s13"],        color: "#5F8A5C", description: "الوجبات، جدول الإفطار والغداء والعشاء، والاحتياجات الغذائيّة الخاصّة." },
  { id: "c4", name: "لجنة النقل",          supervisorIds: ["s4", "s14"],        color: "#4E6B7A", description: "الباصات، جدول الرحلات، التنقّلات الميدانيّة." },
  { id: "c5", name: "لجنة الترفيه",        supervisorIds: ["s6", "s14"],        color: "#B8955A", description: "المسابقات، الأنشطة المسائيّة، والفعاليّات الترفيهيّة." },
  { id: "c6", name: "اللجنة الإعلاميّة",   supervisorIds: ["s8"],               color: "#7A5B2E", description: "التصوير، وسائل التواصل، وإصدار النشرات اليوميّة." },
  { id: "c7", name: "لجنة الاستقبال",      supervisorIds: ["s10"],              color: "#8C5A3C", description: "تسجيل الوصول، توزيع البطاقات، وبطاقات الحضور." },
];

export const getCommittee = (id: string) => committees.find(c => c.id === id);
