# رادار المقاولات — Construction Radar

منصة عربية سعودية لرصد وتحليل المشاريع والفرص والمنافسات والمقاولين وبيانات سوق التشييد من مصادر عامة ورسمية متعددة. مبنية بـ Next.js وTypeScript وTailwind CSS وPostgreSQL/Supabase.

## ما الذي تغيّر؟

المشروع لم يعد يعتمد على «اعتماد» كمصدر وحيد. البنية الجديدة تستخدم موصلات مستقلة متعددة، وتعرض بيانات عامة حية عند خلو قاعدة Supabase بدل إظهار شاشة فارغة أو تمرير بيانات تجريبية للمستخدم.

المصدر الحي الافتراضي حاليًا:

- `muqawil-projects`: مشاريع وفرص منصة مقاول العامة.

مصادر إضافية:

- `etimad-public`: موصل Open Data API الرسمي لاعتماد، ويعمل عند توفير `BASE_URL` و`groupId` الرسميين.
- دليل المقاولين العام في منصة مقاول متاح مباشرة عبر صفحة `/contractors`.
- صفحة `/sources` تعرض شبكة المصادر الرسمية والعامة وبوابات التسجيل والتأهيل المرصودة.

## المزايا

- واجهة عربية RTL ومتجاوبة باسم «رادار المقاولات».
- بيانات مشاريع حية كـ fallback عند عدم إعداد Supabase أو عندما يكون جدول المنافسات فارغًا.
- بحث شامل مع Debouncing وفلاتر متقدمة.
- Server-side filtering, sorting, pagination.
- صفحة تفاصيل لكل فرصة/منافسة مع رابط المصدر الأصلي.
- دليل عام للمقاولين والمنشآت المسجلة في منصة مقاول.
- تحليلات للفرص حسب المنطقة والنشاط، وتحليلات ترسيات عند توفر بياناتها.
- كتالوج مصادر يوضح: متصل حيًا / عام ومفتوح / يتطلب تسجيلًا / يتطلب إعدادًا رسميًا.
- PostgreSQL schema مع PK/FK/Unique Constraints/Indexes و`pg_trgm`.
- مزامنة متعددة المصادر، Idempotent، مع `sync_logs` مستقل لكل مصدر.
- Vercel Cron محمي بـ `CRON_SECRET`.
- بيانات Mock معطلة افتراضيًا ولا تعمل إلا عند `ALLOW_MOCK_DATA=true`.

## التشغيل المحلي

```bash
npm install
cp .env.example .env.local
npm run dev
```

التحقق:

```bash
npm run lint
npm run typecheck
npm run build
```

## إعداد Supabase

1. أنشئ مشروع Supabase.
2. شغّل `supabase/migrations/001_initial_schema.sql` في SQL Editor.
3. اضبط `NEXT_PUBLIC_SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY`.
4. أنشئ `CRON_SECRET` قويًا.
5. اترك `DATA_SOURCES=muqawil-projects` أو أضف مصادر أخرى مفصولة بفاصلة.
6. شغّل المزامنة:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync
```

إذا كانت Supabase غير معدة أو كان جدول `tenders` فارغًا، يستخدم التطبيق المصدر الحي العام مباشرة. بعد نجاح المزامنة، يقرأ التطبيق من قاعدة البيانات.

## إعداد مصادر البيانات

```env
DATA_SOURCES=muqawil-projects
MUQAWIL_PROJECTS_MAX_PAGES=5
MUQAWIL_LIVE_MAX_PAGES=3
ALLOW_MOCK_DATA=false
```

لتشغيل اعتماد بجانب مقاول بعد الحصول على الإعدادات الرسمية:

```env
DATA_SOURCES=muqawil-projects,etimad-public
ETIMAD_OPEN_DATA_BASE_URL=
ETIMAD_OPEN_DATA_GROUP_ID=
ETIMAD_OPEN_DATA_FILE_FORMAT=2
```

المشروع لا يتجاوز تسجيل الدخول أو CAPTCHA أو Rate Limits ولا يستخدم بيانات خاصة. المصادر التي تتطلب تسجيلًا أو تأهيلًا تظهر في كتالوج المصادر كقنوات فرص، ولا يتم سحب محتواها المحمي آليًا.

## API

- `GET /api/tenders`
- `GET /api/tenders/:id`
- `GET /api/companies/:slug`
- `GET /api/analytics`
- `GET /api/cron/sync`

أمثلة:

```text
/api/tenders?q=تشييد&page=1&pageSize=25
/api/tenders?region=region-id&status=open&sort=publicationDate&order=desc
```

## النشر على Vercel

- اربط المستودع بمشروع Vercel.
- أضف متغيرات البيئة الموجودة في `.env.example`.
- نفّذ Deployment.
- `vercel.json` يشغّل `/api/cron/sync` دوريًا حسب الإعداد الحالي.

## الأمان وجودة البيانات

- Service Role لا يصل إلى Client Components.
- الوصول إلى Supabase يتم Server-side.
- RLS مفعّل ولا توجد سياسات عامة افتراضيًا.
- Cron محمي بـ Bearer secret.
- Query Parameters مقيدة ومتحقق منها بـ Zod.
- كل سجل حي يحتفظ بـ `sourceUrl` للعودة إلى المصدر الأصلي.
- لا يتم تقديم بيانات Mock على أنها بيانات سوق حقيقية.
