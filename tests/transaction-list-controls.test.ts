import { describe, expect, it } from "vitest";

import { filterAndSortTransactions, getTransactionCategories } from "../lib/transaction-list-controls";
import { GovernmentTransaction } from "../lib/transactions";

const today = new Date("2026-08-18T10:00:00");
const base: Omit<GovernmentTransaction, "id" | "title" | "updatedAt"> = {
  agency: "جهة اختبار",
  reference: "REF",
  status: "under_review",
  statusHistory: [],
};
const transactions: GovernmentTransaction[] = [
  { ...base, id: "recent", title: "تحديث حديث", serviceType: "خدمة نقل", dueDate: "2026-08-21", updatedAt: "2026-08-18T09:00:00Z" },
  { ...base, id: "late", title: "معاملة متأخرة", serviceType: "خدمة رخص", dueDate: "2026-08-10", updatedAt: "2026-08-17T09:00:00Z" },
  { ...base, id: "no-date", title: "بلا موعد", serviceType: "خدمة نقل", updatedAt: "2026-08-16T09:00:00Z" },
];

const defaultOptions = { status: "all" as const, color: "all" as const, date: "all" as const, category: "all", sort: "updated_desc" as const };

describe("transaction list controls", () => {
  it("derives a stable unique category list", () => {
    expect(getTransactionCategories(transactions)).toEqual(["خدمة رخص", "خدمة نقل"]);
  });

  it("filters by upcoming, overdue, and unplanned due dates", () => {
    expect(filterAndSortTransactions(transactions, { ...defaultOptions, date: "next_7_days" }, today).map((item) => item.id)).toEqual(["recent"]);
    expect(filterAndSortTransactions(transactions, { ...defaultOptions, date: "overdue" }, today).map((item) => item.id)).toEqual(["late"]);
    expect(filterAndSortTransactions(transactions, { ...defaultOptions, date: "no_due_date" }, today).map((item) => item.id)).toEqual(["no-date"]);
  });

  it("filters by service type and sorts by nearest due date", () => {
    expect(filterAndSortTransactions(transactions, { ...defaultOptions, category: "خدمة نقل" }, today).map((item) => item.id)).toEqual(["recent", "no-date"]);
    expect(filterAndSortTransactions(transactions, { ...defaultOptions, sort: "due_asc" }, today).map((item) => item.id)).toEqual(["late", "recent", "no-date"]);
  });
});
