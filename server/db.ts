import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, like, lt, ne, notInArray, or, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { aiConversations, aiMessages, approvalRequests, approvalSteps, appointments, automationEvents, automationRules, automationRuns, automationSchedules, auditLogs, cloudRecords, documents, dueNotificationRuns, expoGoOAuthAttempts, faqItems, governmentServices, handoffRequests, InsertUser, InsertServiceRequest, InsertTransactionRecord, knowledgeArticles, loginSecurityDevices, mobilePushDevices, notificationDeliveryLogs, notificationPreferences, notifications, officialSources, organizationMembers, organizations, playbookSteps, playbookVersions, regulatoryUpdates, requestDraftDocuments, requestDrafts, requestPlaybookAssignments, servicePlaybooks, serviceRequests, supportTickets, taskChecklistItems, taskDependencies, tasks, ticketMessages, transactionStatusHistory, transactions, updateImpacts, updateSubscriptions, userConsents, users } from "../drizzle/schema";
import { canManageOperations, canOperateTransactions } from "./authorization";
import { ENV } from "./_core/env";
import { assertConversationTransition, assertSafeConversationContent, conversationStatusForState, type ConversationState } from "./conversation-state";
import { calculateDraftCompletion, mergeRequestDraftData, type RequestDraftPatch } from "./request-draft-policy";
import { validateRequestData, validationStatusFromResults } from "./request-validation";
import { consentTextHash, mayConfirmDraft, requestPolicyVersion } from "./request-review";
import { formatRequestNumber, submissionMessage } from "./request-submission";
import { canAttachDraftDocument } from "./draft-document-policy";
import { handoffPriorityForReason, handoffSubject } from "./handoff-policy";
import { classifyLoginSecurity, formatLoginSecurityAlert, normalizeDeviceId } from "./login-security";
import { dueAtForPlaybookStep, playbookTaskSourceKey, resolveGeneratedTaskAssignee, shouldGenerateTaskFromPlaybookStep, slaDueAtForPlaybookStep, slaMinutesForPlaybookStep } from "./playbook-task-policy";
import { isOfficialGovernmentUrl, mayTransitionRegulatoryUpdate, parseOfficialRss, type OfficialUpdateImportance, type OfficialUpdateType, ZATCA_OFFICIAL_SOURCE } from "./official-update-policy";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch {
      console.warn("[Database] Failed to initialize the database connection");
      _db = null;
    }
  }
  return _db;
}

export async function createExpoGoOAuthAttempt(input: {
  id: string;
  proofHash: string;
  callbackState: string;
  expiresAt: Date;
  deviceId?: string;
  platform?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(expoGoOAuthAttempts).where(lt(expoGoOAuthAttempts.expiresAt, new Date()));
  await db.insert(expoGoOAuthAttempts).values({ ...input, status: "pending" });
}

export async function markExpoGoOAuthAttemptReady(input: {
  id: string;
  callbackState: string;
  authorizationCode: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(expoGoOAuthAttempts)
    .set({ authorizationCode: input.authorizationCode, status: "ready" })
    .where(and(
      eq(expoGoOAuthAttempts.id, input.id),
      eq(expoGoOAuthAttempts.callbackState, input.callbackState),
      eq(expoGoOAuthAttempts.status, "pending"),
      gt(expoGoOAuthAttempts.expiresAt, new Date()),
    ));
  return Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) > 0;
}

export async function claimExpoGoOAuthAttempt(input: { id: string; proofHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({
    authorizationCode: expoGoOAuthAttempts.authorizationCode,
    callbackState: expoGoOAuthAttempts.callbackState,
    deviceId: expoGoOAuthAttempts.deviceId,
    platform: expoGoOAuthAttempts.platform,
  }).from(expoGoOAuthAttempts).where(and(
    eq(expoGoOAuthAttempts.id, input.id),
    eq(expoGoOAuthAttempts.proofHash, input.proofHash),
    eq(expoGoOAuthAttempts.status, "ready"),
    gt(expoGoOAuthAttempts.expiresAt, new Date()),
  )).limit(1);
  const attempt = rows[0];
  if (!attempt?.authorizationCode) return undefined;
  const result = await db.update(expoGoOAuthAttempts)
    .set({ status: "exchanging" })
    .where(and(
      eq(expoGoOAuthAttempts.id, input.id),
      eq(expoGoOAuthAttempts.proofHash, input.proofHash),
      eq(expoGoOAuthAttempts.status, "ready"),
    ));
  if (Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) !== 1) return undefined;
  return attempt;
}

export async function removeExpoGoOAuthAttempt(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(expoGoOAuthAttempts).where(eq(expoGoOAuthAttempts.id, id));
}

export async function failExpoGoOAuthAttempt(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(expoGoOAuthAttempts).set({ status: "failed", authorizationCode: null }).where(eq(expoGoOAuthAttempts.id, id));
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user");
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createServiceRequest(input: Omit<InsertServiceRequest, "requestNumber" | "customerUserId"> & { customerUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const requestNumber = `AM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const result = await db.insert(serviceRequests).values({ ...input, requestNumber });
  return { id: result[0].insertId, requestNumber };
}

export async function canUseOrganization(userId: number, organizationId: number) {
  const db = await getDb();
  if (!db) return false;
  const owned = await db.select({ id: organizations.id }).from(organizations).where(and(
    eq(organizations.id, organizationId),
    eq(organizations.ownerUserId, userId),
    isNull(organizations.deletedAt),
  )).limit(1);
  if (owned.length) return true;
  const membership = await db.select({ id: organizationMembers.id }).from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, userId),
      isNull(organizations.deletedAt),
    )).limit(1);
  return membership.length > 0;
}

export type DailyDueCandidate = {
  resourceType: "request" | "transaction" | "appointment" | "task";
  resourceId: string;
  recipientUserId: number;
  title: string;
  dueAt: Date;
};

export async function listDailyDueCandidates(before: Date): Promise<DailyDueCandidate[]> {
  const db = await getDb();
  if (!db) return [];
  const [requestRows, transactionRows, appointmentRows, taskRows] = await Promise.all([
    db.select({ id: serviceRequests.id, recipientUserId: serviceRequests.customerUserId, title: serviceRequests.title, dueAt: serviceRequests.desiredDueAt }).from(serviceRequests).where(and(isNotNull(serviceRequests.desiredDueAt), isNull(serviceRequests.deletedAt), notInArray(serviceRequests.status, ["cancelled"]) as never, lt(serviceRequests.desiredDueAt, before))),
    db.select({ id: transactions.id, recipientUserId: transactions.customerUserId, referenceNumber: transactions.referenceNumber, dueAt: transactions.dueAt }).from(transactions).where(and(isNotNull(transactions.dueAt), isNull(transactions.deletedAt), notInArray(transactions.status, ["completed", "rejected", "cancelled", "archived"]) as never, lt(transactions.dueAt, before))),
    db.select({ id: appointments.id, recipientUserId: appointments.customerUserId, title: appointments.title, dueAt: appointments.startsAt }).from(appointments).where(and(eq(appointments.status, "scheduled"), lt(appointments.startsAt, before))),
    db.select({ id: tasks.id, ownerUserId: tasks.ownerUserId, assigneeUserId: tasks.assigneeUserId, title: tasks.title, dueAt: sql<Date | null>`coalesce(${tasks.slaDueAt}, ${tasks.dueAt})` }).from(tasks).where(and(or(isNotNull(tasks.slaDueAt), isNotNull(tasks.dueAt)), notInArray(tasks.status, ["completed", "cancelled"]), lt(sql`coalesce(${tasks.slaDueAt}, ${tasks.dueAt})`, before))),
  ]);
  return [
    ...requestRows.filter((row): row is typeof row & { dueAt: Date } => row.dueAt instanceof Date).map((row) => ({ resourceType: "request" as const, resourceId: String(row.id), recipientUserId: row.recipientUserId, title: row.title, dueAt: row.dueAt })),
    ...transactionRows.filter((row): row is typeof row & { dueAt: Date } => row.dueAt instanceof Date).map((row) => ({ resourceType: "transaction" as const, resourceId: String(row.id), recipientUserId: row.recipientUserId, title: row.referenceNumber || `معاملة #${row.id}`, dueAt: row.dueAt })),
    ...appointmentRows.filter((row): row is typeof row & { dueAt: Date } => row.dueAt instanceof Date).map((row) => ({ resourceType: "appointment" as const, resourceId: String(row.id), recipientUserId: row.recipientUserId, title: row.title, dueAt: row.dueAt })),
    ...taskRows.filter((row): row is typeof row & { dueAt: Date } => row.dueAt instanceof Date).flatMap((row) => [...new Set([row.ownerUserId, row.assigneeUserId].filter((recipient): recipient is number => typeof recipient === "number"))].map((recipientUserId) => ({ resourceType: "task" as const, resourceId: String(row.id), recipientUserId, title: row.title, dueAt: row.dueAt }))),
  ];
}

export type InactiveDraftCandidate = { conversationId: string; recipientUserId: number; lastActivityAt: Date };

export async function listInactiveDraftCandidates(before: Date): Promise<InactiveDraftCandidate[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ conversationId: aiConversations.id, recipientUserId: aiConversations.ownerUserId, lastActivityAt: aiConversations.lastActivityAt }).from(aiConversations).where(and(eq(aiConversations.status, "active"), notInArray(aiConversations.currentState, ["submitted", "cancelled", "expired", "needs_human_review"]), lt(aiConversations.lastActivityAt, before))).limit(300);
  return rows.filter((row): row is typeof row & { lastActivityAt: Date } => row.lastActivityAt instanceof Date);
}

type DailyNotificationKey = { recipientUserId: number; resourceType: string; resourceId: string; notifiedForDate: string };

export async function reserveDailyDueNotification(input: DailyNotificationKey) {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(dueNotificationRuns).values(input);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Duplicate") || message.includes("ER_DUP_ENTRY")) return false;
    throw error;
  }
}

export async function releaseDailyDueNotification(input: DailyNotificationKey) {
  const db = await getDb();
  if (!db) return;
  await db.delete(dueNotificationRuns).where(and(eq(dueNotificationRuns.recipientUserId, input.recipientUserId), eq(dueNotificationRuns.resourceType, input.resourceType), eq(dueNotificationRuns.resourceId, input.resourceId), eq(dueNotificationRuns.notifiedForDate, input.notifiedForDate), isNull(dueNotificationRuns.notificationId)));
}

export async function finalizeDailyDueNotification(input: DailyNotificationKey & { notificationId: number }) {
  const db = await getDb();
  if (!db) return;
  await db.update(dueNotificationRuns).set({ notificationId: input.notificationId }).where(and(eq(dueNotificationRuns.recipientUserId, input.recipientUserId), eq(dueNotificationRuns.resourceType, input.resourceType), eq(dueNotificationRuns.resourceId, input.resourceId), eq(dueNotificationRuns.notifiedForDate, input.notifiedForDate)));
}

export async function getDailyDueScanSchedule() {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(automationSchedules).where(eq(automationSchedules.key, "daily_due_scan")).limit(1);
  return rows[0];
}

export async function saveDailyDueScanSchedule(input: { heartbeatTaskUid: string; enabled: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(automationSchedules).values({ key: "daily_due_scan", ...input }).onDuplicateKeyUpdate({ set: { heartbeatTaskUid: input.heartbeatTaskUid, enabled: input.enabled } });
  return getDailyDueScanSchedule();
}

export async function updateDailyDueScanRun(input: { success: boolean; summary: unknown }) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  await db.update(automationSchedules).set({ lastRunAt: now, ...(input.success ? { lastSuccessAt: now } : {}), lastSummary: input.summary }).where(eq(automationSchedules.key, "daily_due_scan"));
}

export async function listServiceRequests(userId: number, role: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(serviceRequests).orderBy(desc(serviceRequests.updatedAt));
  return canOperateTransactions(role) ? query : query.where(eq(serviceRequests.customerUserId, userId));
}

export async function createTransaction(input: InsertTransactionRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transactions).values(input);
  return result[0].insertId;
}

export async function listTransactions(userId: number, role: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(transactions).orderBy(desc(transactions.updatedAt));
  return canOperateTransactions(role) ? query : query.where(eq(transactions.customerUserId, userId));
}

export async function getTransactionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return rows[0];
}

export async function updateTransactionStatus(id: number, status: InsertTransactionRecord["status"], nextAction?: string, assigneeUserId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(transactions).set({ status, nextAction, assigneeUserId }).where(eq(transactions.id, id));
}

export function assertCanManage(role: string) {
  if (!canManageOperations(role)) throw new Error("FORBIDDEN_OPERATION");
}

function securityHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function networkFingerprint(req: { ip?: string; headers?: Record<string, unknown> }) {
  const forwarded = typeof req.headers?.["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0].trim() : "";
  const ip = forwarded || req.ip || "unknown";
  const normalized = ip.includes(".") ? ip.split(".").slice(0, 3).join(".") : ip;
  return securityHash(normalized);
}

export async function recordLoginSecurityEvent(input: { userId: number; deviceId?: string | null; platform?: string | null; req: { ip?: string; headers?: Record<string, unknown> } }) {
  const db = await getDb();
  if (!db) return { isNewDevice: false, isUnusualNetwork: false };
  const deviceFingerprint = securityHash(normalizeDeviceId(input.deviceId, input.platform, String(input.req.headers?.["user-agent"] || "unknown")));
  const network = networkFingerprint(input.req);
  const knownDevices = await db.select({ id: loginSecurityDevices.id, networkFingerprint: loginSecurityDevices.networkFingerprint }).from(loginSecurityDevices).where(eq(loginSecurityDevices.userId, input.userId)).limit(50);
  const classification = classifyLoginSecurity(knownDevices, deviceFingerprint, network);
  const existing = classification.existing;
  const { isNewDevice, isUnusualNetwork } = classification;
  if (existing) {
    await db.update(loginSecurityDevices).set({ networkFingerprint: network, platform: input.platform ?? undefined, userAgent: String(input.req.headers?.["user-agent"] || "").slice(0, 512), lastSeenAt: new Date() }).where(eq(loginSecurityDevices.id, existing.id));
  } else {
    await db.insert(loginSecurityDevices).values({ id: deviceFingerprint, userId: input.userId, deviceFingerprint, networkFingerprint: network, platform: input.platform ?? undefined, userAgent: String(input.req.headers?.["user-agent"] || "").slice(0, 512) });
  }
  if (isNewDevice || isUnusualNetwork) {
    const alert = formatLoginSecurityAlert({ isNewDevice, isUnusualNetwork, platform: input.platform ?? "unknown" });
    await createInAppNotification({ recipientUserId: input.userId, title: alert.title, body: alert.body, type: alert.type, data: alert.data });
    await createAuditLog({ actorUserId: input.userId, action: "auth.login_security_alert", resourceType: "login", metadata: { isNewDevice, isUnusualNetwork, platform: input.platform ?? "unknown" } });
  }
  return { isNewDevice, isUnusualNetwork };
}

export async function createAuditLog(input: { actorUserId?: number | null; action: string; resourceType: string; resourceId?: string | number | null; metadata?: unknown }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({ actorUserId: input.actorUserId ?? null, action: input.action, resourceType: input.resourceType, resourceId: input.resourceId === undefined || input.resourceId === null ? null : String(input.resourceId), metadata: input.metadata });
}

export async function createSupportTicket(input: { customerUserId: number; transactionId?: number; subject: string; priority: "low" | "normal" | "high" | "urgent"; initialMessage: string; channel?: "support" | "abu_mishal_chat" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(supportTickets).values({ customerUserId: input.customerUserId, transactionId: input.transactionId, subject: input.subject, priority: input.priority, channel: input.channel ?? "support" });
  const ticketId = result[0].insertId;
  await db.insert(ticketMessages).values({ ticketId, authorUserId: input.customerUserId, body: input.initialMessage, isInternal: false });
  return { id: ticketId };
}

export async function listSupportTickets(userId: number, role: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({ id: supportTickets.id, subject: supportTickets.subject, status: supportTickets.status, priority: supportTickets.priority, transactionId: supportTickets.transactionId, customerUserId: supportTickets.customerUserId, assignedUserId: supportTickets.assignedUserId, updatedAt: supportTickets.updatedAt, createdAt: supportTickets.createdAt, customerName: users.name }).from(supportTickets).leftJoin(users, eq(supportTickets.customerUserId, users.id));
  return canOperateTransactions(role) ? query.where(eq(supportTickets.channel, "support")).orderBy(desc(supportTickets.updatedAt)).limit(100) : query.where(and(eq(supportTickets.customerUserId, userId), eq(supportTickets.channel, "support"))).orderBy(desc(supportTickets.updatedAt)).limit(100);
}

export async function getSupportTicketById(ticketId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  return rows[0];
}

export async function listTicketMessages(ticketId: number, includeInternal: boolean) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({ id: ticketMessages.id, ticketId: ticketMessages.ticketId, authorUserId: ticketMessages.authorUserId, authorName: users.name, body: ticketMessages.body, isInternal: ticketMessages.isInternal, readAt: ticketMessages.readAt, createdAt: ticketMessages.createdAt }).from(ticketMessages).leftJoin(users, eq(ticketMessages.authorUserId, users.id));
  return includeInternal ? query.where(eq(ticketMessages.ticketId, ticketId)).orderBy(asc(ticketMessages.createdAt)) : query.where(and(eq(ticketMessages.ticketId, ticketId), eq(ticketMessages.isInternal, false))).orderBy(asc(ticketMessages.createdAt));
}

export async function addTicketMessage(input: { ticketId: number; authorUserId: number; body: string; isInternal: boolean; nextStatus: "in_progress" | "awaiting_customer" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { nextStatus, ...message } = input;
  const result = await db.insert(ticketMessages).values(message);
  await db.update(supportTickets).set({ updatedAt: new Date(), status: nextStatus }).where(eq(supportTickets.id, input.ticketId));
  return { id: result[0].insertId };
}

export async function getCustomerAbuMishalChat(customerUserId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(supportTickets).where(and(eq(supportTickets.customerUserId, customerUserId), eq(supportTickets.channel, "abu_mishal_chat"))).orderBy(desc(supportTickets.updatedAt)).limit(1);
  return rows[0];
}

export async function createCustomerAbuMishalChat(customerUserId: number) {
  const existing = await getCustomerAbuMishalChat(customerUserId);
  if (existing) return existing;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(supportTickets).values({ customerUserId, channel: "abu_mishal_chat", subject: "محادثة مع أبو مشعل", priority: "normal", status: "open" });
  return getSupportTicketById(Number(result[0].insertId));
}

export async function listAbuMishalChatThreads() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: supportTickets.id,
    customerUserId: supportTickets.customerUserId,
    customerName: users.name,
    subject: supportTickets.subject,
    status: supportTickets.status,
    assignedUserId: supportTickets.assignedUserId,
    updatedAt: supportTickets.updatedAt,
    unreadCount: sql<number>`sum(case when ${ticketMessages.authorUserId} = ${supportTickets.customerUserId} and ${ticketMessages.readAt} is null then 1 else 0 end)`,
    lastMessageAt: sql<Date | null>`max(${ticketMessages.createdAt})`,
  }).from(supportTickets).leftJoin(users, eq(supportTickets.customerUserId, users.id)).leftJoin(ticketMessages, eq(ticketMessages.ticketId, supportTickets.id)).where(eq(supportTickets.channel, "abu_mishal_chat")).groupBy(supportTickets.id, supportTickets.customerUserId, users.name, supportTickets.subject, supportTickets.status, supportTickets.assignedUserId, supportTickets.updatedAt).orderBy(desc(supportTickets.updatedAt)).limit(100);
}

export async function markAbuMishalChatRead(input: { ticketId: number; viewerUserId: number; customerUserId: number; adminViewer: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const authorCondition = input.adminViewer ? eq(ticketMessages.authorUserId, input.customerUserId) : ne(ticketMessages.authorUserId, input.viewerUserId);
  await db.update(ticketMessages).set({ readAt: new Date() }).where(and(eq(ticketMessages.ticketId, input.ticketId), eq(ticketMessages.isInternal, false), authorCondition, isNull(ticketMessages.readAt)));
  return { success: true } as const;
}

export async function listAdminNotificationRecipients() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id }).from(users).where(inArray(users.role, ["admin", "super_admin"])).limit(50);
}

export async function updateSupportTicket(ticketId: number, input: { status?: "open" | "in_progress" | "awaiting_customer" | "resolved" | "closed"; priority?: "low" | "normal" | "high" | "urgent"; assignedUserId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const closedAt = input.status === "resolved" || input.status === "closed" ? new Date() : undefined;
  await db.update(supportTickets).set({ ...input, ...(closedAt ? { closedAt } : {}) }).where(eq(supportTickets.id, ticketId));
  return { success: true } as const;
}

export async function listLoginActivity(userId: number) {
  const db = await getDb();
  if (!db) return { devices: [], alerts: [] };
  const [devices, alerts] = await Promise.all([
    db.select({ id: loginSecurityDevices.id, platform: loginSecurityDevices.platform, userAgent: loginSecurityDevices.userAgent, lastSeenAt: loginSecurityDevices.lastSeenAt, createdAt: loginSecurityDevices.createdAt }).from(loginSecurityDevices).where(eq(loginSecurityDevices.userId, userId)).orderBy(desc(loginSecurityDevices.lastSeenAt)).limit(30),
    db.select({ id: auditLogs.id, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt }).from(auditLogs).where(and(eq(auditLogs.actorUserId, userId), eq(auditLogs.action, "auth.login_security_alert"))).orderBy(desc(auditLogs.createdAt)).limit(50),
  ]);
  return { devices, alerts };
}

export async function listNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.recipientUserId, userId)).orderBy(desc(notifications.createdAt)).limit(80);
}

function notificationTaskId(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const value = (data as Record<string, unknown>).taskId;
  const taskId = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(taskId) && taskId > 0 ? taskId : undefined;
}

export async function listNotificationCenter(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const items = await db.select().from(notifications).where(eq(notifications.recipientUserId, userId)).orderBy(desc(notifications.createdAt)).limit(80);
  if (!items.length) return [];
  const notificationIds = items.map((item) => item.id);
  const deliveryRows = await db.select({ notificationId: notificationDeliveryLogs.notificationId, channel: notificationDeliveryLogs.channel, status: notificationDeliveryLogs.status, createdAt: notificationDeliveryLogs.createdAt, deliveredAt: notificationDeliveryLogs.deliveredAt }).from(notificationDeliveryLogs).where(inArray(notificationDeliveryLogs.notificationId, notificationIds)).orderBy(desc(notificationDeliveryLogs.createdAt)).limit(240);
  const taskIds = [...new Set(items.map((item) => notificationTaskId(item.data)).filter((id): id is number => id !== undefined))];
  const taskRows = taskIds.length
    ? await db.select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority, slaDueAt: tasks.slaDueAt, dueAt: tasks.dueAt }).from(tasks).where(and(inArray(tasks.id, taskIds), or(eq(tasks.ownerUserId, userId), eq(tasks.assigneeUserId, userId))))
    : [];
  const tasksById = new Map(taskRows.map((task) => [task.id, task]));
  const deliveryByNotification = new Map<number, typeof deliveryRows>();
  for (const delivery of deliveryRows) {
    const current = deliveryByNotification.get(delivery.notificationId) ?? [];
    current.push(delivery);
    deliveryByNotification.set(delivery.notificationId, current);
  }
  return items.map((item) => ({
    ...item,
    task: notificationTaskId(item.data) ? tasksById.get(notificationTaskId(item.data)!) ?? null : null,
    deliveries: deliveryByNotification.get(item.id) ?? [],
  }));
}

export async function markNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.recipientUserId, userId)));
  return { success: true } as const;
}

export async function createInAppNotification(input: { recipientUserId: number; title: string; body: string; type: string; data?: unknown }) {
  const db = await getDb();
  if (!db) return;
  const preferences = await getNotificationPreferences(input.recipientUserId);
  const result = await db.insert(notifications).values(input);
  const notificationId = Number(result[0].insertId);
  const critical = input.type === "support_ticket" || input.type === "human_handoff";
  const status = !preferences.inAppEnabled ? "suppressed" : preferences.digestFrequency === "daily" && !critical ? "queued" : "delivered";
  await db.insert(notificationDeliveryLogs).values({ id: crypto.randomUUID(), notificationId, status, idempotencyKey: `in-app:${notificationId}`, details: { digestFrequency: preferences.digestFrequency, quietHoursEnabled: preferences.quietHoursEnabled }, deliveredAt: status === "delivered" ? new Date() : undefined });
  return notificationId;
}

export async function getNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  await db.insert(notificationPreferences).values({ userId });
  const created = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  if (!created[0]) throw new Error("Preference creation failed");
  return created[0];
}

