import { and, asc, count, desc, eq, isNotNull, isNull, like, lt, notInArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { appointments, automationSchedules, auditLogs, cloudRecords, documents, dueNotificationRuns, faqItems, InsertUser, InsertServiceRequest, InsertTransactionRecord, knowledgeArticles, notifications, organizations, serviceRequests, supportTickets, ticketMessages, transactions, users } from "../drizzle/schema";
import { canManageOperations, canOperateTransactions } from "./authorization";
import { ENV } from "./_core/env";

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

type DailyNotificationKey = Pick<DailyDueCandidate, "recipientUserId" | "resourceType" | "resourceId"> & { notifiedForDate: string };

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
  await db.insert(notifications).values(input);
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
