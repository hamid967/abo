# مرجع إعداد APNs وFCM

**تاريخ المراجعة:** 17 أغسطس 2026

## المسار الحالي في أبو مشعل

يستخدم المشروع `expo-notifications` وخدمة Expo Push. هذا المسار يتطلب رمز Expo Push من الجهاز، ومعرّف مشروع EAS ثابت، وبيانات اعتماد FCM v1 لأندرويد وبيانات اعتماد APNs لـiOS عند بناء نسخة تطوير أو إنتاج.

## متطلبات Android

يتطلب Android مشروع Firebase وربط تطبيق Android بمعرّف الحزمة الحالي `com.app.governmenttransactionstracker`. يلزم إنشاء بيانات اعتماد FCM v1 ثم رفعها إلى إعدادات بناء التطبيق أو حفظها حصراً كسر في بيئة البناء. لا يجوز وضع ملف حساب الخدمة أو المفتاح الخاص داخل مستودع المشروع أو ضمن التطبيق.

## متطلبات iOS

يتطلب iOS عضوية Apple Developer مدفوعة، وتسجيل جهاز الاختبار قبل أول بناء تطوير، وتفعيل Push Notifications. يحتاج المسار المباشر إلى ملف مفتاح APNs بصيغة `.p8` ومعرّف المفتاح ومعرّف فريق Apple؛ أما استخدام خدمة Expo Push مع EAS فيدير بيانات اعتماد APNs أثناء إعداد البناء. يبقى المكوّن `expo-notifications` في إعداد Expo لإضافة entitlement اللازم.

## ملاحظة تصميمية

تعمل خدمة Expo Push كطبقة تسليم موحدة فوق FCM وAPNs، وتناسب المسار الخادمي الحالي في `server/mobile-push-service.ts`. لا يلزم التحول إلى إرسال مباشر لـFCM أو APNs ما لم تظهر حاجة فعلية لتحكم منخفض المستوى؛ التحول المباشر يتطلب الاحتفاظ بالرموز الأصلية وبيانات اعتماد الموردين وتوسيع خدمة الخادم.

## المراجع

1. Expo, [Push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).
2. Expo, [Send notifications with FCM and APNs](https://docs.expo.dev/push-notifications/sending-notifications-custom/).
