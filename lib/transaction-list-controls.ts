import { GovernmentTransaction, isTransactionOverdue, statusDetails, TransactionStatus } from "./transactions";

export type TransactionDateFilter = "all" | "overdue" | "next_7_days" | "no_due_date";
export type TransactionSort = "updated_desc" | "due_asc" | "due_desc" | "title_asc";
export type TransactionColorFilter = "all" | "blue" | "amber" | "red" | "green";

export type TransactionListOptions = {
  status: TransactionStatus | "all";
  color: TransactionColorFilter;
  date: TransactionDateFilter;
  category: string;
  sort: TransactionSort;
};

const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

function hasDueDateWithinNextSevenDays(transaction: GovernmentTransaction, today: Date) {
  if (!transaction.dueDate || isTransactionOverdue(transaction, today)) return false;
  const dueDate = new Date(`${transaction.dueDate}T23:59:59`);
  const horizon = endOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7));
  return dueDate <= horizon;
}

function dueDateTime(transaction: GovernmentTransaction) {
  return transaction.dueDate ? new Date(`${transaction.dueDate}T23:59:59`).getTime() : null;
}

export function getTransactionCategories(transactions: GovernmentTransaction[]) {
  return [...new Set(transactions.map((transaction) => transaction.serviceType?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "ar"));
}

export function filterAndSortTransactions(transactions: GovernmentTransaction[], options: TransactionListOptions, today = new Date()) {
  return transactions
    .filter((transaction) => {
      const computedStatus = isTransactionOverdue(transaction, today) ? "overdue" : transaction.status;
      const matchesStatus = options.status === "all" || transaction.status === options.status;
      const matchesColor = options.color === "all" || statusDetails[computedStatus].tone === options.color;
      const matchesCategory = options.category === "all" || transaction.serviceType?.trim() === options.category;
      const matchesDate = options.date === "all" ||
        (options.date === "overdue" && isTransactionOverdue(transaction, today)) ||
        (options.date === "next_7_days" && hasDueDateWithinNextSevenDays(transaction, today)) ||
        (options.date === "no_due_date" && !transaction.dueDate);

      return matchesStatus && matchesColor && matchesCategory && matchesDate;
    })
    .sort((first, second) => {
      if (options.sort === "title_asc") return first.title.localeCompare(second.title, "ar");
      if (options.sort === "updated_desc") return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();

      const firstDueDate = dueDateTime(first);
      const secondDueDate = dueDateTime(second);
      if (firstDueDate === null && secondDueDate === null) return 0;
      if (firstDueDate === null) return 1;
      if (secondDueDate === null) return -1;
      return options.sort === "due_asc" ? firstDueDate - secondDueDate : secondDueDate - firstDueDate;
    });
}
