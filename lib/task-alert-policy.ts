export type TaskAlertCandidate = {
  id: number;
  status: string;
  slaDueAt?: Date | string | null;
  dueAt?: Date | string | null;
};

const TERMINAL_TASK_STATUSES = new Set(["completed", "cancelled"]);

export function resolveTaskAlertDueAt(task: TaskAlertCandidate) {
  const raw = task.slaDueAt ?? task.dueAt;
  if (!raw) return undefined;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function taskAlertTriggerAt(task: TaskAlertCandidate, reminderMinutes: number, now = new Date()) {
  if (TERMINAL_TASK_STATUSES.has(task.status)) return undefined;
  const dueAt = resolveTaskAlertDueAt(task);
  if (!dueAt) return undefined;
  const safeMinutes = Math.min(10_080, Math.max(5, Math.floor(reminderMinutes)));
  const triggerAt = new Date(dueAt.getTime() - safeMinutes * 60_000);
  return triggerAt.getTime() > now.getTime() ? triggerAt : undefined;
}
