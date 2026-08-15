export const reminderOffsets = [0, 1, 3, 7] as const;

export type ReminderOffsetDays = (typeof reminderOffsets)[number];

export const DEFAULT_REMINDER_HOUR = 9;
export const DEFAULT_REMINDER_MINUTE = 0;

export type ReminderSettings = {
  enabled: boolean;
  daysBefore: ReminderOffsetDays;
  hour?: number;
  minute?: number;
  notificationId?: string;
};

export const reminderOffsetLabels: Record<ReminderOffsetDays, string> = {
  0: "في يوم الموعد",
  1: "قبل يوم واحد",
  3: "قبل 3 أيام",
  7: "قبل أسبوع",
};

export function isValidReminderTime(hour: number, minute: number) {
  return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function getReminderTriggerDate(
  dueDate: string,
  daysBefore: ReminderOffsetDays,
  hour = DEFAULT_REMINDER_HOUR,
  minute = DEFAULT_REMINDER_MINUTE,
) {
  const parts = dueDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN) || !isValidReminderTime(hour, minute)) return null;

  const [year, month, day] = parts;
  const trigger = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (trigger.getFullYear() !== year || trigger.getMonth() !== month - 1 || trigger.getDate() !== day) return null;
  trigger.setDate(trigger.getDate() - daysBefore);
  return trigger;
}

export function canScheduleReminder(
  dueDate: string | undefined,
  daysBefore: ReminderOffsetDays,
  hour = DEFAULT_REMINDER_HOUR,
  minute = DEFAULT_REMINDER_MINUTE,
  now = new Date(),
) {
  if (!dueDate) return false;
  const trigger = getReminderTriggerDate(dueDate, daysBefore, hour, minute);
  return Boolean(trigger && trigger.getTime() > now.getTime());
}
