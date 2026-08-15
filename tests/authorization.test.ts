import { describe, expect, it } from "vitest";

import { canAccessCustomerRecord, canManageOperations, canOperateTransactions, canViewSystemDashboard } from "../server/authorization";

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

  it("reserves the system-wide dashboard for administrative roles", () => {
    expect(canViewSystemDashboard("admin")).toBe(true);
    expect(canViewSystemDashboard("super_admin")).toBe(true);
    expect(canViewSystemDashboard("supervisor")).toBe(false);
    expect(canViewSystemDashboard("employee")).toBe(false);
    expect(canViewSystemDashboard("user")).toBe(false);
  });
});
