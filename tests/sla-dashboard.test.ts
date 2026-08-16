import { describe, expect, it } from "vitest";

import { calculateSlaDashboard } from "../lib/sla-dashboard";

describe("calculateSlaDashboard", () => {
  const now = new Date("2026-08-17T09:00:00.000Z");

  it("calculates completion, overdue, and active percentages from visible tasks", () => {
    const result = calculateSlaDashboard([
      { status: "completed", slaDueAt: "2026-08-17T08:00:00.000Z" },
      { status: "new", slaDueAt: "2026-08-17T08:59:00.000Z" },
      { status: "in_progress", slaDueAt: "2026-08-17T12:00:00.000Z" },
      { status: "awaiting_customer" },
    ], now);
    expect(result).toMatchObject({ total: 4, completed: 1, overdue: 1, active: 2, completedPercent: 25, overduePercent: 25, activePercent: 50 });
  });

  it("does not classify completed or cancelled tasks as overdue", () => {
    const result = calculateSlaDashboard([
      { status: "completed", slaDueAt: "2026-08-17T08:00:00.000Z" },
      { status: "cancelled", slaDueAt: "2026-08-17T08:00:00.000Z" },
    ], now);
    expect(result).toMatchObject({ total: 1, completed: 1, overdue: 0, active: 0, completedPercent: 100 });
  });

  it("returns zero percentages when no tasks are visible", () => {
    expect(calculateSlaDashboard([], now)).toMatchObject({ total: 0, completedPercent: 0, overduePercent: 0, activePercent: 0 });
  });
});
