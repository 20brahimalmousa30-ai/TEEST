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
  tagline       text not null default ''
);

-- ── اللجان ───────────────────────────────────────────────────────────────
create table if not exists committees (
  id             text primary key,
  name           text not null,
  supervisor_ids text[] not null default '{}',
  description    text not null default '',
  color          text not null default '#1E4635'
);

-- ── الشباب (الطلاب) ──────────────────────────────────────────────────────
create table if not exists students (
  id                 text primary key,
  name               text not null,
  national_id_masked text not null default '',
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
  status         text not null default 'pending' check (status in ('paid','pending','overdue')),
  extracted_by_ai boolean not null default false,
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
  logo_display_mode text not null default 'VISIBLE' check (logo_display_mode in ('VISIBLE','BLURRED','HIDDEN'))
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
