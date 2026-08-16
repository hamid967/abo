export type PlaybookTaskStep = {
  stepKey: string;
  title: string;
  instructions: string | null;
  actionType: "instruction" | "document" | "approval" | "task";
  expectedDurationMinutes: number | null;
};

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
