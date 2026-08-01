"use client";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store/StoreProvider";
import type { LogoDisplayMode } from "@/lib/store/StoreProvider";
import { useSession } from "@/lib/auth/session";
import { Logo } from "@/components/Logo";
import { fileToDataUrl, extractBrandColors, type BrandColors } from "@/lib/color";
import {
  MARQUEE_PAGES, MARQUEE_STYLES, resolveMarquee, defaultMarquee,
  type PageMarquee, type MarqueeStyle,
} from "@/lib/pageMarquees";

export default function SiteSettingsPage() {
  useEffect(() => { document.title = "إعدادات الموقع — معالي محافظة بلّسمر"; }, []);
  const {
    logoDisplayMode, setLogoDisplayMode,
    tripMessage, setTripMessage,
    postRegisterNote, setPostRegisterNote,
    logoUrl, logoVersion, brandColors, setLogoUrl, setBrandColors,
    scheduleUrl, scheduleVersion, setScheduleUrl,
  } = useStore();
  const { session } = useSession();
  const canControlLogo = session?.role === "PRINCE" || session?.role === "DEPUTY_PRINCE";
  // شعارٌ مخصّصٌ مُطبَّق حالياً؟ (معاينةُ الجلسة أو إصدارٌ محفوظٌ في القاعدة)
  const hasCustomLogo = Boolean((logoUrl ?? "").trim()) || logoVersion > 0;

  const [tripDraft, setTripDraft] = useState("");
  const [tripSaved, setTripSaved] = useState(false);
  // يزامن مسوّدة رسالة السفرة مع القيمة القادمة من قاعدة البيانات بعد التحميل.
  useEffect(() => { setTripDraft(tripMessage); }, [tripMessage]);

  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  // يزامن مسوّدة مربّع «ما التالي؟» مع القيمة القادمة من قاعدة البيانات بعد التحميل.
  useEffect(() => { setNoteDraft(postRegisterNote); }, [postRegisterNote]);

  // ── رفع شعارٍ مخصّص واستخراج ألوان الهوية منه ──
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoDraft, setLogoDraft] = useState<string | null>(null);  // معاينة قبل الحفظ
  const [suggested, setSuggested] = useState<BrandColors | null>(null);
  const [logoErr, setLogoErr] = useState("");
  const [logoSaved, setLogoSaved] = useState(false);
  const MAX_LOGO_BYTES = 512 * 1024;

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";                 // يسمح بإعادة اختيار الملفّ نفسه لاحقاً
    if (!file) return;
    const ok = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!ok.includes(file.type)) { setLogoErr("صيغةٌ غير مدعومة — استخدم PNG أو JPG أو SVG أو WebP."); return; }
    if (file.size > MAX_LOGO_BYTES) { setLogoErr("حجم الملفّ يتجاوز ٥١٢ كيلوبايت — اختر صورةً أصغر."); return; }
    setLogoErr(""); setLogoSaved(false);
    try {
      const dataUrl = await fileToDataUrl(file);
      setLogoDraft(dataUrl);
      try { setSuggested(await extractBrandColors(dataUrl)); }
      catch { setSuggested(null); }
    } catch { setLogoErr("تعذّرت قراءة الصورة."); }
  }

  function saveLogo() {
    if (!logoDraft) return;
    setLogoUrl(logoDraft);
    setLogoDraft(null);
    setLogoSaved(true);
  }
  function cancelLogoDraft() { setLogoDraft(null); setSuggested(null); setLogoErr(""); }
  function revertLogo() { setLogoUrl(""); cancelLogoDraft(); setLogoSaved(false); }
  function applyColors() { if (suggested) { setBrandColors(suggested); } }
  function revertColors() { setBrandColors(null); }

  // ── رفع «جدول السفرة» (صورة) بكامل دقّتها — بلا أيّ ضغطٍ أو تصغير ──
  const scheduleInputRef = useRef<HTMLInputElement>(null);
  const [scheduleDraft, setScheduleDraft] = useState<string | null>(null);
  const [scheduleErr, setScheduleErr] = useState("");
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const MAX_SCHEDULE_BYTES = 10 * 1024 * 1024;
  const hasSchedule = Boolean((scheduleUrl ?? "").trim()) || scheduleVersion > 0;
  const currentSchedule = (scheduleUrl ?? "").trim() || (scheduleVersion > 0 ? `/api/schedule?v=${scheduleVersion}` : "");

  async function onPickSchedule(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ok = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!ok.includes(file.type)) { setScheduleErr("صيغةٌ غير مدعومة — استخدم PNG أو JPG أو WebP أو GIF."); return; }
    if (file.size > MAX_SCHEDULE_BYTES) { setScheduleErr("حجم الملفّ يتجاوز ١٠ ميغابايت — اختر صورةً أصغر."); return; }
    setScheduleErr(""); setScheduleSaved(false);
    try { setScheduleDraft(await fileToDataUrl(file)); }
    catch { setScheduleErr("تعذّرت قراءة الصورة."); }
  }
  function saveSchedule() {
    if (!scheduleDraft) return;
    setScheduleUrl(scheduleDraft);
    setScheduleDraft(null);
    setScheduleSaved(true);
  }
  function cancelScheduleDraft() { setScheduleDraft(null); setScheduleErr(""); }
  function removeSchedule() { setScheduleUrl(""); cancelScheduleDraft(); setScheduleSaved(false); }

  if (!canControlLogo) {
    return (
      <div className="page-shell">
        <PageHeader eyebrow="إعدادات الموقع" title="إعدادات الموقع" />
        <Card>
          <p className="text-[13px] text-text-2">هذه الصفحة متاحةٌ للأمير ونائبه فقط.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="هوية الموقع"
        title="إعدادات الموقع"
        subtitle="تحكّمٌ كاملٌ بهوية الموقع — رفع الشعار وتغيير الصور، ألوان الهوية، وضع عرض الشعار، ورسالة السفرة. كلّ تغييرٍ يُحفظ فوراً ويُطبَّق على كامل الموقع."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card title="شعار الموقع (رفع / تغيير الصورة)">
            <p className="mb-4 text-[12.5px] leading-[1.8] text-text-2">
              ارفع صورة شعارٍ جديدة (PNG أو JPG أو SVG أو WebP، بحدٍّ أقصى ٥١٢ كيلوبايت). تُطبَّق فور الحفظ
              على كامل الموقع — الهيدر والصفحة الرئيسة وصفحة الدخول.
            </p>

            <div className="mb-4 flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded border border-line bg-bg-raised">
                {logoDraft
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoDraft} alt="معاينة الشعار الجديد" className="h-full w-full object-contain" />
                  : <Logo size={52} />}
              </div>
              <div className="flex-1">
                <div className="text-[12.5px] text-text-2">
                  {logoDraft ? "معاينةٌ حيّة — لم تُحفظ بعد." : hasCustomLogo ? "شعارٌ مخصّصٌ مُطبَّق حاليّاً." : "الشعار الافتراضي مُطبَّق."}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => logoInputRef.current?.click()}>اختر صورة…</Button>
                  {hasCustomLogo && !logoDraft && <Button variant="outline" onClick={revertLogo}>استعادة الافتراضي</Button>}
                </div>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onPickLogo} className="hidden" />
              </div>
            </div>

            {logoErr && <p className="mb-3 text-[12px] text-critical">{logoErr}</p>}
            {logoSaved && !logoDraft && <p className="mb-3 text-[12px] text-ok">✓ حُفظ الشعار وطُبِّق على كامل الموقع.</p>}

            {logoDraft && (
              <div className="mb-4 flex flex-wrap gap-2">
                <Button onClick={saveLogo}>حفظ الشعار وتطبيقه</Button>
                <Button variant="outline" onClick={cancelLogoDraft}>إلغاء</Button>
              </div>
            )}

            {suggested && (
              <div className="rounded border border-line bg-bg-raised p-3">
                <div className="mb-2 text-[12.5px] font-medium text-text">ألوانٌ مقترحة من الشعار</div>
                <p className="mb-3 text-[11.5px] leading-[1.7] text-text-3">
                  عاينْ تغيير ألوان الهوية (الأزرار والحدود والعناصر البارزة) قبل تطبيقها. لن تُطبَّق إلّا بتأكيدك.
                </p>
                <div className="grid grid-cols-2 gap-3 text-center text-[11px]">
                  <div>
                    <div className="mb-1 text-text-3">قبل</div>
                    <div className="flex justify-center gap-1.5">
                      <span className="h-8 w-8 rounded border border-line" style={{ background: "var(--accent)" }} />
                      <span className="h-8 w-8 rounded border border-line" style={{ background: "var(--accent-warm)" }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-text-3">بعد</div>
                    <div className="flex justify-center gap-1.5">
                      <span className="h-8 w-8 rounded border border-line" style={{ background: suggested.accent }} />
                      <span className="h-8 w-8 rounded border border-line" style={{ background: suggested.accentWarm }} />
                    </div>
                    <div className="num mt-1 text-[10px] text-text-3">{suggested.accent} · {suggested.accentWarm}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={applyColors}>تطبيق الألوان</Button>
                  {brandColors && <Button variant="outline" onClick={revertColors}>استعادة ألوان الثيم</Button>}
                </div>
              </div>
            )}

            {!suggested && brandColors && (
              <div className="rounded border border-line bg-bg-raised p-3">
                <div className="mb-2 flex items-center gap-2 text-[12.5px] text-text-2">
                  <span className="h-4 w-4 rounded" style={{ background: brandColors.accent }} />
                  <span className="h-4 w-4 rounded" style={{ background: brandColors.accentWarm }} />
                  <span>ألوان هويةٍ مخصّصةٌ مُطبَّقة.</span>
                </div>
                <Button variant="outline" onClick={revertColors}>استعادة ألوان الثيم الافتراضيّة</Button>
              </div>
            )}
          </Card>

          <Card title="جدول السفرة (صورة)">
            <p className="mb-4 text-[12.5px] leading-[1.8] text-text-2">
              ارفع صورة جدول السفرة (PNG أو JPG أو WebP أو GIF، بحدٍّ أقصى ١٠ ميغابايت). تُعرض للطلاب
              والمشرفين بكامل دقّتها كما رفعتَها — بلا أيّ ضغطٍ أو تصغير — ويتكيّف الإطار مع مقاسها.
            </p>

            {(scheduleDraft || currentSchedule) && (
              <div className="mb-4 overflow-hidden rounded border border-line bg-bg-raised">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scheduleDraft ?? currentSchedule}
                  alt="معاينة جدول السفرة"
                  className="block w-full"
                  style={{ height: "auto" }}
                />
              </div>
            )}

            <div className="mb-2 text-[12.5px] text-text-2">
              {scheduleDraft ? "معاينةٌ حيّة — لم تُحفظ بعد." : hasSchedule ? "جدولٌ مُطبَّقٌ حاليّاً — يراه الطلاب والمشرفون." : "لا يوجد جدولٌ بعد."}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => scheduleInputRef.current?.click()}>
                {hasSchedule || scheduleDraft ? "تغيير الصورة…" : "اختر صورة…"}
              </Button>
              {scheduleDraft && <Button onClick={saveSchedule}>حفظ الجدول وتطبيقه</Button>}
              {scheduleDraft && <Button variant="outline" onClick={cancelScheduleDraft}>إلغاء</Button>}
              {hasSchedule && !scheduleDraft && <Button variant="outline" onClick={removeSchedule}>حذف الجدول</Button>}
              <input ref={scheduleInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onPickSchedule} className="hidden" />
            </div>

            {scheduleErr && <p className="mt-3 text-[12px] text-critical">{scheduleErr}</p>}
            {scheduleSaved && !scheduleDraft && <p className="mt-3 text-[12px] text-ok">✓ حُفظ الجدول وظهر للطلاب والمشرفين.</p>}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title="التحكّم بعرض الشعار">
            <div className="mb-4 flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded border border-line bg-bg-raised">
                {logoDisplayMode === "HIDDEN"
                  ? <span className="text-[11px] text-text-3">مُخفى</span>
                  : <Logo size={52} />}
              </div>
              <p className="flex-1 text-[12.5px] leading-[1.8] text-text-2">
                يُطبَّق فوراً على كامل الموقع — الهيدر، الصفحة الرئيسة، صفحة الدخول، وكلّ موضعٍ يظهر فيه الشعار.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["ANIMATED", "متحرك", "الوضع الافتراضي — نبضٌ وتوهّج"],
                ["VISIBLE",  "إظهار", "ثابتٌ بلا حركة"],
                ["BLURRED",  "تغبيش", "ضبابيٌّ مؤقت"],
                ["HIDDEN",   "إخفاء", "لا يظهر إطلاقاً"],
              ] as [LogoDisplayMode, string, string][]).map(([mode, label, hint]) => {
                const active = logoDisplayMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setLogoDisplayMode(mode)}
                    className={`rounded border px-2 py-2.5 text-center transition-colors ${
                      active
                        ? "border-accent bg-accent text-[#F4EEE2]"
                        : "border-line-strong text-text-2 hover:border-accent hover:text-text"
                    }`}
                  >
                    <span className="block text-[13px] font-medium">{label}</span>
                    <span className={`mt-0.5 block text-[10.5px] ${active ? "opacity-85" : "text-text-3"}`}>{hint}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="رسالة السفرة">
            <p className="mb-3 text-[12.5px] leading-[1.8] text-text-2">
              نصٌّ يظهر في الصفحة الرئيسة مكان قسم الأدوار السابق. اتركه فارغاً لعرض الرسالة الافتراضيّة.
            </p>
            <textarea
              value={tripDraft}
              onChange={e => { setTripDraft(e.target.value); setTripSaved(false); }}
              rows={7}
              placeholder="اكتب رسالة السفرة التي ستظهر للزوّار في الصفحة الرئيسة…"
              className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[13.5px] leading-[1.9]"
            />
            <div className="mt-3 flex items-center gap-2">
              <Button
                onClick={() => { setTripMessage(tripDraft.trim()); setTripSaved(true); }}
                disabled={tripDraft === tripMessage}
              >
                حفظ الرسالة
              </Button>
              {tripSaved && <span className="text-[12px] text-ok">✓ حُفظت</span>}
            </div>
          </Card>

          <Card title="مربّع ما بعد التسجيل">
            <p className="mb-3 text-[12.5px] leading-[1.8] text-text-2">
              نصُّ مربّع «ما التالي؟» الذي يظهر للمُسجِّل بعد إرسال طلبه (خطوات المراجعة وبيانات
              السداد). كلُّ سطرٍ يظهر كما تكتبه. اتركه فارغاً لعرض النصّ الافتراضيّ.
            </p>
            <textarea
              value={noteDraft}
              onChange={e => { setNoteDraft(e.target.value); setNoteSaved(false); }}
              rows={9}
              placeholder="اكتب خطوات ما بعد التسجيل وبيانات السداد…"
              className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[13.5px] leading-[1.9]"
            />
            <div className="mt-3 flex items-center gap-2">
              <Button
                onClick={() => { setPostRegisterNote(noteDraft.trim()); setNoteSaved(true); }}
                disabled={noteDraft === postRegisterNote}
              >
                حفظ المربّع
              </Button>
              {noteSaved && <span className="text-[12px] text-ok">✓ حُفظ</span>}
            </div>
          </Card>
        </div>
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <MarqueeEditor />
      </div>
    </div>
  );
}

