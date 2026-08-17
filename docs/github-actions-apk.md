# بناء APK تجريبي عبر GitHub Actions

يوفر الملف `.github/workflows/android-debug-apk.yml` بناءً يدوياً لتطبيق أبو مشعل على Android. ينتج البناء ملف **Debug APK قابل للتثبيت للاختبار**، وليس ملفاً موقّعاً للنشر على Google Play.

## التشغيل

بعد وصول الملف إلى المستودع على GitHub، افتح تبويب **Actions**، واختر **Build Android Debug APK**، ثم اضغط **Run workflow**. سيظهر الملف الناتج باسم `abu-mishal-android-debug-apk` ضمن Artifacts عند اكتمال المهمة.

## إعداد Firebase اختياري

إذا كانت إشعارات FCM مهيأة، أضف Secret في المستودع باسم `GOOGLE_SERVICES_JSON_BASE64` يحتوي على المحتوى المشفر Base64 لملف `google-services.json`. يستعيده سير العمل أثناء البناء فقط، ولا يحفظ الملف في المستودع أو ضمن Artifact.

## الحدود

هذا المسار مناسب لاختبار APK دون حصة Expo. إنشاء إصدار إنتاج موقّع يحتاج لاحقاً إلى Keystore Android ضمن أسرار GitHub، وإلى إعداد FCM/APNs الخارجي لاختبار الإشعارات الفورية على جهاز حقيقي.
