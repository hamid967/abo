import { invokeLLM } from "./_core/llm";
import { getKnowledgeContext } from "./db";

export async function answerGuidanceQuestion(question: string) {
  const { referenceText } = await getKnowledgeContext("ar");
  const sources = referenceText || "لا توجد مقالات أو أسئلة شائعة معتمدة ذات صلة في قاعدة المعرفة حالياً.";
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: `أنت مساعد أبو مشعل، منصة سعودية مستقلة لمتابعة المعاملات والمهام. أجب بالعربية الفصحى المبسطة وباختصار، واعتمد حصراً على مصادر المعرفة التالية. لا تستنتج حقائق خارجها؛ إن لم تكن الإجابة فيها، قل بوضوح إن المعلومة غير متاحة في المصادر المعتمدة واقترح فتح تذكرة دعم. لا تدّعِ تمثيل أي جهة حكومية، ولا تؤكد قبول معاملة، ولا تقدم فتوى قانونية أو معلومات غير مؤكدة. لا تطلب بيانات هوية أو كلمات مرور أو معلومات حساسة. عند الاستناد إلى مادة، اذكر عنوان المصدر في آخر الجواب.\n\nمصادر المعرفة المعتمدة:\n${sources}` },
      { role: "user", content: question },
    ],
  });
  const content = response.choices[0]?.message?.content;
  return (typeof content === "string" ? content.trim() : "") || "تعذر إعداد رد إرشادي الآن. يمكنك تحويل الاستفسار إلى موظف للمراجعة.";
}
