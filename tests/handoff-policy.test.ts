import { describe, expect, it } from "vitest";
import { handoffPriorityForReason, handoffSubject } from "../server/handoff-policy";

describe("human handoff policy", () => {
  it("marks payment and complaint themes for faster review", () => {
    expect(handoffPriorityForReason("لدي شكوى عاجلة")).toBe("high");
    expect(handoffPriorityForReason("أريد مساعدة في المسودة")).toBe("normal");
  });

  it("uses a clear support subject without claiming government representation", () => {
    expect(handoffSubject("ar")).toContain("المساعد التنفيذي");
    expect(handoffSubject("ar")).not.toContain("حكومي");
  });
});
