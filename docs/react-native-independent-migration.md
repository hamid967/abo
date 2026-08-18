# ترحيل أبو مشعل إلى React Native مستقل

## القرار والنطاق

القرار المعتمد هو إزالة حزمة Expo ووحداتها من تطبيق الجوال، مع الإبقاء على React Native والخادم وطبقة tRPC وقاعدة البيانات وسير GitHub Actions. لا يشمل ذلك حذف بيانات المستخدم أو تغيير حزمة Android `com.app.governmenttransactionstracker` أو مفاتيح توقيع الإصدار.

الترحيل يجب أن يبقى على مراحل قابلة للاستعادة. لا تُحذف الاعتمادات الحالية نهائياً قبل أن تعمل بدائلها في Android وiOS وتنجح اختبارات التدفقات المرتبطة بها.

## خريطة البدائل

| الاعتماد الحالي | البديل المستقل | أثر الترحيل |
|---|---|---|
| `expo-router` | `@react-navigation/native` مع Native Stack وBottom Tabs | تحويل نقطة الدخول والمسارات وربط الروابط العميقة. |
| `@expo/vector-icons` و`expo-symbols` | `react-native-vector-icons` | استبدال طبقة الرموز ومكونات iOS الرمزية. |
| `expo-secure-store` | `react-native-keychain` | حفظ الجلسات والرموز داخل Keychain وAndroid Keystore. |
| `expo-local-authentication` | `react-native-biometrics` مع Keychain access control | إعادة ربط البصمة وFace ID وقفل التطبيق. |
| `expo-notifications` | Firebase Messaging وNotifee | استقبال دفع الإشعارات وعرض التنبيهات والتعامل مع الفتح. |
| `expo-calendar` | `react-native-calendar-events` | إضافة المواعيد للتقويم بعد موافقة المستخدم. |
| `expo-camera` و`expo-document-picker` | Vision Camera و`react-native-document-picker` | المسح ورفع المستندات مع أذونات أصلية. |
| `expo-audio` | وحدة تسجيل/تشغيل صوت أصلية | الإدخال الصوتي للمحادثة ومؤشر مدة التسجيل. |
| `expo-image` و`expo-video` | `react-native-fast-image` و`react-native-video` | عرض الوسائط مع التخزين المؤقت والتشغيل. |
| `expo-linking` و`expo-web-browser` | React Native Linking وInAppBrowser | عودة OAuth والروابط العميقة. |
| `expo-network` و`expo-clipboard` و`expo-haptics` | NetInfo وClipboard وHaptic Feedback | الحفاظ على حالة الشبكة والنسخ والتغذية اللمسية. |
| `expo-splash-screen` و`expo-font` و`expo-asset` | Bootsplash وربط أصول React Native | شاشة الإقلاع والخط العربي والأصول المضمنة. |
| `expo-build-properties` | إعدادات Gradle وPodfile مباشرة | تكوين SDK والأذونات والاعتمادات الأصلية. |

## تسلسل التنفيذ

1. إنشاء نقطة دخول React Native أصلية، وتهيئة Android وiOS، وإعداد Metro مستقل من Expo.
2. نقل التنقل إلى React Navigation مع طبقة توافق مؤقتة تمنع كسر شاشات التطبيق أثناء نقلها تباعاً.
3. نقل طبقات المصادقة والروابط العميقة والتخزين الآمن قبل إزالة أي رمز يعتمد على Expo Router أو Secure Store.
4. استبدال الميزات الأصلية حسب الأولوية: الإشعارات، البصمة، الشبكة، المستندات/الكاميرا، الصوت، التقويم، ثم الوسائط.
5. نقل العلامة وشاشة الإقلاع والرموز والخطوط إلى مشاريع Android وiOS الأصلية.
6. إزالة الاعتمادات وإعدادات Expo بعد نجاح فحوصات Android وiOS، ثم تشغيل حزم GitHub Actions الموقّعة.

## ضوابط الأمان والإطلاق

لا توضع مفاتيح Firebase أو APNs أو OAuth أو التوقيع في مستودع التطبيق. يجب أن تظل الأسرار في GitHub Actions أو في خادم أبو مشعل. لا يحمل الرابط العميق رمز جلسة أو بيانات حساسة؛ يمرر OAuth رمز تحقق قصير العمر مع PKCE ثم يستبدل بخادم التطبيق. تظل حزم Android موقعة بنفس keystore الحالي للحفاظ على قدرة المستخدمين على التحديث.

## معايير اكتمال الترحيل

يكتمل الحذف فقط عند زوال `expo` و`expo-*` و`@expo/*` و`expo-router` من `package.json` ومن نقطة الدخول وسير البناء، مع نجاح فحص TypeScript واختبارات الانحدار وبناء Android الموقّع على GitHub Actions. يحتاج إصدار iOS النهائي إلى بناء وتوقيع على عامل macOS واختبار قبول فعلي على iPhone وiPad.
