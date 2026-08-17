import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDailyDueNotification, getSaudiDayWindow, shouldPromptInactiveDraft } from "../server/daily-due-scan";

describe("daily due-date scan", () => {
  const now = new Date("2026-08-15T07:00:00.000Z");

  it("يربط الجمع الرسمي المتحقق بالفحص اليومي دون كشف تفاصيل الفشل", () => {
    const source = readFileSync("server/daily-due-scan.ts", "utf8");
    expect(source).toContain("collectVerifiedOfficialSources");
    expect(source).not.toContain("stack: error.stack");
  });

  it("يعرض حالة الفحص اليومي للمدير من دون كشف معرّف مهمة الجدولة", () => {
    const router = readFileSync("server/routers.ts", "utf8");
    const screen = readFileSync("app/admin/index.tsx", "utf8");
    expect(router).toContain("dailyDueStatus: protectedProcedure.query");
    expect(router).toContain("admin.daily_due_status_view");
    expect(router).not.toContain("heartbeatTaskUid");
    expect(screen).toContain("حالة الفحص اليومي");
    expect(screen).toContain("dailyDueStatus.refetch()");
  });

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

  it("formats an SLA task as a task alert with a task resource payload", () => {
    const taskAlert = getDailyDueNotification({ resourceType: "task", resourceId: "91", recipientUserId: 7, title: "إرفاق المستندات المطلوبة", dueAt: new Date("2026-08-15T10:00:00.000Z") }, now);
    expect(taskAlert.title).toContain("مهمة");
    expect(taskAlert.data.resourceType).toBe("task");
    expect(taskAlert.data.resourceId).toBe("91");
  });
});

describe("inactive draft timing", () => {
  it("waits at least 72 hours before prompting a user to resume", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    expect(shouldPromptInactiveDraft(new Date("2026-08-12T12:00:00.000Z"), now)).toBe(true);
    expect(shouldPromptInactiveDraft(new Date("2026-08-12T12:01:00.000Z"), now)).toBe(false);
  });
});
