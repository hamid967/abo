import { describe, expect, it } from "vitest";
import { serviceDecisionSource, serviceDecisionSourceLabel } from "../lib/service-decision";

describe("service decision sources", () => {
  const now = new Date("2026-08-16T09:00:00.000Z");

  it("prioritizes a requested document over other transaction data", () => {
    expect(serviceDecisionSource({ status: "awaiting_customer_documents", dueDate: "2026-08-30", updatedAt: now.toISOString() }, now)).toBe("document_requirement");
  });

  it("identifies a nearby due date and keeps the source label explainable", () => {
    const source = serviceDecisionSource({ status: "under_review", dueDate: "2026-08-18", updatedAt: now.toISOString() }, now);
    expect(source).toBe("due_date");
    expect(serviceDecisionSourceLabel(source, true)).toBe("موعد المتابعة");
  });

  it("falls back to transaction status and then latest activity", () => {
    expect(serviceDecisionSource({ status: "under_review", updatedAt: now.toISOString() }, now)).toBe("transaction_status");
    expect(serviceDecisionSource({ status: "draft", updatedAt: now.toISOString() }, now)).toBe("last_activity");
  });
});
