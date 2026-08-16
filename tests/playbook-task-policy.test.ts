import { describe, expect, it } from "vitest";
import { dueAtForPlaybookStep, playbookTaskSourceKey, shouldGenerateTaskFromPlaybookStep } from "../server/playbook-task-policy";

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
});
