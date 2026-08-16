import { describe, expect, it } from "vitest";

import { calculateSlaWeeklyTrend } from "../lib/sla-weekly-trend";

describe("calculateSlaWeeklyTrend", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");

  it("creates seven daily points and calculates the weekly throughput rate", () => {
    const result = calculateSlaWeeklyTrend([
      { status: "completed", createdAt: "2026-08-11T08:00:00.000Z", completedAt: "2026-08-12T10:00:00.000Z" },
      { status: "completed", createdAt: "2026-08-13T08:00:00.000Z", completedAt: "2026-08-16T10:00:00.000Z" },
      { status: "in_progress", createdAt: "2026-08-14T08:00:00.000Z" },
      { status: "cancelled", createdAt: "2026-08-14T08:00:00.000Z" },
    ], now);
    expect(result.points).toHaveLength(7);
    expect(result).toMatchObject({ completedTotal: 2, weeklyRate: 67 });
    expect(result.points.map((point) => point.completed)).toContain(1);
  });

  it("excludes cancelled tasks and keeps a zero rate when no work was available", () => {
    const result = calculateSlaWeeklyTrend([{ status: "cancelled", createdAt: "2026-08-15T08:00:00.000Z" }], now);
    expect(result).toMatchObject({ weeklyRate: 0, completedTotal: 0, direction: "steady", delta: 0 });
    expect(result.points.every((point) => point.rate === 0)).toBe(true);
  });

  it("reports the direction from the earliest to latest comparable day", () => {
    const result = calculateSlaWeeklyTrend([
      { status: "in_progress", createdAt: "2026-08-11T08:00:00.000Z" },
      { status: "completed", createdAt: "2026-08-16T08:00:00.000Z", completedAt: "2026-08-17T10:00:00.000Z" },
    ], now);
    expect(result.direction).toBe("up");
    expect(result.delta).toBeGreaterThan(0);
  });
});
