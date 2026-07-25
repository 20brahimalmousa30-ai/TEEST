import type { Student } from "./types";

const first = ["محمد","أحمد","عبدالله","خالد","فيصل","بندر","سعد","تركي","يوسف","سلطان","فهد","نايف","ماجد","راشد","عمر","زياد","حمود","سالم","صالح","ياسر","حسن","علي","معاذ","ثامر","نواف","بدر","حاتم","ريّان","طلال","عبدالرحمن","عبدالعزيز","إبراهيم","حمد","مساعد","مبارك"];
const last  = ["الشهري","الغامدي","العسيري","القحطاني","الزهراني","المالكي","الحربي","العجمي","الشمراني","الفيفي","آل بازع","آل حامد","آل مانع","آل مساعد","الدوسري","الشمري","المطيري","الرشيدي","القرشي","النعمي","العنزي","السبيعي","الجهني","الحازمي","العمري","البقمي","السلمي","الثبيتي","العتيبي","الحبشي"];
const grades   = ["الأول ثانوي","الثاني ثانوي","الثالث ثانوي"];
const sections = ["ريادة","علو","قيادة"] as const;
const paySt    = ["PENDING","PARTIAL","PAID"] as const;

// Deterministic pseudo-random so pages don't flip on every render
function hash(str: string) { let h = 5381; for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i); return Math.abs(h); }

function build(): Student[] {
  const teamIds = Array.from({ length: 12 }, (_, i) => `t${i + 1}`);
  const list: Student[] = [];
  let idx = 1;
  for (const tid of teamIds) {
    const perTeam = 34 + (hash(tid) % 8); // 34–41 students
    for (let i = 0; i < perTeam; i++) {
      const seed = hash(`${tid}-${i}`);
      const fname = first[seed % first.length];
      const lname = last[(seed >> 3) % last.length];
      const pay   = paySt[seed % 3];
      const paid  = pay === "PAID" ? 2500 : pay === "PARTIAL" ? 1500 : 0;
      list.push({
        id: `st${idx.toString().padStart(3, "0")}`,
        name: `${fname} ${lname}`,
        nationalIdMasked: `••••••${(1000 + (seed % 8999)).toString()}`,
        phone: `0555 ${(100000 + (seed % 899999)).toString().slice(0, 3)} ${(100 + (seed % 899)).toString()}`,
        grade: grades[seed % grades.length],
        section: sections[seed % sections.length],
        teamId: tid,
        paymentStatus: pay,
        paidAmount: paid,
        totalAmount: 2500,
        points: 20 + (seed % 90),
        emergencyContact: `${first[(seed >> 2) % first.length]} ${lname} (والد)`,
        emergencyPhone: `0555 ${(200000 + (seed % 799999)).toString().slice(0, 3)} ${(100 + (seed % 899)).toString()}`,
        attendance: 70 + (seed % 30),
      });
      idx++;
    }
  }
  return list;
}

export const students: Student[] = build();

export const getStudent = (id: string) => students.find(s => s.id === id);
export const getStudentsByTeam = (teamId: string) => students.filter(s => s.teamId === teamId);

export const summary = {
  total: students.length,
  paid: students.filter(s => s.paymentStatus === "PAID").length,
  partial: students.filter(s => s.paymentStatus === "PARTIAL").length,
  pending: students.filter(s => s.paymentStatus === "PENDING").length,
  collected: students.reduce((sum, s) => sum + s.paidAmount, 0),
  target: students.reduce((sum, s) => sum + s.totalAmount, 0),
};
