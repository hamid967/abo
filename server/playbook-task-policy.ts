export type PlaybookTaskStep = {
  stepKey: string;
  title: string;
  instructions: string | null;
  actionType: "instruction" | "document" | "approval" | "task";
  expectedDurationMinutes: number | null;
  assignmentRule?: "transaction_assignee" | "least_loaded_staff" | "request_owner" | "unassigned";
  slaMinutes?: number | null;
};

export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type AssignmentSource = "transaction_assignee" | "least_loaded_staff" | "request_owner" | "unassigned";

export const defaultSlaMinutes: Record<TaskPriority, number> = { urgent: 240, high: 480, normal: 1_440, low: 4_320 };

/** Only steps requiring a user action become tasks. Informational steps remain in the immutable Playbook snapshot. */
export function shouldGenerateTaskFromPlaybookStep(step: PlaybookTaskStep) {
  return step.actionType === "document" || step.actionType === "approval" || step.actionType === "task";
}

export function playbookTaskSourceKey(versionId: string, stepKey: string) {
  return `${versionId}:${stepKey}`;
}

export function dueAtForPlaybookStep(step: Pick<PlaybookTaskStep, "expectedDurationMinutes">, now = new Date()) {
  if (!step.expectedDurationMinutes || step.expectedDurationMinutes <= 0) return undefined;
  return new Date(now.getTime() + step.expectedDurationMinutes * 60_000);
}

export function slaMinutesForPlaybookStep(step: Pick<PlaybookTaskStep, "slaMinutes">, priority: TaskPriority) {
  if (step.slaMinutes && step.slaMinutes > 0) return step.slaMinutes;
  return defaultSlaMinutes[priority];
}

export function slaDueAtForPlaybookStep(step: Pick<PlaybookTaskStep, "slaMinutes">, priority: TaskPriority, now = new Date()) {
  return new Date(now.getTime() + slaMinutesForPlaybookStep(step, priority) * 60_000);
}

export function resolveGeneratedTaskAssignee(input: { rule?: PlaybookTaskStep["assignmentRule"]; transactionAssigneeUserId?: number | null; requestOwnerUserId: number; leastLoadedStaffUserId?: number | null }) {
  const rule = input.rule ?? "transaction_assignee";
  if (rule === "request_owner") return { assigneeUserId: input.requestOwnerUserId, assignmentSource: "request_owner" as const };
  if (rule === "unassigned") return { assigneeUserId: undefined, assignmentSource: "unassigned" as const };
  if (rule === "transaction_assignee" && input.transactionAssigneeUserId) return { assigneeUserId: input.transactionAssigneeUserId, assignmentSource: "transaction_assignee" as const };
  if (input.leastLoadedStaffUserId) return { assigneeUserId: input.leastLoadedStaffUserId, assignmentSource: "least_loaded_staff" as const };
  return { assigneeUserId: undefined, assignmentSource: "unassigned" as const };
}
