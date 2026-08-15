import { describe, expect, it } from "vitest";

import { canScheduleReminder, getReminderTriggerDate, isValidReminderTime, reminderOffsetLabels } from "../lib/reminders";

describe("reminder scheduling", () => {
  it("sets the reminder at the selected hour and minute before the due date", () => {
    const trigger = getReminderTriggerDate("2026-08-15", 3, 16, 45);

    expect(trigger).not.toBeNull();
    expect(trigger?.getFullYear()).toBe(2026);
    expect(trigger?.getMonth()).toBe(7);
    expect(trigger?.getDate()).toBe(12);
    expect(trigger?.getHours()).toBe(16);
    expect(trigger?.getMinutes()).toBe(45);
  });

  it("rejects impossible due dates and dates whose reminder time has passed", () => {
    expect(getReminderTriggerDate("2026-02-30", 1)).toBeNull();
    expect(canScheduleReminder("2026-08-15", 3, 9, 0, new Date(2026, 7, 12, 9))).toBe(false);
    expect(canScheduleReminder(undefined, 3, 9, 0, new Date(2026, 7, 1))).toBe(false);
    expect(isValidReminderTime(23, 59)).toBe(true);
    expect(isValidReminderTime(24, 0)).toBe(false);
  });

  it("supplies visible Arabic labels for reminder options", () => {
    expect(reminderOffsetLabels[7]).toBe("قبل أسبوع");
    expect(reminderOffsetLabels[0]).toBe("في يوم الموعد");
  });
});
