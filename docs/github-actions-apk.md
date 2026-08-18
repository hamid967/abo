# بناء APK وAAB موقّع عبر GitHub Actions

يوفر الملف `.github/workflows/android-debug-apk.yml` بناءً يدوياً لتطبيق أبو مشعل على Android. ينتج الخيار `debug` ملف APK للاختبار، وينتج الخيار `release` ملف APK موقّعاً عند تهيئة أسرار keystore، كما ينتج `release` مع صيغة `aab` حزمة Google Play موقّعة.

## التشغيل

بعد وصول الملف إلى المستودع على GitHub، افتح تبويب **Actions**، واختر **Build Android Package**، ثم اضغط **Run workflow**. اختر `apk` للاختبار السريع أو التوزيع الداخلي. لإصدار Google Play اختر `release` و`aab`؛ يظهر الملف الناتج ضمن Artifacts عند اكتمال المهمة.

> صيغة AAB مخصصة للتوزيع عبر Google Play ولا تقبل نسخة `debug` في سير العمل.

## إعداد Firebase اختياري

إذا كانت إشعارات FCM مهيأة، أضف Secret في المستودع باسم `GOOGLE_SERVICES_JSON_BASE64` يحتوي على المحتوى المشفر Base64 لملف `google-services.json`. يستعيده سير العمل أثناء البناء فقط، ولا يحفظ الملف في المستودع أو ضمن Artifact.

## أسرار توقيع الإصدار الإلزامية

أنشئ keystore Android مرة واحدة فقط واحتفظ بنسخة احتياطية مشفرة خارج GitHub. أضف الأسرار التالية في **Settings → Secrets and variables → Actions** في المستودع، ولا تضعها في الشيفرة أو المحادثة:

| السر | القيمة |
|---|---|
| `ANDROID_RELEASE_KEYSTORE_BASE64` | محتوى ملف keystore بصيغة Base64 دون أسطر إضافية. |
| `ANDROID_RELEASE_KEYSTORE_PASSWORD` | كلمة مرور keystore. |
| `ANDROID_RELEASE_KEY_ALIAS` | اسم alias للتوقيع. |
| `ANDROID_RELEASE_KEY_PASSWORD` | كلمة مرور المفتاح. |

> لا يمكن تحديث التطبيق مستقبلاً إذا فُقد keystore أو كلمات مروره. احتفظ بنسخة احتياطية مشفرة ومقيدة الوصول قبل تشغيل أول بناء `release`.
