import { describe, expect, it, vi } from "vitest";

vi.mock("../server/_core/llm", () => ({ invokeLLM: vi.fn().mockRejectedValue(new Error("classifier unavailable")) }));

import { containsDisallowedChatSecret, detectRequestIntent } from "../server/intent-detection";

describe("intent detection safety gate", () => {
  it("blocks credentials before language-model processing", async () => {
    expect(containsDisallowedChatSecret("رمز التحقق هو 123456")).toBe(true);
    await expect(detectRequestIntent({ message: "كلمة المرور هي secret", language: "ar" })).resolves.toMatchObject({ intent: "unknown_intent", requiresHumanReview: true });
  });

  it("uses a deterministic fallback if the classifier is unavailable", async () => {
    const result = await detectRequestIntent({ message: "أريد متابعة معاملة رقم الطلب AM-2026-1001", language: "ar" });
    expect(["track_transaction", "unknown_intent"]).toContain(result.intent);
    expect(result.entities.transactionNumber ?? result.entities.referenceNumber).toBeTruthy();
  });
});
