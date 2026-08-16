export type ServiceDecisionInput = {
  status: string;
  dueDate?: string;
  updatedAt: string;
};

export type ServiceDecisionSource = "document_requirement" | "due_date" | "transaction_status" | "last_activity";

export function serviceDecisionSource(input: ServiceDecisionInput, now = new Date()): ServiceDecisionSource {
  if (input.status === "awaiting_customer_documents") return "document_requirement";
  if (input.dueDate) {
    const due = new Date(`${input.dueDate}T12:00:00`);
    if (!Number.isNaN(due.getTime()) && due.getTime() - now.getTime() <= 7 * 86_400_000) return "due_date";
  }
  if (input.status && input.status !== "draft") return "transaction_status";
  return "last_activity";
}

export function serviceDecisionSourceLabel(source: ServiceDecisionSource, isArabic: boolean) {
  const labels = isArabic
    ? { document_requirement: "متطلب مستند", due_date: "موعد المتابعة", transaction_status: "حالة المعاملة", last_activity: "آخر نشاط" }
    : { document_requirement: "Document requirement", due_date: "Due date", transaction_status: "Transaction status", last_activity: "Latest activity" };
  return labels[source];
}
