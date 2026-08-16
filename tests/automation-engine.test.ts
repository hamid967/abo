import { describe, expect, it } from "vitest";
import { automationRunKey, matchesRuleConditions, mayProcessAutomationEvent, previewAutomationRule } from "../server/automation-engine";

describe("automation engine safeguards", () => {
  it("creates a deterministic unique run key for each rule-event pair", () => {
    expect(automationRunKey("rule-1", "event-1")).toBe("rule:rule-1:event:event-1");
    expect(automationRunKey("rule-1", "event-2")).not.toBe(automationRunKey("rule-1", "event-1"));
  });

  it("rejects unknown and automation-originated events to prevent rule loops", () => {
    expect(mayProcessAutomationEvent({ eventName: "unknown.event", payload: {} })).toBe(false);
    expect(mayProcessAutomationEvent({ eventName: "request.created", payload: { automationOrigin: true } })).toBe(false);
    expect(mayProcessAutomationEvent({ eventName: "request.created", payload: {} })).toBe(true);
  });

  it("evaluates only explicit equality conditions before executing a rule", () => {
    expect(matchesRuleConditions({ equals: { status: "completed" } }, { status: "completed" })).toBe(true);
    expect(matchesRuleConditions({ equals: { status: "completed" } }, { status: "under_review" })).toBe(false);
  });

  it("previews the matching action plan without executing side effects", () => {
    const preview = previewAutomationRule({ id: "rule-1", key: "completed", triggerEvent: "transaction.status_changed", priority: 10, conditions: { equals: { status: "completed" } }, actions: [{ type: "in_app_notification" }, { type: "create_task" }] }, { status: "completed" });
    expect(preview.matched).toBe(true);
    expect(preview.sideEffectsExecuted).toBe(false);
    expect(preview.actionPlan).toEqual([{ order: 1, type: "in_app_notification", wouldRun: true }, { order: 2, type: "create_task", wouldRun: true }]);
  });
});
