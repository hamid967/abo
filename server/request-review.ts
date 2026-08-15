import { createHash } from "node:crypto";

export const requestPolicyVersion = "ai-request-v1";

export function consentTextHash(input: { draftId: string; summaryVersion: number; consentType: "terms" | "privacy" | "request_submission"; policyVersion?: string }) {
  return createHash("sha256").update(`${input.draftId}:${input.summaryVersion}:${input.consentType}:${input.policyVersion ?? requestPolicyVersion}`).digest("hex");
}

export function mayConfirmDraft(input: { state: string; validationStatus: string; consentTypes: string[]; summaryVersion: number }) {
  const required = ["terms", "privacy", "request_submission"];
  return input.state === "awaiting_confirmation" && input.validationStatus !== "errors" && required.every((type) => input.consentTypes.includes(type)) && input.summaryVersion >= 1;
}
