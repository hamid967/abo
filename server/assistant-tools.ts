import type { RequestIntent } from "./intent-detection";

export const assistantToolCatalog = {
  create_request_draft: { mutates: true, ownerOnly: true, idempotent: true, description: "ينشئ مسودة طلب مرتبطة بالحساب." },
  update_request_draft: { mutates: true, ownerOnly: true, idempotent: false, description: "يحدّث الحقول المنظمة للمسودة المملوكة." },
  validate_request_draft: { mutates: false, ownerOnly: true, idempotent: true, description: "يفحص اكتمال المسودة ولا يرسل الطلب." },
  submit_request: { mutates: true, ownerOnly: true, idempotent: true, description: "ينشئ الطلب بعد موافقة صريحة وإصدار ملخص مطابق." },
  list_user_requests: { mutates: false, ownerOnly: true, idempotent: true, description: "يعرض طلبات الحساب الحالي فقط." },
  get_request_status: { mutates: false, ownerOnly: true, idempotent: true, description: "يعرض حالة طلب يملكه المستخدم." },
  attach_document_to_draft: { mutates: true, ownerOnly: true, idempotent: true, description: "يربط مستنداً مملوكاً بالمسودة." },
  remove_document_from_draft: { mutates: true, ownerOnly: true, idempotent: true, description: "يفصل مستنداً من مسودة مملوكة." },
  create_inquiry: { mutates: true, ownerOnly: true, idempotent: true, description: "يفتح تذكرة دعم مملوكة للعميل." },
  request_human_handoff: { mutates: true, ownerOnly: true, idempotent: true, description: "ينشئ طلب تحويل بشري وسجل تدقيق." },
} as const;

export type AssistantToolName = keyof typeof assistantToolCatalog;

export const intentToolAllowlist: Record<RequestIntent, readonly AssistantToolName[]> = {
  create_request: ["create_request_draft", "update_request_draft", "validate_request_draft", "submit_request", "attach_document_to_draft", "request_human_handoff"],
  track_transaction: ["list_user_requests", "get_request_status", "request_human_handoff"],
  ask_requirements: ["validate_request_draft", "request_human_handoff"],
  upload_document: ["attach_document_to_draft", "remove_document_from_draft", "request_human_handoff"],
  book_appointment: ["create_request_draft", "update_request_draft", "request_human_handoff"],
  create_inquiry: ["create_inquiry", "request_human_handoff"],
  create_complaint: ["create_inquiry", "request_human_handoff"],
  request_callback: ["create_inquiry", "request_human_handoff"],
  update_request: ["update_request_draft", "get_request_status", "request_human_handoff"],
  cancel_request: ["get_request_status", "request_human_handoff"],
  pay_invoice: ["request_human_handoff"],
  talk_to_human: ["request_human_handoff"],
  unknown_intent: ["request_human_handoff"],
};

export function assertIntentToolAllowed(intent: RequestIntent, tool: AssistantToolName) {
  if (!intentToolAllowlist[intent].includes(tool)) throw new Error(`TOOL_NOT_ALLOWED_FOR_INTENT:${intent}:${tool}`);
}
