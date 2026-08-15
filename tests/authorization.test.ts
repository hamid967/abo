import { describe, expect, it } from "vitest";

import { canAccessCustomerRecord, canManageOperations, canOperateTransactions } from "../server/authorization";

describe("Abu Mishal authorization", () => {
  it("limits a customer to their own record", () => {
    expect(canAccessCustomerRecord("user", 12, 12)).toBe(true);
    expect(canAccessCustomerRecord("user", 12, 13)).toBe(false);
  });

  it("allows operational roles to access assigned work and reserves management actions", () => {
    expect(canOperateTransactions("employee")).toBe(true);
    expect(canOperateTransactions("user")).toBe(false);
    expect(canManageOperations("supervisor")).toBe(true);
    expect(canManageOperations("employee")).toBe(false);
  });
});
