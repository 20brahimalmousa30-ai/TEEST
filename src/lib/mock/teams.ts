import type { Team } from "./types";

export const teams: Team[] = [
  { id: "t1",  name: "المرتفعات",     badge: "M", color: "#1E4635", supervisorId: "s1",  studentCount: 40, points: 385, tagline: "أعلى فريقٍ بفارقٍ مريح — ثباتٌ لأربعة أيّامٍ متتالية." },
  { id: "t2",  name: "السَّرَاة",     badge: "S", color: "#6B7A3E", supervisorId: "s2",  studentCount: 42, points: 342, tagline: "ثالثُ ثلاثةِ أيّامٍ في المركز الثاني." },
  { id: "t3",  name: "أعالي عَسير",   badge: "A", color: "#8C5A3C", supervisorId: "s3",  studentCount: 39, points: 310, tagline: "+٢٢ نقطةً منذ الأمس — قفزةٌ لافتة." },
  { id: "t4",  name: "رَواسي",        badge: "R", color: "#4E6B7A", supervisorId: "s4",  studentCount: 41, points: 298, tagline: "الفريق النسائي — أعلى نسبة حضور." },
  { id: "t5",  name: "الطلال",        badge: "T", color: "#7A5B2E", supervisorId: "s5",  studentCount: 38, points: 276, tagline: "الأقوى في المسابقة الحرفيّة." },
  { id: "t6",  name: "الشُّعف",       badge: "SH", color: "#3F5B4E", supervisorId: "s6",  studentCount: 40, points: 268, tagline: "بدأ متأخّراً وارتفع في الأيّام الثلاثة الأخيرة." },
  { id: "t7",  name: "النَّجد",       badge: "N", color: "#5A4A7A", supervisorId: "s7",  studentCount: 37, points: 254, tagline: "تفوّقٌ ملحوظٌ في المسابقات الحواريّة." },
  { id: "t8",  name: "الأخاديد",     badge: "AK", color: "#6B4A3E", supervisorId: "s8",  studentCount: 40, points: 240, tagline: "ثباتٌ في المنتصف — استقرارٌ بلا مفاجآت." },
  { id: "t9",  name: "الأودية",      badge: "AW", color: "#2E5A5A", supervisorId: "s9",  studentCount: 36, points: 231, tagline: "الفريق الفتيّ — أصغر أعضاء الرحلة." },
  { id: "t10", name: "الجبال الشاهقة", badge: "JS", color: "#4A6B2E", supervisorId: "s10", studentCount: 42, points: 220, tagline: "الأكثر تنوّعاً — يجمع طلّاباً من ست مدن." },
  { id: "t11", name: "المرتقى",       badge: "MQ", color: "#7A4A5A", supervisorId: "s11", studentCount: 38, points: 208, tagline: "استعادةٌ بطيئةٌ بعد بدايةٍ متعثّرة." },
  { id: "t12", name: "الذُّرى",        badge: "Z", color: "#5A6B3E", supervisorId: "s12", studentCount: 41, points: 195, tagline: "الأدنى في الترتيب — لكنّ الفارق يتقلّص." },
];

export const getTeam = (id: string) => teams.find(t => t.id === id);
