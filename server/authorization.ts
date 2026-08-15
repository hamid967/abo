export type AbuMishalRole = "user" | "employee" | "supervisor" | "admin" | "super_admin";

export function canOperateTransactions(role: string | null | undefined) {
  return role === "employee" || role === "supervisor" || role === "admin" || role === "super_admin";
}

export function canManageOperations(role: string | null | undefined) {
  return role === "supervisor" || role === "admin" || role === "super_admin";
}

export function canViewSystemDashboard(role: string | null | undefined) {
  return role === "admin" || role === "super_admin";
}

export function canManageKnowledge(role: string | null | undefined) {
  return role === "supervisor" || role === "admin" || role === "super_admin";
}

export function canViewAuditLogs(role: string | null | undefined) {
  return role === "admin" || role === "super_admin";
}

export function canAccessCustomerRecord(role: string | null | undefined, recordOwnerId: number, currentUserId: number) {
  return recordOwnerId === currentUserId || canOperateTransactions(role);
}
