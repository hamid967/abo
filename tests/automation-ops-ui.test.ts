import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("automation operations UI", () => {
  it("uses the protected operations query and rule toggle action", () => {
    const screen = readFileSync("app/admin/automation.tsx", "utf8");
    expect(screen).toContain("trpc.automationOps.dashboard.useQuery");
    expect(screen).toContain("trpc.automationOps.setRuleEnabled.useMutation");
    expect(screen).toContain('account?.role === "admin"');
  });
});