export async function updateNotificationPreferences(input: { userId: number; inAppEnabled: boolean; pushEnabled?: boolean; taskAlertsEnabled?: boolean; calendarSyncEnabled?: boolean; taskReminderMinutes?: number; digestFrequency: "immediate" | "daily"; quietHoursEnabled: boolean; quietStartHour?: number | null; quietEndHour?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await getNotificationPreferences(input.userId);
  const taskReminderMinutes = input.taskReminderMinutes ?? current.taskReminderMinutes;
  const pushEnabled = input.pushEnabled ?? current.pushEnabled;
  const taskAlertsEnabled = input.taskAlertsEnabled ?? current.taskAlertsEnabled;
  const calendarSyncEnabled = input.calendarSyncEnabled ?? current.calendarSyncEnabled;
  const quietStartHour = input.quietHoursEnabled ? input.quietStartHour ?? 22 : null;
  const quietEndHour = input.quietHoursEnabled ? input.quietEndHour ?? 7 : null;
  await db.insert(notificationPreferences).values({ userId: input.userId, inAppEnabled: input.inAppEnabled, pushEnabled, taskAlertsEnabled, calendarSyncEnabled, taskReminderMinutes, digestFrequency: input.digestFrequency, quietHoursEnabled: input.quietHoursEnabled, quietStartHour, quietEndHour }).onDuplicateKeyUpdate({ set: { inAppEnabled: input.inAppEnabled, pushEnabled, taskAlertsEnabled, calendarSyncEnabled, taskReminderMinutes, digestFrequency: input.digestFrequency, quietHoursEnabled: input.quietHoursEnabled, quietStartHour, quietEndHour } });
  return getNotificationPreferences(input.userId);
}

export async function registerMobilePushDevice(input: { userId: number; deviceId: string; platform: "ios" | "android"; expoPushToken: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // A token can only belong to one active account. Remove a previous account link
  // so a signed-out account cannot keep receiving alerts on the shared device.
  await db.delete(mobilePushDevices).where(and(eq(mobilePushDevices.expoPushToken, input.expoPushToken), ne(mobilePushDevices.userId, input.userId)));
  const existing = await db.select({ id: mobilePushDevices.id }).from(mobilePushDevices).where(and(eq(mobilePushDevices.userId, input.userId), eq(mobilePushDevices.deviceId, input.deviceId))).limit(1);
  if (existing[0]) {
    await db.update(mobilePushDevices).set({ platform: input.platform, expoPushToken: input.expoPushToken, enabled: true, lastSeenAt: new Date() }).where(eq(mobilePushDevices.id, existing[0].id));
    return { id: existing[0].id, reused: true } as const;
  }
  const id = crypto.randomUUID();
  await db.insert(mobilePushDevices).values({ id, ...input, enabled: true, lastSeenAt: new Date() });
  return { id, reused: false } as const;
}

export async function deactivateMobilePushDevice(input: { userId: number; deviceId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mobilePushDevices).set({ enabled: false, lastSeenAt: new Date() }).where(and(eq(mobilePushDevices.userId, input.userId), eq(mobilePushDevices.deviceId, input.deviceId)));
  return { success: true } as const;
}

export async function listMobilePushDevicesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Deliberately never select expoPushToken for a client response.
  return db.select({ id: mobilePushDevices.id, deviceId: mobilePushDevices.deviceId, platform: mobilePushDevices.platform, enabled: mobilePushDevices.enabled, lastSeenAt: mobilePushDevices.lastSeenAt, createdAt: mobilePushDevices.createdAt }).from(mobilePushDevices).where(eq(mobilePushDevices.userId, userId)).orderBy(desc(mobilePushDevices.lastSeenAt)).limit(20);
}

export async function listActivePushTokensForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: mobilePushDevices.id, expoPushToken: mobilePushDevices.expoPushToken, platform: mobilePushDevices.platform }).from(mobilePushDevices).where(and(eq(mobilePushDevices.userId, userId), eq(mobilePushDevices.enabled, true))).limit(10);
}

export async function disableMobilePushDeviceById(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(mobilePushDevices).set({ enabled: false }).where(eq(mobilePushDevices.id, id));
}

export async function createPushDeliveryLog(input: { notificationId: number; status: "queued" | "delivered" | "suppressed" | "failed"; idempotencyKey: string; details?: unknown; deliveredAt?: Date }) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(notificationDeliveryLogs).values({ id: crypto.randomUUID(), ...input, channel: "push" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Duplicate") || message.includes("ER_DUP_ENTRY")) return;
    throw error;
  }
}

export async function listNotificationDeliveryLogs(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: notificationDeliveryLogs.id, channel: notificationDeliveryLogs.channel, status: notificationDeliveryLogs.status, createdAt: notificationDeliveryLogs.createdAt, deliveredAt: notificationDeliveryLogs.deliveredAt, title: notifications.title, type: notifications.type }).from(notificationDeliveryLogs).innerJoin(notifications, eq(notificationDeliveryLogs.notificationId, notifications.id)).where(eq(notifications.recipientUserId, userId)).orderBy(desc(notificationDeliveryLogs.createdAt)).limit(60);
}

export async function listPublishedKnowledge(language: "ar" | "en") {
  const db = await getDb();
  if (!db) return { articles: [], faqs: [] };
  const [articles, faqs] = await Promise.all([
    db.select().from(knowledgeArticles).where(and(eq(knowledgeArticles.status, "published"), eq(knowledgeArticles.language, language))).orderBy(desc(knowledgeArticles.updatedAt)).limit(50),
    db.select().from(faqItems).where(and(eq(faqItems.isPublished, true), eq(faqItems.language, language))).orderBy(asc(faqItems.sortOrder)).limit(50),
  ]);
  return { articles, faqs };
}

export async function getKnowledgeContext(language: "ar" | "en" = "ar") {
  const { articles, faqs } = await listPublishedKnowledge(language);
  const sources = [
    ...articles.map((article) => ({ title: article.title, sourceLabel: article.sourceLabel ?? "مركز معرفة أبو مشعل", sourceUrl: article.sourceUrl ?? null, updatedAt: article.updatedAt })),
    ...faqs.map((faq) => ({ title: faq.question, sourceLabel: "الأسئلة الشائعة في أبو مشعل", sourceUrl: null, updatedAt: faq.updatedAt })),
  ];
  const referenceText = [
    ...articles.map((article) => `مقال: ${article.title}\nالخلاصة: ${article.excerpt ?? ""}\nالمحتوى: ${article.content.slice(0, 1600)}\nالمصدر: ${article.sourceLabel ?? "مركز معرفة أبو مشعل"}`),
    ...faqs.map((faq) => `سؤال شائع: ${faq.question}\nالإجابة: ${faq.answer.slice(0, 1000)}`),
  ].join("\n\n---\n\n");
  return { referenceText: referenceText.slice(0, 12000), sources };
}

export async function createKnowledgeArticle(input: { title: string; excerpt?: string; content: string; category?: string; language: "ar" | "en"; sourceLabel?: string; sourceUrl?: string; createdByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(knowledgeArticles).values({ ...input, status: "published", publishedAt: new Date() });
  return { id: result[0].insertId };
}

export async function createFaqItem(input: { question: string; answer: string; category?: string; language: "ar" | "en"; sortOrder?: number; createdByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(faqItems).values({ ...input, isPublished: true });
  return { id: result[0].insertId };
}

export async function listAuditLogs(limit: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: auditLogs.id, action: auditLogs.action, resourceType: auditLogs.resourceType, resourceId: auditLogs.resourceId, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt, actorUserId: auditLogs.actorUserId, actorName: users.name }).from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

export async function searchAccessibleRecords(userId: number, role: string, term: string) {
  const db = await getDb();
  if (!db) return { requests: [], transactions: [] };
  const pattern = `%${term}%`;
  const requestPredicate = or(like(serviceRequests.requestNumber, pattern), like(serviceRequests.title, pattern), like(serviceRequests.customerPhone, pattern));
  const transactionPredicate = or(like(transactions.referenceNumber, pattern), like(transactions.nextAction, pattern));
  const requestsResult = canOperateTransactions(role) ? await db.select({ id: serviceRequests.id, number: serviceRequests.requestNumber, title: serviceRequests.title, status: serviceRequests.status }).from(serviceRequests).where(requestPredicate).limit(10) : await db.select({ id: serviceRequests.id, number: serviceRequests.requestNumber, title: serviceRequests.title, status: serviceRequests.status }).from(serviceRequests).where(and(eq(serviceRequests.customerUserId, userId), requestPredicate)).limit(10);
  const transactionsResult = canOperateTransactions(role) ? await db.select({ id: transactions.id, number: transactions.referenceNumber, status: transactions.status, nextAction: transactions.nextAction }).from(transactions).where(transactionPredicate).limit(10) : await db.select({ id: transactions.id, number: transactions.referenceNumber, status: transactions.status, nextAction: transactions.nextAction }).from(transactions).where(and(eq(transactions.customerUserId, userId), transactionPredicate)).limit(10);
  return { requests: requestsResult, transactions: transactionsResult };
}

export async function getCloudRecord(ownerUserId: number, recordType: "transactions" | "workspace" | "inquiries" | "today-actions") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(cloudRecords).where(and(eq(cloudRecords.ownerUserId, ownerUserId), eq(cloudRecords.recordType, recordType))).limit(1);
  return rows[0];
}

export async function upsertCloudRecord(ownerUserId: number, recordType: "transactions" | "workspace" | "inquiries" | "today-actions", payload: unknown) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(cloudRecords).values({ ownerUserId, recordType, payload }).onDuplicateKeyUpdate({ set: { payload, updatedAt: new Date() } });
  return { success: true } as const;
}

export async function createUploadedDocument(input: { ownerUserId: number; fileName: string; storageKey: string; mimeType: string; fileSizeBytes: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values({ ...input, verificationStatus: "pending" });
  return result[0].insertId;
}

export type PlaybookStepInput = { stepKey: string; title: string; instructions?: string; actionType: "instruction" | "document" | "approval" | "task"; assignmentRule?: "transaction_assignee" | "least_loaded_staff" | "request_owner" | "unassigned"; isRequired: boolean; expectedDurationMinutes?: number; slaMinutes?: number };

export async function listPlaybooksForAdmin() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ playbook: servicePlaybooks, serviceName: governmentServices.name, versionId: playbookVersions.id, versionNumber: playbookVersions.versionNumber, versionStatus: playbookVersions.status, title: playbookVersions.title, publishedAt: playbookVersions.publishedAt }).from(servicePlaybooks).innerJoin(governmentServices, eq(servicePlaybooks.serviceId, governmentServices.id)).leftJoin(playbookVersions, eq(playbookVersions.playbookId, servicePlaybooks.id)).orderBy(desc(servicePlaybooks.updatedAt), desc(playbookVersions.versionNumber));
  const grouped = new Map<string, { id: string; serviceId: number; serviceName: string; name: string; status: "active" | "archived"; versions: Array<{ id: string; versionNumber: number; status: "draft" | "published" | "archived"; title: string; publishedAt: Date | null }> }>();
  for (const row of rows) {
    if (!grouped.has(row.playbook.id)) grouped.set(row.playbook.id, { id: row.playbook.id, serviceId: row.playbook.serviceId, serviceName: row.serviceName, name: row.playbook.name, status: row.playbook.status, versions: [] });
    if (row.versionId) grouped.get(row.playbook.id)!.versions.push({ id: row.versionId, versionNumber: row.versionNumber!, status: row.versionStatus!, title: row.title!, publishedAt: row.publishedAt });
  }
  return [...grouped.values()];
}

export async function listActiveServicesForPlaybooks() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: governmentServices.id, name: governmentServices.name }).from(governmentServices).where(eq(governmentServices.isActive, true)).orderBy(asc(governmentServices.name));
}

export async function getPublishedPlaybookForService(serviceId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ playbookId: servicePlaybooks.id, playbookName: servicePlaybooks.name, serviceName: governmentServices.name, versionId: playbookVersions.id, versionNumber: playbookVersions.versionNumber, title: playbookVersions.title, description: playbookVersions.description, requirements: playbookVersions.requirements, exceptions: playbookVersions.exceptions }).from(servicePlaybooks).innerJoin(governmentServices, eq(servicePlaybooks.serviceId, governmentServices.id)).innerJoin(playbookVersions, eq(playbookVersions.playbookId, servicePlaybooks.id)).where(and(eq(servicePlaybooks.serviceId, serviceId), eq(servicePlaybooks.status, "active"), eq(playbookVersions.status, "published"))).orderBy(desc(playbookVersions.publishedAt)).limit(1);
  const active = rows[0];
  if (!active) return undefined;
  const steps = await db.select({ stepKey: playbookSteps.stepKey, title: playbookSteps.title, instructions: playbookSteps.instructions, actionType: playbookSteps.actionType, assignmentRule: playbookSteps.assignmentRule, slaMinutes: playbookSteps.slaMinutes, isRequired: playbookSteps.isRequired, expectedDurationMinutes: playbookSteps.expectedDurationMinutes, stepOrder: playbookSteps.stepOrder }).from(playbookSteps).where(eq(playbookSteps.versionId, active.versionId)).orderBy(asc(playbookSteps.stepOrder));
  return { ...active, steps };
}

export async function getPlaybookVersionDetails(playbookId: string, versionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const versions = await db.select({ version: playbookVersions, playbook: servicePlaybooks, serviceName: governmentServices.name }).from(playbookVersions).innerJoin(servicePlaybooks, eq(playbookVersions.playbookId, servicePlaybooks.id)).innerJoin(governmentServices, eq(servicePlaybooks.serviceId, governmentServices.id)).where(and(eq(playbookVersions.id, versionId), eq(playbookVersions.playbookId, playbookId))).limit(1);
  const result = versions[0];
  if (!result) return undefined;
  const steps = await db.select().from(playbookSteps).where(eq(playbookSteps.versionId, versionId)).orderBy(asc(playbookSteps.stepOrder));
  return { ...result, steps };
}

