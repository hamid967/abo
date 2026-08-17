import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getGovernanceGapDashboard } from "../server/governance-gap-summary";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const router = readFileSync(join(testsDirectory, "../server/routers.ts"), "utf8");
const adminScreen = readFileSync(join(testsDirectory, "../app/admin/index.tsx"), "utf8");
const gapsScreen = readFileSync(join(testsDirectory, "../app/admin/gaps.tsx"), "utf8");

describe("governance gaps administration dashboard", () => {
  it("summarizes the approved phase-zero security and database gap baseline", () => {
    const dashboard = getGovernanceGapDashboard();

    expect(dashboard.auditBaseline).toBe("مرحلة صفر 2030");
    expect(dashboard.summary.total).toBe(dashboard.gaps.length);
    expect(dashboard.summary.p0).toBeGreaterThan(0);
    expect(dashboard.summary.security).toBeGreaterThan(0);
    expect(dashboard.summary.database).toBeGreaterThan(0);
    expect(dashboard.gaps.some((gap) => gap.id === "migration-governance" && gap.priority === "p0")).toBe(true);
    expect(dashboard.gaps.some((gap) => gap.id === "database-rls-boundary" && gap.report === "SECURITY_GAP_REPORT.md")).toBe(true);
  });

  it("keeps the reporting endpoint behind the system-dashboard authorization check and audits access", () => {
    expect(router).toContain("governanceGaps: protectedProcedure");
    expect(router).toContain("canViewSystemDashboard(ctx.user.role)");
    expect(router).toContain("admin.governance_gaps_viewed");
    expect(router).toContain("getGovernanceGapDashboard()");
  });

  it("provides an accessible administrative route and a discoverable dashboard entry", () => {
    expect(adminScreen).toContain('router.push("/admin/gaps" as never)');
    expect(adminScreen).toContain("فجوات الأمن والبيانات");
    expect(gapsScreen).toContain("ملخص قابل للتنفيذ من تقارير");
    expect(gapsScreen).toContain("accessibilityLabel=\"العودة إلى لوحة الإدارة\"");
    expect(gapsScreen).toContain("refreshControl");
    expect(gapsScreen).toContain("لا تعني الفجوة وجود اختراق أو فقد بيانات");
  });
});
