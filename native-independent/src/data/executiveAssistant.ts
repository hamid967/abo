import { api } from "../api/client";

const idempotencyKey = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
  const value = Math.floor(Math.random() * 16);
  return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
});

export const assistantApi = {
  start: () => api.executiveAssistant.start.mutate({ language: "ar", idempotencyKey: idempotencyKey() }),
  listDrafts: () => api.executiveAssistant.listDrafts.query(),
  detail: (conversationId: string) => api.executiveAssistant.detail.query({ conversationId }),
  sendMessage: (conversationId: string, message: string) => api.executiveAssistant.sendMessage.mutate({ conversationId, message, language: "ar" }),
  updateDraft: (conversationId: string, patch: Record<string, unknown>) => api.executiveAssistant.updateDraft.mutate({ conversationId, patch }),
  validate: (conversationId: string) => api.executiveAssistant.validateDraft.mutate({ conversationId }),
  prepareReview: (conversationId: string) => api.executiveAssistant.prepareReview.mutate({ conversationId }),
  recordConsent: (conversationId: string, consentType: "terms" | "privacy" | "request_submission") => api.executiveAssistant.recordConsent.mutate({ conversationId, consentType }),
  submit: (conversationId: string) => api.executiveAssistant.submitDraft.mutate({ conversationId, language: "ar" }),
};