export async function createServicePlaybook(input: { serviceId: number; name: string; createdByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const service = await db.select({ id: governmentServices.id }).from(governmentServices).where(and(eq(governmentServices.id, input.serviceId), eq(governmentServices.isActive, true))).limit(1);
  if (!service[0]) throw new Error("SERVICE_NOT_FOUND");
  const existing = await db.select({ id: servicePlaybooks.id }).from(servicePlaybooks).where(and(eq(servicePlaybooks.serviceId, input.serviceId), eq(servicePlaybooks.status, "active"))).limit(1);
  if (existing[0]) throw new Error("ACTIVE_PLAYBOOK_ALREADY_EXISTS");
  const id = crypto.randomUUID();
  await db.insert(servicePlaybooks).values({ id, ...input });
  return { id };
}

export async function createPlaybookVersion(input: { playbookId: string; title: string; description?: string; requirements?: unknown; exceptions?: unknown; steps: PlaybookStepInput[]; createdByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const playbook = await db.select({ id: servicePlaybooks.id }).from(servicePlaybooks).where(and(eq(servicePlaybooks.id, input.playbookId), eq(servicePlaybooks.status, "active"))).limit(1);
  if (!playbook[0]) throw new Error("PLAYBOOK_NOT_FOUND");
  const previous = await db.select({ versionNumber: playbookVersions.versionNumber }).from(playbookVersions).where(eq(playbookVersions.playbookId, input.playbookId)).orderBy(desc(playbookVersions.versionNumber)).limit(1);
  const versionNumber = (previous[0]?.versionNumber ?? 0) + 1;
  const versionId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(playbookVersions).values({ id: versionId, playbookId: input.playbookId, versionNumber, title: input.title, description: input.description, requirements: input.requirements, exceptions: input.exceptions, createdByUserId: input.createdByUserId });
    if (input.steps.length) await tx.insert(playbookSteps).values(input.steps.map((step, index) => ({ id: crypto.randomUUID(), versionId, stepKey: step.stepKey, title: step.title, instructions: step.instructions, actionType: step.actionType, assignmentRule: step.assignmentRule ?? "transaction_assignee", isRequired: step.isRequired, expectedDurationMinutes: step.expectedDurationMinutes, slaMinutes: step.slaMinutes, stepOrder: index + 1 })));
  });
  return { id: versionId, versionNumber };
}

export async function publishPlaybookVersion(input: { playbookId: string; versionId: string; publishedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const version = await db.select({ id: playbookVersions.id, status: playbookVersions.status }).from(playbookVersions).where(and(eq(playbookVersions.id, input.versionId), eq(playbookVersions.playbookId, input.playbookId))).limit(1);
  if (!version[0]) throw new Error("PLAYBOOK_VERSION_NOT_FOUND");
  if (version[0].status === "archived") throw new Error("ARCHIVED_VERSION_CANNOT_BE_PUBLISHED");
  const steps = await db.select({ id: playbookSteps.id }).from(playbookSteps).where(eq(playbookSteps.versionId, input.versionId)).limit(1);
  if (!steps[0]) throw new Error("PLAYBOOK_STEPS_REQUIRED");
  await db.transaction(async (tx) => {
    await tx.update(playbookVersions).set({ status: "archived" }).where(and(eq(playbookVersions.playbookId, input.playbookId), eq(playbookVersions.status, "published"), ne(playbookVersions.id, input.versionId)));
    await tx.update(playbookVersions).set({ status: "published", publishedAt: new Date(), publishedByUserId: input.publishedByUserId }).where(and(eq(playbookVersions.id, input.versionId), eq(playbookVersions.playbookId, input.playbookId)));
  });
  return { success: true } as const;
}

export async function archiveServicePlaybook(playbookId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await tx.update(servicePlaybooks).set({ status: "archived" }).where(and(eq(servicePlaybooks.id, playbookId), eq(servicePlaybooks.status, "active")));
    await tx.update(playbookVersions).set({ status: "archived" }).where(and(eq(playbookVersions.playbookId, playbookId), ne(playbookVersions.status, "archived")));
  });
  return { success: true } as const;
}

export async function listOwnedDocuments(ownerUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: documents.id, fileName: documents.fileName, mimeType: documents.mimeType, fileSizeBytes: documents.fileSizeBytes, documentType: documents.documentType, verificationStatus: documents.verificationStatus, expiresAt: documents.expiresAt, requestId: documents.requestId, transactionId: documents.transactionId, createdAt: documents.createdAt }).from(documents).where(and(eq(documents.ownerUserId, ownerUserId), isNull(documents.deletedAt))).orderBy(desc(documents.createdAt));
}

export async function getOwnedDocumentForAccess(ownerUserId: number, documentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ id: documents.id, storageKey: documents.storageKey, requestId: documents.requestId, transactionId: documents.transactionId, fileName: documents.fileName }).from(documents).where(and(eq(documents.id, documentId), eq(documents.ownerUserId, ownerUserId), isNull(documents.deletedAt))).limit(1);
  return rows[0];
}

export async function softDeleteOwnedDocument(ownerUserId: number, documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const document = await getOwnedDocumentForAccess(ownerUserId, documentId);
  if (!document) throw new Error("DOCUMENT_NOT_FOUND");
  if (document.requestId || document.transactionId) throw new Error("DOCUMENT_LINKED_TO_RECORD");
  await db.update(documents).set({ deletedAt: new Date() }).where(and(eq(documents.id, documentId), eq(documents.ownerUserId, ownerUserId), isNull(documents.deletedAt)));
  return { success: true, fileName: document.fileName } as const;
}

export async function getSystemTransactionDashboard(status?: (typeof transactions.$inferSelect)["status"], search?: string) {
  const db = await getDb();
  if (!db) return { metrics: { total: 0, active: 0, overdue: 0, awaitingDocuments: 0, completed: 0, approvalsExpiringSoon: 0 }, transactions: [] };
  const now = new Date();
  const approvalWindowEndsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [grouped, expiringApprovals] = await Promise.all([
    db.select({ status: transactions.status, total: count(transactions.id) }).from(transactions).groupBy(transactions.status),
    db.select({ total: count(approvalRequests.id) }).from(approvalRequests).where(and(
      eq(approvalRequests.status, "pending"),
      isNotNull(approvalRequests.expiresAt),
      gt(approvalRequests.expiresAt, now),
      lt(approvalRequests.expiresAt, approvalWindowEndsAt),
    )),
  ]);
  const statusTotals = Object.fromEntries(grouped.map((item) => [item.status, Number(item.total)]));
  const total = Object.values(statusTotals).reduce((sum, value) => sum + value, 0);
  const completed = statusTotals.completed ?? 0;
  const inactive = completed + (statusTotals.rejected ?? 0) + (statusTotals.cancelled ?? 0) + (statusTotals.archived ?? 0);
  const criteria = [status ? eq(transactions.status, status) : undefined, search ? or(like(transactions.referenceNumber, `%${search}%`), like(users.name, `%${search}%`), like(serviceRequests.customerPhone, `%${search}%`), like(organizations.name, `%${search}%`)) : undefined].filter(Boolean);
  const rowQuery = db.select({ id: transactions.id, referenceNumber: transactions.referenceNumber, status: transactions.status, priority: transactions.priority, nextAction: transactions.nextAction, dueAt: transactions.dueAt, updatedAt: transactions.updatedAt, customerUserId: transactions.customerUserId, customerName: users.name, customerPhone: serviceRequests.customerPhone, organizationName: organizations.name, assigneeUserId: transactions.assigneeUserId }).from(transactions).leftJoin(users, eq(transactions.customerUserId, users.id)).leftJoin(serviceRequests, eq(transactions.requestId, serviceRequests.id)).leftJoin(organizations, eq(transactions.organizationId, organizations.id));
  const rows = criteria.length ? await rowQuery.where(and(...criteria)).orderBy(desc(transactions.updatedAt)).limit(100) : await rowQuery.orderBy(desc(transactions.updatedAt)).limit(100);
  return { metrics: { total, active: total - inactive, overdue: statusTotals.overdue ?? 0, awaitingDocuments: statusTotals.awaiting_customer_documents ?? 0, completed, approvalsExpiringSoon: Number(expiringApprovals[0]?.total ?? 0) }, transactions: rows };
}

export async function getTaskWorkloadOverview() {
  const db = await getDb();
  if (!db) return { totalActive: 0, overdue: 0, unassigned: 0, team: [] as Array<{ assigneeUserId: number | null; name: string; active: number; overdue: number }> };
  const grouped = await db.select({
    assigneeUserId: tasks.assigneeUserId,
    active: sql<number>`sum(case when ${tasks.status} not in ('completed', 'cancelled') then 1 else 0 end)`,
    overdue: sql<number>`sum(case when ${tasks.status} not in ('completed', 'cancelled') and coalesce(${tasks.slaDueAt}, ${tasks.dueAt}) is not null and coalesce(${tasks.slaDueAt}, ${tasks.dueAt}) < now() then 1 else 0 end)`,
  }).from(tasks).groupBy(tasks.assigneeUserId);
  const assigneeIds = grouped.map((row) => row.assigneeUserId).filter((id): id is number => typeof id === "number");
  const members = assigneeIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, assigneeIds)) : [];
  const names = new Map(members.map((member) => [member.id, member.name || `عضو #${member.id}`]));
  const team = grouped.map((row) => ({ assigneeUserId: row.assigneeUserId, name: row.assigneeUserId ? names.get(row.assigneeUserId) ?? `عضو #${row.assigneeUserId}` : "غير معيّنة", active: Number(row.active ?? 0), overdue: Number(row.overdue ?? 0) })).sort((a, b) => b.active - a.active || b.overdue - a.overdue);
  return { totalActive: team.reduce((sum, row) => sum + row.active, 0), overdue: team.reduce((sum, row) => sum + row.overdue, 0), unassigned: team.find((row) => row.assigneeUserId === null)?.active ?? 0, team };
}

export type DraftStructuredData = Record<string, unknown>;

export async function createRequestConversation(input: { ownerUserId: number; language: "ar" | "en"; idempotencyKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(requestDrafts).where(and(eq(requestDrafts.ownerUserId, input.ownerUserId), eq(requestDrafts.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing[0]) {
    const conversations = await db.select().from(aiConversations).where(and(eq(aiConversations.ownerUserId, input.ownerUserId), eq(aiConversations.draftId, existing[0].id))).orderBy(desc(aiConversations.updatedAt)).limit(1);
    if (conversations[0]) return { draft: existing[0], conversation: conversations[0], reused: true };
  }
  const draftId = crypto.randomUUID();
  const conversationId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(requestDrafts).values({ id: draftId, ownerUserId: input.ownerUserId, structuredData: {}, idempotencyKey: input.idempotencyKey });
    await tx.insert(aiConversations).values({ id: conversationId, ownerUserId: input.ownerUserId, draftId, language: input.language, currentState: "started", status: "active" });
  });
  const [draft, conversation] = await Promise.all([
    db.select().from(requestDrafts).where(eq(requestDrafts.id, draftId)).limit(1),
    db.select().from(aiConversations).where(eq(aiConversations.id, conversationId)).limit(1),
  ]);
  return { draft: draft[0], conversation: conversation[0], reused: false };
}

export async function getRequestConversation(ownerUserId: number, conversationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ conversation: aiConversations, draft: requestDrafts }).from(aiConversations).leftJoin(requestDrafts, eq(aiConversations.draftId, requestDrafts.id)).where(and(eq(aiConversations.id, conversationId), eq(aiConversations.ownerUserId, ownerUserId))).limit(1);
  return rows[0];
}

export async function listConversationMessages(ownerUserId: number, conversationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({ id: aiMessages.id, role: aiMessages.role, content: aiMessages.content, toolName: aiMessages.toolName, metadata: aiMessages.metadata, createdAt: aiMessages.createdAt }).from(aiMessages).innerJoin(aiConversations, eq(aiMessages.conversationId, aiConversations.id)).where(and(eq(aiMessages.conversationId, conversationId), eq(aiConversations.ownerUserId, ownerUserId))).orderBy(asc(aiMessages.createdAt));
}

export async function appendConversationMessage(input: { ownerUserId: number; conversationId: string; role: "user" | "assistant" | "tool"; content: string; toolName?: string; metadata?: unknown }) {
  assertSafeConversationContent(input.content);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conversation = await getRequestConversation(input.ownerUserId, input.conversationId);
  if (!conversation?.conversation) throw new Error("CONVERSATION_NOT_FOUND");
  if (conversation.conversation.status !== "active") throw new Error("CONVERSATION_NOT_ACTIVE");
  const id = crypto.randomUUID();
  await db.insert(aiMessages).values({ id, conversationId: input.conversationId, role: input.role, content: input.content, toolName: input.toolName, metadata: input.metadata });
  await db.update(aiConversations).set({ lastActivityAt: new Date() }).where(and(eq(aiConversations.id, input.conversationId), eq(aiConversations.ownerUserId, input.ownerUserId)));
  return { id };
}

