import { describe, expect, it } from "vitest";
import { consentTextHash, mayConfirmDraft } from "../server/request-review";

describe("request review and consent", () => {
  it("binds consent to a specific summary revision", () => {
    expect(consentTextHash({ draftId: "a", summaryVersion: 1, consentType: "terms" })).not.toBe(consentTextHash({ draftId: "a", summaryVersion: 2, consentType: "terms" }));
  });

  it("requires all three explicit consents at the confirmation state", () => {
    expect(mayConfirmDraft({ state: "awaiting_confirmation", validationStatus: "passed", summaryVersion: 1, consentTypes: ["terms", "privacy", "request_submission"] })).toBe(true);
    expect(mayConfirmDraft({ state: "awaiting_confirmation", validationStatus: "passed", summaryVersion: 1, consentTypes: ["terms", "privacy"] })).toBe(false);
    expect(mayConfirmDraft({ state: "reviewing_summary", validationStatus: "passed", summaryVersion: 1, consentTypes: ["terms", "privacy", "request_submission"] })).toBe(false);
  });
});
