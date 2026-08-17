import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";

import { calculateSlaDashboard } from "../lib/sla-dashboard";
import { calculateSlaWeeklyTrend, type SlaWeeklyTrendTask } from "../lib/sla-weekly-trend";

const NOW = new Date("2026-08-17T12:00:00.000Z");

function buildDeterministicTasks(count: number): SlaWeeklyTrendTask[] {
  return Array.from({ length: count }, (_, index) => {
    const createdDaysAgo = index % 55;
    const createdAt = new Date(NOW);
    createdAt.setUTCDate(createdAt.getUTCDate() - createdDaysAgo);
    const mode = index % 17;
    if (mode === 0) return { status: "cancelled", createdAt };
    if (mode % 3 !== 0) return { status: "in_progress", createdAt, dueAt: new Date(NOW.getTime() + ((index % 8) - 4) * 3_600_000) };
    const completedAt = new Date(createdAt);
    completedAt.setUTCDate(completedAt.getUTCDate() + Math.min((index % 5) + 1, createdDaysAgo));
    return { status: "completed", createdAt, completedAt, dueAt: new Date(NOW.getTime() - (index % 24) * 3_600_000) };
  });
}

describe("SLA analytics performance", () => {
  it("processes 10,000 access-scoped tasks for summary, 7-day, and 30-day charts within the performance budget", () => {
    const tasks = buildDeterministicTasks(10_000);
    const startedAt = performance.now();
    const dashboard = calculateSlaDashboard(tasks, NOW);
    const weekly = calculateSlaWeeklyTrend(tasks, NOW, 7);
    const monthly = calculateSlaWeeklyTrend(tasks, NOW, 30);
    const elapsedMs = performance.now() - startedAt;

    expect(dashboard.total).toBe(tasks.filter((task) => task.status !== "cancelled").length);
    expect(weekly.points).toHaveLength(7);
    expect(monthly.points).toHaveLength(30);
    // A generous ceiling catches accidental quadratic regressions without making CI timing brittle.
    expect(elapsedMs).toBeLessThan(2_000);
  });

  it("keeps periodic recomputation bounded for a large cached task collection", () => {
    const tasks = buildDeterministicTasks(5_000);
    const startedAt = performance.now();
    for (let cycle = 0; cycle < 6; cycle += 1) {
      const tick = new Date(NOW.getTime() + cycle * 60_000);
      calculateSlaDashboard(tasks, tick);
      calculateSlaWeeklyTrend(tasks, tick, cycle % 2 === 0 ? 7 : 30);
    }
    const elapsedMs = performance.now() - startedAt;
    expect(elapsedMs).toBeLessThan(2_000);
  });
});