export async function saveConversationProgress(input: { ownerUserId: number; conversationId: string; nextState: ConversationState; structuredData?: DraftStructuredData; validationStatus?: "pending" | "errors" | "warnings" | "passed"; completionPercentage?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await getRequestConversation(input.ownerUserId, input.conversationId);
  const draft = current?.draft;
  if (!current?.conversation || !draft) throw new Error("CONVERSATION_NOT_FOUND");
  assertConversationTransition(current.conversation.currentState as ConversationState, input.nextState);
  const completionPercentage = input.completionPercentage === undefined ? undefined : Math.max(0, Math.min(100, Math.round(input.completionPercentage)));
  await db.transaction(async (tx) => {
    if (input.structuredData || input.validationStatus || completionPercentage !== undefined) {
      await tx.update(requestDrafts).set({ ...(input.structuredData ? { structuredData: input.structuredData, summaryVersion: draft.summaryVersion + 1 } : {}), ...(input.validationStatus ? { validationStatus: input.validationStatus } : {}), ...(completionPercentage !== undefined ? { completionPercentage } : {}) }).where(and(eq(requestDrafts.id, draft.id), eq(requestDrafts.ownerUserId, input.ownerUserId)));
    }
    await tx.update(aiConversations).set({ currentState: input.nextState, status: conversationStatusForState(input.nextState), lastActivityAt: new Date() }).where(and(eq(aiConversations.id, input.conversationId), eq(aiConversations.ownerUserId, input.ownerUserId)));
  });
  return getRequestConversation(input.ownerUserId, input.conversationId);
}

export async function updateRequestDraftFields(input: { ownerUserId: number; conversationId: string; patch: RequestDraftPatch }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const session = await getRequestConversation(input.ownerUserId, input.conversationId);
  const draft = session?.draft;
  if (!session?.conversation || !draft || draft.deletedAt || ["submitted", "cancelled", "expired"].includes(draft.status)) throw new Error("DRAFT_NOT_EDITABLE");
  const structuredData = mergeRequestDraftData(draft.structuredData, input.patch);
  const completionPercentage = calculateDraftCompletion(structuredData);
  const { serviceId, entityId, organizationId } = input.patch;
  await db.update(requestDrafts).set({ structuredData, completionPercentage, validationStatus: "pending", summaryVersion: draft.summaryVersion + 1, ...(serviceId ? { serviceId } : {}), ...(entityId ? { entityId } : {}), ...(organizationId !== undefined ? { organizationId } : {}) }).where(and(eq(requestDrafts.id, draft.id), eq(requestDrafts.ownerUserId, input.ownerUserId)));
  await db.update(aiConversations).set({ lastActivityAt: new Date() }).where(and(eq(aiConversations.id, input.conversationId), eq(aiConversations.ownerUserId, input.ownerUserId)));
  return getRequestConversation(input.ownerUserId, input.conversationId);
}

export async function listActiveRequestDrafts(ownerUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: requestDrafts.id, status: requestDrafts.status, completionPercentage: requestDrafts.completionPercentage, structuredData: requestDrafts.structuredData, updatedAt: requestDrafts.updatedAt, conversationId: aiConversations.id }).from(requestDrafts).innerJoin(aiConversations, eq(aiConversations.draftId, requestDrafts.id)).where(and(eq(requestDrafts.ownerUserId, ownerUserId), eq(aiConversations.ownerUserId, ownerUserId), isNull(requestDrafts.deletedAt), notInArray(requestDrafts.status, ["submitted", "cancelled", "expired"]) as never)).orderBy(desc(requestDrafts.updatedAt)).limit(20);
}

export async function cancelRequestConversation(ownerUserId: number, conversationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const session = await getRequestConversation(ownerUserId, conversationId);
  if (!session?.conversation || !session.draft) throw new Error("CONVERSATION_NOT_FOUND");
  if (session.draft.submittedRequestId || session.conversation.status === "submitted") throw new Error("SUBMITTED_REQUEST_CANNOT_BE_CANCELLED_HERE");
  if (session.conversation.status === "cancelled") return { success: true, alreadyCancelled: true } as const;
  await db.transaction(async (tx) => {
    await tx.update(requestDrafts).set({ status: "cancelled" }).where(and(eq(requestDrafts.id, session.draft!.id), eq(requestDrafts.ownerUserId, ownerUserId)));
    await tx.update(aiConversations).set({ status: "cancelled", currentState: "cancelled", lastActivityAt: new Date() }).where(and(eq(aiConversations.id, conversationId), eq(aiConversations.ownerUserId, ownerUserId)));
  });
  return { success: true, alreadyCancelled: false } as const;
}

export async function deleteAssistantConversationContent(ownerUserId: number, conversationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const session = await getRequestConversation(ownerUserId, conversationId);
  if (!session?.conversation) throw new Error("CONVERSATION_NOT_FOUND");
  await db.transaction(async (tx) => {
    await tx.delete(aiMessages).where(eq(aiMessages.conversationId, conversationId));
    if (session.draft && !session.draft.submittedRequestId) await tx.update(requestDrafts).set({ status: "cancelled", deletedAt: new Date() }).where(and(eq(requestDrafts.id, session.draft.id), eq(requestDrafts.ownerUserId, ownerUserId)));
    if (session.conversation.status !== "submitted") await tx.update(aiConversations).set({ status: "cancelled", currentState: "cancelled", lastActivityAt: new Date() }).where(and(eq(aiConversations.id, conversationId), eq(aiConversations.ownerUserId, ownerUserId)));
  });
  return { success: true, submittedRequestPreserved: Boolean(session.draft?.submittedRequestId) } as const;
}

export async function validateRequestDraft(ownerUserId: number, conversationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const session = await getRequestConversation(ownerUserId, conversationId);
  const draft = session?.draft;
  if (!session?.conversation || !draft || draft.deletedAt) throw new Error("DRAFT_NOT_FOUND");
  const data = draft.structuredData && typeof draft.structuredData === "object" && !Array.isArray(draft.structuredData) ? draft.structuredData as Record<string, unknown> : {};
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const duplicates = title ? await db.select({ id: serviceRequests.id }).from(serviceRequests).where(and(eq(serviceRequests.customerUserId, ownerUserId), eq(serviceRequests.title, title), notInArray(serviceRequests.status, ["submitted", "cancelled"]))).limit(1) : [];
  const results = validateRequestData(data, Boolean(duplicates[0]));
  const validationStatus = validationStatusFromResults(results);
  await db.update(requestDrafts).set({ validationStatus, status: validationStatus === "errors" ? "draft" : "reviewing" }).where(and(eq(requestDrafts.id, draft.id), eq(requestDrafts.ownerUserId, ownerUserId)));
  return { results, validationStatus, summaryVersion: draft.summaryVersion };
}

export async function moveConversationState(ownerUserId: number, conversationId: string, nextState: ConversationState) {
  return saveConversationProgress({ ownerUserId, conversationId, nextState });
}

export async function prepareDraftReview(ownerUserId: number, conversationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const beforeValidation = await getRequestConversation(ownerUserId, conversationId);
  if (!beforeValidation?.conversation || !beforeValidation.draft || beforeValidation.draft.deletedAt) throw new Error("DRAFT_NOT_FOUND");
  if (beforeValidation.conversation.currentState === "awaiting_confirmation") return beforeValidation;
  const reviewableStates = ["identifying_intent", "selecting_beneficiary", "selecting_service", "selecting_entity", "collecting_information", "collecting_documents", "validating_information", "reviewing_summary"];
  if (!reviewableStates.includes(beforeValidation.conversation.currentState)) throw new Error("REVIEW_STATE_REQUIRED");
  const validation = await validateRequestDraft(ownerUserId, conversationId);
  if (validation.validationStatus === "errors") throw new Error("DRAFT_VALIDATION_FAILED");
  const session = await getRequestConversation(ownerUserId, conversationId);
  if (!session?.conversation || !session.draft) throw new Error("DRAFT_NOT_FOUND");
  await db.transaction(async (tx) => {
    await tx.update(requestDrafts).set({ status: "awaiting_confirmation" }).where(and(eq(requestDrafts.id, session.draft!.id), eq(requestDrafts.ownerUserId, ownerUserId)));
    await tx.update(aiConversations).set({ currentState: "awaiting_confirmation", status: "active", lastActivityAt: new Date() }).where(and(eq(aiConversations.id, conversationId), eq(aiConversations.ownerUserId, ownerUserId)));
  });
  return getRequestConversation(ownerUserId, conversationId);
}