/**
 * محرّر «الخلفيّة التحفيزيّة المتحرّكة» لكلّ صفحة.
 * يختار الأمير الصفحة، ثمّ يفعّل/يعطّل الخلفيّة، ويختار نمط الحركة،
 * ويضيف/يعدّل/يحذف الجُمل. كلّ صفحةٍ لها إعدادها المستقلّ.
 */
function MarqueeEditor() {
  const { pageMarquees, setPageMarquee } = useStore();
  const [pageKey, setPageKey] = useState(MARQUEE_PAGES[0].key);
  const [draft, setDraft] = useState<PageMarquee>(defaultMarquee());
  const [saved, setSaved] = useState(false);

  // يحمّل إعداد الصفحة المختارة في المسوّدة عند تغيير الصفحة أو بعد التحميل.
  useEffect(() => {
    setDraft(resolveMarquee(pageMarquees, pageKey));
    setSaved(false);
  }, [pageKey, pageMarquees]);

  const setPhrase = (i: number, v: string) =>
    setDraft(d => ({ ...d, phrases: d.phrases.map((p, j) => (j === i ? v : p)) }));
  const addPhrase = () => setDraft(d => ({ ...d, phrases: [...d.phrases, ""] }));
  const removePhrase = (i: number) =>
    setDraft(d => ({ ...d, phrases: d.phrases.filter((_, j) => j !== i) }));

  function save() {
    const clean = draft.phrases.map(s => s.trim()).filter(Boolean);
    setPageMarquee(pageKey, { ...draft, phrases: clean });
    setDraft(d => ({ ...d, phrases: clean }));
    setSaved(true);
  }

  const pageLabel = MARQUEE_PAGES.find(p => p.key === pageKey)?.label ?? "";

  return (
    <Card title="الخلفيّة التحفيزيّة المتحرّكة (لكلّ صفحة)">
      <p className="mb-4 text-[12.5px] leading-[1.8] text-text-2">
        كلامٌ محفّزٌ يتحرّك في خلفيّة كلّ صفحة بلونٍ شبه شفّافٍ لكنّه واضح. اختر الصفحة، ثمّ
        فعّل الخلفيّة، واختر نمط الحركة، وحرّر الجُمل (إضافة/تعديل/حذف). لكلّ صفحةٍ إعدادُها الخاصّ.
      </p>

      <div className="mb-4">
        <label className="mb-1.5 block text-[12px] text-text-3">الصفحة</label>
        <select
          value={pageKey}
          onChange={e => setPageKey(e.target.value)}
          className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[13.5px]"
        >
          {MARQUEE_PAGES.map(p => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => { setDraft(d => ({ ...d, enabled: !d.enabled })); setSaved(false); }}
          className={`rounded border px-3 py-2 text-[13px] font-medium transition-colors ${
            draft.enabled
              ? "border-accent bg-accent text-[#F4EEE2]"
              : "border-line-strong text-text-2 hover:border-accent hover:text-text"
          }`}
        >
          {draft.enabled ? "✓ الخلفيّة مُفعّلة" : "الخلفيّة مُعطّلة"}
        </button>
        <span className="text-[12px] text-text-3">صفحة: {pageLabel}</span>
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-[12px] text-text-3">نمط الحركة</label>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {MARQUEE_STYLES.map(st => {
            const active = draft.style === st.value;
            return (
              <button
                key={st.value}
                onClick={() => { setDraft(d => ({ ...d, style: st.value as MarqueeStyle })); setSaved(false); }}
                className={`rounded border px-2 py-2.5 text-center transition-colors ${
                  active
                    ? "border-accent bg-accent text-[#F4EEE2]"
                    : "border-line-strong text-text-2 hover:border-accent hover:text-text"
                }`}
              >
                <span className="block text-[12.5px] font-medium">{st.label}</span>
                <span className={`mt-0.5 block text-[10.5px] ${active ? "opacity-85" : "text-text-3"}`}>{st.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-[12px] text-text-3">الجُمل</label>
        <div className="flex flex-col gap-2">
          {draft.phrases.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                value={p}
                onChange={e => { setPhrase(i, e.target.value); setSaved(false); }}
                placeholder="اكتب جملةً تحفيزيّة…"
                className="flex-1 rounded border border-line-strong bg-surface px-3 py-2 text-[13.5px]"
              />
              <button
                onClick={() => { removePhrase(i); setSaved(false); }}
                className="shrink-0 rounded border border-line-strong px-3 py-2 text-[12px] text-critical hover:border-critical"
              >
                حذف
              </button>
            </div>
          ))}
          {draft.phrases.length === 0 && (
            <p className="text-[12px] text-text-3">لا جُمل بعد — أضِف جملةً واحدة على الأقلّ.</p>
          )}
        </div>
        <div className="mt-2">
          <Button variant="outline" onClick={() => { addPhrase(); setSaved(false); }}>+ إضافة جملة</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={save}>حفظ خلفيّة هذه الصفحة</Button>
        {saved && <span className="text-[12px] text-ok">✓ حُفظت وطُبِّقت</span>}
      </div>
    </Card>
  );
}
