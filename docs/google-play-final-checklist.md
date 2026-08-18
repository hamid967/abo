# قائمة الإقفال النهائية لـ Google Play

## صفحة المتجر

| البند | المطلوب لأبو مشعل |
|---|---|
| اسم التطبيق | أبو مشعل |
| وصف قصير وطويل | استخدم النصوص المعتمدة في `docs/google-play-listing.md` وتجنب أي إيحاء بتمثيل جهة حكومية. |
| الأيقونة والرسم المميز | الأيقونة الحالية والرسم المميز 1024×500 جاهزان ضمن `docs/store-assets`. |
| لقطات الشاشة | ارفع اللقطات العمودية الفعلية من `docs/store-assets/screenshots`، ثم استبدل بوابتي الدخول بلقطات بحساب اختبار تعرض الميزات الأساسية. |
| رابط سياسة الخصوصية | رابط HTTPS عام وثابت، غير PDF، يظهر في Play Console وداخل التطبيق. |

## App content وData safety

أكمل نموذج Data safety من **Play Console → App content → Data safety**. يلزم الإفصاح الدقيق عن كل بيانات يجمعها التطبيق أو تشاركها أي مكتبة خارجية، ووصف الغرض والتشفير أثناء النقل وإمكانية حذف البيانات. حتى التطبيقات التي لا تجمع بيانات يجب أن تكمل النموذج وسياسة الخصوصية.[1]

بالنسبة لأبو مشعل، راجع على الأقل: معلومات الحساب ووسيلة الاتصال، المعاملات والمهام، المستندات المرفوعة، محتوى المحادثة، رموز إشعارات الجهاز، واستخدام الكاميرا والميكروفون والتقويم عند اختيار المستخدم للميزة. لا تعلن أي ممارسة غير مطابقة للسلوك الفعلي أو لسياسة الخصوصية.

تتطلب سياسة Google Play سياسة خصوصية عامة وميسرة من داخل التطبيق، وإفصاحاً واضحاً وموافقة إيجابية قبل الوصول غير المتوقع إلى بيانات حساسة أو أذونات الجهاز. إذا كان إنشاء الحساب متاحاً، وفّر حذف الحساب من داخل التطبيق ومن رابط ويب خارجي.[2]

## الإصدار

1. أنشئ التطبيق في Play Console بالاسم وحزمة Android: `com.app.governmenttransactionstracker`.
2. نزّل `abu-mishal-android-release-aab` من تشغيل GitHub Actions الناجح، ولا تستخدم Expo Build.
3. ارفعه أولاً إلى **Internal testing** وأضف مختبرين، ثم نفذ رحلة الدخول والمعاملة والمستند والإشعار على جهاز فعلي.
4. أكمل App content وData safety وContent rating وTarget audience وAds declaration قبل التوسع إلى Closed أو Production.
5. راجع Policy status، ثم ابدأ مسار النشر في Play Console بعد قبول الاختبار.

## مراجع

[1] Google Play, [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

[2] Google Play, [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).
