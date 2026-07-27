import type { Supervisor } from "./types";

export const supervisors: Supervisor[] = [
  { id: "s1",  name: "أحمد الشهري",         nationalIdMasked: "••••••1234", phone: "0555 012 340", email: "a.shehri@maali.abha",  teamIds: ["t1"], committeeIds: ["c1"], permissions: [] },
  { id: "s2",  name: "خالد آل مساعد",       nationalIdMasked: "••••••2287", phone: "0555 012 341", email: "k.almusaid@maali.abha", teamIds: ["t2"], committeeIds: [], permissions: [] },
  { id: "s3",  name: "يوسف القحطاني",       nationalIdMasked: "••••••3902", phone: "0555 012 342", email: "y.qahtani@maali.abha",  teamIds: ["t3"], committeeIds: ["c2"], permissions: [] },
  { id: "s4",  name: "نورة الغامدي",        nationalIdMasked: "••••••4451", phone: "0555 012 343", email: "n.ghamdi@maali.abha",   teamIds: ["t4"], committeeIds: ["c3", "c4"], permissions: [] },
  { id: "s5",  name: "فيصل العسيري",        nationalIdMasked: "••••••5588", phone: "0555 012 344", email: "f.asiri@maali.abha",    teamIds: ["t5"], committeeIds: [], permissions: [] },
  { id: "s6",  name: "عبدالله الزهراني",    nationalIdMasked: "••••••6712", phone: "0555 012 345", email: "a.zahrani@maali.abha",  teamIds: ["t6"], committeeIds: ["c5"], permissions: [] },
  { id: "s7",  name: "بندر آل حامد",        nationalIdMasked: "••••••7834", phone: "0555 012 346", email: "b.alhamid@maali.abha",  teamIds: ["t7"], committeeIds: [], permissions: [] },
  { id: "s8",  name: "سعد آل مانع",         nationalIdMasked: "••••••8901", phone: "0555 012 347", email: "s.almane@maali.abha",   teamIds: ["t8"], committeeIds: ["c6"], permissions: [] },
  { id: "s9",  name: "محمد آل حمّاد",       nationalIdMasked: "••••••9034", phone: "0555 012 348", email: "m.alhamad@maali.abha",  teamIds: ["t9"], committeeIds: [], permissions: [] },
  { id: "s10", name: "ريّان الحربي",        nationalIdMasked: "••••••1023", phone: "0555 012 349", email: "r.harbi@maali.abha",    teamIds: ["t10"], committeeIds: ["c1", "c7"], permissions: [] },
  { id: "s11", name: "طلال العجمي",         nationalIdMasked: "••••••2145", phone: "0555 012 350", email: "t.ajmi@maali.abha",     teamIds: ["t11"], committeeIds: [], permissions: [] },
  { id: "s12", name: "رائد الشمراني",        nationalIdMasked: "••••••3267", phone: "0555 012 351", email: "r.shamrani@maali.abha", teamIds: ["t12"], committeeIds: ["c2"], permissions: [] },
  { id: "s13", name: "سارة الفيفي",          nationalIdMasked: "••••••4390", phone: "0555 012 352", email: "s.fifi@maali.abha",     teamIds: [],       committeeIds: ["c3"], permissions: [] },
  { id: "s14", name: "عمر آل بازع",          nationalIdMasked: "••••••5501", phone: "0555 012 353", email: "o.baze@maali.abha",     teamIds: [],       committeeIds: ["c4", "c5"], permissions: [] },
];

export const getSupervisor = (id: string) => supervisors.find(s => s.id === id);
