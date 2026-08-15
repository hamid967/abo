import { describe, expect, it } from "vitest";
import { assertSafeConversationContent, canTransitionConversation } from "../server/conversation-state";
import { mergeRequestDraftData, requestDraftPatchSchema } from "../server/request-draft-policy";
import { mayConfirmDraft } from "../server/request-review";

describe("executive assistant journey contract", () => {
  it("moves through an allowed intake journey while keeping the patch allowlisted", () => {
    expect(canTransitionConversation("started", "identifying_intent")).toBe(true);
    expect(canTransitionConversation("identifying_intent", "selecting_beneficiary")).toBe(true);
    expect(canTransitionConversation("selecting_beneficiary", "selecting_service")).toBe(true);
    expect(canTransitionConversation("selecting_service", "collecting_information")).toBe(true);
    const draft = mergeRequestDraftData({}, { title: "طلب متابعة", phoneNumber: "0501234567", beneficiaryType: "individual" });
    expect(Object.keys(draft).every((key) => key in requestDraftPatchSchema.shape)).toBe(true);
  });

  it("requires a matching review version and all explicit consents before submission", () => {
    expect(mayConfirmDraft({ state: "awaiting_confirmation", validationStatus: "warnings", consentTypes: ["terms", "privacy", "request_submission"], summaryVersion: 3 })).toBe(true);
    expect(mayConfirmDraft({ state: "awaiting_confirmation", validationStatus: "errors", consentTypes: ["terms", "privacy", "request_submission"], summaryVersion: 3 })).toBe(false);
  });

  it("blocks sensitive content before it can enter the stored conversation journey", () => {
    expect(() => assertSafeConversationContent("رمز التحقق هو 123456")).toThrow("SENSITIVE_CONVERSATION_CONTENT");
  });
});
