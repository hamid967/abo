# آلة حالات المحادثة التنفيذية

## الحالات المسموح بها

| الحالة | الغرض | الانتقالات المسموح بها |
|---|---|---|
| `started` | إنشاء المحادثة دون بيانات تنفيذية. | `identifying_intent`، `cancelled`، `expired` |
| `identifying_intent` | فهم هدف المستخدم واستخراج بيانات أولية. | `selecting_beneficiary`، `needs_human_review`، `cancelled` |
| `selecting_beneficiary` | تحديد فرد أو منشأة أو ممثل. | `selecting_service`، `cancelled` |
| `selecting_service` | تثبيت الخدمة والجهة. | `collecting_information`، `needs_human_review` |
| `collecting_information` | جمع الحقول المطلوبة سؤالاً رئيسياً واحداً كل مرة. | `collecting_documents`، `validating_information`، `cancelled` |
| `collecting_documents` | ربط المرفقات وفحص اكتمالها. | `validating_information`، `needs_human_review` |
| `validating_information` | تنفيذ تحقق خادمي من الحقول والتكرار والمستندات. | `reviewing_summary`، `collecting_information` |
| `reviewing_summary` | عرض الملخص المنظم والنتائج التحذيرية. | `awaiting_confirmation`، `collecting_information` |
| `awaiting_confirmation` | انتظار ضغط تأكيد مرتبط بإصدار الملخص. | `submitting`، `cancelled` |
| `submitting` | قفل إرسال idempotent وتنفيذ الإنشاء الخادمي. | `submitted`، `reviewing_summary`، `needs_human_review` |
| `submitted` | تم إنشاء طلب داخل أبو مشعل. | حالة نهائية للمحادثة. |
| `needs_human_review` | تحويل إلى فريق المتابعة مع السياق المنظم. | `collecting_information`، `cancelled` |
| `cancelled` و`expired` | إيقاف المسودة أو انتهاء صلاحيتها. | بدء محادثة جديدة فقط. |

## القواعد الثابتة

لا يقوم النص العام مثل «تمام» أو «أرسل» بإنشاء طلب. الإرسال يتطلب حالة `awaiting_confirmation`، إصدار ملخص محفوظ، موافقة صريحة موثقة، والتحقق من الهوية. لا تخزّن الرسائل سلسلة التفكير أو تعليمات النظام، ويمنع حفظ كلمات المرور والرموز وبيانات البطاقات.

## تحرير واستئناف المسودة

تُحفظ الحقول المنظمة في `request_drafts.structuredData` وتبقى الرسائل في `ai_messages`. يغيّر تعديل حقل بعد المراجعة الحالة إلى `collecting_information` ويلغي موافقة الإصدار السابق. الرجوع خطوة لا يحذف الرسائل، بل يسجل انتقال الحالة ويعيد الحقل إلى بيانات ناقصة عند الاقتضاء.
