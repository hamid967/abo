import { describe, expect, it } from "vitest";
import { automationRunKey, mayProcessAutomationEvent } from "../server/automation-engine";

describe("automation recovery contract", () => {
  it("creates a stable key for a retried rule run", () => {
    expect(automationRunKey("rule-1", "event-1")).toBe(automationRunKey("rule-1", "event-1"));
  });

  it("rejects events emitted by automation itself to prevent a retry loop", () => {
    expect(mayProcessAutomationEvent({ eventName: "request.created", payload: { automationOrigin: true } })).toBe(false);
    expect(mayProcessAutomationEvent({ eventName: "request.created", payload: { automationOrigin: false } })).toBe(true);
  });
});
