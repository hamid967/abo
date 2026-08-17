import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("task execution dependencies and checklists", () => {
  const schema = readFileSync("drizzle/schema.ts", "utf8");
  const db = readFileSync("server/db.ts", "utf8");
  const router = readFileSync("server/routers.ts", "utf8");
  const screen = readFileSync("app/task-tracking/index.tsx", "utf8");

  it("keeps dependency and checklist records constrained to the existing task model", () => {
    expect(schema).toContain('mysqlTable("task_dependencies"');
    expect(schema).toContain('mysqlTable("task_checklist_items"');
    expect(schema).toContain("task_dependencies_unique");
    expect(schema).toContain("task_checklist_items_task_fk");
  });

  it("blocks completion on the server when predecessors or required checklist items remain", () => {
    expect(db).toContain("taskCompletionBlockReason");
    expect(db).toContain("wouldCreateDependencyCycle");
    expect(db).toContain("TASK_DEPENDENCY_CYCLE");
    expect(router).toContain("TASK_BLOCKED_BY_DEPENDENCY");
    expect(router).toContain("addDependency");
    expect(router).toContain("setChecklistCompletion");
  });

  it("shows the blocker and required checklist before the user completes a task", () => {
    expect(screen).toContain("التبعيات وقائمة التحقق");
    expect(screen).toContain("المهمة محجوبة");
    expect(screen).toContain("قائمة التحقق ناقصة");
    expect(screen).toContain("accessibilityRole=\"checkbox\"");
  });
});
