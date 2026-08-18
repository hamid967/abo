export const transactionStatuses = ["received", "under_review", "awaiting_assignment", "assigned", "document_verification", "awaiting_customer_documents", "ready_for_submission", "submitted_to_agency", "under_agency_review", "awaiting_appointment", "beneficiary_attendance_required", "payment_required", "revision_required", "suspended", "overdue", "completed", "rejected", "cancelled", "archived"] as const;
export type TransactionStatus = (typeof transactionStatuses)[number];
export type TransactionPriority = "low" | "normal" | "high" | "urgent";

export type TransactionListItem = {
  id: number;
  title: string;
  serviceName?: string | null;
  city?: string | null;
  referenceNumber?: string | null;
  status: TransactionStatus;
  priority: TransactionPriority;
  dueAt?: string | Date | null;
  nextAction?: string | null;
  updatedAt: string | Date;
};

export type TransactionDetail = TransactionListItem & {
  description: string;
  createdAt: string | Date;
  history: { id: number; status: string; note?: string | null; createdAt: string | Date }[];
};

export type GovernmentTransaction = {
  id: string;
  title: string;
  agency: string;
  reference: string;
  status: TransactionStatus;
  priority?: TransactionPriority;
  serviceType?: string;
  dueDate?: string;
  updatedAt: string;
  statusHistory: unknown[];
};

export const statusLabel: Record<string, string> = {
  received: "تم الاستلام", under_review: "قيد المراجعة", awaiting_assignment: "بانتظار التعيين", assigned: "تم التعيين", document_verification: "تدقيق المستندات", awaiting_customer_documents: "بانتظار مستندات العميل", ready_for_submission: "جاهزة للإرسال", submitted_to_agency: "مُرسلة للجهة", under_agency_review: "قيد مراجعة الجهة", awaiting_appointment: "بانتظار موعد", beneficiary_attendance_required: "يتطلب حضور المستفيد", payment_required: "يتطلب سداد", revision_required: "يتطلب تعديل", suspended: "معلقة", overdue: "متأخرة", completed: "مكتملة", rejected: "مرفوضة", cancelled: "ملغاة", archived: "مؤرشفة",
};

export function statusColor(status: string) {
  if (status === "completed") return "#1E7A50";
  if (["overdue", "rejected", "cancelled"].includes(status)) return "#B42318";
  if (["received", "under_review", "assigned", "document_verification"].includes(status)) return "#0B5D45";
  return "#9A5A12";
}
