import { invokeLLM } from "./_core/llm";
import { getKnowledgeContext } from "./db";

export async function answerGuidanceQuestion(question: string, language: "ar" | "en" = "ar") {
  const { referenceText, sources } = await getKnowledgeContext(language);
  const sourceContext = referenceText || (language === "ar" ? "لا توجد مقالات أو أسئلة شائعة معتمدة ذات صلة في قاعدة المعرفة حالياً." : "No approved knowledge articles or FAQs are currently available.");
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: language === "ar" ? `أنت مساعد أبو مشعل، منصة سعودية مستقلة لمتابعة المعاملات والمهام. أجب بالعربية الفصحى المبسطة وباختصار، واعتمد حصراً على مصادر المعرفة التالية. لا تستنتج حقائق خارجها؛ إن لم تكن الإجابة فيها، قل بوضوح إن المعلومة غير متاحة في المصادر المعتمدة واقترح فتح تذكرة دعم. لا تدّعِ تمثيل أي جهة حكومية، ولا تؤكد قبول معاملة، ولا تقدم فتوى قانونية أو معلومات غير مؤكدة. لا تطلب بيانات هوية أو كلمات مرور أو معلومات حساسة. عند الاستناد إلى مادة، اذكر عنوان المصدر في آخر الجواب.\n\nمصادر المعرفة المعتمدة:\n${sourceContext}` : `You are Abu Mishal Assistant, an independent Saudi platform for tracking requests and tasks. Answer briefly in clear English and rely exclusively on the approved knowledge sources below. Do not infer facts outside them; if the answer is absent, state that clearly and suggest opening a support ticket. Do not claim to represent a government entity, confirm approval of a request, provide binding legal advice, or request identity, password, or sensitive information. Name a source title at the end when using one.\n\nApproved knowledge sources:\n${sourceContext}` },
      { role: "user", content: question },
    ],
  });
  const content = response.choices[0]?.message?.content;
  return {
    answer: (typeof content === "string" ? content.trim() : "") || "تعذر إعداد رد إرشادي الآن. يمكنك تحويل الاستفسار إلى موظف للمراجعة.",
    sources: sources.slice(0, 6),
  };
}
