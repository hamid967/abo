import { describe, expect, it } from "vitest";
import { resolveTaskAlertDueAt, taskAlertTriggerAt } from "../lib/task-alert-policy";

describe("task SLA alert policy", () => {
  const now = new Date("2026-08-17T09:00:00.000Z");

  it("uses the SLA deadline before the general task deadline", () => {
    const dueAt = resolveTaskAlertDueAt({ id: 1, status: "new", slaDueAt: "2026-08-17T12:00:00.000Z", dueAt: "2026-08-18T12:00:00.000Z" });
    expect(dueAt?.toISOString()).toBe("2026-08-17T12:00:00.000Z");
  });

  it("schedules the selected number of minutes before a future deadline", () => {
    const trigger = taskAlertTriggerAt({ id: 1, status: "in_progress", slaDueAt: "2026-08-17T12:00:00.000Z" }, 60, now);
    expect(trigger?.toISOString()).toBe("2026-08-17T11:00:00.000Z");
  });

  it("does not schedule completed, cancelled, or already-due tasks", () => {
    expect(taskAlertTriggerAt({ id: 1, status: "completed", slaDueAt: "2026-08-17T12:00:00.000Z" }, 60, now)).toBeUndefined();
    expect(taskAlertTriggerAt({ id: 2, status: "cancelled", slaDueAt: "2026-08-17T12:00:00.000Z" }, 60, now)).toBeUndefined();
    expect(taskAlertTriggerAt({ id: 3, status: "new", slaDueAt: "2026-08-17T09:30:00.000Z" }, 60, now)).toBeUndefined();
  });
});
