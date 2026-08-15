export const transactionStatuses = [
  "new",
  "under_review",
  "action_required",
  "completed",
  "overdue",
] as const;

export type TransactionStatus = (typeof transactionStatuses)[number];

export type GovernmentTransaction = {
  id: string;
  title: string;
  agency: string;
  reference: string;
  status: TransactionStatus;
  dueDate?: string;
  updatedAt: string;
  notes?: string;
};

export type TransactionDraft = Omit<GovernmentTransaction, "id" | "updatedAt">;

export const statusDetails: Record<
  TransactionStatus,
  { label: string; description: string; tone: "blue" | "amber" | "green" | "red" }
> = {
  new: {
    label: "جديدة",
    description: "تم تسجيلها وتنتظر البدء في المتابعة.",
    tone: "blue",
  },
  under_review: {
    label: "قيد المراجعة",
    description: "الجهة المختصة تراجع الطلب أو المستندات.",
    tone: "blue",
  },
  action_required: {
    label: "مطلوب إجراء",
    description: "تحتاج إلى إضافة مستند أو اتخاذ خطوة جديدة.",
    tone: "amber",
  },
  completed: {
    label: "مكتملة",
    description: "اكتملت المعاملة ويمكن حفظها للرجوع إليها.",
    tone: "green",
  },
  overdue: {
    label: "متأخرة",
    description: "تجاوزت الموعد المسجل وتحتاج مراجعة عاجلة.",
    tone: "red",
  },
};

export function createTransaction(draft: TransactionDraft): GovernmentTransaction {
  const now = new Date().toISOString();
  return {
    ...draft,
    id: `transaction-${Date.now()}`,
    updatedAt: now,
  };
}

export function isTransactionOverdue(transaction: GovernmentTransaction, today = new Date()) {
  if (!transaction.dueDate || transaction.status === "completed") return false;
  const dueDate = new Date(`${transaction.dueDate}T23:59:59`);
  return dueDate < today;
}
