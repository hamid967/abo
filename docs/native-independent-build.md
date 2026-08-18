# بناء Android للتطبيق المستقل

المسار المعتمد للحزمة المستقلة هو سير **Build Independent Android Package** في GitHub Actions. لا يستدعي هذا السير Expo أو EAS؛ يدخل مباشرة إلى `native-independent`، ويثبت الاعتمادات، ويفحص TypeScript، ثم يبني Gradle حزمة موقعة.

| المدخل | القيمة |
|---|---|
| التشغيل التلقائي | أي دفع إلى `main` يغير ملفات `native-independent` أو ملف السير أو مساعد التوقيع. |
| الحزمة الافتراضية | AAB موقعة للاختبار الداخلي على Google Play. |
| الخيار اليدوي | APK موقعة للاختبار المباشر أو AAB موقعة للمتجر. |
| رقم الإصدار | يولده السير من رقم التشغيل، ليبقى أعلى من الإصدارات السابقة. |
| هوية Android | `com.app.governmenttransactionstracker` للحفاظ على مسار تحديث التطبيق الحالي. |

## أسرار GitHub المطلوبة

تُحفظ الأسرار التالية في **Settings → Secrets and variables → Actions** بالمستودع، ولا توضع في الشيفرة أو ملفات Gradle.

| السر | الغرض |
|---|---|
| `ANDROID_RELEASE_KEYSTORE_BASE64` | ملف keystore مشفر بصيغة Base64. |
| `ANDROID_RELEASE_KEYSTORE_PASSWORD` | كلمة مرور ملف keystore. |
| `ANDROID_RELEASE_KEY_ALIAS` | اسم مفتاح الإصدار. |
| `ANDROID_RELEASE_KEY_PASSWORD` | كلمة مرور مفتاح الإصدار. |

بعد اكتمال التشغيل، نزّل Artifact باسم `abu-mishal-native-aab-<run>` لرفعه إلى Google Play Internal testing، أو `abu-mishal-native-apk-<run>` لاختبار Android يدوياً. لا ترفع APK إلى Google Play؛ المتجر يتطلب AAB.
