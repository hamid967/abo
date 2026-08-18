# جاهزية البناء المجاني لأبو مشعل

**الحالة:** جاهز لبناء Android الموقّع عبر GitHub Actions دون Expo Build السحابي.

## النتيجة

لا يحتوي المشروع على `eas.json` أو إعداد مشروع EAS أو `EXPO_TOKEN`. يستعمل ملف التكوين `app.config.js` وحدات Expo مفتوحة المصدر وExpo CLI لتوليد مشروع Android محلياً داخل عامل GitHub فقط؛ لا يستدعي هذا الأمر خدمة Expo Build أو حصة بناء مدفوعة.

> ظهور رسالة `Expo build quota exceeded` في لوحة النشر يخص زر **Build APK** في تلك اللوحة فقط. لا يمنع تشغيل التطبيق عبر Expo Go، ولا يمنع بناء APK أو AAB الموقعين عبر GitHub Actions.

| المجال | التحقق | الحالة |
|---|---|---|
| هوية Android | `package` و`versionCode` موجودان في `app.config.js` | جاهز |
| حزمة الإصدار APK | تشغيل GitHub Actions `32094007348` نجح | جاهز للاختبار الداخلي |
| حزمة المتجر AAB | تشغيل GitHub Actions `32101694976` نجح | جاهز لـGoogle Play Internal testing |
| توقيع الإصدار | keystore مستعاد من أسرار GitHub فقط | جاهز |
| FCM | ملف `google-services.json` اختياري ويُنشأ من سر GitHub عند توفره | لا يمنع البناء |
| APNs | إعداد خارجي مطلوب فقط لإشعارات iOS الفعلية | لا يمنع Android |

## مسار البناء المعتمد

1. افتح [Actions في مستودع أبو مشعل](https://github.com/hamid967/abo/actions).
2. اختر **Build Android Package** ثم **Run workflow**.
3. لاختبار Android اختر `release` و`apk`، ولـGoogle Play اختر `release` و`aab`.
4. نزّل Artifact الناتج من نفس التشغيل. لا تستخدم زر **Build APK** في لوحة Expo.

## أسرار GitHub المطلوبة للإصدار فقط

يحتاج بناء `release` هذه الأسرار الموجودة في GitHub Actions: `ANDROID_RELEASE_KEYSTORE_BASE64` و`ANDROID_RELEASE_KEYSTORE_PASSWORD` و`ANDROID_RELEASE_KEY_ALIAS` و`ANDROID_RELEASE_KEY_PASSWORD`. لا تظهر هذه القيم في سجل البناء أو في المستودع.

## حدود النشر

يتم نشر الخلفية من لوحة المشروع في إجراء مستقل عن الحزم. عند ظهور `Backend Service — Unpublished changes`، ينفذ مالك الحساب نشر الخلفية من بطاقتها. لا يتطلب ذلك Expo Build ولا يغير توقيع Android.
