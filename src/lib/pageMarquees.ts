/**
 * خلفيّةٌ تحفيزيّة متحرّكة لكلّ صفحة.
 *
 * الأمير يتحكّم — لكلّ صفحة — بمجموعة الجُمل المعروضة، ونمط حركتها، وتفعيلها،
 * من صفحة «إعدادات الموقع». تُخزَّن الإعدادات كخريطة JSON في app_settings.page_marquees.
 */

export type MarqueeStyle = "slide" | "float" | "fade";

export type PageMarquee = {
  phrases: string[];
  style: MarqueeStyle;
  enabled: boolean;
};

export type PageMarqueeMap = Record<string, PageMarquee>;

/** أنماط الحركة المتاحة للأمير، مع وصفٍ عربيّ. */
export const MARQUEE_STYLES: { value: MarqueeStyle; label: string; hint: string }[] = [
  { value: "slide", label: "أشرطة منزلقة",  hint: "جُملٌ تنزلق أفقياً عبر الشاشة في عدّة صفوف." },
  { value: "float", label: "كلماتٌ تطفو",   hint: "جُملٌ تصعد ببطءٍ وتتلاشى — تأثيرٌ أنعم." },
  { value: "fade",  label: "نصٌّ كبيرٌ باهت", hint: "جملةٌ واحدة كبيرة تتبدّل كلّ بضع ثوانٍ دون انزلاق." },
];

/**
 * سجلّ الصفحات: المفتاح ثابتٌ (لا يتغيّر)، والعنوان عربيّ للعرض،
 * والمُطابِق يحدّد أيّ مسارٍ ينتمي لهذه الصفحة. الترتيب مهمّ: الأخصّ أوّلاً.
 */
export const MARQUEE_PAGES: { key: string; label: string; test: (p: string) => boolean }[] = [
  { key: "login",        label: "صفحة الدخول",        test: p => p.startsWith("/login") },
  { key: "register",     label: "صفحة التسجيل",       test: p => p.startsWith("/register") },
  { key: "dashboard",    label: "لوحة الأمير",         test: p => p.startsWith("/dashboard") },
  { key: "teams",        label: "الفرق",              test: p => p.startsWith("/teams") },
  { key: "leaderboard",  label: "المتصدّرون",          test: p => p.startsWith("/leaderboard") },
  { key: "students",     label: "الشباب",             test: p => p.startsWith("/students") },
  { key: "supervisors",  label: "المشرفون",           test: p => p.startsWith("/supervisors") },
  { key: "committees",   label: "اللجان",             test: p => p.startsWith("/committees") },
  { key: "invoices",     label: "الفواتير",           test: p => p.startsWith("/invoices") },
  { key: "my-team",      label: "فريقي (المشرف)",     test: p => p.startsWith("/my-team") },
  { key: "my-committee", label: "لجنتي (المشرف)",     test: p => p.startsWith("/my-committee") },
  { key: "me",           label: "صفحتي (الشاب)",      test: p => p.startsWith("/me") },
  { key: "settings",     label: "الإعدادات",          test: p => p.startsWith("/settings") },
  { key: "home",         label: "الصفحة الرئيسة",      test: p => p === "/" },
];

/** يُعيد مفتاح الصفحة المطابق للمسار، أو null إن لم تُدرَج الصفحة. */
export function pageKeyFor(pathname: string): string | null {
  return MARQUEE_PAGES.find(pg => pg.test(pathname))?.key ?? null;
}

/** جُملٌ افتراضيّة تظهر قبل أن يخصّصها الأمير. */
export const DEFAULT_MARQUEE_PHRASES = [
  "من رَامَ المعالي سَهِرَ الليالي",
  "الجبالُ العاليةُ تُصعَد بخطواتٍ صادقة",
  "لك في القمم موعد",
  "رحلةُ العمر تبدأ من هنا",
];

/** الإعداد الافتراضيّ لأيّ صفحةٍ لم يخصّصها الأمير بعد. */
export function defaultMarquee(): PageMarquee {
  return { phrases: DEFAULT_MARQUEE_PHRASES, style: "slide", enabled: true };
}

/** يدمج الإعداد المخزَّن للصفحة مع الافتراضيّ، مع تنظيفٍ آمن للقيم. */
export function resolveMarquee(map: PageMarqueeMap, key: string | null): PageMarquee {
  const base = defaultMarquee();
  if (!key) return base;
  const stored = map[key];
  if (!stored) return base;
  const phrases = Array.isArray(stored.phrases)
    ? stored.phrases.map(s => String(s).trim()).filter(Boolean)
    : base.phrases;
  const style: MarqueeStyle = ["slide", "float", "fade"].includes(stored.style) ? stored.style : base.style;
  const enabled = typeof stored.enabled === "boolean" ? stored.enabled : base.enabled;
  return { phrases, style, enabled };
}
