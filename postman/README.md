# Postman — تجربة كل عمليات Sanad Youth

هذا المجلد يحتوي مجموعة Postman جاهزة تغطي كل الـ endpoints في المشروع:

- `Sanad-Youth.postman_collection.json` — المجموعة نفسها (63 طلبًا، و68 عند احتساب طلبات سكربت التزامن).
- `Sanad-Youth-Local.postman_environment.json` — متغيرات البيئة المحلية.
- `fixtures/` — ملفات صغيرة لاختبار رفع السيرة الذاتية، صورة البرنامج، والمادة.

## الاستيراد

1. افتح Postman.
2. `Import` ثم اختر الملفين:
   - `Sanad-Youth.postman_collection.json`
   - `Sanad-Youth-Local.postman_environment.json`
3. اختر Environment باسم **Sanad Youth - Local** من أعلى اليمين.
4. تأكد أن الخادم يعمل على `http://localhost:3000/api`.

## التشغيل

شغّل المجلدات بالترتيب. يمكنك استخدام `Collection Runner` وتشغيل المجموعة كاملة، أو تنفيذ كل مجلد يدويًا.

من سطر الأوامر (Newman):

```bash
npx newman run postman/Sanad-Youth.postman_collection.json \
  -e postman/Sanad-Youth-Local.postman_environment.json
```

| الترتيب | المجلد | ماذا يغطي |
|---|---|---|
| 00 | Setup | تسجيل دخول الأدمن، إنشاء مشرف، تسجيل شابين، وحفظ التوكنات |
| 01 | Supervisor | إنشاء برامج، جلسة، إعلان، صورة، ومادة |
| 02 | Public Programs | قائمة البرامج، البحث، التفاصيل، وأخطاء 400/404 |
| 03 | Youth Applications | تقديم الطلبات، رفع CV، تحميل CV، وطلباتي |
| 04 | Admin | مراجعة الطلبات، قبول/رفض، المشرفون، والإعلانات العامة |
| 05 | Youth Announcements & Materials | إعلانات الشاب، مواد البرنامج، وتحميل مادة |
| 06 | Security Checks | 403 للدور الخطأ، 400 للحقول غير المسموحة، 401 بدون توكن |
| 07 | Concurrency | سباق على آخر مقعد: 201 و409 ثم عودة المقعد بعد الرفض |
| 08 | Auth Sessions | تدوير Refresh Token، الجلسات، وإلغاء جلسة |
| 09 | Cleanup / Destructive | إلغاء الطلبات، حذف الملفات، إخفاء البرامج، وتسجيل الخروج |

## الحسابات الافتراضية

| الدور | البريد | كلمة المرور |
|---|---|---|
| Admin | `admin@sanad.local` | `Admin@12345` |
| Supervisor | `postman.supervisor@sanad.local` | `Supervisor@12345` |
| Youth 1 | `postman.youth1@sanad.local` | `Youth@12345` |
| Youth 2 | `postman.youth2@sanad.local` | `Youth@12345` |

> حساب الأدمن يجب أن يكون موجودًا مسبقًا:
> ```bash
> npm run build
> npm run seed:admin
> ```

## ملاحظات مهمة

- المجموعة **قابلة لإعادة التشغيل**: كل تشغيل ينشئ برامج جديدة، لذلك لا تتعارض الطلبات مع تشغيل سابق.
- المستخدمون (المشرف والشابان) ثابتون. أول تشغيل ينشئهم، والتشغيلات التالية تعيد 409 ثم تسجّل الدخول بنفس كلمة المرور.
- مجلد **09 - Cleanup / Destructive** يلغي الجلسات. بعد تشغيله أعد تشغيل **00 - Setup** قبل أي تجربة جديدة.
- طلبات رفع الملفات تستخدم مسارات مطلقة داخل `postman/fixtures`. إذا نقلت المشروع، أعد اختيار الملفات من `Body > form-data` في هذه الطلبات:
  - `Upload Program Image`
  - `Upload Material`
  - `Apply to CV Program with CV`
- اختبار التزامن في المجلد 07 يستخدم `pm.sendRequest` لإرسال طلبين فعليًا في نفس الوقت، ثم يتحقق من `remainingSeats` ويعيد المقعد برفض الطلب الفائز.
- إذا أردت تغيير بيانات الدخول أو عناوين البرامج، عدّل قيم البيئة من `Environments > Sanad Youth - Local`.
