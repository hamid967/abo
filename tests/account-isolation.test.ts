import { describe, expect, it } from "vitest";

import { canAccessCustomerRecord } from "../server/authorization";

type OwnedResource = { kind: string; ownerUserId: number };

const accountA = 4101;
const accountB = 4102;
const resources: OwnedResource[] = [
  { kind: "service_request", ownerUserId: accountA },
  { kind: "transaction", ownerUserId: accountA },
  { kind: "support_ticket", ownerUserId: accountA },
  { kind: "uploaded_document", ownerUserId: accountA },
  { kind: "ai_conversation", ownerUserId: accountA },
  { kind: "notification", ownerUserId: accountA },
];

describe("multi-account isolation matrix", () => {
  it("allows account A to access only its own owned resources", () => {
    for (const resource of resources) {
      expect(canAccessCustomerRecord("user", resource.ownerUserId, accountA), resource.kind).toBe(true);
      expect(canAccessCustomerRecord("user", resource.ownerUserId, accountB), resource.kind).toBe(false);
    }
  });

  it("keeps account B isolated when the same resource shape is owned by B", () => {
    for (const resource of resources) {
      const accountBResource = { ...resource, ownerUserId: accountB };
      expect(canAccessCustomerRecord("user", accountBResource.ownerUserId, accountB), resource.kind).toBe(true);
      expect(canAccessCustomerRecord("user", accountBResource.ownerUserId, accountA), resource.kind).toBe(false);
    }
  });

  it("allows operational roles to work across customer-owned records while customers remain isolated", () => {
    for (const role of ["employee", "supervisor", "admin", "super_admin"]) {
      expect(canAccessCustomerRecord(role, accountA, accountB), role).toBe(true);
    }
    expect(canAccessCustomerRecord("user", accountA, accountB)).toBe(false);
  });
});
