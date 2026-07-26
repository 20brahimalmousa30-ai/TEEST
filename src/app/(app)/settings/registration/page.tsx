"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Modal, Confirm } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { useStore } from "@/lib/store/StoreProvider";
import type { LogoDisplayMode } from "@/lib/store/StoreProvider";
import { copyText } from "@/lib/download";
import { useSession } from "@/lib/auth/session";
import { Logo } from "@/components/Logo";

export default function RegistrationSettingsPage() {
  useEffect(() => { document.title = "إعدادات نموذج التسجيل — معالي أبها"; }, []);
  const { regFields, regOpen, students, toggleRegField, reorderRegField, addRegField, removeRegField, setRegOpen, logoDisplayMode, setLogoDisplayMode } = useStore();
  const { session } = useSession();
  const canControlLogo = session?.role === "PRINCE" || session?.role === "DEPUTY_PRINCE";
  const [addOpen, setAddOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [nf, setNf] = useState({ key: "", label: "", type: "نص", required: false, desc: "" });

  const link = typeof window !== "undefined" ? `${window.location.origin}/register/1448` : "maali.abha/register/1448";

  // Generate a real, scannable QR (PNG data URL) whenever the modal opens.
  useEffect(() => {
    if (!qrOpen) return;
    QRCode.toDataURL(link, { width: 512, margin: 2, color: { dark: "#1E4635", light: "#FFFFFF" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [qrOpen, link]);

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "maali-register-qr.png";
    a.click();
  }

  async function onCopy() {
    if (await copyText(link)) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!nf.label.trim()) return;
    const key = nf.key.trim() || `custom_${Date.now().toString(36)}`;
    addRegField({ ...nf, key, label: nf.label.trim(), desc: nf.desc.trim() || "حقلٌ مخصَّص" });
    setNf({ key: "", label: "", type: "نص", required: false, desc: "" });
    setAddOpen(false);
  }

  const registered = students.length;
  const target = 450;
  const pctFilled = Math.round((registered / target) * 100);

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8">
      <PageHeader
        eyebrow="نموذج التسجيل الديناميكي"
        title="نموذج التسجيل الديناميكي"
        subtitle="فعّل أو عطّل حقول التسجيل بمرونة. كلّ تغييرٍ يُحفظ فوراً وينعكس على رابط التسجيل العام."
      />

      <div className="reg-layout">
        <Card padded={false}>
          <div className="border-b border-line bg-bg-raised px-5 py-3">
            <div className="reg-fieldrow text-[11px] uppercase tracking-[.14em] text-text-3">
              <span className="w-9">مفعّل</span><span>الحقل</span><span>النوع</span><span>إلزامي</span><span>ترتيب</span>
            </div>
          </div>
          <ul>
            {regFields.map((f, i) => (
              <li key={f.key} className="reg-fieldrow border-b border-line px-5 py-3 last:border-b-0">
                <input type="checkbox" checked={f.active} onChange={() => toggleRegField(f.key)} className="h-4 w-4 accent-[color:var(--accent)]" />
                <div>
                  <div className={`text-[13.5px] font-medium ${f.active ? "text-text" : "text-text-3 line-through"}`}>{f.label}</div>
                  <div className="text-[11.5px] text-text-3">{f.desc}</div>
                </div>
                <span className="text-[12px] text-text-2">{f.type}</span>
                <Pill variant={f.required ? "critical" : "neutral"}>{f.required ? "إلزامي" : "اختياري"}</Pill>
                <div className="flex items-center gap-1 text-text-3">
                  <button onClick={() => reorderRegField(f.key, "up")}   disabled={i === 0} className="disabled:opacity-30 hover:text-text" aria-label="أعلى">↑</button>
                  <button onClick={() => reorderRegField(f.key, "down")} disabled={i === regFields.length - 1} className="disabled:opacity-30 hover:text-text" aria-label="أسفل">↓</button>
                  {f.key.startsWith("custom_") && (
                    <button onClick={() => setConfirmRemove(f.key)} className="ms-1 text-critical hover:opacity-80" aria-label="حذف">×</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <button onClick={() => setAddOpen(true)} className="text-[13px] text-accent hover:underline">+ إضافة حقلٍ مخصَّص</button>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {canControlLogo && (
            <Card title="التحكّم بشعار الموقع">
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
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["VISIBLE", "إظهار", "الوضع الافتراضي"],
                  ["BLURRED", "تغبيش", "ضبابيٌّ مؤقت"],
                  ["HIDDEN",  "إخفاء", "لا يظهر إطلاقاً"],
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
          )}

          <Card title="رابط التسجيل العامّ">
            <div className="rounded border border-line bg-bg-raised px-3 py-2 text-[12.5px]">
              <span className="lat text-accent break-all">{link}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={onCopy}>{copied ? "✓ نُسخ" : "نسخ"}</Button>
              <Button variant="outline" onClick={() => setQrOpen(true)}>QR</Button>
              {regOpen
                ? <Button variant="danger" onClick={() => setConfirmClose(true)}>إغلاق التسجيل</Button>
                : <Button variant="primary" onClick={() => setRegOpen(true)}>إعادة فتح التسجيل</Button>}
            </div>
            <p className="mt-3 text-[12px] text-text-3">
              {regOpen
                ? "التسجيل مفتوحٌ حاليّاً. يُغلق تلقائياً عند اكتمال العدد المطلوب."
                : "التسجيل مُغلق. لن يُقبل مسجّلون جدد."}
            </p>
          </Card>

          <Card title="معاينةٌ حيّة">
            <div className="rounded border border-line bg-bg-raised p-4">
              <div className="mb-3 text-[13px] font-semibold text-text">تسجيل رحلة معالي أبها ١٤٤٨هـ</div>
              <div className="grid gap-3">
                {regFields.filter(f => f.active).slice(0, 6).map(f => (
                  <div key={f.key}>
                    <label className="mb-1 block text-[11.5px] text-text-3">
                      {f.label}{f.required && <span className="ms-1 text-critical">*</span>}
                    </label>
                    <div className="rounded border border-line-strong bg-surface px-3 py-1.5 text-[12px] text-text-3">حقل {f.type}</div>
                  </div>
                ))}
                {regFields.filter(f => f.active).length > 6 && <div className="text-[11px] text-text-3">… + {regFields.filter(f => f.active).length - 6} حقول أخرى</div>}
              </div>
            </div>
          </Card>

          <Card title="إحصاءٌ سريع">
            <div className="grid grid-cols-2 gap-4 text-[13.5px]">
              <div>
                <div className="text-[11px] text-text-3">مسجّلون</div>
                <div className="num mt-1 text-[20px] text-text">{registered}<span className="ms-1 text-[11px] text-text-3">/ {target}</span></div>
              </div>
              <div>
                <div className="text-[11px] text-text-3">نسبة الاكتمال</div>
                <div className={`num mt-1 text-[20px] ${pctFilled >= 90 ? "text-ok" : "text-accent-warm-2"}`}>{pctFilled}%</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Add custom field */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="إضافة حقلٍ مخصَّص"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button type="submit" form="new-field">إضافة الحقل</Button>
          </>
        }
      >
        <form id="new-field" onSubmit={submitAdd} className="grid gap-4">
          <Field label="عنوان الحقل" value={nf.label} onChange={e => setNf({ ...nf, label: e.target.value })} placeholder="مثال: قياس المقاس" required />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] tracking-[.12em] text-text-3">النوع</span>
              <select value={nf.type} onChange={e => setNf({ ...nf, type: e.target.value })} className="w-full rounded border border-line-strong bg-surface px-3 py-2 text-[14px]">
                <option>نص</option><option>نص طويل</option><option>رقم</option><option>هاتف</option><option>ملف</option><option>قائمة</option><option>تاريخ</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-[13px]">
              <input type="checkbox" checked={nf.required} onChange={e => setNf({ ...nf, required: e.target.checked })} className="accent-[color:var(--accent)]" />
              <span className="text-text-2">حقلٌ إلزامي</span>
            </label>
          </div>
          <Field label="وصف قصير (اختياري)" value={nf.desc} onChange={e => setNf({ ...nf, desc: e.target.value })} />
        </form>
      </Modal>

      {/* QR modal — real scannable QR, downloadable as PNG */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="رمز QR للرابط" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setQrOpen(false)}>إغلاق</Button>
            <Button onClick={downloadQr} disabled={!qrDataUrl}>⬇ تحميل الصورة</Button>
          </>
        }>
        <div className="flex flex-col items-center gap-3">
          {qrDataUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={qrDataUrl} alt="رمز QR لرابط التسجيل" className="h-52 w-52 rounded bg-white p-3" />
            : <div className="grid h-52 w-52 place-items-center rounded bg-bg-raised text-[12px] text-text-3">جارٍ التوليد…</div>}
          <p className="lat text-[11px] text-text-3 break-all text-center">{link}</p>
          <p className="text-[11.5px] text-text-3 text-center">امسح الرمز بالكاميرا للوصول لصفحة التسجيل مباشرةً.</p>
        </div>
      </Modal>

      <Confirm
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => setRegOpen(false)}
        title="إغلاق التسجيل؟"
        message="لن يُقبل مسجّلون جدد. يمكن إعادة فتحه لاحقاً."
        confirmLabel="نعم، أغلِق"
        danger
      />
      <Confirm
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => confirmRemove && removeRegField(confirmRemove)}
        title="حذف الحقل؟"
        message="سيُزال الحقل من نموذج التسجيل نهائياً."
        confirmLabel="نعم، احذف"
        danger
      />
    </div>
  );
}
