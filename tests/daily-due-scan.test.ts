import { describe, expect, it } from "vitest";
import { getDailyDueNotification, getSaudiDayWindow } from "../server/daily-due-scan";

describe("daily due-date scan", () => {
  const now = new Date("2026-08-15T07:00:00.000Z");

  it("uses the Saudi calendar day for an idempotency key", () => {
    const window = getSaudiDayWindow(now);
    expect(window.key).toBe("2026-08-15");
    expect(window.start.toISOString()).toBe("2026-08-14T21:00:00.000Z");
  });

  it("marks prior dates as overdue and today's dates as due today", () => {
    const overdue = getDailyDueNotification({ resourceType: "appointment", resourceId: "2", recipientUserId: 7, title: "مراجعة المستندات", dueAt: new Date("2026-08-14T09:00:00.000Z") }, now);
    const dueToday = getDailyDueNotification({ resourceType: "request", resourceId: "3", recipientUserId: 7, title: "متابعة طلب", dueAt: new Date("2026-08-15T10:00:00.000Z") }, now);
    expect(overdue.title).toContain("متأخر");
    expect(overdue.data.urgency).toBe("overdue");
    expect(dueToday.title).toContain("اليوم");
    expect(dueToday.data.urgency).toBe("today");
  });
});
