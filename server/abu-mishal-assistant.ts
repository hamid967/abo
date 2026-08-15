import { invokeLLM } from "./_core/llm";
import { getKnowledgeContext } from "./db";
import { z } from "zod";

export const requestIntakeStageSchema = z.enum(["service", "agency", "title", "description"]);
export type RequestIntakeStage = z.infer<typeof requestIntakeStageSchema>;

const requestIntakeGuidanceSchema = z
  .object({
    reply: z.string().trim().min(1).max(700),
    tip: z.string().trim().max(240).nullable(),
  })
  .strict();

export function containsSensitiveIntakeData(value: string) {
  return /\d{8,}/.test(value) || /(password|verification\s*code|card\s*(number|details)|كلمة\s*المرور|رمز\s*التحقق|رقم\s*الهوية|بيانات\s*البطاقة)/i.test(value);
}

export async function answerGuidanceQuestion(question: string, language: "ar" | "en" = "ar") {
  const { referenceText, sources } = await getKnowledgeContext(language);
  const sourceContext = referenceText || (language === "ar" ? "لا توجد مقالات أو أسئلة شائعة معتمدة ذات صلة في قاعدة المعرفة حالياً." : "No approved knowledge articles or FAQs are currently available.");
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: language === "ar" ? `أنت مساعد أبو مشعل، منصة سعودية مستقلة لمتابعة المعاملات والمهام. أجب بلهجة سعودية مهنية واضحة وباختصار، واعتمد حصراً على مصادر المعرفة التالية. لا تستنتج حقائق خارجها؛ إن لم تكن الإجابة فيها، قل بوضوح إن المعلومة غير متاحة في المصادر المعتمدة واقترح فتح تذكرة دعم. لا تدّعِ تمثيل أي جهة حكومية، ولا تؤكد قبول معاملة، ولا تقدم فتوى قانونية أو معلومات غير مؤكدة. لا تطلب بيانات هوية أو كلمات مرور أو معلومات حساسة. عند الاستناد إلى مادة، اذكر عنوان المصدر في آخر الجواب.\n\nمصادر المعرفة المعتمدة:\n${sourceContext}` : `You are Abu Mishal Assistant, an independent Saudi platform for tracking requests and tasks. Answer briefly in clear English and rely exclusively on the approved knowledge sources below. Do not infer facts outside them; if the answer is absent, state that clearly and suggest opening a support ticket. Do not claim to represent a government entity, confirm approval of a request, provide binding legal advice, or request identity, password, or sensitive information. Name a source title at the end when using one.\n\nApproved knowledge sources:\n${sourceContext}` },
      { role: "user", content: question },
    ],
  });
  const content = response.choices[0]?.message?.content;
  return {
    answer: (typeof content === "string" ? content.trim() : "") || "ما قدرنا نجهز رد إرشادي الآن. تقدر تحوّل استفسارك لموظف عشان يراجعه.",
    sources: sources.slice(0, 6),
  };
}

export async function guideRequestIntake(input: {
  message: string;
  stage: RequestIntakeStage;
  language: "ar" | "en";
  context: { serviceType?: string; agency?: string; title?: string; description?: string };
}) {
  const { referenceText } = await getKnowledgeContext(input.language);
  const stageLabel = input.language === "ar"
    ? { service: "نوع الخدمة", agency: "الجهة المرجعية", title: "عنوان الطلب", description: "وصف الطلب" }[input.stage]
    : { service: "service type", agency: "reference agency", title: "request title", description: "request description" }[input.stage];
  const fallback = input.language === "ar"
    ? { reply: `سجّلنا اللي ذكرته بخصوص ${stageLabel}. بنراجع البيانات معك قبل إنشاء الطلب، وهذا ما يعني قبول الطلب من أي جهة.`, tip: "عشان نحافظ على خصوصيتك، لا تكتب رقم الهوية أو كلمة المرور أو رمز التحقق أو بيانات البطاقة في المحادثة." }
    : { reply: `Your input for the ${stageLabel} has been recorded. You will review everything before the request is created; this does not confirm acceptance by any authority.`, tip: "Do not enter an ID number, password, verification code, or card details in chat." };

  if (containsSensitiveIntakeData(input.message)) {
    return input.language === "ar"
      ? { reply: "عشان نحافظ على خصوصيتك، ما نقدر نعالج هالرسالة داخل المحادثة. احذف الأرقام أو البيانات الحساسة واكتب وصفاً عاماً فقط.", tip: "اكتب الاسم ورقم الجوال لاحقاً في حقول المراجعة المخصصة، ولا تكتب كلمة مرور أو رمز تحقق." }
      : { reply: "For your privacy, this message cannot be processed in chat. Remove numbers or sensitive data and provide a general description only.", tip: "Enter the name and mobile number later in the dedicated review fields; never enter a password or verification code." };
  }

  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      maxTokens: 500,
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: input.language === "ar"
            ? `أنت مساعد تعبئة طلبات «أبو مشعل»، منصة مستقلة لا تمثل أي جهة حكومية. أعطِ تعقيباً قصيراً ومتعاوناً بالعربية على إدخال المستخدم في مرحلة «${stageLabel}». لا تفسر الأنظمة أو تؤكد استحقاقاً أو قبولاً، ولا تطلب أو تعيد ذكر رقم الهوية أو كلمات المرور أو رموز التحقق أو بيانات بطاقات الدفع. لا تطلب مرفقات في المحادثة. إذا احتاج الأمر معلومة غير مؤكدة، وجّه المستخدم إلى مراجعة الملخص أو فريق الدعم. أخرج JSON صالحاً فقط بالشكل {"reply":"...","tip":"... أو null"}. سياق تعبئة غير حساس: ${JSON.stringify(input.context)}. مرجع معرفة منشور للاستخدام الإرشادي فقط: ${referenceText.slice(0, 500) || "لا يوجد."}`
            : `You are Abu Mishal request-intake assistant, an independent platform that does not represent any government authority. Give a short, helpful English acknowledgment of the user's input for the "${stageLabel}" stage. Do not interpret regulations, confirm eligibility or acceptance, request or repeat ID numbers, passwords, verification codes, or payment-card details. Do not request attachments in chat. If information is uncertain, direct the user to review the summary or contact support. Output valid JSON only: {"reply":"...","tip":"... or null"}. Non-sensitive intake context: ${JSON.stringify(input.context)}. Published knowledge context for guidance only: ${(referenceText || "None.").slice(0, 500)}`,
        },
        { role: "user", content: input.message },
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string") return fallback;
    return requestIntakeGuidanceSchema.parse(JSON.parse(content));
  } catch {
    return fallback;
  }
}
