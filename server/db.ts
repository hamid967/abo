import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, like, lt, notInArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { aiConversations, aiMessages, appointments, automationEvents, automationRules, automationRuns, automationSchedules, auditLogs, cloudRecords, documents, dueNotificationRuns, expoGoOAuthAttempts, faqItems, handoffRequests, InsertUser, InsertServiceRequest, InsertTransactionRecord, knowledgeArticles, notificationDeliveryLogs, notificationPreferences, notifications, organizations, requestDraftDocuments, requestDrafts, serviceRequests, supportTickets, tasks, ticketMessages, transactionStatusHistory, transactions, userConsents, users } from "../drizzle/schema";
import { canManageOperations, canOperateTransactions } from "./authorization";
import { ENV } from "./_core/env";
import { assertConversationTransition, assertSafeConversationContent, conversationStatusForState, type ConversationState } from "./conversation-state";
import { calculateDraftCompletion, mergeRequestDraftData, type RequestDraftPatch } from "./request-draft-policy";
import { validateRequestData, validationStatusFromResults } from "./request-validation";
import { consentTextHash, mayConfirmDraft, requestPolicyVersion } from "./request-review";
import { formatRequestNumber, submissionMessage } from "./request-submission";
import { canAttachDraftDocument } from "./draft-document-policy";
import { handoffPriorityForReason, handoffSubject } from "./handoff-policy";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
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
    console.error("[Database] Failed to upsert user:", error);
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

export type DailyDueCandidate = {
  resourceType: "request" | "transaction" | "appointment";
  resourceId: string;
  recipientUserId: number;
  title: string;
  dueAt: Date;
};

