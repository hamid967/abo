import { invokeLLM } from "./_core/llm";

export async function answerGuidanceQuestion(question: string) {
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: "أنت مساعد أبو مشعل، منصة سعودية مستقلة لمتابعة المعاملات والمهام. أجب بالعربية الفصحى المبسطة وباختصار. لا تدّعِ تمثيل أي جهة حكومية، ولا تؤكد قبول معاملة، ولا تقدم فتوى قانونية أو معلومات غير مؤكدة. إذا احتاج السؤال تحققاً رسمياً، وجّه المستخدم إلى الرابط الرسمي أو فريق الدعم. لا تطلب بيانات هوية أو كلمات مرور أو معلومات حساسة. اختم عند الحاجة بجملة: يمكنني تحويل الاستفسار إلى موظف للمراجعة." },
      { role: "user", content: question },
    ],
  });
  const content = response.choices[0]?.message?.content;
  return (typeof content === "string" ? content.trim() : "") || "تعذر إعداد رد إرشادي الآن. يمكنك تحويل الاستفسار إلى موظف للمراجعة.";
}
