import {
  boolean,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "employee", "supervisor", "admin", "super_admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  organizationType: mysqlEnum("organizationType", ["establishment", "company", "association", "nonprofit"]).notNull(),
  commercialRegistration: varchar("commercialRegistration", { length: 64 }),
  city: varchar("city", { length: 120 }),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("organizations_owner_idx").on(table.ownerUserId), foreignKey({ columns: [table.ownerUserId], foreignColumns: [users.id], name: "organizations_owner_user_fk" }).onDelete("restrict")]);

export const organizationMembers = mysqlTable("organization_members", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  memberRole: mysqlEnum("memberRole", ["owner", "manager", "representative", "viewer"]).default("representative").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("organization_member_unique").on(table.organizationId, table.userId), index("organization_members_user_idx").on(table.userId), foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "organization_members_organization_fk" }).onDelete("cascade"), foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "organization_members_user_fk" }).onDelete("restrict")]);

export const governmentEntities = mysqlTable("government_entities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 120 }),
  officialUrl: varchar("officialUrl", { length: 1024 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("government_entities_name_unique").on(table.name)]);

export const governmentServices = mysqlTable("government_services", {
  id: int("id").autoincrement().primaryKey(),
  entityId: int("entityId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  audience: varchar("audience", { length: 120 }),
  description: text("description"),
  requirements: json("requirements"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("government_services_entity_idx").on(table.entityId), foreignKey({ columns: [table.entityId], foreignColumns: [governmentEntities.id], name: "government_services_entity_fk" }).onDelete("restrict")]);

export const serviceRequests = mysqlTable("service_requests", {
  id: int("id").autoincrement().primaryKey(),
  requestNumber: varchar("requestNumber", { length: 32 }).notNull(),
  customerUserId: int("customerUserId").notNull(),
  organizationId: int("organizationId"),
  serviceId: int("serviceId"),
  beneficiaryType: mysqlEnum("beneficiaryType", ["individual", "establishment", "company", "association", "nonprofit", "representative"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  city: varchar("city", { length: 120 }),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "under_review", "converted", "cancelled"]).default("draft").notNull(),
  desiredDueAt: timestamp("desiredDueAt"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("service_requests_number_unique").on(table.requestNumber), index("service_requests_customer_idx").on(table.customerUserId), index("service_requests_status_idx").on(table.status), foreignKey({ columns: [table.customerUserId], foreignColumns: [users.id], name: "service_requests_customer_fk" }).onDelete("restrict"), foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "service_requests_organization_fk" }).onDelete("set null"), foreignKey({ columns: [table.serviceId], foreignColumns: [governmentServices.id], name: "service_requests_service_fk" }).onDelete("set null")]);

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  customerUserId: int("customerUserId").notNull(),
  organizationId: int("organizationId"),
  entityId: int("entityId"),
  serviceId: int("serviceId"),
  assigneeUserId: int("assigneeUserId"),
  referenceNumber: varchar("referenceNumber", { length: 128 }),
  status: mysqlEnum("status", ["draft", "received", "under_review", "awaiting_assignment", "assigned", "document_verification", "awaiting_customer_documents", "ready_for_submission", "submitted_to_agency", "under_agency_review", "awaiting_appointment", "beneficiary_attendance_required", "payment_required", "revision_required", "suspended", "overdue", "completed", "rejected", "cancelled", "archived"]).default("received").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  nextAction: text("nextAction"),
  dueAt: timestamp("dueAt"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("transactions_customer_idx").on(table.customerUserId), index("transactions_assignee_idx").on(table.assigneeUserId), index("transactions_status_idx").on(table.status), foreignKey({ columns: [table.requestId], foreignColumns: [serviceRequests.id], name: "transactions_request_fk" }).onDelete("restrict"), foreignKey({ columns: [table.customerUserId], foreignColumns: [users.id], name: "transactions_customer_fk" }).onDelete("restrict"), foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "transactions_organization_fk" }).onDelete("set null"), foreignKey({ columns: [table.entityId], foreignColumns: [governmentEntities.id], name: "transactions_entity_fk" }).onDelete("set null"), foreignKey({ columns: [table.serviceId], foreignColumns: [governmentServices.id], name: "transactions_service_fk" }).onDelete("set null"), foreignKey({ columns: [table.assigneeUserId], foreignColumns: [users.id], name: "transactions_assignee_fk" }).onDelete("set null")]);

