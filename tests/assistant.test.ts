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

import { answerGuidanceQuestion } from "../server/abu-mishal-assistant";

describe("Abu Mishal guidance assistant", () => {
  it("returns the model answer with published knowledge sources", async () => {
    const result = await answerGuidanceQuestion("ما المستندات المطلوبة؟");
    expect(result.answer).toContain("إرشادية");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].title).toBe("دليل الطلبات");
  });
});
