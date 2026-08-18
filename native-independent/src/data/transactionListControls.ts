import type { GovernmentTransaction } from "./transactions";

export type TransactionListFilters = {
  status: "all" | GovernmentTransaction["status"];
  color: "all" | "green" | "amber" | "red";
  date: "all" | "next_7_days" | "overdue" | "no_due_date";
  category: string;
  sort: "updated_desc" | "due_asc" | "due_desc" | "title_asc";
};

function colorForStatus(status: string) {
  if (status === "completed") return "green";
  if (["overdue", "rejected", "cancelled"].includes(status)) return "red";
  return "amber";
}

export function getTransactionCategories(items: GovernmentTransaction[]) {
  return [...new Set(items.map((item) => item.serviceType?.trim()).filter((value): value is string => Boolean(value)))];
}

export function filterAndSortTransactions(items: GovernmentTransaction[], filters: TransactionListFilters, now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.color !== "all" && colorForStatus(item.status) !== filters.color) return false;
    if (filters.category !== "all" && item.serviceType !== filters.category) return false;
    if (filters.date === "no_due_date") return !item.dueDate;
    if (!item.dueDate || filters.date === "all") return true;
    const due = new Date(`${item.dueDate}T00:00:00`);
    if (filters.date === "next_7_days") return due >= start && due <= end;
    return filters.date !== "overdue" || due < start;
  }).slice().sort((left, right) => {
    if (filters.sort === "title_asc") return left.title.localeCompare(right.title, "ar");
    if (filters.sort === "updated_desc") return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    const leftDue = left.dueDate ? new Date(`${left.dueDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
    const rightDue = right.dueDate ? new Date(`${right.dueDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
    return filters.sort === "due_desc" ? rightDue - leftDue : leftDue - rightDue;
  });
}
