import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("executive assistant entry UI", () => {
  const screen = readFileSync("app/assistant/request-intake.tsx", "utf8");
  const transactions = readFileSync("app/(tabs)/transactions.tsx", "utf8");

  it("uses the persisted executive assistant API and privacy notice", () => {
    expect(screen).toContain("trpc.executiveAssistant.start.useMutation");
    expect(screen).toContain("trpc.executiveAssistant.sendMessage.useMutation");
    expect(screen).toContain("رمز التحقق");
  });

  it("exposes review, consent, submission, documents, and conversation lifecycle controls", () => {
    expect(screen).toContain(
      "trpc.executiveAssistant.prepareReview.useMutation",
    );
    expect(screen).toContain(
      "trpc.executiveAssistant.recordConsent.useMutation",
    );
    expect(screen).toContain("trpc.executiveAssistant.submitDraft.useMutation");
    expect(screen).toContain("DocumentPicker.getDocumentAsync");
    expect(screen).toContain(
      "trpc.executiveAssistant.attachDocument.useMutation",
    );
    expect(screen).toContain("trpc.executiveAssistant.cancelDraft.useMutation");
    expect(screen).toContain(
      "trpc.executiveAssistant.deleteConversationData.useMutation",
    );
  });

  it("shows the published service plan to the request owner before submission", () => {
    expect(screen).toContain("trpc.playbooks.activeForService.useQuery");
    expect(screen).toContain("PlaybookJourney");
  });

  it("shows approved knowledge sources inside assistant replies", () => {
    expect(screen).toContain("guidanceSourcesFromMetadata");
    expect(screen).toContain("GuidanceSources");
    expect(screen).toContain("المصادر المعتمدة");
  });

  it("links uploaded documents to the selected service requirement", () => {
    expect(screen).toContain("playbookRequirements");
    expect(screen).toContain("requirementKey");
    expect(screen).toContain("completedRequirements");
    expect(screen).toContain("قائمة المتطلبات");
  });

  it("offers explicit service selection when automatic matching is uncertain", () => {
    expect(screen).toContain(
      "trpc.executiveAssistant.serviceSuggestions.useQuery",
    );
    expect(screen).toContain("ServiceSuggestions");
    expect(screen).toContain("اختر الخدمة الأقرب");
    expect(screen).toContain("serviceConfidence");
  });

  it("routes the main transaction entry to chat intake", () => {
    expect(transactions).toContain(
      'router.push("/assistant/request-intake?flow=transaction" as never)',
    );
    expect(screen).toContain(
      'const isTransactionFlow = flow === "transaction"',
    );
    expect(screen).toContain("TransactionIntakeSteps");
  });
});
