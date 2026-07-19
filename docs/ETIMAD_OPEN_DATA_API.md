# تكامل Open Data API الرسمي لمنصة اعتماد

هذا المشروع لا يستخدم scraping ولا يتجاوز تسجيل الدخول أو CAPTCHA أو Rate Limits أو أي قيد وصول غير عام.

## ما هو موثق رسميًا

دليل التكامل الرسمي لـ Open Data API في منصة اعتماد يعرّف الطلب بالشكل التالي:

```text
GET {BASE_URL}/etimad/v1/opendata/{groupId}?fileFormat={fileFormat}
X_MOF_RqUID: <UUID>
```

قيم `fileFormat` الموثقة:

- `1`: XML
- `2`: JSON
- `3`: CSV
- `4`: XLSX

الموصل الحالي يستخدم JSON افتراضيًا (`fileFormat=2`) ويولد `X_MOF_RqUID` جديدًا لكل طلب.

## متغيرات البيئة

```env
DATA_SOURCE=etimad-public
ETIMAD_OPEN_DATA_BASE_URL=
ETIMAD_OPEN_DATA_GROUP_ID=
ETIMAD_OPEN_DATA_FILE_FORMAT=2
```

- `ETIMAD_OPEN_DATA_BASE_URL`: عنوان الخادم الرسمي الذي توفره منصة اعتماد أو بوابة المطورين.
- `ETIMAD_OPEN_DATA_GROUP_ID`: معرّف مجموعة بيانات المنافسات.
- `ETIMAD_OPEN_DATA_FILE_FORMAT`: اختياري؛ الافتراضي `2`.

يوجد كذلك `ETIMAD_PUBLIC_API_URL` كمسار مباشر قديم للتوافق الخلفي، وعند ضبطه تكون له الأولوية.

## لماذا لا توجد قيم جاهزة في المستودع؟

الدليل العام المنشور يعرض عنوان الخادم بصيغة placeholder (`[Server IP]:[port]`) ولا ينشر قيمة `groupId` الفعلية لمجموعة المنافسات. لذلك لا يتم تخمين هاتين القيمتين أو استخدام endpoint غير موثق.

## شكل الاستجابة

الدليل يعرّف عنصر استجابة باسم `File` ويصفه بأنه Streaming. الموصل يتعامل دفاعيًا مع أكثر الأشكال الشائعة:

- مصفوفة JSON مباشرة.
- `File` / `file` / `Data` / `items` / `records` كمصفوفة.
- JSON نصي داخل `File`.
- JSON مشفر Base64 داخل `File`.

بعد ذلك يتم تحويل الحقول الشائعة العربية والإنجليزية إلى نموذج `Tender` الداخلي مع IDs ثابتة قابلة لإعادة المزامنة دون تكرار.

## التفعيل

1. الحصول على `BASE_URL` و`groupId` الرسميين.
2. إضافة القيم إلى Vercel Environment Variables.
3. تغيير `DATA_SOURCE` إلى `etimad-public`.
4. تشغيل `/api/cron/sync` عبر Vercel Cron أو يدويًا مع `CRON_SECRET`.

في حال عدم توفر الإعدادات، يبقى التطبيق على `DATA_SOURCE=mock` ويعمل دون تعطيل الواجهة.
