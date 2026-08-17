import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("notification center UI", () => {
  const screen = readFileSync("app/notifications/index.tsx", "utf8");
  const router = readFileSync("server/routers.ts", "utf8");
  const database = readFileSync("server/db.ts", "utf8");

  it("shows notification history filters and linked task follow-up", () => {
    expect(screen).toContain('type NotificationFilter = "all" | "unread" | "tasks"');
    expect(screen).toContain("مركز الإشعارات");
    expect(screen).toContain("item.task");
    expect(screen).toContain('router.push("/task-tracking" as never)');
    expect(screen).toContain("RefreshControl");
  });

  it("keeps delivery metadata and task records behind the authenticated notification route", () => {
    expect(router).toContain("db.listNotificationCenter(ctx.user.id)");
    expect(database).toContain("listNotificationCenter");
    expect(database).toContain("eq(notifications.recipientUserId, userId)");
    expect(database).toContain("eq(tasks.ownerUserId, userId)");
    expect(database).toContain("eq(tasks.assigneeUserId, userId)");
  });
});
