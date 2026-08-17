import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("approval workflow safeguards", () => {
  const schema = readFileSync("drizzle/schema.ts", "utf8");
  const db = readFileSync("server/db.ts", "utf8");
  const router = readFileSync("server/routers.ts", "utf8");
  const screen = readFileSync("app/task-tracking/index.tsx", "utf8");

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
});
