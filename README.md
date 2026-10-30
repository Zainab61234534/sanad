# سند الشباب — Backend

خدمة خلفية (REST API) لمنصة **سند الشباب**، مبنية بـ **NestJS + PostgreSQL + Prisma**. تدير البرامج التدريبية، التقديم وحجز المقاعد، الجلسات، المواد، الإعلانات، والصلاحيات لثلاثة أدوار: **شاب (YOUTH)**، **مشرف (SUPERVISOR)**، **أدمن (ADMIN)**.

---

## المحتويات

- [التقنيات](#التقنيات)
- [الأدوار والصلاحيات](#الأدوار والصلاحيات)
- [التشغيل السريع](#التشغيل-السريع)
- [متغيرات البيئة](#متغيرات-البيئة)
- [المسارات (API)](#المسارات-api)
- [Postman](#postman)
- [رحلة الشاب](#رحلة-الشاب)
- [قواعد المقاعد والتزامن](#قواعد-المقاعد-والتزامن)
- [حالات الطلب](#حالات-الطلب)
- [التخزين المؤقت (Cache)](#التخزين-المؤقت-cache)
- [الرفع والملفات](#الرفع-والملفات)
- [الأمان](#الأمان)
- [الاختبارات](#الاختبارات)
- [هيكل المشروع](#هيكل-المشروع)
- [قرارات تصميمية وحدود النطاق](#قرارات-تصميمية-وحدود-النطاق)

---

## التقنيات

| الطبقة | التقنية |
|---|---|
| الإطار | NestJS 12 |
| قاعدة البيانات | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`) |
| المصادقة | JWT Access Token + Refresh Token rotation |
| التشفير | bcrypt (cost 12) + SHA-256 لتخزين Refresh Token |
| التحقق | class-validator / class-transformer + `ValidationPipe` عام |
| الرفع | Multer (disk storage) + فحص magic bytes |
| الكاش | `@nestjs/cache-manager` مع مفاتيح مُصدّرة (versioned keys) |
| التوثيق | زخارف Swagger (`@ApiTags`, `@ApiConsumes`) — بدون واجهة `/docs` |
| الاختبارات | Vitest + Supertest |

---

## الأدوار والصلاحيات

### شاب — `YOUTH`

- يتصفح البرامج المنشورة (`isPublished = true`) ويقرأ تفاصيلها.
- يقدّم على برنامج **مرة واحدة فقط** مع رفع السيرة الذاتية (اختياري، PDF فقط).
- يتابع طلباته ويلغي طلبه (قيد المراجعة أو المقبول).
- يرى الإعلانات العامة + إعلانات البرامج التي قُبل فيها.
- يحمّل مواد البرامج التي قُبل فيها فقط.

### مشرف — `SUPERVISOR`

- ينشئ برامجه ويعدّلها (لا يستطيع تعديل برنامج مشرف آخر).
- يخفي البرنامج عبر `isPublished = false` بدل الحذف.
- يدير جلسات برامجه (إضافة/تعديل/حذف).
- يرفع مواد برامجه ويحذفها.
- ينشر إعلانات لبرامجه فقط.
- **لا** يراجع طلبات التقديم.

### أدمن — `ADMIN`

- يضيف المشرفين ويعرضهم.
- يراجع طلبات التقديم: قبول أو رفض مع ملاحظة.
- يعرض السير الذاتية المرفقة.
- ينشر ويعدّل ويحذف الإعلانات العامة.
- يستطيع الوصول لمواد أي برنامج.

> جميع الصلاحيات مفروضة على مستوى الخادم عبر `JwtAuthGuard` + `RolesGuard` العامّين، وليس عبر إخفاء الواجهة فقط.

---

## التشغيل السريع

### 1) المتطلبات

- Node.js 20+ (المشروع مُختبر على Node 24).
- PostgreSQL يعمل محليًا أو سحابيًا.

### 2) تثبيت الحزم

```bash
npm install
```

### 3) إنشاء ملف `.env`

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/sanad?schema=public"
JWT_SECRET="ضع-هنا-سرًا-طويلًا-وعشوائيًا"
REFRESH_TTL_DAYS=30
PORT=3000
```

### 4) تطبيق مخطط قاعدة البيانات

```bash
# في بيئة التطوير
npx prisma migrate dev

# أو على قاعدة موجودة مسبقًا
npx prisma migrate deploy
```

### 5) إنشاء أول حساب أدمن

```bash
npm run build
npm run seed:admin
```

يحاول السكربت إنشاء/التأكد من الحساب:

- البريد: `admin@sanad.local`
- كلمة المرور: `Admin@12345`

> **غيّر كلمة المرور فورًا في أي بيئة غير محلية.** السكربت لا يغيّر كلمة مرور حساب موجود مسبقًا (`update: {}`).

### 6) تشغيل الخادم

```bash
# تطوير (watch)
npm run start:dev

# إنتاج (يتطلب build أولًا)
npm run build
npm run start:prod
```

- العنوان الأساسي: `http://localhost:3000/api`
- البادئة `/api` مطبّقة على كل المسارات.
- لا توجد واجهة أمامية في هذا المستودع؛ التعامل يتم عبر REST/Swagger.

---

## متغيرات البيئة

| المتغير | مطلوب | الوصف |
|---|---|---|
| `DATABASE_URL` | نعم | رابط اتصال PostgreSQL. |
| `JWT_SECRET` | نعم | سر توقيع Access Tokens؛ استخدم قيمة طويلة وعشوائية. |
| `REFRESH_TTL_DAYS` | لا | مدة صلاحية Refresh Token بالأيام (الافتراضي 30). |
| `PORT` | لا | منفذ الخادم (الافتراضي 3000). |
| `THROTTLE_DISABLED` | لا | `true` لتعطيل Rate Limiting محليًا/أثناء الاختبارات. |
| `OBSERVE_APP_KEY` / `OBSERVE_APP_SECRET` | لا | تكامل NestJS Observe (اختياري). بدونهما يعمل التطبيق ويطبع تحذيرًا فقط. |
| `JWT_ACCESS_EXPIRES_IN_SECONDS` | لا | محجوز حاليًا؛ صلاحية Access Token ثابتة على ساعة واحدة. |

---

## المسارات (API)

> كل المسارات تبدأ بـ `/api`. الحقول `page` و`limit` اختيارية (الافتراضي 1 و10، والحد الأقصى 50).
> الاستجابات المُصفّحة: `{ items, meta: { page, limit, total, totalPages } }`.

### المصادقة

| Method | Path | الصلاحية | الوصف |
|---|---|---|---|
| `POST` | `/api/auth/register` | عام | تسجيل شاب جديد فقط (أي `role` مرسل يُرفض بـ 400). |
| `POST` | `/api/auth/login` | عام (5/دقيقة) | تسجيل الدخول وإرجاع Access + Refresh. |
| `POST` | `/api/auth/refresh` | عام (20/دقيقة) | تدوير Refresh Token مع كشف إعادة الاستخدام. |
| `POST` | `/api/auth/logout` | مصادق | إلغاء الجلسة الحالية. |
| `POST` | `/api/auth/logout-all` | مصادق | إلغاء كل جلسات المستخدم. |
| `GET` | `/api/auth/sessions` | مصادق | جلسات المستخدم النشطة (بدون أي hash). |
| `DELETE` | `/api/auth/sessions/:id` | مصادق | إلغاء جلسة يملكها المستخدم. |
| `GET` | `/api/auth/me` | مصادق | بيانات المستخدم الحالي. |

### البرامج

| Method | Path | الصلاحية | الوصف |
|---|---|---|---|
| `GET` | `/api/programs` | عام | البرامج المنشورة؛ يدعم `search`. |
| `GET` | `/api/programs/:id` | عام | تفاصيل البرنامج + الجلسات + المقاعد المتبقية. |
| `POST` | `/api/supervisor/programs` | مشرف | إنشاء برنامج (المشرف يؤخذ من التوكن). |
| `GET` | `/api/supervisor/programs` | مشرف | برامج المشرف الحالي. |
| `PATCH` | `/api/supervisor/programs/:id` | مشرف (مالك) | تعديل؛ لا يمكن تقليل السعة تحت المحجوز. |
| `POST` | `/api/supervisor/programs/:id/image` | مشرف (مالك) | رفع صورة (multipart، الحقل `image`). |

### الجلسات

| Method | Path | الصلاحية | الوصف |
|---|---|---|---|
| `POST` | `/api/supervisor/programs/:programId/sessions` | مشرف (مالك) | إضافة جلسة. |
| `PATCH` | `/api/supervisor/sessions/:id` | مشرف (مالك) | تعديل جلسة. |
| `DELETE` | `/api/supervisor/sessions/:id` | مشرف (مالك) | حذف جلسة. |

### طلبات التقديم

| Method | Path | الصلاحية | الوصف |
|---|---|---|---|
| `POST` | `/api/programs/:programId/applications` | شاب (10/دقيقة) | تقديم + حجز مقعد؛ ملف `cv` اختياري (PDF ≤ 5MB). |
| `GET` | `/api/applications/me` | شاب | طلبات الشاب الحالي؛ فلتر `status`. |
| `GET` | `/api/applications/:id/cv` | شاب (صاحب الطلب) أو أدمن | تنزيل السيرة الذاتية. |
| `PATCH` | `/api/applications/:id/cancel` | شاب (صاحب الطلب) | إلغاء طلب قيد المراجعة أو مقبول. |
| `GET` | `/api/admin/applications` | أدمن | كل الطلبات؛ فلاتر `status` و`programId`. |
| `PATCH` | `/api/admin/applications/:id/accept` | أدمن | قبول الطلب. |
| `PATCH` | `/api/admin/applications/:id/reject` | أدمن | رفض الطلب وإرجاع المقعد. |

### الإعلانات

| Method | Path | الصلاحية | الوصف |
|---|---|---|---|
| `GET` | `/api/announcements` | شاب | الإعلانات العامة + إعلانات برامجه المقبول فيها. |
| `GET` | `/api/announcements/general` | مصادق | الإعلانات العامة فقط (مُخزّنة مؤقتًا). |
| `POST` | `/api/supervisor/programs/:programId/announcements` | مشرف (مالك) | إعلان لبرنامج. |
| `POST` | `/api/admin/announcements` | أدمن | إعلان عام. |
| `PATCH` | `/api/admin/announcements/:id` | أدمن | تعديل إعلان عام. |
| `DELETE` | `/api/admin/announcements/:id` | أدمن | حذف إعلان عام. |

### المواد

| Method | Path | الصلاحية | الوصف |
|---|---|---|---|
| `POST` | `/api/supervisor/programs/:programId/materials` | مشرف (مالك) | رفع مادة؛ الحقول `file` و`title`. |
| `GET` | `/api/programs/:programId/materials` | أدمن/مشرف مالك/شاب مقبول | قائمة مواد البرنامج. |
| `GET` | `/api/materials/:id/download` | نفس صلاحية العرض | تنزيل المادة. |
| `DELETE` | `/api/supervisor/materials/:id` | مشرف (مالك) | حذف المادة وملفها. |

### إدارة المشرفين

| Method | Path | الصلاحية | الوصف |
|---|---|---|---|
| `POST` | `/api/admin/supervisors` | أدمن | إنشاء مشرف. |
| `GET` | `/api/admin/supervisors` | أدمن | عرض المشرفين. |

---

## Postman

توجد مجموعة جاهزة في [`postman/`](postman/) لتجربة كل العمليات (63 طلبًا + سكربت تزامن) مع بيئة محلية وملفات تجريبية:

- `postman/Sanad-Youth.postman_collection.json`
- `postman/Sanad-Youth-Local.postman_environment.json`

خطوات سريعة:

1. استورد الملفين إلى Postman واختر بيئة **Sanad Youth - Local**.
2. شغّل مجلد **00 - Setup** أولًا.
3. شغّل بقية المجلدات بالترتيب (أو استخدم Collection Runner).
4. مجلد **09 - Cleanup / Destructive** يلغي الجلسات، لذا أعد تشغيل **00 - Setup** بعده.

بيانات الدخول الافتراضية: `admin@sanad.local` / `Admin@12345` (بعد `npm run seed:admin`). تفاصيل أكثر في [`postman/README.md`](postman/README.md).

---

## رحلة الشاب

1. `POST /api/auth/register` ثم `POST /api/auth/login`.
2. `GET /api/programs` ثم `GET /api/programs/:id` لاختيار برنامج.
3. `POST /api/programs/:programId/applications` مع `cv` اختياري.
4. `GET /api/applications/me` لمتابعة الحالة.
5. بعد القبول: `GET /api/announcements` و`GET /api/programs/:programId/materials`.
6. عند الحاجة: `PATCH /api/applications/:id/cancel`.

---

## قواعد المقاعد والتزامن

الهدف: **عدم تجاوز السعة مطلقًا** حتى لو وصلت طلبات متزامنة في نفس اللحظة.

### عند التقديم

```text
1) إنشاء الطلب داخل Transaction.
   القيد الفريد (userId, programId) يمنع التقديم المكرر فورًا (P2002 → 409).

2) حجز ذري مشروط:
   UPDATE programs
   SET reservedSeats = reservedSeats + 1
   WHERE id = :programId
     AND isPublished = true
     AND reservedSeats < capacity;

3) إذا أعاد UPDATE صفر صفوف:
   - البرنامج موجود ومنشور → 409 "اكتمل عدد المقاعد"
   - غير موجود/غير منشور → 404

4) أي استثناء يُلغي العملية بالكامل (rollback)، فلا يبقى طلب بلا مقعد.
```

### عند القبول/الرفض/الإلغاء

- **القبول** لا يغيّر `reservedSeats` لأن المقعد محجوز منذ التقديم.
- **الرفض** أو **الإلغاء** ينقص `reservedSeats` بشرط `> 0`.
- الانتقال يتم بـ `updateMany` مشروط بالحالة الحالية، لذلك:
  - إلغاء ورفض متزامنان: واحد فقط ينجح، والآخر يحصل على `409`، ولا يُرجَع المقعد مرتين.
- لا يمكن للمشرف تقليل `capacity` إلى أقل من `reservedSeats` (يُرفض بـ `409`).

### اختبار الحالة الصعبة

الاختبار التكاملي `test/app.e2e-spec.ts` ينشئ برنامجًا بسعة **1**، ثم يرسل طلبين متزامنين من شابين مختلفين ويتحقق من:

- نجاح طلب واحد فقط (`201`) والآخر `409`.
- بقاء `reservedSeats = 1` (وليس 2).
- عودة المقعد إلى `0` بعد الرفض/الإلغاء.

---

## حالات الطلب

```text
PENDING ──accept──▶ ACCEPTED ──cancel──▶ CANCELED
   │
   ├──reject──▶ REJECTED
   └──cancel──▶ CANCELED
```

- لا يُقبل/يُرفض إلا طلب `PENDING`.
- الإلغاء متاح من `PENDING` أو `ACCEPTED`.
- القيد الفريد `(userId, programId)` يعني **عدم إمكانية إعادة التقديم** بعد الإلغاء أو الرفض. هذا قرار مقصود لمنع التكرار.

---

## التخزين المؤقت (Cache)

| البيانات | TTL | الإبطال |
|---|---|---|
| تفاصيل البرنامج (البيانات الثابتة) | 5 دقائق | `create/update/setImage` عبر `cache.bump('program:id')` |
| الإعلانات العامة (صفحات 1–10) | 60 ثانية | إنشاء/تعديل/حذف إعلان عام |
| المقاعد المتبقية | **بدون كاش** | استعلام مباشر بالمفتاح الأساسي |

- المفاتيح مُصدّرة (versioned) لتفادي قراءة بيانات قديمة بعد الإبطال.
- إعلانات البرامج والمواد لا تُخزّن مؤقتًا.

---

## الرفع والملفات

| النوع | المجلد | الامتدادات | الحد |
|---|---|---|---|
| سيرة ذاتية (`cv`) | `uploads/cv` | `.pdf` | 5MB |
| صورة برنامج (`image`) | `uploads/images` | `.jpg`, `.jpeg`, `.png`, `.webp` | 2MB |
| مادة (`material`) | `uploads/materials` | `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.jpg`, `.jpeg`, `.png` | 20MB |

- أسماء الملفات عشوائية (`UUID`) وليست اسم العميل.
- بعد الحفظ يتم فحص **magic bytes** للتأكد من مطابقة المحتوى للامتداد.
- `UploadCleanupInterceptor` يحذف الملف إذا فشل أي تحقق/منطق/حفظ لاحق.
- حماية من Path Traversal عند القراءة/الحذف.
- استبدال صورة برنامج يحذف الصورة القديمة.
- حذف مادة يحذف ملفها من القرص.
- التنزيل يتم بـ `StreamableFile` مع `Content-Disposition` آمن.

---

## الأمان

- **كلمات المرور:** bcrypt cost 12، ولا تُرجَع أبدًا في الاستجابات.
- **تسجيل الدخول:** رسالة خطأ موحّدة + `DUMMY_HASH` لتقليل تسريب توقيت وجود البريد.
- **Refresh Tokens:**
  - يتكوّن من `sessionId.secret` عشوائي 48 بايت.
  - يُخزَّن SHA-256 فقط.
  - تدوير إلزامي عند كل تجديد.
  - إعادة استخدام توكن قديم تُلغي الجلسة كاملة (Reuse Detection).
- **Access Token:** JWT موقّع، يحتوي `sub` و`sid` و`role`، صلاحية ساعة.
- **الصلاحيات:** `JwtAuthGuard` عام + `RolesGuard` عام يقرأ `@Roles`.
- **منع تسريب الوجود:** محاولة تعديل/حذف مورد لا يملكه المستخدم ترجع `404` لا `403` في مسارات الملكية.
- **التحقق:** `whitelist + forbidNonWhitelisted + transform` عام، لذا:
  - `supervisorId` أو `reservedSeats` في جسم الطلب → `400`.
  - قيم `page/limit` تُحوَّل إلى أرقام بأمان.
- **Rate Limiting:** 100/دقيقة عام، 5/دقيقة لتسجيل الدخول، 20/دقيقة للتجديد، 10/دقيقة للتقديم، 20/دقيقة للرفع.
- **الأسرار:** `.env` غير مخصص للمشاركة؛ دوّر `JWT_SECRET` وكلمة مرور قاعدة البيانات قبل أي نشر.

---

## الاختبارات

### اختبارات الوحدة

```bash
npm test
```

تغطي أدوات التصفيح (`paged`, `skipTake`).

### الاختبارات التكاملية (E2E)

```bash
npm run test:e2e
```

تتطلب:

- PostgreSQL يعمل.
- ملف `.env` صالح (`DATABASE_URL`, `JWT_SECRET`).

تغطي:

1. عرض البرامج وتفاصيلها.
2. فرض الصلاحيات (شاب لا يدخل مسارات الأدمن/المشرف).
3. منع Mass Assignment عند تعديل البرنامج.
4. **سباق المقعد الأخير** (طلبان متزامنان، سعة 1).
5. القبول ثم إلغاء الشاب وعودة المقعد.
6. الرفض وعودة المقعد.
7. إنشاء الأدمن لمشرف.

> الاختبار ينشئ بيانات مؤقتة بعناوين بريد فريدة ثم يحذفها في `afterAll`. يُفضّل استخدام قاعدة بيانات اختبار منفصلة لتجنب أي أثر على بيانات التطوير.

---

## هيكل المشروع

```text
prisma/
  schema.prisma              # المخطط والعلاقات والفهارس
  migrations/                # ترحيلات قاعدة البيانات
src/
  auth/                      # تسجيل، دخول، تدوير Refresh، جلسات
  programs/                  # برامج + صور + تفاصيل + كاش
  sessions/                  # جلسات البرامج (مشرف)
  applications/              # تقديم/إلغاء/مراجعة + حجز المقاعد
  announcements/             # إعلانات عامة وبرامج
  materials/                 # رفع/عرض/تنزيل/حذف المواد
  users/                     # إدارة المشرفين (أدمن)
  common/
    guards/                  # JwtAuthGuard, RolesGuard
    decorators/              # @Public, @Roles, @CurrentUser
    dto/                     # Pagination + helpers
    cache/                   # AppCache (versioned keys)
    uploads/                 # Multer + فحص الملفات + تنظيف
    enums/                   # Role
  prisma/                    # PrismaService + PrismaModule
  generated/prisma/          # مولّد آليًا — لا تعدّله
Script/
  create-admin.ts            # إنشاء أول أدمن
test/
  app.e2e-spec.ts            # الاختبار التكاملي
uploads/                     # ملفات وقت التشغيل (خارج git)
```

---

## قرارات تصميمية وحدود النطاق

### قرارات

- **عدّاد `reservedSeats`** بدل حساب الطلبات عند كل قراءة: يسمح بحجز ذري عبر `UPDATE ... WHERE reservedSeats < capacity`.
- **الإنشاء ثم الحجز داخل Transaction**: يضمن عدم بقاء طلب بلا مقعد عند امتلاء البرنامج.
- **القبول لا يغيّر العداد**: المقعد محجوز منذ التقديم، والرفض/الإلغاء هما اللذان يحرّرانه.
- **إخفاء البرنامج بدل حذفه** (`isPublished`): يحافظ على تاريخ الطلبات والمواد.
- **`supervisorId` من التوكن دائمًا**: لا يُقبل من جسم الطلب.
- **`404` بدل `403`** في موارد الملكية: يمنع كشف وجود برامج/طلبات الآخرين.
- **الكاش للبيانات الثابتة فقط**: المقاعد تُقرأ مباشرة لضمان دقتها.

### خارج النطاق الحالي

- واجهة أمامية (Frontend).
- إشعارات بريد/SMS.
- استعادة كلمة المرور.
- حذف البرامج نهائيًا (يُستخدم `isPublished = false`).
- إعادة التقديم بعد الإلغاء/الرفض (يمنعه القيد الفريد).
- إدارة مستخدمين كاملة للأدمن (المطلوب: إضافة/عرض المشرفين).
- فحص فيروسات للملفات المرفوعة.

---

## ترخيص

مشروع خاص — `UNLICENSED`.
