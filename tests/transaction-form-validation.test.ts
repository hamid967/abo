import { describe, expect, it } from "vitest";

import { transactionFormDefaults, transactionFormSchema } from "../lib/transaction-form-validation";

describe("transaction form validation", () => {
  it("accepts a valid Arabic transaction without a reminder", () => {
    const result = transactionFormSchema.safeParse({ ...transactionFormDefaults, title: "تجديد رخصة", agency: "إدارة المرور", dueDate: "2026-08-30" });
    expect(result.success).toBe(true);
  });

  it("rejects calendar dates that only match the string pattern", () => {
    const result = transactionFormSchema.safeParse({ ...transactionFormDefaults, title: "طلب", agency: "الجهة", dueDate: "2026-02-30" });
    expect(result.success).toBe(false);
  });

  it("requires a valid future-ready reminder time and due date when reminders are enabled", () => {
    const result = transactionFormSchema.safeParse({ ...transactionFormDefaults, title: "طلب", agency: "الجهة", reminderEnabled: true, reminderHour: "27", reminderMinute: "77" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(["dueDate", "reminderHour", "reminderMinute"]));
    }
  });
});
