import { describe, expect, it } from "vitest";
import { defaultAutomationRules } from "../server/default-automation-rules";

describe("default automation rules", () => {
  it("covers document, assignment, and human escalation journeys", () => {
    expect(defaultAutomationRules.map((rule) => rule.triggerEvent)).toEqual(expect.arrayContaining(["request.created", "draft.document_attached", "conversation.handoff_requested"]));
    const actionTypes = defaultAutomationRules.map((rule) => rule.actions[0]?.type);
    expect(actionTypes).toEqual(expect.arrayContaining(["create_task", "in_app_notification"]));
  });
});
