export const conversationStates = [
  "started", "identifying_intent", "selecting_beneficiary", "selecting_service", "selecting_entity",
  "collecting_information", "collecting_documents", "validating_information", "reviewing_summary",
  "awaiting_confirmation", "submitting", "submitted", "needs_human_review", "cancelled", "expired",
] as const;

export type ConversationState = (typeof conversationStates)[number];

const transitions: Record<ConversationState, readonly ConversationState[]> = {
  started: ["identifying_intent", "cancelled", "expired"],
  identifying_intent: ["selecting_beneficiary", "needs_human_review", "cancelled"],
  selecting_beneficiary: ["selecting_service", "cancelled"],
  selecting_service: ["selecting_entity", "collecting_information", "needs_human_review", "cancelled"],
  selecting_entity: ["collecting_information", "needs_human_review", "cancelled"],
  collecting_information: ["collecting_documents", "validating_information", "needs_human_review", "cancelled"],
  collecting_documents: ["validating_information", "needs_human_review", "cancelled"],
  validating_information: ["collecting_information", "reviewing_summary", "needs_human_review", "cancelled"],
  reviewing_summary: ["collecting_information", "awaiting_confirmation", "cancelled"],
  awaiting_confirmation: ["reviewing_summary", "submitting", "cancelled"],
  submitting: ["submitted", "reviewing_summary", "needs_human_review"],
  submitted: [],
  needs_human_review: ["collecting_information", "cancelled"],
  cancelled: [],
  expired: [],
};

export function canTransitionConversation(from: ConversationState, to: ConversationState) {
  return transitions[from].includes(to);
}

export function assertConversationTransition(from: ConversationState, to: ConversationState) {
  if (!canTransitionConversation(from, to)) throw new Error(`INVALID_CONVERSATION_TRANSITION:${from}:${to}`);
}

export function conversationStatusForState(state: ConversationState) {
  if (state === "submitted") return "submitted" as const;
  if (state === "needs_human_review") return "needs_human_review" as const;
  if (state === "cancelled" || state === "expired") return state;
  return "active" as const;
}

const prohibitedConversationPatterns = [
  /\b(?:password|passcode|otp|cvv|verification\s*code)\b/i,
  /(?:كلمة\s*المرور|رمز\s*(?:التحقق|التأكيد)|رقم\s*البطاقة|بيانات\s*الدخول)/i,
];

export function assertSafeConversationContent(content: string) {
  if (content.length > 4000) throw new Error("MESSAGE_TOO_LONG");
  if (prohibitedConversationPatterns.some((pattern) => pattern.test(content))) throw new Error("SENSITIVE_CONVERSATION_CONTENT");
}
