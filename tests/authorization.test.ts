import { describe, expect, it } from "vitest";

import { canAccessCustomerRecord, canManageKnowledge, canManageOperations, canOperateTransactions, canViewAuditLogs, canViewSystemDashboard } from "../server/authorization";

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

  it("restricts knowledge publication to supervisory roles and audit logs to admins", () => {
    expect(canManageKnowledge("supervisor")).toBe(true);
    expect(canManageKnowledge("employee")).toBe(false);
    expect(canManageKnowledge("user")).toBe(false);
    expect(canViewAuditLogs("admin")).toBe(true);
    expect(canViewAuditLogs("super_admin")).toBe(true);
    expect(canViewAuditLogs("supervisor")).toBe(false);
  });
});