export async function recordDraftConsent(input: { ownerUserId: number; conversationId: string; consentType: "terms" | "privacy" | "request_submission" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const session = await getRequestConversation(input.ownerUserId, input.conversationId);
  if (!session?.conversation || !session.draft || session.conversation.currentState !== "awaiting_confirmation") throw new Error("CONFIRMATION_NOT_READY");
  const id = crypto.randomUUID();
  const summaryVersion = session.draft.summaryVersion;
  await db.insert(userConsents).values({ id, ownerUserId: input.ownerUserId, draftId: session.draft.id, consentType: input.consentType, policyVersion: requestPolicyVersion, summaryVersion, consentTextHash: consentTextHash({ draftId: session.draft.id, summaryVersion, consentType: input.consentType }) });
  return { id, summaryVersion };
}

export async function checkDraftSubmissionConsent(ownerUserId: number, conversationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const session = await getRequestConversation(ownerUserId, conversationId);
  if (!session?.conversation || !session.draft) return { allowed: false, session: undefined };
  const rows = await db.select({ consentType: userConsents.consentType }).from(userConsents).where(and(eq(userConsents.ownerUserId, ownerUserId), eq(userConsents.draftId, session.draft.id), eq(userConsents.summaryVersion, session.draft.summaryVersion), isNull(userConsents.revokedAt)));
  return { allowed: mayConfirmDraft({ state: session.conversation.currentState, validationStatus: session.draft.validationStatus, consentTypes: rows.map((row) => row.consentType), summaryVersion: session.draft.summaryVersion }), session };
}

export async function submitRequestDraft(ownerUserId: number, conversationId: string, language: "ar" | "en") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const consent = await checkDraftSubmissionConsent(ownerUserId, conversationId);
  const draft = consent.session?.draft;
  if (!consent.session?.conversation || !draft) throw new Error("DRAFT_NOT_FOUND");
  if (draft.submittedRequestId) {
    const existingTransaction = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.requestId, draft.submittedRequestId)).limit(1);
    return { requestId: draft.submittedRequestId, transactionId: existingTransaction[0]?.id ?? null, alreadySubmitted: true };
  }
  if (!consent.allowed) throw new Error("EXPLICIT_CONSENT_REQUIRED");
  const data = draft.structuredData && typeof draft.structuredData === "object" && !Array.isArray(draft.structuredData) ? draft.structuredData as Record<string, unknown> : {};
  const title = String(data.title ?? "").trim();
  const description = String(data.description ?? "").trim();
  const beneficiaryType = data.beneficiaryType as "individual" | "establishment" | "company" | "association" | "nonprofit" | "representative";
  const phoneNumber = typeof data.phoneNumber === "string" ? data.phoneNumber : undefined;
  const city = typeof data.city === "string" ? data.city : undefined;
  const priority = (data.priority === "low" || data.priority === "high" || data.priority === "urgent" ? data.priority : "normal") as "low" | "normal" | "high" | "urgent";
  const claimed = await db.update(requestDrafts).set({ status: "submitting" }).where(and(eq(requestDrafts.id, draft.id), eq(requestDrafts.ownerUserId, ownerUserId), eq(requestDrafts.status, "awaiting_confirmation")));
  if (!claimed[0]?.affectedRows) {
    const latest = await getRequestConversation(ownerUserId, conversationId);
    if (latest?.draft?.submittedRequestId) return { requestId: latest.draft.submittedRequestId, transactionId: null, alreadySubmitted: true };
    throw new Error("SUBMISSION_IN_PROGRESS");
  }
  try {
    const result = await db.transaction(async (tx) => {
      const placeholder = `TMP-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
      const requestResult = await tx.insert(serviceRequests).values({ requestNumber: placeholder, customerUserId: ownerUserId, organizationId: draft.organizationId ?? undefined, serviceId: draft.serviceId ?? undefined, beneficiaryType, title, description, customerPhone: phoneNumber, city, priority, status: "submitted" });
      const requestId = Number(requestResult[0].insertId);
      const requestNumber = formatRequestNumber(requestId);
      await tx.update(serviceRequests).set({ requestNumber }).where(eq(serviceRequests.id, requestId));
      const transactionResult = await tx.insert(transactions).values({ requestId, customerUserId: ownerUserId, organizationId: draft.organizationId ?? undefined, entityId: draft.entityId ?? undefined, serviceId: draft.serviceId ?? undefined, referenceNumber: requestNumber, status: "received", priority, nextAction: submissionMessage(language) });
      const transactionId = Number(transactionResult[0].insertId);
      if (draft.serviceId) {
        const published = await tx.select({ playbookId: servicePlaybooks.id, playbookName: servicePlaybooks.name, versionId: playbookVersions.id, versionNumber: playbookVersions.versionNumber, versionTitle: playbookVersions.title, requirements: playbookVersions.requirements, exceptions: playbookVersions.exceptions }).from(servicePlaybooks).innerJoin(playbookVersions, eq(playbookVersions.playbookId, servicePlaybooks.id)).where(and(eq(servicePlaybooks.serviceId, draft.serviceId), eq(servicePlaybooks.status, "active"), eq(playbookVersions.status, "published"))).orderBy(desc(playbookVersions.publishedAt)).limit(1);
        const active = published[0];
        if (active) {
          const steps = await tx.select({ stepKey: playbookSteps.stepKey, title: playbookSteps.title, instructions: playbookSteps.instructions, actionType: playbookSteps.actionType, assignmentRule: playbookSteps.assignmentRule, slaMinutes: playbookSteps.slaMinutes, stepOrder: playbookSteps.stepOrder, isRequired: playbookSteps.isRequired, expectedDurationMinutes: playbookSteps.expectedDurationMinutes }).from(playbookSteps).where(eq(playbookSteps.versionId, active.versionId)).orderBy(asc(playbookSteps.stepOrder));
          await tx.insert(requestPlaybookAssignments).values({ id: crypto.randomUUID(), requestId, playbookId: active.playbookId, versionId: active.versionId, assignedByUserId: ownerUserId, snapshot: { playbookName: active.playbookName, versionNumber: active.versionNumber, versionTitle: active.versionTitle, requirements: active.requirements, exceptions: active.exceptions, steps } });
          const staff = await tx.select({ id: users.id }).from(users).where(inArray(users.role, ["employee", "supervisor"]));
          const staffIds = staff.map((member) => member.id);
          const loadRows = staffIds.length ? await tx.select({ assigneeUserId: tasks.assigneeUserId, openCount: count(tasks.id) }).from(tasks).where(and(inArray(tasks.assigneeUserId, staffIds), inArray(tasks.status, ["new", "in_progress", "awaiting_customer", "awaiting_external"]))).groupBy(tasks.assigneeUserId) : [];
          const openLoads = new Map(loadRows.filter((row): row is typeof row & { assigneeUserId: number } => row.assigneeUserId !== null).map((row) => [row.assigneeUserId, Number(row.openCount)]));
          const leastLoadedStaff = () => staffIds.slice().sort((left, right) => (openLoads.get(left) ?? 0) - (openLoads.get(right) ?? 0) || left - right)[0];
          const generatedTasks = steps.filter(shouldGenerateTaskFromPlaybookStep).map((step) => {
            const assignee = resolveGeneratedTaskAssignee({ rule: step.assignmentRule, requestOwnerUserId: ownerUserId, leastLoadedStaffUserId: leastLoadedStaff() });
            if (assignee.assigneeUserId && assignee.assignmentSource === "least_loaded_staff") openLoads.set(assignee.assigneeUserId, (openLoads.get(assignee.assigneeUserId) ?? 0) + 1);
            const slaMinutes = slaMinutesForPlaybookStep(step, priority);
            return { transactionId, ownerUserId, assigneeUserId: assignee.assigneeUserId, assignmentSource: assignee.assignmentSource, sourceType: "playbook_step" as const, sourceKey: playbookTaskSourceKey(active.versionId, step.stepKey), title: step.title, description: step.instructions ?? (language === "ar" ? `إجراء مولّد من Playbook ${active.playbookName} (الإصدار ${active.versionNumber}).` : `Task generated from ${active.playbookName} (version ${active.versionNumber}).`), priority, dueAt: dueAtForPlaybookStep(step), slaMinutes, slaDueAt: slaDueAtForPlaybookStep(step, priority) };
          });
          if (generatedTasks.length) await tx.insert(tasks).values(generatedTasks).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
        }
      }
      const linkedDocuments = await tx.select({ documentId: requestDraftDocuments.documentId }).from(requestDraftDocuments).where(eq(requestDraftDocuments.draftId, draft.id));
      if (linkedDocuments.length) await tx.update(documents).set({ requestId, transactionId }).where(and(eq(documents.ownerUserId, ownerUserId), inArray(documents.id, linkedDocuments.map((item) => item.documentId))));
      await tx.insert(transactionStatusHistory).values({ transactionId, nextStatus: "received", actorUserId: ownerUserId, customerNote: submissionMessage(language) });
      await tx.insert(tasks).values({ transactionId, ownerUserId, title: language === "ar" ? "مراجعة الطلب الجديد" : "Review the new request", description: language === "ar" ? "راجع البيانات والمستندات قبل متابعة الإجراء التالي." : "Review the data and documents before the next action.", priority, status: "new" });
      await tx.update(requestDrafts).set({ status: "submitted", submittedRequestId: requestId }).where(and(eq(requestDrafts.id, draft.id), eq(requestDrafts.ownerUserId, ownerUserId)));
      await tx.update(aiConversations).set({ status: "submitted", currentState: "submitted", lastActivityAt: new Date() }).where(and(eq(aiConversations.id, conversationId), eq(aiConversations.ownerUserId, ownerUserId)));
      await tx.insert(notifications).values({ recipientUserId: ownerUserId, title: language === "ar" ? "تم إنشاء طلبك" : "Your request was created", body: submissionMessage(language), type: "request_created", data: { requestId, transactionId, requestNumber } });
      await tx.insert(auditLogs).values({ actorUserId: ownerUserId, action: "assistant.request_submitted", resourceType: "request_draft", resourceId: draft.id, metadata: { requestId, transactionId, requestNumber, summaryVersion: draft.summaryVersion } });
      return { requestId, transactionId, requestNumber, alreadySubmitted: false };
    });
    return result;
  } catch (error) {
    await db.update(requestDrafts).set({ status: "awaiting_confirmation" }).where(and(eq(requestDrafts.id, draft.id), eq(requestDrafts.ownerUserId, ownerUserId), eq(requestDrafts.status, "submitting")));
    throw error;
  }
}

export async function attachDocumentToDraft(input: { ownerUserId: number; conversationId: string; documentId: number; requirementKey?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const session = await getRequestConversation(input.ownerUserId, input.conversationId);
  const draft = session?.draft;
  if (!draft || ["submitted", "cancelled", "expired"].includes(draft.status)) throw new Error("DRAFT_NOT_EDITABLE");
  const rows = await db.select().from(documents).where(eq(documents.id, input.documentId)).limit(1);
  const document = rows[0];
  if (!document) throw new Error("DOCUMENT_NOT_FOUND");
  const check = canAttachDraftDocument({ mimeType: document.mimeType, fileSizeBytes: document.fileSizeBytes, ownerMatches: document.ownerUserId === input.ownerUserId && !document.deletedAt });
  if (!check.allowed) throw new Error(check.reason);
  await db.insert(requestDraftDocuments).values({ id: crypto.randomUUID(), draftId: draft.id, documentId: document.id, requirementKey: input.requirementKey }).onDuplicateKeyUpdate({ set: { requirementKey: input.requirementKey, classificationStatus: "pending" } });
  return listDraftDocuments(input.ownerUserId, input.conversationId);
}

export async function listDraftDocuments(ownerUserId: number, conversationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const session = await getRequestConversation(ownerUserId, conversationId);
  if (!session?.draft) throw new Error("DRAFT_NOT_FOUND");
  return db.select({ id: requestDraftDocuments.id, requirementKey: requestDraftDocuments.requirementKey, classificationStatus: requestDraftDocuments.classificationStatus, documentId: documents.id, fileName: documents.fileName, mimeType: documents.mimeType, fileSizeBytes: documents.fileSizeBytes, verificationStatus: documents.verificationStatus, expiresAt: documents.expiresAt }).from(requestDraftDocuments).innerJoin(documents, eq(requestDraftDocuments.documentId, documents.id)).where(and(eq(requestDraftDocuments.draftId, session.draft.id), eq(documents.ownerUserId, ownerUserId), isNull(documents.deletedAt))).orderBy(desc(requestDraftDocuments.createdAt));
}

export async function removeDocumentFromDraft(input: { ownerUserId: number; conversationId: string; documentId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const session = await getRequestConversation(input.ownerUserId, input.conversationId);
  if (!session?.draft) throw new Error("DRAFT_NOT_FOUND");
  await db.delete(requestDraftDocuments).where(and(eq(requestDraftDocuments.draftId, session.draft.id), eq(requestDraftDocuments.documentId, input.documentId), inArray(requestDraftDocuments.documentId, (await db.select({ id: documents.id }).from(documents).where(eq(documents.ownerUserId, input.ownerUserId))).map((item) => item.id))));
  return { success: true } as const;
}

export async function requestHumanHandoff(input: { ownerUserId: number; conversationId: string; reason: string; language: "ar" | "en" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const session = await getRequestConversation(input.ownerUserId, input.conversationId);
  if (!session?.conversation) throw new Error("CONVERSATION_NOT_FOUND");
  const existing = await db.select().from(handoffRequests).where(and(eq(handoffRequests.ownerUserId, input.ownerUserId), eq(handoffRequests.conversationId, input.conversationId), inArray(handoffRequests.status, ["pending", "assigned"]))).limit(1);
  if (existing[0]) return { handoffId: existing[0].id, ticketId: existing[0].ticketId, reused: true };
  const priority = handoffPriorityForReason(input.reason);
  const ticket = await createSupportTicket({ customerUserId: input.ownerUserId, subject: handoffSubject(input.language), priority, initialMessage: input.reason });
  const handoffId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(handoffRequests).values({ id: handoffId, ownerUserId: input.ownerUserId, conversationId: input.conversationId, draftId: session.draft?.id ?? undefined, ticketId: ticket.id, reason: input.reason, priority, status: "pending" });
    await tx.update(aiConversations).set({ currentState: "needs_human_review", status: "needs_human_review", lastActivityAt: new Date() }).where(and(eq(aiConversations.id, input.conversationId), eq(aiConversations.ownerUserId, input.ownerUserId)));
    await tx.insert(notifications).values({ recipientUserId: input.ownerUserId, title: input.language === "ar" ? "تم تحويل طلبك إلى فريق المتابعة" : "Your request was handed to the follow-up team", body: input.language === "ar" ? "سيظهر الرد والتحديث في مركز الدعم داخل التطبيق." : "Replies and updates will appear in the in-app support center.", type: "human_handoff", data: { handoffId, ticketId: ticket.id } });
  });
  return { handoffId, ticketId: ticket.id, reused: false };
}

export async function createAutomationEvent(input: { eventName: string; aggregateType: string; aggregateId: string; ownerUserId?: number; payload: Record<string, unknown>; idempotencyKey: string }) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await db.select().from(automationEvents).where(eq(automationEvents.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing[0]) return existing[0];
  const id = crypto.randomUUID();
  try {
    await db.insert(automationEvents).values({ id, ...input });
    const rows = await db.select().from(automationEvents).where(eq(automationEvents.id, id)).limit(1);
    return rows[0];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Duplicate") || message.includes("ER_DUP_ENTRY")) {
      const rows = await db.select().from(automationEvents).where(eq(automationEvents.idempotencyKey, input.idempotencyKey)).limit(1);
      return rows[0];
    }
    throw error;
  }
}

export async function listEnabledAutomationRules(triggerEvent: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(automationRules).where(and(eq(automationRules.triggerEvent, triggerEvent), eq(automationRules.enabled, true))).orderBy(asc(automationRules.priority));
}

export async function reserveAutomationRun(input: { ruleId: string; eventId: string; idempotencyKey: string }) {
  const db = await getDb();
  if (!db) return undefined;
  const id = crypto.randomUUID();
  try {
    await db.insert(automationRuns).values({ id, ruleId: input.ruleId, eventId: input.eventId, idempotencyKey: input.idempotencyKey, status: "running", startedAt: new Date() });
    return { id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Duplicate") || message.includes("ER_DUP_ENTRY")) return undefined;
    throw error;
  }
}

export async function completeAutomationRun(runId: string, result: unknown) {
  const db = await getDb();
  if (!db) return;
  await db.update(automationRuns).set({ status: "succeeded", result, completedAt: new Date() }).where(eq(automationRuns.id, runId));
}

export async function failAutomationRun(runId: string, errorCode: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(automationRuns).set({ status: "failed", errorCode, completedAt: new Date() }).where(eq(automationRuns.id, runId));
}

export async function skipAutomationRun(runId: string, result: unknown) {
  const db = await getDb();
  if (!db) return;
  await db.update(automationRuns).set({ status: "skipped", result, completedAt: new Date() }).where(eq(automationRuns.id, runId));
}

export async function seedDefaultAutomationRules(rules: ReadonlyArray<{ id: string; key: string; name: string; triggerEvent: string; priority: number; conditions: unknown; actions: unknown }>) {
  const db = await getDb();
  if (!db) return;
  for (const rule of rules) {
    await db.insert(automationRules).values({ ...rule, enabled: true }).onDuplicateKeyUpdate({ set: { name: rule.name, triggerEvent: rule.triggerEvent, priority: rule.priority, conditions: rule.conditions, actions: rule.actions } });
  }
}

export async function getAutomationOperationsDashboard() {
  const db = await getDb();
  if (!db) return { rules: [], runs: [], metrics: { activeRules: 0, failedRuns: 0, successfulRuns: 0, pendingHandoffs: 0 } };
  const [rules, runs, pendingHandoffRows] = await Promise.all([
    db.select().from(automationRules).orderBy(asc(automationRules.priority), desc(automationRules.updatedAt)),
    db.select({ id: automationRuns.id, status: automationRuns.status, errorCode: automationRuns.errorCode, createdAt: automationRuns.createdAt, completedAt: automationRuns.completedAt, ruleKey: automationRules.key, ruleName: automationRules.name, eventName: automationEvents.eventName, aggregateType: automationEvents.aggregateType, aggregateId: automationEvents.aggregateId }).from(automationRuns).innerJoin(automationRules, eq(automationRuns.ruleId, automationRules.id)).innerJoin(automationEvents, eq(automationRuns.eventId, automationEvents.id)).orderBy(desc(automationRuns.createdAt)).limit(40),
    db.select({ id: handoffRequests.id }).from(handoffRequests).where(inArray(handoffRequests.status, ["pending", "assigned"])).limit(500),
  ]);
  return { rules, runs, metrics: { activeRules: rules.filter((rule) => rule.enabled).length, failedRuns: runs.filter((run) => run.status === "failed").length, successfulRuns: runs.filter((run) => run.status === "succeeded").length, pendingHandoffs: pendingHandoffRows.length } };
}

export async function setAutomationRuleEnabled(ruleId: string, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(automationRules).set({ enabled }).where(eq(automationRules.id, ruleId));
  return { success: true } as const;
}

export async function getAutomationRuleById(ruleId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(automationRules).where(eq(automationRules.id, ruleId)).limit(1);
  return rows[0];
}

export async function createAutomatedTask(input: { ownerUserId: number; transactionId: number; title: string; priority: "low" | "normal" | "high" | "urgent"; ruleKey: string }) {
  const db = await getDb();
  if (!db) return;
  const exists = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.transactionId, input.transactionId), eq(tasks.title, input.title), eq(tasks.ownerUserId, input.ownerUserId), eq(tasks.status, "new"))).limit(1);
  if (exists[0]) return exists[0];
  const result = await db.insert(tasks).values({ transactionId: input.transactionId, ownerUserId: input.ownerUserId, title: input.title, priority: input.priority, status: "new", description: `Automation rule: ${input.ruleKey}` });
  return { id: Number(result[0].insertId) };
}

export async function listTaskTrackingForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    id: tasks.id,
    title: tasks.title,
    description: tasks.description,
    status: tasks.status,
    priority: tasks.priority,
    dueAt: tasks.dueAt,
    slaDueAt: tasks.slaDueAt,
    slaMinutes: tasks.slaMinutes,
    createdAt: tasks.createdAt,
    completedAt: tasks.completedAt,
    assignmentSource: tasks.assignmentSource,
    transactionId: tasks.transactionId,
    transactionReference: transactions.referenceNumber,
  }).from(tasks).leftJoin(transactions, eq(tasks.transactionId, transactions.id)).where(or(eq(tasks.ownerUserId, userId), eq(tasks.assigneeUserId, userId))).orderBy(asc(tasks.slaDueAt), desc(tasks.createdAt));
}

type TaskBlockReason = { type: "dependency" | "checklist" | "approval"; count: number };

async function canAccessTrackedTask(userId: number, taskId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ id: tasks.id }).from(tasks).where(and(
    eq(tasks.id, taskId),
    or(eq(tasks.ownerUserId, userId), eq(tasks.assigneeUserId, userId)),
  )).limit(1);
  return rows[0];
}

async function taskCompletionBlockReason(taskId: number): Promise<TaskBlockReason | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const dependencies = await db.select({ id: taskDependencies.id }).from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
    .where(and(eq(taskDependencies.taskId, taskId), ne(tasks.status, "completed")));
  if (dependencies.length) return { type: "dependency", count: dependencies.length };
  const checklist = await db.select({ id: taskChecklistItems.id }).from(taskChecklistItems)
    .where(and(eq(taskChecklistItems.taskId, taskId), eq(taskChecklistItems.isRequired, true), isNull(taskChecklistItems.completedAt)));
  if (checklist.length) return { type: "checklist", count: checklist.length };
  const approvals = await db.select({ id: approvalRequests.id }).from(approvalRequests).where(and(
    eq(approvalRequests.resourceType, "task"),
    eq(approvalRequests.resourceId, String(taskId)),
    eq(approvalRequests.status, "pending"),
  ));
  if (approvals.length) return { type: "approval", count: approvals.length };
  return undefined;
}

async function wouldCreateDependencyCycle(taskId: number, dependsOnTaskId: number) {
  const db = await getDb();
  if (!db) return true;
  const edges = await db.select({ taskId: taskDependencies.taskId, dependsOnTaskId: taskDependencies.dependsOnTaskId }).from(taskDependencies);
  const pending = [dependsOnTaskId];
  const visited = new Set<number>();
  while (pending.length) {
    const current = pending.pop();
    if (current === undefined || visited.has(current)) continue;
    if (current === taskId) return true;
    visited.add(current);
    edges.filter((edge) => edge.taskId === current).forEach((edge) => pending.push(edge.dependsOnTaskId));
  }
  return false;
}

export async function getTaskExecutionDetailsForUser(userId: number, taskId: number) {
  const db = await getDb();
  if (!db || !await canAccessTrackedTask(userId, taskId)) return undefined;
  const [dependencies, checklist] = await Promise.all([
    db.select({ id: taskDependencies.id, taskId: taskDependencies.taskId, dependsOnTaskId: taskDependencies.dependsOnTaskId, title: tasks.title, status: tasks.status, createdAt: taskDependencies.createdAt })
      .from(taskDependencies).innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id)).where(eq(taskDependencies.taskId, taskId)),
    db.select({ id: taskChecklistItems.id, title: taskChecklistItems.title, isRequired: taskChecklistItems.isRequired, position: taskChecklistItems.position, completedAt: taskChecklistItems.completedAt })
      .from(taskChecklistItems).where(eq(taskChecklistItems.taskId, taskId)).orderBy(asc(taskChecklistItems.position), asc(taskChecklistItems.id)),
  ]);
  return { dependencies, checklist, blockedBy: await taskCompletionBlockReason(taskId) };
}

export async function addTaskDependency(input: { userId: number; taskId: number; dependsOnTaskId: number }) {
  if (input.taskId === input.dependsOnTaskId) throw new Error("TASK_DEPENDENCY_SELF_REFERENCE");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [task, dependency] = await Promise.all([canAccessTrackedTask(input.userId, input.taskId), canAccessTrackedTask(input.userId, input.dependsOnTaskId)]);
  if (!task || !dependency) throw new Error("TASK_NOT_FOUND");
  if (await wouldCreateDependencyCycle(input.taskId, input.dependsOnTaskId)) throw new Error("TASK_DEPENDENCY_CYCLE");
  try {
    const result = await db.insert(taskDependencies).values({ taskId: input.taskId, dependsOnTaskId: input.dependsOnTaskId, createdByUserId: input.userId });
    return { id: Number(result[0].insertId) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Duplicate") || message.includes("ER_DUP_ENTRY")) throw new Error("TASK_DEPENDENCY_ALREADY_EXISTS");
    throw error;
  }
}

export async function addTaskChecklistItem(input: { userId: number; taskId: number; title: string; isRequired: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!await canAccessTrackedTask(input.userId, input.taskId)) throw new Error("TASK_NOT_FOUND");
  const existing = await db.select({ id: taskChecklistItems.id }).from(taskChecklistItems).where(eq(taskChecklistItems.taskId, input.taskId));
  const result = await db.insert(taskChecklistItems).values({ taskId: input.taskId, title: input.title, isRequired: input.isRequired, position: existing.length, createdByUserId: input.userId });
  return { id: Number(result[0].insertId) };
}

export async function setTaskChecklistItemCompletion(input: { userId: number; checklistItemId: number; completed: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ taskId: taskChecklistItems.taskId }).from(taskChecklistItems).where(eq(taskChecklistItems.id, input.checklistItemId)).limit(1);
  const item = rows[0];
  if (!item || !await canAccessTrackedTask(input.userId, item.taskId)) return false;
  const result = await db.update(taskChecklistItems).set({ completedAt: input.completed ? new Date() : null, completedByUserId: input.completed ? input.userId : null }).where(eq(taskChecklistItems.id, input.checklistItemId));
  return Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) > 0;
}

export type ApprovalResourceType = "task" | "service_request";
export type ApprovalRole = "user" | "employee" | "supervisor" | "admin" | "super_admin";
export type ApprovalDecision = "approved" | "rejected" | "changes_requested" | "information_requested";
export type ApprovalInboxOptions = {
  resourceType?: ApprovalResourceType;
  status?: "all" | "active" | "expired";
  sortBy?: "createdAt" | "expiresAt" | "dueAt";
  sortOrder?: "asc" | "desc";
};

async function approvalResourceOwner(userId: number, resourceType: ApprovalResourceType, resourceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const numericId = Number(resourceId);
  if (!Number.isInteger(numericId) || numericId <= 0) return undefined;
  if (resourceType === "task") {
    const task = await canAccessTrackedTask(userId, numericId);
    if (!task) return undefined;
    const rows = await db.select({ ownerUserId: tasks.ownerUserId }).from(tasks).where(eq(tasks.id, numericId)).limit(1);
    return rows[0]?.ownerUserId;
  }
  const rows = await db.select({ customerUserId: serviceRequests.customerUserId }).from(serviceRequests).where(and(eq(serviceRequests.id, numericId), eq(serviceRequests.customerUserId, userId))).limit(1);
  return rows[0]?.customerUserId;
}

export async function createApprovalRequest(input: { userId: number; resourceType: ApprovalResourceType; resourceId: string; routingMode: "sequential" | "parallel"; expiresAt?: Date; steps: Array<{ requiredRole: ApprovalRole; assignedUserId?: number; label: string }> }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ownerUserId = await approvalResourceOwner(input.userId, input.resourceType, input.resourceId);
  if (!ownerUserId) throw new Error("APPROVAL_RESOURCE_NOT_FOUND");
  const existing = await db.select({ id: approvalRequests.id }).from(approvalRequests).where(and(
    eq(approvalRequests.resourceType, input.resourceType),
    eq(approvalRequests.resourceId, input.resourceId),
    eq(approvalRequests.status, "pending"),
  )).limit(1);
  if (existing.length) throw new Error("APPROVAL_REQUEST_ALREADY_PENDING");
  const id = randomUUID();
  await db.insert(approvalRequests).values({ id, resourceType: input.resourceType, resourceId: input.resourceId, ownerUserId, createdByUserId: input.userId, routingMode: input.routingMode, expiresAt: input.expiresAt });
  await db.insert(approvalSteps).values(input.steps.map((step, index) => ({ approvalRequestId: id, stepOrder: index, requiredRole: step.requiredRole, assignedUserId: step.assignedUserId, label: step.label })));
  return { id };
}

export async function listApprovalsForResource(userId: number, resourceType: ApprovalResourceType, resourceId: string) {
  const db = await getDb();
  if (!db || !await approvalResourceOwner(userId, resourceType, resourceId)) return undefined;
  const requests = await db.select().from(approvalRequests).where(and(eq(approvalRequests.resourceType, resourceType), eq(approvalRequests.resourceId, resourceId))).orderBy(desc(approvalRequests.createdAt));
  const ids = requests.map((request) => request.id);
  const steps = ids.length ? await db.select().from(approvalSteps).where(inArray(approvalSteps.approvalRequestId, ids)).orderBy(asc(approvalSteps.stepOrder)) : [];
  return requests.map((request) => ({ ...request, steps: steps.filter((step) => step.approvalRequestId === request.id) }));
}

export async function listPendingApprovalsForApprover(userId: number, userRole: ApprovalRole, options: ApprovalInboxOptions = {}) {
  const db = await getDb();
  if (!db) return [] as Array<{ approvalRequestId: string; stepId: number; stepLabel: string; routingMode: "sequential" | "parallel"; createdAt: Date; expiresAt: Date | null; resourceType: ApprovalResourceType; resourceId: string; resourceLabel: string }>;
  const candidates = await db.select({ request: approvalRequests, step: approvalSteps }).from(approvalSteps).innerJoin(approvalRequests, eq(approvalSteps.approvalRequestId, approvalRequests.id)).where(and(
    eq(approvalRequests.status, "pending"),
    eq(approvalSteps.status, "pending"),
    or(eq(approvalSteps.assignedUserId, userId), eq(approvalSteps.requiredRole, userRole)),
  )).orderBy(asc(approvalRequests.createdAt), asc(approvalSteps.stepOrder));
  if (!candidates.length) return [];
  const requestIds = [...new Set(candidates.map((row) => row.request.id))];
  const allSteps = await db.select().from(approvalSteps).where(inArray(approvalSteps.approvalRequestId, requestIds)).orderBy(asc(approvalSteps.stepOrder));
  const taskIds = candidates.filter((row) => row.request.resourceType === "task").map((row) => Number(row.request.resourceId)).filter((id) => Number.isInteger(id) && id > 0);
  const serviceRequestIds = candidates.filter((row) => row.request.resourceType === "service_request").map((row) => Number(row.request.resourceId)).filter((id) => Number.isInteger(id) && id > 0);
  const taskRows = taskIds.length ? await db.select({ id: tasks.id, title: tasks.title, slaDueAt: tasks.slaDueAt, dueAt: tasks.dueAt }).from(tasks).where(inArray(tasks.id, [...new Set(taskIds)])) : [];
  const serviceRequestRows = serviceRequestIds.length ? await db.select({ id: serviceRequests.id, title: serviceRequests.title, desiredDueAt: serviceRequests.desiredDueAt }).from(serviceRequests).where(inArray(serviceRequests.id, [...new Set(serviceRequestIds)])) : [];
  const taskLabels = new Map(taskRows.map((task) => [String(task.id), { label: task.title, dueAt: task.slaDueAt ?? task.dueAt ?? null }]));
  const serviceRequestLabels = new Map(serviceRequestRows.map((request) => [String(request.id), { label: request.title, dueAt: request.desiredDueAt ?? null }]));
  const actionable = candidates.filter(({ request, step }) => request.routingMode !== "sequential" || allSteps.filter((candidate) => candidate.approvalRequestId === request.id && candidate.stepOrder < step.stepOrder).every((candidate) => ["approved", "skipped"].includes(candidate.status))).map(({ request, step }) => {
    const resource = request.resourceType === "task" ? taskLabels.get(request.resourceId) : serviceRequestLabels.get(request.resourceId);
    return { approvalRequestId: request.id, stepId: step.id, stepLabel: step.label, routingMode: request.routingMode, createdAt: request.createdAt, expiresAt: request.expiresAt ?? null, resourceType: request.resourceType, resourceId: request.resourceId, resourceLabel: resource?.label ?? (request.resourceType === "task" ? `مهمة #${request.resourceId}` : `طلب خدمة #${request.resourceId}`), dueAt: resource?.dueAt ?? null };
  });
  const now = new Date();
  const filtered = actionable.filter((item) => {
    if (options.resourceType && item.resourceType !== options.resourceType) return false;
    const isExpired = Boolean(item.expiresAt && item.expiresAt <= now);
    if (options.status === "active" && isExpired) return false;
    if (options.status === "expired" && !isExpired) return false;
    return true;
  });
  const sortBy = options.sortBy ?? "createdAt";
  const sortOrder = options.sortOrder ?? "asc";
  return filtered.sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];
    if (!leftValue && !rightValue) return left.createdAt.getTime() - right.createdAt.getTime();
    if (!leftValue) return 1;
    if (!rightValue) return -1;
    const comparison = leftValue.getTime() - rightValue.getTime();
    return sortOrder === "desc" ? -comparison : comparison;
  });
}

