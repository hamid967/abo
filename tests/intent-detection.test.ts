import { describe, expect, it, vi } from "vitest";

vi.mock("../server/_core/llm", () => ({ invokeLLM: vi.fn().mockRejectedValue(new Error("classifier unavailable")) }));

import { containsDisallowedChatSecret, detectRequestIntent } from "../server/intent-detection";
import { nextTransactionIntakeQuestion } from "../server/transaction-intake-chat";

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

  it("extracts several explicit Saudi transaction details when the classifier is unavailable", async () => {
    const result = await detectRequestIntent({ message: "أبي أقدم معاملة فرد لتجديد رخصة لدى المرور، اسمي أحمد وفي مدينة الرياض", language: "ar" });
    expect(result.entities.beneficiaryType).toBe("individual");
    expect(result.entities.serviceName).toContain("تجديد رخصة");
    expect(result.entities.entityName).toContain("المرور");
    expect(result.entities.beneficiaryName).toBe("أحمد");
    expect(result.entities.city).toBe("الرياض");
  });

  it("offers focused suggestions for the next missing transaction detail", () => {
    const next = nextTransactionIntakeQuestion({ beneficiaryType: "individual" }, "ar");
    expect(next.field).toBe("serviceName");
    expect(next.suggestions).toContain("تجديد رخصة");
    expect(next.completedFields).toBe(1);
  });
});
