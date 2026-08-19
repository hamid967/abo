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
    expect(result.confidence).toBe("medium");
  });

  it("blocks sensitive guidance before it reaches the model", async () => {
    vi.mocked(invokeLLM).mockClear();
    const result = await answerGuidanceQuestion("رقم الهوية 1234567890 ما حالة معاملتي؟");
    expect(result.answer).toContain("خصوصيتك");
    expect(result.suggestedAction).toBe("open_support");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("returns confidence, follow-up questions and a next action from structured output", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ answer: "أحتاج رقم مرجع غير حساس لتحديد المسار.", confidence: "low", followUpQuestions: ["ما نوع المعاملة؟"], suggestedAction: "track_transaction" }) } }] } as never);
    const result = await answerGuidanceQuestion("أبغى أتابع معاملتي");
    expect(result.confidence).toBe("low");
    expect(result.followUpQuestions).toEqual(["ما نوع المعاملة؟"]);
    expect(result.suggestedAction).toBe("track_transaction");
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
