import { describe, expect, it } from "vitest";
import { contractSummaryInstructions, isSourceHintVerified, summarySchema } from "../server/document-summary";

describe("document summary safety", () => {
  it("keeps the Arabic prompt independent and resistant to embedded instructions", () => {
    const instructions = contractSummaryInstructions("ar");
    expect(instructions).toContain("بيانات غير موثوقة");
    expect(instructions).toContain("لا تقدم استشارة قانونية ملزمة");
    expect(instructions).toContain("مطابقاً حرفياً");
  });

  it("only marks a source hint as verified when it exists in the supplied text", () => {
    expect(isSourceHintVerified("مدة العقد سنة واحدة", "اتفق الطرفان أن مدة العقد سنة واحدة قابلة للتجديد.")).toBe(true);
    expect(isSourceHintVerified("فقرة المدة", "اتفق الطرفان أن مدة العقد سنة واحدة قابلة للتجديد.")).toBe(false);
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
