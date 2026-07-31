-- ═══════════════════════════════════════════════════════════════════════
--  مِنصّة «معالي أبها» — مخطّط قاعدة البيانات (Supabase / Postgres)
--  شغّل هذا الملف مرّةً واحدة في: Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════════════

-- تشفير رموز الدخول (bcrypt عبر pgcrypto)
create extension if not exists pgcrypto;

-- ── الحسابات (المصادقة) ────────────────────────────────────────────────
-- رمز الدخول مخزَّن مُشفَّراً (code_hash) لا نصّاً صريحاً.
create table if not exists profiles (
  id            text primary key,
  phone         text unique not null,
  code_hash     text not null,
  name          text not null,
  role          text not null check (role in ('PRINCE','DEPUTY_PRINCE','SUPERVISOR','BENEFICIARY')),
  is_owner      boolean not null default false,
  supervisor_id text,
  student_id    text,
  landing       text not null default '/dashboard',
  created_at    timestamptz not null default now()
);

-- ── المشرفون ────────────────────────────────────────────────────────────
create table if not exists supervisors (
  id                 text primary key,
  name               text not null,
  national_id_masked text not null default '',
  national_id        text,
  phone              text not null default '',
  email              text not null default '',
  team_ids           text[] not null default '{}',
  committee_ids      text[] not null default '{}'
);

-- ── الفرق ────────────────────────────────────────────────────────────────
create table if not exists teams (
  id            text primary key,
  name          text not null,
  color         text not null default '#1E4635',
  badge         text not null default '',
  supervisor_id text references supervisors(id) on delete set null,
  student_count integer not null default 0,
  points        integer not null default 0,
  tagline       text not null default '',
  budget        integer not null default 0   -- موازنة الفريق (ر.س) — للأمير/نائبه تعديلها
);

-- ── اللجان ───────────────────────────────────────────────────────────────
create table if not exists committees (
  id             text primary key,
  name           text not null,
  supervisor_ids text[] not null default '{}',
  description    text not null default '',
  color          text not null default '#1E4635',
  budget         integer not null default 0   -- موازنة اللجنة (ر.س) — للأمير/نائبه تعديلها
);