export async function decideApprovalStep(input: { userId: number; userRole: ApprovalRole; approvalRequestId: string; stepId: number; decision: ApprovalDecision; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const requestRows = await db.select().from(approvalRequests).where(eq(approvalRequests.id, input.approvalRequestId)).limit(1);
  const request = requestRows[0];
  if (!request || request.status !== "pending") throw new Error("APPROVAL_REQUEST_NOT_PENDING");
  if (request.expiresAt && request.expiresAt.getTime() <= Date.now()) {
    await db.update(approvalRequests).set({ status: "expired" }).where(eq(approvalRequests.id, request.id));
    throw new Error("APPROVAL_REQUEST_EXPIRED");
  }
  const steps = await db.select().from(approvalSteps).where(eq(approvalSteps.approvalRequestId, request.id)).orderBy(asc(approvalSteps.stepOrder));
  const step = steps.find((candidate) => candidate.id === input.stepId);
  if (!step || step.status !== "pending") throw new Error("APPROVAL_STEP_NOT_PENDING");
  if (step.assignedUserId ? step.assignedUserId !== input.userId : step.requiredRole !== input.userRole) throw new Error("APPROVAL_DECISION_FORBIDDEN");
  if (request.routingMode === "sequential" && steps.some((candidate) => candidate.stepOrder < step.stepOrder && !["approved", "skipped"].includes(candidate.status))) throw new Error("APPROVAL_SEQUENCE_BLOCKED");
  await db.update(approvalSteps).set({ status: input.decision, decisionNote: input.note ?? null, decidedByUserId: input.userId, decidedAt: new Date() }).where(eq(approvalSteps.id, step.id));
  const nextStatus = input.decision === "approved" && steps.filter((candidate) => candidate.id !== step.id).every((candidate) => ["approved", "skipped"].includes(candidate.status)) ? "approved" : input.decision === "approved" ? "pending" : input.decision;
  await db.update(approvalRequests).set({ status: nextStatus }).where(eq(approvalRequests.id, request.id));
  return { requestStatus: nextStatus };
}

export async function updateTrackedTaskStatus(input: { userId: number; taskId: number; status: "new" | "in_progress" | "awaiting_customer" | "awaiting_external" | "completed" | "cancelled" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const blockedBy = input.status === "completed" ? await taskCompletionBlockReason(input.taskId) : undefined;
  if (blockedBy) return { updated: false, blockedBy };
  const result = await db.update(tasks).set({ status: input.status, completedAt: input.status === "completed" ? new Date() : null }).where(and(eq(tasks.id, input.taskId), or(eq(tasks.ownerUserId, input.userId), eq(tasks.assigneeUserId, input.userId))));
  return { updated: Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) > 0, blockedBy: undefined };
}

export type RegulatoryUpdateStatus = "collected" | "duplicate" | "processing" | "needs_review" | "verified" | "published" | "rejected" | "archived";

export async function ensureInitialZatcaOfficialSource(actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select({ id: officialSources.id }).from(officialSources).where(eq(officialSources.feedUrl, ZATCA_OFFICIAL_SOURCE.feedUrl)).limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };
  const result = await db.insert(officialSources).values({
    ...ZATCA_OFFICIAL_SOURCE,
    sourceType: "rss",
    collectionMethod: "rss",
    verificationStatus: "verified",
    collectionFrequency: "daily",
    isActive: true,
  });
  const id = Number(result[0].insertId);
  await createAuditLog({ actorUserId, action: "official_source.initial_zatca_created", resourceType: "official_source", resourceId: id, metadata: { feedUrl: ZATCA_OFFICIAL_SOURCE.feedUrl } });
  return { id, created: true };
}

