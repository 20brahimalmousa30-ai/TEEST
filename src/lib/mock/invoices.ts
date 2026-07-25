import type { Invoice } from "./types";

export const invoices: Invoice[] = [
  { id: "inv001", code: "INV-1448-001", vendor: "مطاعم الكرم للحفلات",     purpose: "وجبات الإفطار — اليوم الأوّل", scope: { kind: "committee", committeeId: "c3" }, amount: 12800, vat: 15, date: "1448-07-21", status: "paid",    extractedByAI: true  },
  { id: "inv002", code: "INV-1448-002", vendor: "شركة العالميّة للنقل",     purpose: "نقلٌ من الرياض إلى أبها",       scope: { kind: "event" },                        amount: 34500, vat: 15, date: "1448-07-21", status: "paid",    extractedByAI: true  },
  { id: "inv003", code: "INV-1448-003", vendor: "مؤسّسة الأفق للطباعة",      purpose: "طباعة كتيّبات البرنامج",         scope: { kind: "event" },                        amount:  4200, vat: 15, date: "1448-07-21", status: "paid",    extractedByAI: false },
  { id: "inv004", code: "INV-1448-004", vendor: "متجر النَّجم للهدايا",       purpose: "هدايا فريق المرتفعات",           scope: { kind: "team", teamId: "t1" },           amount:  3600, vat: 15, date: "1448-07-22", status: "paid",    extractedByAI: true  },
  { id: "inv005", code: "INV-1448-005", vendor: "مطاعم الكرم للحفلات",      purpose: "وجبات العشاء — اليوم الثاني",   scope: { kind: "committee", committeeId: "c3" }, amount: 11400, vat: 15, date: "1448-07-22", status: "paid",    extractedByAI: true  },
  { id: "inv006", code: "INV-1448-006", vendor: "أدوات الحاجة الرياضيّة",    purpose: "معدّات مسابقة الرماية",           scope: { kind: "committee", committeeId: "c5" }, amount:  8900, vat: 15, date: "1448-07-22", status: "pending", extractedByAI: false },
  { id: "inv007", code: "INV-1448-007", vendor: "شركة سلامة الطبيّة",        purpose: "مستلزمات الإسعافات الأوّليّة",    scope: { kind: "committee", committeeId: "c1" }, amount:  6250, vat: 15, date: "1448-07-23", status: "paid",    extractedByAI: true  },
  { id: "inv008", code: "INV-1448-008", vendor: "استوديو أفق للتصوير",       purpose: "تصوير اليومين الأوّلَين",         scope: { kind: "committee", committeeId: "c6" }, amount:  4800, vat: 15, date: "1448-07-23", status: "paid",    extractedByAI: true  },
  { id: "inv009", code: "INV-1448-009", vendor: "منظّم الفعاليّات المتقدّم", purpose: "إعداد قاعة الفعاليّة الختاميّة",   scope: { kind: "event" },                        amount: 18700, vat: 15, date: "1448-07-24", status: "pending", extractedByAI: false },
  { id: "inv010", code: "INV-1448-010", vendor: "شركة العالميّة للنقل",      purpose: "نقلٌ للجولة الميدانيّة (جبل السودة)", scope: { kind: "committee", committeeId: "c4" }, amount:  9600, vat: 15, date: "1448-07-24", status: "paid",    extractedByAI: true  },
  { id: "inv011", code: "INV-1448-011", vendor: "مطبعة الشرق للأوسط",       purpose: "شهادات المشاركة",                scope: { kind: "committee", committeeId: "c2" }, amount:  2900, vat: 15, date: "1448-07-24", status: "paid",    extractedByAI: true  },
  { id: "inv012", code: "INV-1448-012", vendor: "متجر النَّجم للهدايا",       purpose: "جوائز المسابقة الحواريّة",         scope: { kind: "team", teamId: "t7" },           amount:  2450, vat: 15, date: "1448-07-24", status: "pending", extractedByAI: true  },
  { id: "inv013", code: "INV-1448-013", vendor: "مقهى السَّرَاة الشعبيّ",       purpose: "الاستراحة المسائيّة — اليوم الثالث", scope: { kind: "team", teamId: "t2" },           amount:  1800, vat: 15, date: "1448-07-23", status: "overdue", extractedByAI: false },
  { id: "inv014", code: "INV-1448-014", vendor: "شركة الأمنيّة للحراسة",     purpose: "حراسةٌ مسائيّة (٤ أيّام)",         scope: { kind: "event" },                        amount:  7200, vat: 15, date: "1448-07-24", status: "pending", extractedByAI: false },
  { id: "inv015", code: "INV-1448-015", vendor: "مطاعم الكرم للحفلات",      purpose: "وجبات الغداء — اليوم الرابع",   scope: { kind: "committee", committeeId: "c3" }, amount: 13200, vat: 15, date: "1448-07-24", status: "paid",    extractedByAI: true  },
];

export const getInvoice = (id: string) => invoices.find(i => i.id === id);
export const invoiceSummary = {
  total: invoices.reduce((s, i) => s + i.amount, 0),
  paid: invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0),
  pending: invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.amount, 0),
  overdue: invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0),
  count: invoices.length,
  aiExtracted: invoices.filter(i => i.extractedByAI).length,
};