-- ── مهامّ اللجان ─────────────────────────────────────────────────────────
-- يضيفها الأمير/نائبه أو أحد مشرفي اللجنة، ويمكن تخصيصها لعضوٍ بعينه.
create table if not exists committee_tasks (
  id           text primary key,
  committee_id text not null references committees(id) on delete cascade,
  title        text not null,
  assignee_id  text,                       -- مشرف مخصَّص (اختياري)
  done         boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ── ربط المشرفين بالفرق واللجان (many-to-many حقيقي) ──────────────────────
-- المصدر الوحيد لعلاقة «المشرف يُشرف على فريق/لجنة». يحلّ محلّ:
--   supervisors.team_ids · supervisors.committee_ids · committees.supervisor_ids
create table if not exists supervisor_assignments (
  supervisor_id text not null references supervisors(id) on delete cascade,
  target_kind   text not null check (target_kind in ('team','committee')),
  target_id     text not null,
  primary key (supervisor_id, target_kind, target_id)
);
create index if not exists idx_sa_target on supervisor_assignments (target_kind, target_id);

-- ── الشباب (الطلاب) ──────────────────────────────────────────────────────
create table if not exists students (
  id                 text primary key,
  name               text not null,
  national_id_masked text not null default '',
  national_id        text not null default '',   -- رقم الهوية الحقيقيّ (يُدخله الطالب) — فارغٌ للطلاب القدامى
  phone              text not null default '',
  grade              text not null default '',
  section            text not null default 'ريادة' check (section in ('ريادة','علو','قيادة')),
  team_id            text default '',
  payment_status     text not null default 'PENDING' check (payment_status in ('PENDING','PARTIAL','PAID')),
  paid_amount        integer not null default 0,
  total_amount       integer not null default 2500,
  points             integer not null default 0,
  emergency_contact  text not null default '',
  emergency_phone    text not null default '',
  attendance         integer not null default 100,
  approval_status    text default 'APPROVED' check (approval_status in ('PENDING','APPROVED','REJECTED')),
  registered_at      timestamptz,
  photo_data_url     text,
  access_code        text
);

-- ── الفواتير ─────────────────────────────────────────────────────────────
-- scope مخزَّن كـ jsonb مطابقاً لاتّحاد الأنواع في التطبيق:
--   {"kind":"team","teamId":"..."} | {"kind":"committee","committeeId":"..."} | {"kind":"event"}
create table if not exists invoices (
  id             text primary key,
  code           text not null,
  vendor         text not null default '',
  purpose        text not null default '',
  scope          jsonb not null default '{"kind":"event"}',
  amount         integer not null default 0,
  vat            integer not null default 15,
  date           text not null default '',
  status         text not null default 'pending' check (status in ('paid','pending','overdue','approved')),
  extracted_by_ai boolean not null default false,
  image_data_url text,                       -- صورة الفاتورة (base64) — تُخدَم كسولاً
  has_image      boolean not null default false, -- علمٌ خفيف (اللقطة تستبعد الصورة نفسها)
  line_items     jsonb,                       -- بنود الفاتورة المُستخرَجة
  conditions     jsonb,                       -- تقييم الشروط السبعة (مُثبَّت خادميّاً)
  vendor_tax_number text,                     -- الرقم الضريبي للمورّد
  invoice_number text,                        -- رقم الفاتورة لدى المورّد (المُستخرَج)
  uploaded_by    text,                        -- مُعرِّف المشرف الرافع
  submitted_at   timestamptz,                 -- وقت الإرسال للاعتماد
  in_trash       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ── حقول نموذج التسجيل ───────────────────────────────────────────────────
create table if not exists reg_fields (
  key       text primary key,
  label     text not null,
  type      text not null,
  required  boolean not null default false,
  active    boolean not null default true,
  descr     text not null default '',
  sort      integer not null default 0
);

-- ── حضور الطلاب (يومٌ لكلّ صفّ) ──────────────────────────────────────────
create table if not exists attendance (
  student_id text not null references students(id) on delete cascade,
  day        integer not null,
  present    boolean not null default false,
  primary key (student_id, day)
);

-- ── إعدادات عامّة (صفٌّ واحد) ─────────────────────────────────────────────
create table if not exists app_settings (
  id                integer primary key default 1 check (id = 1),
  reg_open          boolean not null default true,
  logo_display_mode text not null default 'VISIBLE' check (logo_display_mode in ('VISIBLE','BLURRED','HIDDEN')),
  association_name       text,   -- اسم الجمعية الرسمي (لمطابقة شرط اسم الجمعية)
  association_tax_number text,   -- الرقم الضريبي للجمعية (لمطابقة شرط الرقم الضريبي)
  conditions_policy      jsonb   -- سياسة الشروط الإلزاميّة (الافتراض: السبعة كلها)
);

insert into app_settings (id) values (1) on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════
--  بذرة الحساب الوحيد: الأمير — جوّال 0559570829، الرمز 740318 (مُشفَّر)
-- ═══════════════════════════════════════════════════════════════════════
insert into profiles (id, phone, code_hash, name, role, is_owner, landing)
values (
  'prince',
  '0559570829',
  crypt('740318', gen_salt('bf')),
  'الأمير',
  'PRINCE',
  true,
  '/dashboard'
)
on conflict (phone) do nothing;

-- ── حقول التسجيل الافتراضيّة ─────────────────────────────────────────────
insert into reg_fields (key, label, type, required, active, descr, sort) values
  ('name',    'الاسم الكامل',    'نص',      true,  true,  'اسمُ الطالب رباعياً كما في الهويّة.', 0),
  ('nid',     'رقم الهويّة',      'رقم',     true,  true,  'يُخزَّن مشفَّراً — لا يظهر كاملاً إلاّ للأمير الأصل.', 1),
  ('phone',   'الجوّال',         'هاتف',    true,  true,  'رقم واتساب مُفضَّل، للتواصل مع الطالب مباشرة.', 2),
  ('grade',   'الصف الدراسي',    'قائمة',   true,  true,  'من قائمة: أوّل/ثاني/ثالث ثانوي.', 3),
  ('section', 'القسم المفضَّل',  'قائمة',   false, true,  'ريادة/علو/قيادة — لتوزيعٍ مبدئي.', 4),
  ('photo',   'الصورة الشخصيّة', 'ملف',     false, true,  'بحدٍّ أقصى ٥ ميغا.', 5),
  ('emergN',  'اسم جهة الطوارئ', 'نص',      true,  true,  'الأب/الأم/الوليّ.', 6),
  ('emergP',  'رقم الطوارئ',     'هاتف',    true,  true,  'متاح ٢٤ ساعة أثناء الرحلة.', 7),
  ('health',  'الحالة الصحيّة',  'نص طويل', false, true,  'أمراض مزمنة، حساسيّة دواء، غذاء خاص.', 8),
  ('notes',   'ملاحظات أخرى',    'نص طويل', false, false, 'معلومات إضافيّة (اختياري).', 9)
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════
--  ملاحظة أمنيّة: كلّ الوصول للبيانات يمرّ عبر الخادم (Server Actions) باستخدام
--  مفتاح service_role، والمصادقة تُتحقَّق في الخادم عبر دالّة verify_login أدناه.
--  لذا RLS غير مُفعَّل هنا؛ لا تَكشِف مفتاح service_role في المتصفّح إطلاقاً.
-- ═══════════════════════════════════════════════════════════════════════

-- دالّة تحقُّق الدخول: تُعيد صفّ الحساب إذا طابق الرمزُ التشفيرَ المخزَّن.
create or replace function verify_login(p_phone text, p_code text)
returns setof profiles
language sql
stable
as $$
  select * from profiles
  where phone = p_phone
    and code_hash = crypt(p_code, code_hash)
  limit 1;
$$;

-- تغيير رمز الدخول ذاتياً: يتحقّق من الرمز الحالي ثم يُحدّث التشفير في عمليّةٍ ذرّيّة.
-- يُعيد true إن نجح التحقّق والتحديث، و false إن كان الرمز الحالي خاطئاً.
create or replace function set_login_code(p_phone text, p_current text, p_new text)
returns boolean
language plpgsql
as $$
declare
  matched integer;
begin
  update profiles
    set code_hash = crypt(p_new, gen_salt('bf'))
    where phone = p_phone
      and code_hash = crypt(p_current, code_hash);
  get diagnostics matched = row_count;
  return matched > 0;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════
--  ترحيل: نقل علاقات المشرفين من المصفوفات القديمة إلى جدول الربط
--  (آمنٌ لإعادة التشغيل — يُنفَّذ مرّةً ثمّ يحذف الأعمدة القديمة)
-- ═══════════════════════════════════════════════════════════════════════
do $$
begin
  -- من supervisors.team_ids
  if exists (select 1 from information_schema.columns
             where table_name='supervisors' and column_name='team_ids') then
    insert into supervisor_assignments (supervisor_id, target_kind, target_id)
    select s.id, 'team', t from supervisors s, unnest(s.team_ids) as t
    where t <> ''
    on conflict do nothing;
    alter table supervisors drop column team_ids;
  end if;

  -- من supervisors.committee_ids
  if exists (select 1 from information_schema.columns
             where table_name='supervisors' and column_name='committee_ids') then
    insert into supervisor_assignments (supervisor_id, target_kind, target_id)
    select s.id, 'committee', c from supervisors s, unnest(s.committee_ids) as c
    where c <> ''
    on conflict do nothing;
    alter table supervisors drop column committee_ids;
  end if;

  -- من committees.supervisor_ids
  if exists (select 1 from information_schema.columns
             where table_name='committees' and column_name='supervisor_ids') then
    insert into supervisor_assignments (supervisor_id, target_kind, target_id)
    select sup, 'committee', c.id from committees c, unnest(c.supervisor_ids) as sup
    where sup <> '' and exists (select 1 from supervisors s where s.id = sup)
    on conflict do nothing;
    alter table committees drop column supervisor_ids;
  end if;

  -- من teams.supervisor_id (قائد الفريق الواحد يُصبح أيضاً «مُشرفاً على» الفريق)
  insert into supervisor_assignments (supervisor_id, target_kind, target_id)
  select t.supervisor_id, 'team', t.id from teams t
  where t.supervisor_id is not null and t.supervisor_id <> ''
    and exists (select 1 from supervisors s where s.id = t.supervisor_id)
  on conflict do nothing;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
--  الملكيّة (is_owner): أميرٌ أصلٌ واحدٌ فقط، ونقلٌ ذرّيٌّ محميّ
-- ═══════════════════════════════════════════════════════════════════════
-- ثابتٌ في القاعدة: لا يمكن وجود أكثر من صاحب ملكيّةٍ واحد في آنٍ واحد.
create unique index if not exists profiles_single_owner
  on profiles (is_owner) where is_owner = true;

-- إنشاء حسابِ مشرفٍ إداريّ (نائب أمير) برمزٍ مُشفَّر.
create or replace function create_admin(p_id text, p_phone text, p_code text, p_name text, p_role text)
returns void
language sql
as $$
  insert into profiles (id, phone, code_hash, name, role, is_owner, landing)
  values (p_id, p_phone, crypt(p_code, gen_salt('bf')), p_name, p_role, false, '/dashboard');
$$;

-- نقل الملكيّة ذرّياً: يخفض المالكَ الحاليّ ثمّ يرفع الهدف — دون خرق قيد المالك الواحد.
-- يُعيد true إن كان p_from_phone هو المالك الحاليّ فعلاً والهدف موجود.
create or replace function transfer_ownership(p_from_phone text, p_to_id text)
returns boolean
language plpgsql
as $$
declare
  demoted integer;
  promoted integer;
begin
  update profiles set is_owner = false
    where phone = p_from_phone and is_owner = true;
  get diagnostics demoted = row_count;
  if demoted = 0 then return false; end if;

  update profiles set is_owner = true, role = 'PRINCE'
    where id = p_to_id;
  get diagnostics promoted = row_count;
  return promoted > 0;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════
--  ترحيل المرحلتين ج ود (إضافي — آمنٌ لإعادة التشغيل)
-- ═══════════════════════════════════════════════════════════════════════

-- البند ٢٠: جُمل تحفيزيّة قابلة للتعديل من الأمير (تُخزَّن كمصفوفة JSON).
alter table app_settings add column if not exists motivations    jsonb;
alter table app_settings add column if not exists ticker_phrases jsonb;

-- البند ١٠: سداد الرسوم برفع إيصالٍ ثم اعتماد الأمير.
alter table students add column if not exists receipt_data_url     text;
alter table students add column if not exists receipt_status       text;   -- PENDING | APPROVED | REJECTED
alter table students add column if not exists receipt_amount       numeric;
alter table students add column if not exists receipt_submitted_at timestamptz;

-- البندان ١٧ و١٨: صورةٌ مخصَّصة للفريق/اللجنة (يُشتقّ منها اللون تلقائياً).
alter table teams      add column if not exists image_data_url text;
alter table committees add column if not exists image_data_url text;

-- ═══════════════════════════════════════════════════════════════════════
--  توليد رمز الدخول تلقائياً عند إضافة مشرف أو اعتماد طالب (يظهر للأمير)
-- ═══════════════════════════════════════════════════════════════════════

-- رمز دخول المشرف يظهر صريحاً للأمير (كرمز الطالب في students.access_code).
alter table supervisors add column if not exists access_code text;

-- البند ١٨: صلاحيات دقيقة لكلّ مشرف (أقسام إداريّة إضافيّة يفتحها الأمير).
alter table supervisors add column if not exists permissions text[] not null default '{}';

-- يوفّر (أو يُحدّث) حساب دخولٍ لمشرفٍ/مستفيدٍ برمزٍ مُشفَّر (bcrypt).
-- عند تكرار الجوّال يُحدَّث الرمز والربط — لكن لا يمسّ حسابات الأمراء إطلاقاً.
create or replace function upsert_login(
  p_id text, p_phone text, p_code text, p_name text, p_role text,
  p_supervisor_id text, p_student_id text, p_landing text
) returns void
language sql
as $$
  insert into profiles (id, phone, code_hash, name, role, is_owner, supervisor_id, student_id, landing)
  values (p_id, p_phone, crypt(p_code, gen_salt('bf')), p_name, p_role, false,
          nullif(p_supervisor_id, ''), nullif(p_student_id, ''), p_landing)
  on conflict (phone) do update
    set code_hash     = excluded.code_hash,
        name          = excluded.name,
        role          = excluded.role,
        supervisor_id = excluded.supervisor_id,
        student_id    = excluded.student_id,
        landing       = excluded.landing
    where profiles.is_owner = false
      and profiles.role not in ('PRINCE', 'DEPUTY_PRINCE');
$$;

-- ═══════════════════════════════════════════════════════════════════════
--  ترحيل «تعديل ٥» — محتوى الصفحة الرئيسة وحقول التسجيل (آمنٌ لإعادة التشغيل)
-- ═══════════════════════════════════════════════════════════════════════

-- البند ٦: رسالة السفرة (تُعرض في الصفحة الرئيسة، يُحرّرها الأمير).
alter table app_settings add column if not exists trip_message text;

-- نصّ مربّع «ما التالي؟» بعد إرسال التسجيل (خطوات المراجعة وبيانات السداد، يُحرّرها الأمير).
alter table app_settings add column if not exists post_register_note text;

-- البند ٨: وضعٌ رابعٌ للشعار «متحرك» (ANIMATED) — توسيع قيد logo_display_mode.
do $$
begin
  alter table app_settings drop constraint if exists app_settings_logo_display_mode_check;
  alter table app_settings add constraint app_settings_logo_display_mode_check
    check (logo_display_mode in ('VISIBLE','BLURRED','HIDDEN','ANIMATED'));
end $$;

-- البنود ٩–١٣: تعديل حقول نموذج التسجيل على القواعد القائمة (بجانب البذرة أعلاه).
delete from reg_fields where key = 'emergN';                                    -- ٩: حذف «اسم جهة الطوارئ»
update reg_fields set label = 'رقم وليّ الأمر',
                      descr = 'متاح ٢٤ ساعة أثناء الرحلة.'   where key = 'emergP';  -- ١٠
update reg_fields set label = 'الفريق',
                      descr = 'الريادة/القيادة/العلو — لتوزيعٍ مبدئي.' where key = 'section'; -- ١١
update reg_fields set label = 'مقترحك للسفرة',
                      descr = 'ملاحظاتك واقتراحاتك للرحلة (اختياري).',
                      type  = 'نص طويل', required = false        where key = 'health';  -- ١٣
-- البند ١٢: «رقم الهوية» (nid) موجودٌ أصلاً في البذرة.

-- ═══════════════════════════════════════════════════════════════════════
--  ترحيل «تعديل الهبوط» — شعارٌ متحرّك افتراضاً + رفع شعارٍ مخصّص + ألوان الهوية
-- ═══════════════════════════════════════════════════════════════════════

-- (٣) جعل الوضع «المتحرك» هو الافتراضي، وتطبيقه على السطر الحاليّ.
alter table app_settings alter column logo_display_mode set default 'ANIMATED';
update app_settings set logo_display_mode = 'ANIMATED' where id = 1 and logo_display_mode = 'VISIBLE';

-- (٦) شعارٌ مخصّص يرفعه الأمير (Data URL) + ألوان الهوية المشتقّة منه.
alter table app_settings add column if not exists logo_url          text;
alter table app_settings add column if not exists brand_accent      text;
alter table app_settings add column if not exists brand_accent_warm text;

-- إصدار الشعار: رقمٌ خفيف (0 = لا شعار مخصّص) يُبدَّل عند كل رفع. يسمح باستبعاد
-- الشعار الثقيل (base64 ≈ ٢٥٠ ك.ب) من لقطة loadAllData، وجلبه بدلاً منه عند الطلب
-- عبر مسار /api/logo مع كسر التخزين المؤقّت (?v=logo_version) عند التغيير.
alter table app_settings add column if not exists logo_version bigint not null default 0;

-- جُملٌ تحفيزيّة متحرّكة في خلفيّة كل صفحة، يُحرّرها الأمير (إضافة/تعديل/حذف)
-- ويختار نمط الحركة لكلّ صفحة. تُخزَّن كخريطة JSON:
--   { "<pageKey>": { "phrases": ["..."], "style": "slide|float|fade", "enabled": true } }
alter table app_settings add column if not exists page_marquees jsonb;

-- ═══════════════════════════════════════════════════════════════════════
--  إجابات حقول التسجيل المخصّصة (الديناميكيّة) — تُخزَّن كخريطة { key: value }
--  كي لا تُفقَد إجابات الحقول التي يضيفها الأمير (عبر reg_fields) والتي لا
--  يقابلها عمودٌ ثابت في جدول الطلاب. تُعرَض في صفحة تفاصيل الطالب.
--  ⚠️ شغّل هذا السطر في Supabase قبل نشر الشيفرة التي تعتمد عليه.
alter table students add column if not exists reg_answers jsonb;

-- رقم الهوية الحقيقيّ للمشرف — حسّاسٌ يُكشف للأمير/نائبه فقط (يُجرَّد من لقطة غيرهم
--  في data.ts). القناع القديم (national_id_masked) كان عشوائياً مضلِّلاً؛ من الآن
--  يُعتمَد هذا العمود، ومن لا رقم حقيقيّ له يُعرَض «غير مسجَّل».
--  ⚠️ شغّل هذا السطر في Supabase قبل نشر الشيفرة التي تعتمد عليه.
alter table supervisors add column if not exists national_id text;

-- ═══════════════════════════════════════════════════════════════════════
--  تحليل فواتير المشرفين بالذكاء الاصطناعي + الاعتماد المشروط بالشروط السبعة
--  ⚠️ شغّل هذه الأسطر في Supabase قبل نشر الشيفرة التي تعتمد عليها.
-- ═══════════════════════════════════════════════════════════════════════
-- صورة الفاتورة المرفوعة (base64 data URL) — تُستبعَد من لقطة loadAllData
--  وتُخدَم كسولاً عبر /api/invoices/[id]/image (كنمط صور الطلاب).
alter table invoices add column if not exists image_data_url  text;
-- علمٌ خفيفٌ بوجود صورة (اللقطة الجماعيّة تستبعد الصورة نفسها).
alter table invoices add column if not exists has_image       boolean not null default false;
-- بنود الفاتورة المُستخرَجة: [{description, quantity, unitPrice, total}]
alter table invoices add column if not exists line_items      jsonb;
-- نتيجة تقييم الشروط السبعة (مُثبَّتة خادميّاً عند الرفع): { taxInvoice, ... }
alter table invoices add column if not exists conditions      jsonb;
-- الرقم الضريبي للمورّد المُستخرَج (لشرط رقم المنشأة).
alter table invoices add column if not exists vendor_tax_number text;
-- رقم الفاتورة لدى المورّد (المُستخرَج).
alter table invoices add column if not exists invoice_number  text;
-- مُعرِّف المشرف الذي رفع الفاتورة (لعرض «مَن رفع» للأمير).
alter table invoices add column if not exists uploaded_by     text;
-- وقت الإرسال للاعتماد.
alter table invoices add column if not exists submitted_at    timestamptz;

-- حالة الاعتماد الجديدة «approved» (المشرف يعتمدها تلقائياً عند استيفاء الشروط،
--  أو تبقى pending لمراجعة الأمير). نوسّع قيد الحالة ليشملها.
do $$ begin
  alter table invoices drop constraint if exists invoices_status_check;
  alter table invoices add constraint invoices_status_check
    check (status in ('paid','pending','overdue','approved'));
exception when others then null; end $$;

-- هويّة الجمعية الرسميّة (لشرطَي «اسم الجمعية» و«الرقم الضريبي للجمعية») +
--  سياسة الشروط الإلزاميّة. الافتراض: كل الشروط السبعة إلزاميّة.
alter table app_settings add column if not exists association_name     text;
alter table app_settings add column if not exists association_tax_number text;
alter table app_settings add column if not exists conditions_policy    jsonb;

-- ═══════════════════════════════════════════════════════════════════════
--  موازنة اللجان والفرق (عرضٌ فقط أثناء الاعتماد — لا تمنع الاعتماد التلقائي)
--  يعدّلها الأمير/نائبه فقط (dbSetTeamBudget/dbSetCommitteeBudget بحارس requireAdmin).
--  ⚠️ شغّل هذين السطرين في Supabase قبل نشر الشيفرة التي تعتمد عليهما.
-- ═══════════════════════════════════════════════════════════════════════
alter table teams      add column if not exists budget integer not null default 0;
alter table committees add column if not exists budget integer not null default 0;

-- ═══════════════════════════════════════════════════════════════════════
--  تطبيع رقم الجوّال في الدخول (دفاعٌ إضافيّ خادميّ)
--  المشكلة: أرقامٌ خُزِّنت بمحارف اتجاهٍ خفيّة/مسافات/«+966»/أرقامٍ هنديّة، فمنعت
--  أصحابها من الدخول لأنّ المطابقة كانت حرفيّة. نُطبّع الطرفين داخل verify_login
--  حتى تعمل حتى مع صفوفٍ قديمةٍ لم تُنظَّف. (التطبيع مطبَّقٌ أيضاً في الكتابة عبر TS.)
--  ⚠️ شغّل هذا في Supabase.
-- ═══════════════════════════════════════════════════════════════════════
create or replace function norm_phone(p text) returns text
language sql immutable as $$
  select case
    when d ~ '^00966[0-9]{9}$' then '0' || substr(d, 6)
    when d ~ '^966[0-9]{9}$'   then '0' || substr(d, 4)
    when d ~ '^5[0-9]{8}$'     then '0' || d
    else d
  end
  from (
    select regexp_replace(
      translate(coalesce(p, ''),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'),
      '[^0-9]', '', 'g'
    ) as d
  ) t;
$$;

create or replace function verify_login(p_phone text, p_code text)
returns setof profiles
language sql
stable
as $$
  select * from profiles
  where norm_phone(phone) = norm_phone(p_phone)
    and code_hash = crypt(p_code, code_hash)
  limit 1;
$$;

-- ═══════════════════════════════════════════════════════════════════════
--  مهامّ اللجان: يضيفها الأمير/نائبه أو أحد مشرفي اللجنة، وتُخصَّص لعضوٍ اختياريّاً.
--  ⚠️ شغّل هذا في Supabase.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists committee_tasks (
  id           text primary key,
  committee_id text not null references committees(id) on delete cascade,
  title        text not null,
  assignee_id  text,
  done         boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════
--  المهامّ التحفيزيّة/الذاتيّة للطلاب: يرصدها الأمير/نائبه أو المشرف لطالبٍ بعينه،
--  ولكلّ مهمّةٍ نقاطٌ محفِّزة. يراها الطالب في صفحة «مهامي» (المرئيّة منها فقط).
--  ⚠️ شغّل هذا في Supabase.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists student_tasks (
  id          text primary key,
  student_id  text not null references students(id) on delete cascade,
  title       text not null,
  points      integer not null default 0,   -- النقاط: موجبة = نشاط، سالبة = خصم
  assigned_by text,                          -- مُعرِّف مَن رصد النشاط (مشرف/أمير)
  visible     boolean not null default true, -- إظهار/إخفاء عن الطالب
  due_date    text,                          -- موعدٌ نهائيّ اختياري (توافقٌ قديم)
  done        boolean not null default false,
  kind        text not null default 'activity', -- 'activity' نشاط | 'deduction' خصم
  batch_id    text,                          -- يجمع صفوف الرصد الجماعيّ (أسرة/الكل) معاً
  scope_label text,                          -- وصفُ النطاق للعرض (مثل «أسرة الشوامخ»/«كل الطلاب»)
  expires_at  timestamptz,                   -- إغلاقٌ تلقائيّ للنشاط المؤقّت (null = مفتوح)
  created_at  timestamptz not null default now()
);
create index if not exists idx_student_tasks_student on student_tasks (student_id);
create index if not exists idx_student_tasks_batch on student_tasks (batch_id);

-- ── ترحيلٌ للجداول القائمة (شغّله مرّةً في Supabase SQL Editor) ──
alter table student_tasks add column if not exists kind        text not null default 'activity';
alter table student_tasks add column if not exists batch_id    text;
alter table student_tasks add column if not exists scope_label text;
alter table student_tasks add column if not exists expires_at  timestamptz;

-- ═══════════════════════════════════════════════════════════════════════
--  تعديل قيمة الرسوم من لوحة الأمير: قيمةٌ افتراضيّة تُطبَّق على جميع الطلاب،
--  مع سجلٍّ تاريخيٍّ لكلّ تغيير. يعدّلها الأمير/نائبه فقط (dbSetDefaultFee).
--  ⚠️ شغّل هذا في Supabase.
-- ═══════════════════════════════════════════════════════════════════════
alter table app_settings add column if not exists default_fee integer not null default 2500;

create table if not exists fee_history (
  id         text primary key,
  amount     integer not null,
  changed_by text,                           -- مُعرِّف مَن غيّر القيمة
  changed_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════
--  تعريف المشرف: صورةٌ شخصيّة + تخصُّص (يُعرَضان في صفحة «المشرفون» التعريفيّة).
--  ⚠️ شغّل هذا في Supabase.
-- ═══════════════════════════════════════════════════════════════════════
alter table supervisors add column if not exists photo_data_url text;
alter table supervisors add column if not exists specialty      text;
