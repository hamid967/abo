import { describe, expect, it } from "vitest";
import { dueAtForPlaybookStep, playbookTaskSourceKey, resolveGeneratedTaskAssignee, shouldGenerateTaskFromPlaybookStep, slaDueAtForPlaybookStep, slaMinutesForPlaybookStep } from "../server/playbook-task-policy";

describe("playbook task generation policy", () => {
  it("creates tasks only for task, document, and approval steps", () => {
    const base = { stepKey: "one", title: "خطوة", instructions: null, expectedDurationMinutes: null };
    expect(shouldGenerateTaskFromPlaybookStep({ ...base, actionType: "instruction" })).toBe(false);
    expect(shouldGenerateTaskFromPlaybookStep({ ...base, actionType: "task" })).toBe(true);
    expect(shouldGenerateTaskFromPlaybookStep({ ...base, actionType: "document" })).toBe(true);
    expect(shouldGenerateTaskFromPlaybookStep({ ...base, actionType: "approval" })).toBe(true);
  });

  it("uses a stable version and step key to prevent duplicate generated tasks", () => {
    expect(playbookTaskSourceKey("version-a", "collect_documents")).toBe("version-a:collect_documents");
  });

  it("derives the due date only when a step declares a positive expected duration", () => {
    const now = new Date("2026-08-16T09:00:00.000Z");
    expect(dueAtForPlaybookStep({ expectedDurationMinutes: 90 }, now)?.toISOString()).toBe("2026-08-16T10:30:00.000Z");
    expect(dueAtForPlaybookStep({ expectedDurationMinutes: null }, now)).toBeUndefined();
    expect(dueAtForPlaybookStep({ expectedDurationMinutes: 0 }, now)).toBeUndefined();
  });

  it("uses the configured SLA or a priority-safe default and derives its due time", () => {
    const now = new Date("2026-08-16T09:00:00.000Z");
    expect(slaMinutesForPlaybookStep({ slaMinutes: 180 }, "normal")).toBe(180);
    expect(slaMinutesForPlaybookStep({ slaMinutes: null }, "urgent")).toBe(240);
    expect(slaDueAtForPlaybookStep({ slaMinutes: 180 }, "normal", now).toISOString()).toBe("2026-08-16T12:00:00.000Z");
  });

  it("prefers an explicit assignment rule and leaves the task unassigned when no eligible staff exists", () => {
    expect(resolveGeneratedTaskAssignee({ rule: "request_owner", requestOwnerUserId: 11, transactionAssigneeUserId: 20, leastLoadedStaffUserId: 30 })).toEqual({ assigneeUserId: 11, assignmentSource: "request_owner" });
    expect(resolveGeneratedTaskAssignee({ rule: "transaction_assignee", requestOwnerUserId: 11, transactionAssigneeUserId: 20, leastLoadedStaffUserId: 30 })).toEqual({ assigneeUserId: 20, assignmentSource: "transaction_assignee" });
    expect(resolveGeneratedTaskAssignee({ rule: "least_loaded_staff", requestOwnerUserId: 11, leastLoadedStaffUserId: 30 })).toEqual({ assigneeUserId: 30, assignmentSource: "least_loaded_staff" });
    expect(resolveGeneratedTaskAssignee({ rule: "transaction_assignee", requestOwnerUserId: 11 })).toEqual({ assigneeUserId: undefined, assignmentSource: "unassigned" });
  });
});
