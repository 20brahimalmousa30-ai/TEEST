"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store/StoreProvider";
import { useSession } from "@/lib/auth/session";

export default function MotivationsSettingsPage() {
  useEffect(() => { document.title = "الجُمل التحفيزيّة — معالي محافظة بلّسمر"; }, []);
  const router = useRouter();
  const { session, ready } = useSession();
  const canEdit = session?.role === "PRINCE" || session?.role === "DEPUTY_PRINCE";
  const { motivations, setMotivations } = useStore();

  // غير المخوَّلين يُعادون لإعدادات الحساب.
  useEffect(() => {
    if (!ready) return;
    if (!canEdit) router.replace("/settings/account");
  }, [ready, canEdit, router]);

  if (!ready || !canEdit) return null;

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <PageHeader
        eyebrow="الجُمل التحفيزيّة"
        title="جُمل التحفيز"
        subtitle="حرّر الرسائل التي يراها الطالب بالتناوب بعد إرسال طلب تسجيله. كلّ إضافةٍ أو تعديلٍ أو حذفٍ يُحفظ فوراً في قاعدة البيانات وينعكس على شاشة ما بعد التسجيل."
      />

      <div className="grid gap-6">
        <PhraseEditor
          title="جُمل التحفيز (شاشة ما بعد التسجيل)"
          hint="تظهر بالتناوب للطالب بعد إرسال طلبه — يُفضَّل أن تكون جُملاً كاملة مُلهِمة."
          placeholder="مثال: رحلتك تبدأ بخطوةٍ… وقد خطوتَها."
          list={motivations}
          onSave={setMotivations}
        />
      </div>
    </div>
  );
}

function PhraseEditor({ title, hint, placeholder, list, onSave }: {
  title: string; hint: string; placeholder: string; list: string[]; onSave: (l: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onSave([...list, v]);
    setDraft("");
  };
  const remove = (idx: number) => onSave(list.filter((_, i) => i !== idx));
  const move = (idx: number, dir: "up" | "down") => {
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= list.length) return;
    const next = list.slice();
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onSave(next);
  };
  const edit = (idx: number, value: string) => onSave(list.map((p, i) => i === idx ? value : p));

  return (
    <Card title={title}>
      <p className="mb-4 text-[12.5px] leading-[1.8] text-text-3">{hint}</p>

      <ul className="grid gap-2">
        {list.map((p, i) => (
          <li key={i} className="flex items-center gap-2 rounded border border-line bg-bg-raised px-3 py-2">
            <span className="num w-6 text-[12px] text-text-3">{i + 1}</span>
            <input
              value={p}
              onChange={e => edit(i, e.target.value)}
              className="flex-1 rounded border border-line-strong bg-surface px-3 py-1.5 text-[13.5px]"
            />
            <div className="flex items-center gap-1 text-text-3">
              <button onClick={() => move(i, "up")}   disabled={i === 0}                className="disabled:opacity-30 hover:text-text" aria-label="أعلى">↑</button>
              <button onClick={() => move(i, "down")} disabled={i === list.length - 1}  className="disabled:opacity-30 hover:text-text" aria-label="أسفل">↓</button>
              <button onClick={() => remove(i)} className="ms-1 text-critical hover:opacity-80" aria-label="حذف">×</button>
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <li className="rounded border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-text-3">
            لا عبارات — أضِف واحدةً أدناه.
          </li>
        )}
      </ul>

      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <Field
            label="إضافة عبارة"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          />
        </div>
        <Button type="button" onClick={add} disabled={!draft.trim()}>إضافة</Button>
      </div>
    </Card>
  );
}