export const transactionStatusHistory = mysqlTable("transaction_status_history", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(),
  previousStatus: varchar("previousStatus", { length: 64 }),
  nextStatus: varchar("nextStatus", { length: 64 }).notNull(),
  actorUserId: int("actorUserId").notNull(),
  customerNote: text("customerNote"),
  internalNote: text("internalNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("status_history_transaction_idx").on(table.transactionId), foreignKey({ columns: [table.transactionId], foreignColumns: [transactions.id], name: "transaction_status_history_transaction_fk" }).onDelete("cascade"), foreignKey({ columns: [table.actorUserId], foreignColumns: [users.id], name: "transaction_status_history_actor_fk" }).onDelete("restrict")]);

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId"),
  ownerUserId: int("ownerUserId").notNull(),
  assigneeUserId: int("assigneeUserId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["new", "in_progress", "awaiting_customer", "awaiting_external", "completed", "overdue", "cancelled"]).default("new").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  dueAt: timestamp("dueAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("tasks_owner_idx").on(table.ownerUserId), index("tasks_transaction_idx").on(table.transactionId), index("tasks_status_idx").on(table.status), foreignKey({ columns: [table.transactionId], foreignColumns: [transactions.id], name: "tasks_transaction_fk" }).onDelete("set null"), foreignKey({ columns: [table.ownerUserId], foreignColumns: [users.id], name: "tasks_owner_fk" }).onDelete("restrict"), foreignKey({ columns: [table.assigneeUserId], foreignColumns: [users.id], name: "tasks_assignee_fk" }).onDelete("set null")]);

export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId"),
  customerUserId: int("customerUserId").notNull(),
  assigneeUserId: int("assigneeUserId"),
  title: varchar("title", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt"),
  outcome: text("outcome"),
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled", "missed"]).default("scheduled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("appointments_customer_idx").on(table.customerUserId), index("appointments_starts_at_idx").on(table.startsAt), foreignKey({ columns: [table.transactionId], foreignColumns: [transactions.id], name: "appointments_transaction_fk" }).onDelete("set null"), foreignKey({ columns: [table.customerUserId], foreignColumns: [users.id], name: "appointments_customer_fk" }).onDelete("restrict"), foreignKey({ columns: [table.assigneeUserId], foreignColumns: [users.id], name: "appointments_assignee_fk" }).onDelete("set null")]);

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId"),
  transactionId: int("transactionId"),
  ownerUserId: int("ownerUserId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  fileSizeBytes: int("fileSizeBytes").notNull(),
  documentType: varchar("documentType", { length: 120 }),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "rejected"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("documents_owner_idx").on(table.ownerUserId), index("documents_transaction_idx").on(table.transactionId), foreignKey({ columns: [table.requestId], foreignColumns: [serviceRequests.id], name: "documents_request_fk" }).onDelete("set null"), foreignKey({ columns: [table.transactionId], foreignColumns: [transactions.id], name: "documents_transaction_fk" }).onDelete("set null"), foreignKey({ columns: [table.ownerUserId], foreignColumns: [users.id], name: "documents_owner_fk" }).onDelete("restrict")]);

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientUserId: int("recipientUserId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  data: json("data"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("notifications_recipient_idx").on(table.recipientUserId, table.readAt), foreignKey({ columns: [table.recipientUserId], foreignColumns: [users.id], name: "notifications_recipient_fk" }).onDelete("cascade")]);

export const cloudRecords = mysqlTable("cloud_records", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  recordType: mysqlEnum("recordType", ["transactions", "workspace", "inquiries"]).notNull(),
  payload: json("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("cloud_records_owner_type_unique").on(table.ownerUserId, table.recordType), foreignKey({ columns: [table.ownerUserId], foreignColumns: [users.id], name: "cloud_records_owner_fk" }).onDelete("cascade")]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = typeof serviceRequests.$inferInsert;
export type TransactionRecord = typeof transactions.$inferSelect;
export type InsertTransactionRecord = typeof transactions.$inferInsert;
export type CloudRecord = typeof cloudRecords.$inferSelect;
