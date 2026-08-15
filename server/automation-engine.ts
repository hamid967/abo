import * as db from "./db";
import { defaultAutomationRules } from "./default-automation-rules";

export const automationEventNames = ["request.created", "draft.document_attached", "conversation.handoff_requested", "transaction.status_changed", "appointment.created", "daily_due_scan.completed"] as const;
export type AutomationEventName = (typeof automationEventNames)[number];

type AutomationRule = { id: string; key: string; triggerEvent: string; conditions: unknown; actions: unknown; priority: number };

export function automationRunKey(ruleId: string, eventId: string) {
  return `rule:${ruleId}:event:${eventId}`;
}

export function mayProcessAutomationEvent(input: { eventName: string; payload: unknown }) {
  if (!automationEventNames.includes(input.eventName as AutomationEventName)) return false;
  if (input.payload && typeof input.payload === "object" && (input.payload as Record<string, unknown>).automationOrigin === true) return false;
  return true;
}

export function matchesRuleConditions(conditions: unknown, payload: Record<string, unknown>) {
  if (!conditions || typeof conditions !== "object") return true;
  const equals = (conditions as Record<string, unknown>).equals;
  if (!equals || typeof equals !== "object") return true;
  return Object.entries(equals as Record<string, unknown>).every(([key, value]) => payload[key] === value);
}

export async function emitAndProcessAutomationEvent(input: { eventName: AutomationEventName; aggregateType: string; aggregateId: string; ownerUserId?: number; payload: Record<string, unknown>; idempotencyKey: string }) {
  if (!mayProcessAutomationEvent(input)) return { eventId: null, processedRules: 0, skipped: true };
  const event = await db.createAutomationEvent(input);
  if (!event) return { eventId: null, processedRules: 0, skipped: true };
  await db.seedDefaultAutomationRules(defaultAutomationRules);
  const rules = await db.listEnabledAutomationRules(input.eventName);
  let processedRules = 0;
  for (const rule of rules as AutomationRule[]) {
    const reserved = await db.reserveAutomationRun({ ruleId: rule.id, eventId: event.id, idempotencyKey: automationRunKey(rule.id, event.id) });
    if (!reserved) continue;
    try {
      if (!matchesRuleConditions(rule.conditions, input.payload)) {
        await db.skipAutomationRun(reserved.id, { reason: "conditions_not_matched" });
        continue;
      }
      const result = await executeRuleActions({ rule, event: { ...input, id: event.id } });
      await db.completeAutomationRun(reserved.id, result);
      processedRules += 1;
    } catch (error) {
      await db.failAutomationRun(reserved.id, error instanceof Error ? error.message.slice(0, 96) : "AUTOMATION_RUN_FAILED");
    }
  }
  return { eventId: event.id, processedRules, skipped: false };
}

async function executeRuleActions(input: { rule: AutomationRule; event: { id: string; ownerUserId?: number; payload: Record<string, unknown> } }) {
  const actions = Array.isArray(input.rule.actions) ? input.rule.actions : [];
  const results: Array<{ type: string; status: "succeeded" | "skipped" }> = [];
  for (const action of actions) {
    if (!action || typeof action !== "object") continue;
    const definition = action as Record<string, unknown>;
    if (definition.type === "in_app_notification" && input.event.ownerUserId && typeof definition.title === "string" && typeof definition.body === "string") {
      await db.createInAppNotification({ recipientUserId: input.event.ownerUserId, title: definition.title, body: definition.body, type: "automation", data: { automationOrigin: true, ruleKey: input.rule.key, eventId: input.event.id } });
      results.push({ type: "in_app_notification", status: "succeeded" });
    } else if (definition.type === "create_task" && input.event.ownerUserId && typeof input.event.payload.transactionId === "number" && typeof definition.title === "string") {
      await db.createAutomatedTask({ ownerUserId: input.event.ownerUserId, transactionId: input.event.payload.transactionId, title: definition.title, priority: definition.priority === "high" || definition.priority === "urgent" || definition.priority === "low" ? definition.priority : "normal", ruleKey: input.rule.key });
      results.push({ type: "create_task", status: "succeeded" });
    } else {
      results.push({ type: String(definition.type ?? "unknown"), status: "skipped" });
    }
  }
  return { actionResults: results, ruleKey: input.rule.key };
}
