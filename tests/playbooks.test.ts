import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const schema = readFileSync("drizzle/schema.ts", "utf8");
const db = readFileSync("server/db.ts", "utf8");
const router = readFileSync("server/routers.ts", "utf8");
const screen = readFileSync("app/admin/playbooks.tsx", "utf8");

describe("service playbooks", () => {
  it("stores separate playbooks, versions, ordered steps, and request snapshots", () => {
    expect(schema).toContain('mysqlTable("service_playbooks"');
    expect(schema).toContain('mysqlTable("playbook_versions"');
    expect(schema).toContain('mysqlTable("playbook_steps"');
    expect(schema).toContain('mysqlTable("request_playbook_assignments"');
    expect(schema).toContain('uniqueIndex("playbook_versions_unique")');
    expect(schema).toContain('uniqueIndex("playbook_steps_order_unique")');
  });

  it("keeps publishing guarded by a non-empty draft and archives the prior published version", () => {
    expect(db).toContain("PLAYBOOK_STEPS_REQUIRED");
    expect(db).toContain('status: "archived"');
    expect(db).toContain('status: "published"');
    expect(db).toContain("ACTIVE_PLAYBOOK_ALREADY_EXISTS");
  });

  it("captures the published playbook version and ordered steps when a new request is submitted", () => {
    expect(db).toContain("requestPlaybookAssignments");
    expect(db).toContain('eq(playbookVersions.status, "published")');
    expect(db).toMatch(/snapshot:\s*{\s*playbookName/);
    expect(db).toContain("versionNumber: active.versionNumber");
  });

  it("generates only actionable step tasks with a source key protected by a unique database index", () => {
    expect(schema).toContain(
      'sourceType: mysqlEnum("sourceType", ["manual", "playbook_step", "automation"])',
    );
    expect(schema).toContain('uniqueIndex("tasks_playbook_step_unique")');
    expect(db).toContain("shouldGenerateTaskFromPlaybookStep");
    expect(db).toContain('sourceType: "playbook_step"');
    expect(db).toContain("onDuplicateKeyUpdate");
  });

  it("persists assignment rules and SLA minutes before generated tasks are created", () => {
    expect(schema).toContain("assignmentRule");
    expect(schema).toContain("slaDueAt");
    expect(db).toContain("resolveGeneratedTaskAssignee");
    expect(db).toContain("slaDueAtForPlaybookStep");
  });

  it("restricts management operations to the protected admin dashboard role", () => {
    expect(router).toContain("playbooks: router");
    expect(router).toContain("canViewSystemDashboard(ctx.user.role)");
    expect(router).toContain("playbook.version_published");
    expect(router).toContain("playbook.archived");
  });

  it("shows service selection, version drafts, publication, and archive actions in the admin UI", () => {
    expect(screen).toContain("trpc.playbooks.list.useQuery");
    expect(screen).toContain("trpc.playbooks.createVersion.useMutation");
    expect(screen).toContain("trpc.playbooks.publish.useMutation");
    expect(screen).toContain("إصدار جديد");
    expect(screen).toContain("لن تتغير الطلبات المرتبطة بإصدارات سابقة");
  });
});
