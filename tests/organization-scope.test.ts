import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("organization scope protection", () => {
  const db = readFileSync("server/db.ts", "utf8");
  const routers = readFileSync("server/routers.ts", "utf8");

  it("accepts an organization only for its owner or an explicit member", () => {
    expect(db).toContain("export async function canUseOrganization");
    expect(db).toContain("eq(organizations.ownerUserId, userId)");
    expect(db).toContain("eq(organizationMembers.userId, userId)");
    expect(db).toContain("isNull(organizations.deletedAt)");
  });

  it("enforces organization access before request creation and draft mutation", () => {
    expect(routers).toContain("ORGANIZATION_ACCESS_DENIED");
    expect(routers).toContain("db.canUseOrganization(ctx.user.id, input.organizationId)");
    expect(routers).toContain("db.canUseOrganization(ctx.user.id, input.patch.organizationId)");
  });
});
