import { describe, expect, it } from "vitest";
import { assertConversationTransition, assertSafeConversationContent, canTransitionConversation, conversationStatusForState } from "../server/conversation-state";

describe("conversation state machine", () => {
  it("allows only the ordered request journey", () => {
    expect(canTransitionConversation("started", "identifying_intent")).toBe(true);
    expect(canTransitionConversation("reviewing_summary", "awaiting_confirmation")).toBe(true);
    expect(canTransitionConversation("awaiting_confirmation", "submitting")).toBe(true);
    expect(() => assertConversationTransition("collecting_information", "submitted")).toThrow("INVALID_CONVERSATION_TRANSITION");
  });

  it("maps terminal states away from active execution", () => {
    expect(conversationStatusForState("submitted")).toBe("submitted");
    expect(conversationStatusForState("needs_human_review")).toBe("needs_human_review");
    expect(conversationStatusForState("collecting_information")).toBe("active");
  });

  it("rejects secrets and oversized message content before persistence", () => {
    expect(() => assertSafeConversationContent("كلمة المرور هي 1234")).toThrow("SENSITIVE_CONVERSATION_CONTENT");
    expect(() => assertSafeConversationContent("x".repeat(4001))).toThrow("MESSAGE_TOO_LONG");
    expect(() => assertSafeConversationContent("أرغب في متابعة طلبي لدى الجهة.")).not.toThrow();
  });
});
