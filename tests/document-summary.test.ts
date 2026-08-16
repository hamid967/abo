import { describe, expect, it } from "vitest";
import { contractSummaryInstructions, summarySchema } from "../server/document-summary";

describe("document summary safety", () => {
  it("keeps the Arabic prompt independent and resistant to embedded instructions", () => {
    const instructions = contractSummaryInstructions("ar");
    expect(instructions).toContain("بيانات غير موثوقة");
    expect(instructions).toContain("لا تقدم استشارة قانونية ملزمة");
  });

  it("accepts a bounded structured summary", () => {
    const result = summarySchema.parse({
      executiveSummary: "يوضح المستند نطاق خدمة ومدتها والتزامات الأطراف الواردة في النص.",
      documentType: "عقد خدمات",
      parties: ["الطرف الأول", "الطرف الثاني"],
      keyClauses: [{ title: "المدة", category: "المدة", detail: "المدة المذكورة سنة واحدة قابلة للتجديد وفق النص.", attention: "review", sourceHint: "فقرة المدة" }],
      attentionPoints: [{ title: "التجديد", detail: "ورد تجديد تلقائي في النص.", reason: "تأكد من مدة الإشعار قبل التجديد." }],
      suggestedQuestions: ["هل مدة الإشعار قبل التجديد مناسبة لك؟"],
      disclaimer: "هذا ملخص إرشادي للمحتوى ولا يعد استشارة قانونية أو حكماً على صحة المستند.",
    });
    expect(result.keyClauses[0].attention).toBe("review");
  });
});
