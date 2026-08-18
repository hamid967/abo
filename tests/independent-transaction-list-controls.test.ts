import { describe, expect, it } from "vitest";

import { filterAndSortTransactions, getTransactionCategories } from "../native-independent/src/data/transactionListControls";
import type { GovernmentTransaction } from "../native-independent/src/data/transactions";

const transactions: GovernmentTransaction[] = [
  { id: "1", title: "تجديد سجل", agency: "وزارة التجارة", reference: "A-1", status: "under_review", serviceType: "تجديد", dueDate: "2026-08-21", updatedAt: "2026-08-18T08:00:00.000Z", statusHistory: [] },
  { id: "2", title: "تعديل بيانات", agency: "منصة أعمال", reference: "A-2", status: "received", serviceType: "تعديل", updatedAt: "2026-08-17T08:00:00.000Z", statusHistory: [] },
  { id: "3", title: "إصدار رخصة", agency: "البلدية", reference: "A-3", status: "under_review", serviceType: "تجديد", dueDate: "2026-08-10", updatedAt: "2026-08-16T08:00:00.000Z", statusHistory: [] },
];

describe("محددات معاملات التطبيق المستقل", () => {
  it("تستخرج التصنيفات وتطبّق فلترة الموعد والتصنيف", () => {
    expect(getTransactionCategories(transactions)).toEqual(["تجديد", "تعديل"]);
    const result = filterAndSortTransactions(transactions, { status: "all", color: "all", date: "next_7_days", category: "تجديد", sort: "due_asc" }, new Date("2026-08-18T09:00:00.000Z"));
    expect(result.map((item) => item.id)).toEqual(["1"]);
  });

  it("ترتّب المواعيد وتضع المعاملات بلا موعد في النهاية", () => {
    const result = filterAndSortTransactions(transactions, { status: "all", color: "all", date: "all", category: "all", sort: "due_asc" }, new Date("2026-08-01T09:00:00.000Z"));
    expect(result.map((item) => item.id)).toEqual(["3", "1", "2"]);
  });
});
