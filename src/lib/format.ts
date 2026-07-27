// البند ٣٧: توحيد نظام الأرقام في الواجهة كلّها.
// جميع الأرقام «البياناتيّة» (المبالغ، الأعداد، النِّسب) تُعرَض بأرقامٍ لاتينيّة
// (0-9) عبر مُنسِّقٍ واحدٍ مشترك، بينما تبقى الأرقام العربيّة-الهنديّة (١٤٤٨…)
// للنصوص الأدبيّة فقط. هذا يمنع تكرار تعريف `sar` في كلّ صفحة.

const latnNumber = new Intl.NumberFormat("ar-SA-u-nu-latn");
const latnDate = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** يُنسِّق مبلغاً/عدداً بأرقامٍ لاتينيّة (0-9). */
export const sar = (n: number) => latnNumber.format(n);

/** يُنسِّق تاريخ ISO تاريخاً ميلاديّاً بأرقامٍ لاتينيّة، أو «—» عند غيابه. */
export const arDate = (iso?: string) =>
  iso ? latnDate.format(new Date(iso)) : "—";
