<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# مبدأٌ ثابت: فشل تحميل البيانات يجب أن يكون مرئياً (لا شاشات فارغة صامتة)

أيّ حالة يفشل فيها جلبُ لقطة البيانات (`loadAllData`) — نسخةُ عميلٍ قديمة بعد نشر،
انقطاعُ شبكة، أو خطأُ خادم — **يجب** أن تُظهر رسالةً واضحة تؤكّد أن البيانات غير
مفقودة وتقترح «تحديث الصفحة»، بدل قائمةٍ/شاشةٍ فارغةٍ أو «تحميلٍ» أبديّ يوحي بالحذف.

- المتجر (`StoreProvider`) يكشف `loadError` و`retry`.
- استخدم `<LoadErrorBanner />` في أيّ صفحةٍ حسّاسة. صفحاتُ الطاقم مغطّاةٌ تلقائياً
  عبر `AppShell`؛ أيّ صفحةٍ خارجه (مثل `/me`) تُدرِج البانر بنفسها، وتُميّز
  «فشل التحميل» عن «قيد التحميل» بدل تعليق المستخدم على مؤشّر تحميلٍ دائم.
- `<VersionWatcher />` يكتشف النشر الجديد تلقائياً (يقارن `NEXT_PUBLIC_BUILD_ID`
  المخبوز بمعرّف `/api/version` الحيّ) ويعرض «تحديث الآن» — يمنع فشل الإجراءات
  بسبب نسخةٍ قديمة دون تدخّلٍ يدويّ.
