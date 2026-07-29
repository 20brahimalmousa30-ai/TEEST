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

/** تحويل الأرقام العربيّة (٠-٩) إلى الأرقام الإنجليزيّة (0-9).
 *  يُستخدم في حقول الإدخال (رقم الجوّال، رقم الهوية) لضمان عدم قَبول الأرقام العربيّة. */
export const arabicToEnglishNumerals = (text: string): string => {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  let result = text;
  for (let i = 0; i < arabicDigits.length; i++) {
    result = result.replaceAll(arabicDigits[i], englishDigits[i]);
  }
  return result;
};
