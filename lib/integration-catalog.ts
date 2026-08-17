export type DeferredIntegration = {
  key: "government" | "whatsapp" | "sms" | "payments" | "maps";
  title: string;
  description: string;
  prerequisite: string;
};

export const deferredIntegrations: readonly DeferredIntegration[] = [
  { key: "government", title: "المنصات الحكومية", description: "غير متصل", prerequisite: "يتطلب تصريحاً قانونياً وتقنياً واتفاقية تكامل مع الجهة المعنية." },
  { key: "whatsapp", title: "واتساب للأعمال", description: "غير متصل", prerequisite: "يتطلب حساب WhatsApp Business وموافقة القالب وقناة معتمدة." },
  { key: "sms", title: "الرسائل النصية", description: "غير متصل", prerequisite: "يتطلب مزود رسائل معتمداً وموافقة صريحة على التنبيهات." },
  { key: "payments", title: "المدفوعات", description: "غير متصل", prerequisite: "يتطلب بوابة دفع متعاقداً عليها وتدقيقاً مالياً وقانونياً." },
  { key: "maps", title: "الخرائط والموقع", description: "غير متصل", prerequisite: "يتطلب موافقة موقع من المستخدم ومزود خرائط مهيأ." },
] as const;
