export const reminderOffsets = [0, 1, 3, 7] as const;

export type ReminderOffsetDays = (typeof reminderOffsets)[number];

export type ReminderSettings = {
  enabled: boolean;
  daysBefore: ReminderOffsetDays;
  notificationId?: string;
};

export const reminderOffsetLabels: Record<ReminderOffsetDays, string> = {
  0: "في يوم الموعد",
  1: "قبل يوم واحد",
  3: "قبل 3 أيام",
  7: "قبل أسبوع",
};

export function getReminderTriggerDate(dueDate: string, daysBefore: ReminderOffsetDays) {
  const parts = dueDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;

  const [year, month, day] = parts;
  const trigger = new Date(year, month - 1, day, 9, 0, 0, 0);
  if (trigger.getFullYear() !== year || trigger.getMonth() !== month - 1 || trigger.getDate() !== day) return null;
  trigger.setDate(trigger.getDate() - daysBefore);
  return trigger;
}

export function canScheduleReminder(dueDate: string | undefined, daysBefore: ReminderOffsetDays, now = new Date()) {
  if (!dueDate) return false;
  const trigger = getReminderTriggerDate(dueDate, daysBefore);
  return Boolean(trigger && trigger.getTime() > now.getTime());
}
