import { describe, expect, it, vi } from "vitest";

vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({ choices: [{ message: { content: "هذه إجابة إرشادية مختصرة. المصدر: دليل الطلبات." } }] })),
}));

vi.mock("../server/db", () => ({
  getKnowledgeContext: vi.fn(async () => ({
    referenceText: "المصدر: دليل الطلبات\nتحديث: 2026-08-15\nمحتوى إرشادي",
    sources: [{ title: "دليل الطلبات", sourceLabel: "أبو مشعل", sourceUrl: null, updatedAt: new Date("2026-08-15") }],
  })),
}));

import { answerGuidanceQuestion, containsSensitiveIntakeData, guideRequestIntake } from "../server/abu-mishal-assistant";
import { invokeLLM } from "../server/_core/llm";

describe("Abu Mishal guidance assistant", () => {
  it("returns the model answer with published knowledge sources", async () => {
    const result = await answerGuidanceQuestion("ما المستندات المطلوبة؟");
    expect(result.answer).toContain("إرشادية");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].title).toBe("دليل الطلبات");
  });

  it("returns structured intake guidance without adding a request", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ reply: "تم تسجيل نوع الخدمة.", tip: "راجع الملخص قبل الإرسال." }) } }] } as never);
    const result = await guideRequestIntake({ message: "متابعة معاملة", stage: "service", language: "ar", context: {} });
    expect(result.reply).toBe("تم تسجيل نوع الخدمة.");
    expect(result.tip).toContain("راجع");
  });

  it("blocks sensitive data before it reaches the model", async () => {
    expect(containsSensitiveIntakeData("رقم هويتي 1234567890")).toBe(true);
    const result = await guideRequestIntake({ message: "رمز التحقق 123456", stage: "description", language: "ar", context: {} });
    expect(result.reply).toContain("خصوصيتك");
  });
});
