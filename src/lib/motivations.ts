/**
 * Shared motivational copy.
 *
 * `motivations` — full sentences shown on the "قيد المراجعة" (waiting-list) screen
 * after a youth submits the registration form. Reused as the source for the
 * animated marquee bars on the registration form itself, to avoid duplicating copy.
 *
 * `tickerPhrases` — short punchy lines tuned for the horizontally-scrolling
 * background bars (Marquee/Ticker) behind the form.
 */
export const motivations = [
  "أهلاً بك بين الطامحين — طلبُك في طريقه.",
  "الجبال العالية تُصعَد بخطواتٍ صادقة. لقد بدأت خطوتك الأولى.",
  "محافظة بلّسمر تنتظرُ من يرسمُ فيها حكاية. حكايتُك قيد المراجعة.",
  "من رَامَ المعالي سَهِرَ الليالي — سنراجع طلبك بعناية.",
  "لن يطول انتظارك — ما ينتظرك أجملُ من الترقّب.",
  "شكراً لثقتك بمعالي. الأمير سيراجع طلبك قريباً.",
  "الرحلة تبدأ بنيّة، ونيّتك واضحة.",
  "لك في القمم موعد — سنراك هناك بإذن الله.",
];

export const tickerPhrases = [
  "رحلةُ العمر تبدأ من هنا",
  "انضم لإخوةٍ يكبرون معك",
  "معالي محافظة بلّسمر ١٤٤٨هـ بانتظارك",
  "من رَامَ المعالي سَهِرَ الليالي",
  "مرتفعاتُ عَسير تُنادي الطامحين",
  "لك في القمم موعد",
];

/**
 * نصّ مربّع «ما التالي؟» الذي يظهر بعد إرسال طلب التسجيل.
 * يُحرّره الأمير من «إعدادات الموقع»؛ وهذا هو النصُّ الافتراضيّ إن تركه فارغاً.
 * يُعرض محافظاً على فواصل الأسطر (whitespace: pre-line).
 */
export const defaultPostRegisterNote = `١ · يراجع طلبَك الأميرُ أو نائبُه.
٢ · لن يُعتمد قبولُك حتى تُسدِّد رسوم السفرة على حساب الجمعيّة:
رقم الحساب (IBAN): SA4480000585608011476325
البنك: مصرف الراجحي
المبلغ: ٥٠٠ ريال
يُرسَل إيصالُ السداد إلى رئيس القسم.
٣ · عند الاعتماد ستصلك رسالةُ القبول متضمّنةً اسم المستخدم وكلمة المرور.`;