export async function listOfficialSourcesForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(officialSources).orderBy(desc(officialSources.updatedAt));
}

export async function collectOfficialSource(input: { actorUserId?: number; sourceId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sourceRows = await db.select().from(officialSources).where(eq(officialSources.id, input.sourceId)).limit(1);
  const source = sourceRows[0];
  if (!source || !source.isActive || source.verificationStatus !== "verified" || source.collectionMethod !== "rss" || !source.feedUrl) throw new Error("OFFICIAL_SOURCE_NOT_COLLECTABLE");
  if (!isOfficialGovernmentUrl(source.officialUrl) || !isOfficialGovernmentUrl(source.feedUrl)) throw new Error("OFFICIAL_SOURCE_URL_REJECTED");

  try {
    const response = await fetch(source.feedUrl, { headers: { Accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`OFFICIAL_SOURCE_FETCH_${response.status}`);
    const xml = await response.text();
    const items = parseOfficialRss(xml);
    let created = 0;
    let duplicates = 0;
    for (const item of items) {
      const existing = await db.select({ id: regulatoryUpdates.id }).from(regulatoryUpdates).where(and(eq(regulatoryUpdates.sourceId, source.id), eq(regulatoryUpdates.checksum, item.checksum))).limit(1);
      if (existing[0]) {
        duplicates += 1;
        continue;
      }
      await db.insert(regulatoryUpdates).values({
        sourceId: source.id,
        externalReference: item.link,
        originalTitle: item.title,
        officialUrl: item.link,
        publishedAt: item.publishedAt,
        originalContent: item.description || item.title,
        updateType: item.updateType,
        importance: item.importance,
        checksum: item.checksum,
        status: "needs_review",
      });
      created += 1;
    }
    const now = new Date();
    await db.update(officialSources).set({ lastCheckedAt: now, lastSuccessAt: now }).where(eq(officialSources.id, source.id));
    await createAuditLog({ actorUserId: input.actorUserId, action: "official_source.collected", resourceType: "official_source", resourceId: source.id, metadata: { created, duplicates, itemCount: items.length } });
    return { created, duplicates, itemCount: items.length };
  } catch (error) {
    await db.update(officialSources).set({ lastCheckedAt: new Date() }).where(eq(officialSources.id, source.id));
    await createAuditLog({ actorUserId: input.actorUserId, action: "official_source.collection_failed", resourceType: "official_source", resourceId: source.id, metadata: { reason: error instanceof Error ? error.message.slice(0, 160) : "unknown" } });
    throw error;
  }
}

export async function collectVerifiedOfficialSources(actorUserId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sources = await db.select({ id: officialSources.id }).from(officialSources).where(and(
    eq(officialSources.isActive, true),
    eq(officialSources.verificationStatus, "verified"),
    eq(officialSources.collectionMethod, "rss"),
  ));
  let created = 0;
  let duplicates = 0;
  const failures: number[] = [];
  for (const source of sources) {
    try {
      const result = await collectOfficialSource({ actorUserId, sourceId: source.id });
      created += result.created;
      duplicates += result.duplicates;
    } catch {
      failures.push(source.id);
    }
  }
  return { sourceCount: sources.length, created, duplicates, failedSourceIds: failures };
}

export async function listRegulatoryUpdatesForAdmin(status?: RegulatoryUpdateStatus) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ update: regulatoryUpdates, sourceName: officialSources.sourceName, authorityNameAr: officialSources.authorityNameAr })
    .from(regulatoryUpdates).innerJoin(officialSources, eq(regulatoryUpdates.sourceId, officialSources.id))
    .where(status ? eq(regulatoryUpdates.status, status) : undefined)
    .orderBy(desc(regulatoryUpdates.createdAt)).limit(100);
  return rows.map((row) => ({ ...row.update, sourceName: row.sourceName, authorityNameAr: row.authorityNameAr }));
}

export async function listPublishedRegulatoryUpdates() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ update: regulatoryUpdates, sourceName: officialSources.sourceName, authorityNameAr: officialSources.authorityNameAr })
    .from(regulatoryUpdates).innerJoin(officialSources, eq(regulatoryUpdates.sourceId, officialSources.id))
    .where(and(eq(regulatoryUpdates.status, "published"), isNull(regulatoryUpdates.deletedAt)))
    .orderBy(desc(regulatoryUpdates.publishedAtSystem), desc(regulatoryUpdates.publishedAt)).limit(100);
  return rows.map((row) => ({
    id: row.update.id,
    titleAr: row.update.titleAr,
    titleEn: row.update.titleEn,
    originalTitle: row.update.originalTitle,
    officialUrl: row.update.officialUrl,
    updateType: row.update.updateType,
    importance: row.update.importance,
    summaryAr: row.update.summaryAr,
    summaryEn: row.update.summaryEn,
    publishedAt: row.update.publishedAt,
    effectiveFrom: row.update.effectiveFrom,
    authorityNameAr: row.authorityNameAr,
    sourceName: row.sourceName,
    publishedAtSystem: row.update.publishedAtSystem,
  }));
}

export async function reviewRegulatoryUpdate(input: { actorUserId: number; updateId: number; action: "verify" | "publish" | "reject"; note?: string; titleAr?: string; titleEn?: string; summaryAr?: string; summaryEn?: string; updateType?: OfficialUpdateType; importance?: OfficialUpdateImportance }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(regulatoryUpdates).where(eq(regulatoryUpdates.id, input.updateId)).limit(1);
  const update = rows[0];
  if (!update || update.deletedAt) throw new Error("REGULATORY_UPDATE_NOT_FOUND");
  const now = new Date();
  const patch = {
    titleAr: input.titleAr?.trim() || update.titleAr,
    titleEn: input.titleEn?.trim() || update.titleEn,
    summaryAr: input.summaryAr?.trim() || update.summaryAr,
    summaryEn: input.summaryEn?.trim() || update.summaryEn,
    updateType: input.updateType ?? update.updateType,
    importance: input.importance ?? update.importance,
    reviewNote: input.note?.trim() || null,
    reviewedByUserId: input.actorUserId,
    reviewedAt: now,
  };
  if (input.action === "verify") {
    if (!mayTransitionRegulatoryUpdate(update.status, input.action)) throw new Error("REGULATORY_UPDATE_REVIEW_STATE_INVALID");
    await db.update(regulatoryUpdates).set({ ...patch, status: "verified" }).where(eq(regulatoryUpdates.id, update.id));
  } else if (input.action === "publish") {
    if (!mayTransitionRegulatoryUpdate(update.status, input.action)) throw new Error("REGULATORY_UPDATE_NOT_VERIFIED");
    await db.update(regulatoryUpdates).set({ ...patch, status: "published", publishedByUserId: input.actorUserId, publishedAtSystem: now }).where(eq(regulatoryUpdates.id, update.id));
  } else {
    if (!mayTransitionRegulatoryUpdate(update.status, input.action)) throw new Error("REGULATORY_UPDATE_REVIEW_STATE_INVALID");
    await db.update(regulatoryUpdates).set({ ...patch, status: "rejected" }).where(eq(regulatoryUpdates.id, update.id));
  }
  await createAuditLog({ actorUserId: input.actorUserId, action: `regulatory_update.${input.action}`, resourceType: "regulatory_update", resourceId: update.id, metadata: { priorStatus: update.status, updateType: patch.updateType, importance: patch.importance } });
  return { status: input.action === "verify" ? "verified" : input.action === "publish" ? "published" : "rejected" };
}

export async function listUpdateSubscriptionsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(updateSubscriptions).where(eq(updateSubscriptions.userId, userId)).orderBy(desc(updateSubscriptions.updatedAt));
}

export async function createUpdateSubscription(input: { userId: number; sourceId?: number; updateType?: string; activity?: string; city?: string; notificationChannel: "in_app" | "push" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(updateSubscriptions).values({ ...input, isActive: true });
  return { id: Number(result[0].insertId) };
}

export async function setUpdateSubscriptionActive(input: { userId: number; subscriptionId: number; isActive: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(updateSubscriptions).set({ isActive: input.isActive }).where(and(eq(updateSubscriptions.id, input.subscriptionId), eq(updateSubscriptions.userId, input.userId)));
  return Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) > 0;
}
