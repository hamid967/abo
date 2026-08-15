import { ReminderSettings } from "@/lib/reminders";

export const transactionStatuses = [
  "draft",
  "received",
  "under_review",
  "awaiting_assignment",
  "assigned",
  "document_verification",
  "awaiting_customer_documents",
  "ready_for_submission",
  "submitted_to_agency",
  "under_agency_review",
  "awaiting_appointment",
  "beneficiary_attendance_required",
  "payment_required",
  "revision_required",
  "suspended",
  "overdue",
  "completed",
  "rejected",
  "cancelled",
  "archived",
] as const;

export type TransactionStatus = (typeof transactionStatuses)[number];
export type TransactionPriority = "low" | "normal" | "high" | "urgent";
export type BeneficiaryType = "individual" | "establishment" | "company" | "association" | "nonprofit" | "representative";

export type StatusHistoryEntry = {
  id: string;
  status: TransactionStatus;
  createdAt: string;
  actorName?: string;
  note?: string;
  internalNote?: string;
};

export type GovernmentTransaction = {
  id: string;
  title: string;
  agency: string;
  reference: string;
  status: TransactionStatus;
  dueDate?: string;
  updatedAt: string;
  notes?: string;
  reminder?: ReminderSettings;
  requestNumber?: string;
  customerName?: string;
  customerPhone?: string;
  beneficiaryType?: BeneficiaryType;
  serviceType?: string;
  priority?: TransactionPriority;
  city?: string;
  assigneeName?: string;
  nextAction?: string;
  statusHistory: StatusHistoryEntry[];
};

export type TransactionDraft = Omit<GovernmentTransaction, "id" | "updatedAt" | "statusHistory">;

export const statusDetails: Record<
  TransactionStatus,
  { label: string; description: string; tone: "blue" | "amber" | "green" | "red" }
> = {
  draft: { label: "مسودة", description: "يُستكمل الطلب قبل إرساله.", tone: "blue" },
  received: { label: "تم الاستلام", description: "تم استلام الطلب وينتظر المراجعة.", tone: "blue" },
  under_review: { label: "تحت المراجعة", description: "تجري مراجعة البيانات الأساسية.", tone: "blue" },
  awaiting_assignment: { label: "بانتظار التعيين", description: "ينتظر الطلب إسناده إلى موظف مختص.", tone: "amber" },
  assigned: { label: "تم تعيين الموظف", description: "أُسندت المتابعة إلى موظف مسؤول.", tone: "blue" },
  document_verification: { label: "التحقق من المستندات", description: "تتم مراجعة المستندات المرفقة.", tone: "blue" },
  awaiting_customer_documents: { label: "بانتظار مستندات", description: "يلزم تقديم مستند أو معلومة من العميل.", tone: "amber" },
  ready_for_submission: { label: "جاهزة للتقديم", description: "اكتملت المتطلبات المبدئية للتقديم.", tone: "green" },
  submitted_to_agency: { label: "تم التقديم للجهة", description: "أُحيلت المعاملة إلى الجهة المختصة.", tone: "blue" },
  under_agency_review: { label: "تحت إجراء الجهة", description: "المعاملة قيد الإجراء لدى الجهة المختصة.", tone: "blue" },
  awaiting_appointment: { label: "بانتظار موعد", description: "تحتاج المعاملة إلى تحديد موعد متابعة.", tone: "amber" },
  beneficiary_attendance_required: { label: "تحتاج حضور المستفيد", description: "يلزم حضور المستفيد لإتمام الإجراء.", tone: "amber" },
  payment_required: { label: "تحتاج سداد رسوم", description: "يلزم سداد رسوم قبل متابعة الإجراء.", tone: "amber" },
  revision_required: { label: "تحتاج تعديل", description: "تحتاج المعاملة تصحيحاً أو تحديثاً.", tone: "amber" },
  suspended: { label: "معلّقة", description: "توقفت المتابعة مؤقتاً بانتظار إجراء خارجي.", tone: "amber" },
  overdue: { label: "متأخرة", description: "تجاوزت موعد المتابعة وتحتاج مراجعة عاجلة.", tone: "red" },
  completed: { label: "مكتملة", description: "اكتملت المعاملة ويمكن أرشفتها.", tone: "green" },
  rejected: { label: "مرفوضة", description: "رفضت الجهة المعاملة أو الطلب.", tone: "red" },
  cancelled: { label: "ملغاة", description: "أُلغي الطلب ولا يحتاج متابعة إضافية.", tone: "red" },
  archived: { label: "مؤرشفة", description: "حُفظت المعاملة للرجوع إليها فقط.", tone: "green" },
};

export function isTerminalStatus(status: TransactionStatus) {
  return status === "completed" || status === "rejected" || status === "cancelled" || status === "archived";
}

export function createTransaction(draft: TransactionDraft): GovernmentTransaction {
  const now = new Date().toISOString();
  const id = `transaction-${Date.now()}`;
  const requestNumber = draft.requestNumber ?? `AM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  return {
    ...draft,
    id,
    requestNumber,
    updatedAt: now,
    statusHistory: [{ id: `${id}-history-1`, status: draft.status, createdAt: now, actorName: "العميل" }],
  };
}

export function addStatusHistoryEntry(transaction: GovernmentTransaction, status: TransactionStatus, actorName = "فريق أبو مشعل", note?: string) {
  const entry: StatusHistoryEntry = {
    id: `${transaction.id}-history-${Date.now()}`,
    status,
    createdAt: new Date().toISOString(),
    actorName,
    note,
  };
  return [...(transaction.statusHistory ?? []), entry];
}

export function isTransactionOverdue(transaction: GovernmentTransaction, today = new Date()) {
  if (!transaction.dueDate || isTerminalStatus(transaction.status)) return false;
  const dueDate = new Date(`${transaction.dueDate}T23:59:59`);
  return dueDate < today;
}
