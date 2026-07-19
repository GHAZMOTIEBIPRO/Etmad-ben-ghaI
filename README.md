# اعتماد بلس — Etimad Plus

منصة عربية سعودية لعرض وتحليل بيانات المنافسات والترسيات الحكومية، مبنية بـ Next.js وTypeScript وTailwind CSS وPostgreSQL/Supabase.

> التطبيق يعمل افتراضيًا ببيانات Mock واقعية لأغراض الـMVP. طبقة `src/lib/data-sources` مستقلة ومهيأة لاستبدال المصدر بواجهة حكومية عامة وموثقة دون إعادة بناء الواجهة.

## المزايا

- Dashboard عربية RTL ومتجاوبة.
- بحث شامل مع Debouncing.
- فلتر «الترسيات فقط» وفلاتر متقدمة.
- Server-side filtering, sorting, pagination.
- صفحة لكل منافسة وصفحة لكل شركة/مورد.
- تحليلات للشركات والجهات والمناطق والأنشطة والفترات الزمنية.
- API Routes مع Zod validation.
- PostgreSQL schema مع PK/FK/Unique Constraints/Indexes و`pg_trgm`.
- مزامنة Idempotent عبر Upsert و`sync_logs`.
- Vercel Cron محمي بـ `CRON_SECRET`.
- Mock fallback تلقائي عند عدم إعداد Supabase.

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
5. ابدأ بـ `DATA_SOURCE=mock`.
6. شغّل المزامنة:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync
```

بعد تعبئة Supabase سيقرأ التطبيق من قاعدة البيانات تلقائيًا بدل Mock Data.

## API

- `GET /api/tenders`
- `GET /api/tenders/:id`
- `GET /api/companies/:slug`
- `GET /api/analytics`
- `GET /api/cron/sync`

أمثلة:

```text
/api/tenders?q=تشغيل&awarded=true&page=1&pageSize=25
/api/tenders?region=reg-riyadh&awardMin=10000000&sort=awardAmount&order=desc
```

## مصدر بيانات اعتماد

لا يقوم المشروع بأي Scraping أو تجاوز تسجيل دخول أو Captcha أو Rate Limits. الموصل `EtimadOpenDataConnector` نقطة تكامل فقط، ويجب ضبط `ETIMAD_PUBLIC_API_URL` بعد التحقق من Endpoint رسمي عام ومسموح وشكل بياناته الموثق.

```env
DATA_SOURCE=etimad-public
ETIMAD_PUBLIC_API_URL=https://verified-public-endpoint.example
```

## النشر على Vercel

- اربط المستودع بمشروع Vercel.
- أضف متغيرات البيئة الموجودة في `.env.example`.
- نفّذ Deployment.
- `vercel.json` يشغّل `/api/cron/sync` يوميًا.

إذا لم تُضبط Supabase فالموقع يبقى عاملًا على Mock Data بدل التعطل.

## الأمان

- Service Role لا يصل إلى Client Components.
- الوصول إلى Supabase يتم Server-side.
- RLS مفعّل ولا توجد سياسات عامة افتراضيًا.
- Cron محمي بـ Bearer secret.
- Query Parameters مقيدة ومتحقق منها بـ Zod.
