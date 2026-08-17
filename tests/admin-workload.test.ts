import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin workload overview", () => {
  const db = readFileSync("server/db.ts", "utf8");
  const router = readFileSync("server/routers.ts", "utf8");
  const screen = readFileSync("app/admin/index.tsx", "utf8");

  it("aggregates active, overdue, and unassigned work from task records", () => {
    expect(db).toContain("getTaskWorkloadOverview");
    expect(db).toContain("coalesce(${tasks.slaDueAt}, ${tasks.dueAt})");
    expect(db).toContain('"غير معيّنة"');
  });

  it("keeps workload access restricted to system dashboard roles", () => {
    expect(router).toContain("adminDashboard: router");
    expect(router).toContain("workload: protectedProcedure");
    expect(router).toContain("canViewSystemDashboard(ctx.user.role)");
  });

  it("presents the workload summary without exposing task details", () => {
    expect(screen).toContain("عبء عمل الفريق");
    expect(screen).toContain("غير معيّنة");
    expect(screen).not.toContain("member.email");
  });

  it("counts pending approvals that expire in the next twenty-four hours for administrators", () => {
    expect(db).toContain("approvalsExpiringSoon");
    expect(db).toContain("approvalWindowEndsAt");
    expect(db).toContain('eq(approvalRequests.status, "pending")');
    expect(db).toContain("gt(approvalRequests.expiresAt, now)");
    expect(db).toContain("lt(approvalRequests.expiresAt, approvalWindowEndsAt)");
    expect(router).toContain("canViewSystemDashboard(ctx.user.role)");
    expect(screen).toContain("موافقات تنتهي خلال 24 ساعة");
    expect(screen).toContain("metrics.approvalsExpiringSoon");
    expect(screen).toContain('accessibilityRole="alert"');
  });
});
