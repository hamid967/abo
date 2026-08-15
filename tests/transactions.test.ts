import { describe, expect, it } from "vitest";

import { createTransaction, isTransactionOverdue, statusDetails, transactionStatuses } from "../lib/transactions";

describe("transaction domain", () => {
  it("creates a transaction with a generated identifier and timestamp", () => {
    const transaction = createTransaction({
      title: "تجديد وثيقة",
      agency: "الجهة المختصة",
      reference: "REF-123",
      status: "draft",
    });

    expect(transaction.id).toMatch(/^transaction-/);
    expect(transaction.updatedAt).toBeTruthy();
    expect(transaction.title).toBe("تجديد وثيقة");
    expect(transaction.statusHistory).toHaveLength(1);
    expect(transaction.requestNumber).toMatch(/^AM-/);
  });

  it("flags unfinished transactions whose due date has passed", () => {
    const overdue = {
      id: "1",
      title: "معاملة",
      agency: "جهة",
      reference: "1",
      status: "under_review" as const,
      dueDate: "2026-01-10",
      updatedAt: "2026-01-01T00:00:00.000Z",
      statusHistory: [],
    };
    const completed = { ...overdue, status: "completed" as const };

    expect(isTransactionOverdue(overdue, new Date("2026-02-01T12:00:00"))).toBe(true);
    expect(isTransactionOverdue(completed, new Date("2026-02-01T12:00:00"))).toBe(false);
  });

  it("provides a user-facing Arabic label for every status", () => {
    expect(transactionStatuses.every((status) => Boolean(statusDetails[status].label))).toBe(true);
  });
});
