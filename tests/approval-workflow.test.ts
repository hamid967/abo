import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("approval workflow safeguards", () => {
  const schema = readFileSync("drizzle/schema.ts", "utf8");
  const db = readFileSync("server/db.ts", "utf8");
  const router = readFileSync("server/routers.ts", "utf8");
  const screen = readFileSync("app/task-tracking/index.tsx", "utf8");
  const inbox = readFileSync("app/approvals/inbox.tsx", "utf8");

  it("stores requests and ordered steps with server-owned audit evidence", () => {
    expect(schema).toContain('mysqlTable("approval_requests"');
    expect(schema).toContain('mysqlTable("approval_steps"');
    expect(schema).toContain("approval_steps_order_unique");
    expect(db).toContain("createApprovalRequest");
    expect(db).toContain("decideApprovalStep");
  });

  it("prevents duplicate pending requests and decisions outside the assigned user or role", () => {
    expect(db).toContain("APPROVAL_REQUEST_ALREADY_PENDING");
    expect(db).toContain("APPROVAL_DECISION_FORBIDDEN");
    expect(db).toContain("APPROVAL_SEQUENCE_BLOCKED");
    expect(router).toContain("approval.step_decided");
  });

  it("blocks task completion while approval is pending and explains the status in the app", () => {
    expect(db).toContain('type: "approval"');
    expect(router).toContain("TASK_BLOCKED_BY_APPROVAL");
    expect(screen).toContain("طلب اعتماد مشرف");
    expect(screen).toContain("بانتظار اعتماد");
  });

  it("limits the approver inbox to actionable pending steps and exposes clear decisions", () => {
    expect(db).toContain("listPendingApprovalsForApprover");
    expect(db).toContain('eq(approvalSteps.assignedUserId, userId)');
    expect(db).toContain("APPROVAL_SEQUENCE_BLOCKED");
    expect(router).toContain("inbox: protectedProcedure");
    expect(inbox).toContain("صندوق وارد الموافقات");
    expect(inbox).toContain("changes_requested");
    expect(inbox).toContain("information_requested");
  });

  it("filters and sorts only the already-authorized pending approval inbox", () => {
    expect(db).toContain("ApprovalInboxOptions");
    expect(db).toContain('status?: "all" | "active" | "expired"');
    expect(db).toContain('sortBy?: "createdAt" | "expiresAt" | "dueAt"');
    expect(db).toContain("const filtered = actionable.filter");
    expect(db).toContain("return filtered.sort");
    expect(router).toContain('status: z.enum(["all", "active", "expired"])');
    expect(router).toContain('sortBy: z.enum(["createdAt", "expiresAt", "dueAt"])');
    expect(inbox).toContain("تصفية وفرز");
    expect(inbox).toContain("expiresSoonest");
    expect(inbox).toContain("accessibilityState={{ selected");
  });
});