export async function listDailyDueCandidates(before: Date): Promise<DailyDueCandidate[]> {
  const db = await getDb();
  if (!db) return [];
  const [requestRows, transactionRows, appointmentRows] = await Promise.all([
    db.select({ id: serviceRequests.id, recipientUserId: serviceRequests.customerUserId, title: serviceRequests.title, dueAt: serviceRequests.desiredDueAt }).from(serviceRequests).where(and(isNotNull(serviceRequests.desiredDueAt), isNull(serviceRequests.deletedAt), notInArray(serviceRequests.status, ["cancelled"]) as never, lt(serviceRequests.desiredDueAt, before))),
    db.select({ id: transactions.id, recipientUserId: transactions.customerUserId, referenceNumber: transactions.referenceNumber, dueAt: transactions.dueAt }).from(transactions).where(and(isNotNull(transactions.dueAt), isNull(transactions.deletedAt), notInArray(transactions.status, ["completed", "rejected", "cancelled", "archived"]) as never, lt(transactions.dueAt, before))),
    db.select({ id: appointments.id, recipientUserId: appointments.customerUserId, title: appointments.title, dueAt: appointments.startsAt }).from(appointments).where(and(eq(appointments.status, "scheduled"), lt(appointments.startsAt, before))),
  ]);
  return [
    ...requestRows.filter((row): row is typeof row & { dueAt: Date } => row.dueAt instanceof Date).map((row) => ({ resourceType: "request" as const, resourceId: String(row.id), recipientUserId: row.recipientUserId, title: row.title, dueAt: row.dueAt })),
    ...transactionRows.filter((row): row is typeof row & { dueAt: Date } => row.dueAt instanceof Date).map((row) => ({ resourceType: "transaction" as const, resourceId: String(row.id), recipientUserId: row.recipientUserId, title: row.referenceNumber || `معاملة #${row.id}`, dueAt: row.dueAt })),
    ...appointmentRows.filter((row): row is typeof row & { dueAt: Date } => row.dueAt instanceof Date).map((row) => ({ resourceType: "appointment" as const, resourceId: String(row.id), recipientUserId: row.recipientUserId, title: row.title, dueAt: row.dueAt })),
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

export async function createAuditLog(input: { actorUserId?: number | null; action: string; resourceType: string; resourceId?: string | number | null; metadata?: unknown }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({ actorUserId: input.actorUserId ?? null, action: input.action, resourceType: input.resourceType, resourceId: input.resourceId === undefined || input.resourceId === null ? null : String(input.resourceId), metadata: input.metadata });
}

export async function createSupportTicket(input: { customerUserId: number; transactionId?: number; subject: string; priority: "low" | "normal" | "high" | "urgent"; initialMessage: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(supportTickets).values({ customerUserId: input.customerUserId, transactionId: input.transactionId, subject: input.subject, priority: input.priority });
  const ticketId = result[0].insertId;
  await db.insert(ticketMessages).values({ ticketId, authorUserId: input.customerUserId, body: input.initialMessage, isInternal: false });
  return { id: ticketId };
}

export async function listSupportTickets(userId: number, role: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({ id: supportTickets.id, subject: supportTickets.subject, status: supportTickets.status, priority: supportTickets.priority, transactionId: supportTickets.transactionId, customerUserId: supportTickets.customerUserId, assignedUserId: supportTickets.assignedUserId, updatedAt: supportTickets.updatedAt, createdAt: supportTickets.createdAt, customerName: users.name }).from(supportTickets).leftJoin(users, eq(supportTickets.customerUserId, users.id));
  return canOperateTransactions(role) ? query.orderBy(desc(supportTickets.updatedAt)).limit(100) : query.where(eq(supportTickets.customerUserId, userId)).orderBy(desc(supportTickets.updatedAt)).limit(100);
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
  const query = db.select({ id: ticketMessages.id, ticketId: ticketMessages.ticketId, authorUserId: ticketMessages.authorUserId, authorName: users.name, body: ticketMessages.body, isInternal: ticketMessages.isInternal, createdAt: ticketMessages.createdAt }).from(ticketMessages).leftJoin(users, eq(ticketMessages.authorUserId, users.id));
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

export async function updateSupportTicket(ticketId: number, input: { status?: "open" | "in_progress" | "awaiting_customer" | "resolved" | "closed"; priority?: "low" | "normal" | "high" | "urgent"; assignedUserId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const closedAt = input.status === "resolved" || input.status === "closed" ? new Date() : undefined;
  await db.update(supportTickets).set({ ...input, ...(closedAt ? { closedAt } : {}) }).where(eq(supportTickets.id, ticketId));
  return { success: true } as const;
}

export async function listNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.recipientUserId, userId)).orderBy(desc(notifications.createdAt)).limit(80);
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

export async function updateNotificationPreferences(input: { userId: number; inAppEnabled: boolean; digestFrequency: "immediate" | "daily"; quietHoursEnabled: boolean; quietStartHour?: number | null; quietEndHour?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notificationPreferences).values({ ...input, quietStartHour: input.quietHoursEnabled ? input.quietStartHour ?? 22 : null, quietEndHour: input.quietHoursEnabled ? input.quietEndHour ?? 7 : null }).onDuplicateKeyUpdate({ set: { inAppEnabled: input.inAppEnabled, digestFrequency: input.digestFrequency, quietHoursEnabled: input.quietHoursEnabled, quietStartHour: input.quietHoursEnabled ? input.quietStartHour ?? 22 : null, quietEndHour: input.quietHoursEnabled ? input.quietEndHour ?? 7 : null } });
  return getNotificationPreferences(input.userId);
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

export async function getCloudRecord(ownerUserId: number, recordType: "transactions" | "workspace" | "inquiries") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(cloudRecords).where(and(eq(cloudRecords.ownerUserId, ownerUserId), eq(cloudRecords.recordType, recordType))).limit(1);
  return rows[0];
}

export async function upsertCloudRecord(ownerUserId: number, recordType: "transactions" | "workspace" | "inquiries", payload: unknown) {
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

export async function getSystemTransactionDashboard(status?: (typeof transactions.$inferSelect)["status"], search?: string) {
  const db = await getDb();
  if (!db) return { metrics: { total: 0, active: 0, overdue: 0, awaitingDocuments: 0, completed: 0 }, transactions: [] };
  const grouped = await db.select({ status: transactions.status, total: count(transactions.id) }).from(transactions).groupBy(transactions.status);
  const statusTotals = Object.fromEntries(grouped.map((item) => [item.status, Number(item.total)]));
  const total = Object.values(statusTotals).reduce((sum, value) => sum + value, 0);
  const completed = statusTotals.completed ?? 0;
  const inactive = completed + (statusTotals.rejected ?? 0) + (statusTotals.cancelled ?? 0) + (statusTotals.archived ?? 0);
  const criteria = [status ? eq(transactions.status, status) : undefined, search ? or(like(transactions.referenceNumber, `%${search}%`), like(users.name, `%${search}%`), like(serviceRequests.customerPhone, `%${search}%`), like(organizations.name, `%${search}%`)) : undefined].filter(Boolean);
  const rowQuery = db.select({ id: transactions.id, referenceNumber: transactions.referenceNumber, status: transactions.status, priority: transactions.priority, nextAction: transactions.nextAction, dueAt: transactions.dueAt, updatedAt: transactions.updatedAt, customerUserId: transactions.customerUserId, customerName: users.name, customerPhone: serviceRequests.customerPhone, organizationName: organizations.name, assigneeUserId: transactions.assigneeUserId }).from(transactions).leftJoin(users, eq(transactions.customerUserId, users.id)).leftJoin(serviceRequests, eq(transactions.requestId, serviceRequests.id)).leftJoin(organizations, eq(transactions.organizationId, organizations.id));
  const rows = criteria.length ? await rowQuery.where(and(...criteria)).orderBy(desc(transactions.updatedAt)).limit(100) : await rowQuery.orderBy(desc(transactions.updatedAt)).limit(100);
  return { metrics: { total, active: total - inactive, overdue: statusTotals.overdue ?? 0, awaitingDocuments: statusTotals.awaiting_customer_documents ?? 0, completed }, transactions: rows };
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
  const validation = await validateRequestDraft(ownerUserId, conversationId);
  if (validation.validationStatus === "errors") throw new Error("DRAFT_VALIDATION_FAILED");
  const session = await getRequestConversation(ownerUserId, conversationId);
  if (!session?.conversation || !session.draft || session.conversation.currentState !== "reviewing_summary") throw new Error("REVIEW_STATE_REQUIRED");
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

export async function createAutomatedTask(input: { ownerUserId: number; transactionId: number; title: string; priority: "low" | "normal" | "high" | "urgent"; ruleKey: string }) {
  const db = await getDb();
  if (!db) return;
  const exists = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.transactionId, input.transactionId), eq(tasks.title, input.title), eq(tasks.ownerUserId, input.ownerUserId), eq(tasks.status, "new"))).limit(1);
  if (exists[0]) return exists[0];
  const result = await db.insert(tasks).values({ transactionId: input.transactionId, ownerUserId: input.ownerUserId, title: input.title, priority: input.priority, status: "new", description: `Automation rule: ${input.ruleKey}` });
  return { id: Number(result[0].insertId) };
}
