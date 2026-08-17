export const transactionIntakeFieldOrder = [
  "beneficiaryType",
  "serviceName",
  "entityName",
  "title",
  "description",
  "beneficiaryName",
  "phoneNumber",
] as const;

export type TransactionIntakeField = (typeof transactionIntakeFieldOrder)[number];

function hasText(data: Record<string, unknown>, field: TransactionIntakeField) {
  return typeof data[field] === "string" && data[field].trim().length > 0;
}

export function nextTransactionIntakeQuestion(data: Record<string, unknown>, language: "ar" | "en") {
  const field = transactionIntakeFieldOrder.find((candidate) => !hasText(data, candidate)) ?? null;
  const prompts = language === "ar" ? {
    beneficiaryType: "تمام. المعاملة تخص فرد، منشأة، شركة، جمعية، أو تمثيل عن مستفيد؟",
    serviceName: "وش الخدمة أو نوع المعاملة اللي تبي نرتّبها لك؟",
    entityName: "وش الجهة المرتبطة بالمعاملة؟ إذا ما تعرف الاسم الرسمي، اكتب الاسم المتداول.",
    title: "أعطني عنواناً قصيراً للمعاملة عشان يظهر لك بوضوح في المتابعة.",
    description: "صف لي المطلوب أو وضع المعاملة بجملة أو جملتين، بدون رقم هوية أو كلمة مرور أو رمز تحقق.",
    beneficiaryName: "من هو المستفيد من المعاملة؟ اكتب الاسم المناسب للمتابعة فقط.",
    phoneNumber: "أدخل رقم الجوال السعودي للتواصل بخصوص هذا الطلب فقط، ولا تضف أي بيانات هوية أو رموز تحقق.",
  } : {
    beneficiaryType: "Is this for an individual, establishment, company, association, or a representative?",
    serviceName: "What service or transaction would you like us to organise?",
    entityName: "Which entity is related to this transaction? Use the commonly known name if you do not know the official one.",
    title: "Please provide a short title so this transaction is easy to recognise later.",
    description: "Describe what you need in one or two sentences. Do not include an ID number, password, or verification code.",
    beneficiaryName: "Who is the beneficiary? Enter only the name needed to follow up on the request.",
    phoneNumber: "Enter a Saudi mobile number for this request only. Do not include an ID number or verification code.",
  };
  if (field) return { field, reply: prompts[field], readyForReview: false } as const;
  return {
    field: null,
    reply: language === "ar"
      ? "ممتاز، جمعت البيانات الأساسية للمعاملة. راجع الملخص وعدّله إذا احتجت، وبعدها اختر «تحقق واعرض المراجعة». ما راح ننشئ أي معاملة إلا بعد موافقتك الصريحة."
      : "Great, the core transaction details are collected. Review and edit the summary, then choose “Validate and review”. No transaction will be created without your explicit consent.",
    readyForReview: true,
  } as const;
}
