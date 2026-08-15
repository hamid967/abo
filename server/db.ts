import { and, count, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { cloudRecords, documents, InsertUser, InsertServiceRequest, InsertTransactionRecord, serviceRequests, transactions, users } from "../drizzle/schema";
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

export async function getSystemTransactionDashboard(status?: (typeof transactions.$inferSelect)["status"]) {
  const db = await getDb();
  if (!db) return { metrics: { total: 0, active: 0, overdue: 0, awaitingDocuments: 0, completed: 0 }, transactions: [] };
  const grouped = await db.select({ status: transactions.status, total: count(transactions.id) }).from(transactions).groupBy(transactions.status);
  const statusTotals = Object.fromEntries(grouped.map((item) => [item.status, Number(item.total)]));
  const total = Object.values(statusTotals).reduce((sum, value) => sum + value, 0);
  const completed = statusTotals.completed ?? 0;
  const inactive = completed + (statusTotals.rejected ?? 0) + (statusTotals.cancelled ?? 0) + (statusTotals.archived ?? 0);
  const rowQuery = db.select({ id: transactions.id, referenceNumber: transactions.referenceNumber, status: transactions.status, priority: transactions.priority, nextAction: transactions.nextAction, dueAt: transactions.dueAt, updatedAt: transactions.updatedAt, customerUserId: transactions.customerUserId, assigneeUserId: transactions.assigneeUserId }).from(transactions);
  const rows = status ? await rowQuery.where(eq(transactions.status, status)).orderBy(desc(transactions.updatedAt)).limit(100) : await rowQuery.orderBy(desc(transactions.updatedAt)).limit(100);
  return { metrics: { total, active: total - inactive, overdue: statusTotals.overdue ?? 0, awaitingDocuments: statusTotals.awaiting_customer_documents ?? 0, completed }, transactions: rows };
}
