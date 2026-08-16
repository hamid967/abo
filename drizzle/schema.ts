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

/**
 * قصير العمر لتمرير نتيجة OAuth إلى Expo Go دون وضع رمز جلسة في رابط العودة.
 * لا يستعمل في التطبيقات الأصلية المبنية، ولا يحتفظ إلا برمز تفويض مؤقت.
 */
export const loginSecurityDevices = mysqlTable("login_security_devices", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  deviceFingerprint: varchar("deviceFingerprint", { length: 128 }).notNull(),
  networkFingerprint: varchar("networkFingerprint", { length: 128 }).notNull(),
  platform: varchar("platform", { length: 32 }),
  userAgent: varchar("userAgent", { length: 512 }),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("login_security_device_unique").on(table.userId, table.deviceFingerprint), index("login_security_device_user_idx").on(table.userId), foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "login_security_device_user_fk" }).onDelete("cascade")]);

export const expoGoOAuthAttempts = mysqlTable("expo_go_oauth_attempts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  proofHash: varchar("proofHash", { length: 64 }).notNull(),
  deviceId: varchar("deviceId", { length: 128 }),
  platform: varchar("platform", { length: 32 }),
  callbackState: varchar("callbackState", { length: 2048 }).notNull(),
  authorizationCode: text("authorizationCode"),
  status: mysqlEnum("status", ["pending", "ready", "exchanging", "failed"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("expo_go_oauth_attempts_expiry_idx").on(table.expiresAt)]);

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
  customerPhone: varchar("customerPhone", { length: 32 }),
  city: varchar("city", { length: 120 }),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "under_review", "converted", "cancelled"]).default("draft").notNull(),
  desiredDueAt: timestamp("desiredDueAt"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("service_requests_number_unique").on(table.requestNumber), index("service_requests_customer_idx").on(table.customerUserId), index("service_requests_status_idx").on(table.status), index("service_requests_phone_idx").on(table.customerPhone), foreignKey({ columns: [table.customerUserId], foreignColumns: [users.id], name: "service_requests_customer_fk" }).onDelete("restrict"), foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "service_requests_organization_fk" }).onDelete("set null"), foreignKey({ columns: [table.serviceId], foreignColumns: [governmentServices.id], name: "service_requests_service_fk" }).onDelete("set null")]);

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

export const automationSchedules = mysqlTable("automation_schedules", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 80 }).notNull(),
  heartbeatTaskUid: varchar("heartbeatTaskUid", { length: 65 }),
  enabled: boolean("enabled").default(false).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  lastSuccessAt: timestamp("lastSuccessAt"),
  lastSummary: json("lastSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("automation_schedules_key_unique").on(table.key), index("automation_schedules_task_uid_idx").on(table.heartbeatTaskUid)]);

export const dueNotificationRuns = mysqlTable("due_notification_runs", {
  id: int("id").autoincrement().primaryKey(),
  recipientUserId: int("recipientUserId").notNull(),
  resourceType: varchar("resourceType", { length: 32 }).notNull(),
  resourceId: varchar("resourceId", { length: 120 }).notNull(),
  notifiedForDate: varchar("notifiedForDate", { length: 10 }).notNull(),
  notificationId: int("notificationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("due_notification_runs_unique").on(table.recipientUserId, table.resourceType, table.resourceId, table.notifiedForDate), index("due_notification_runs_date_idx").on(table.notifiedForDate), foreignKey({ columns: [table.recipientUserId], foreignColumns: [users.id], name: "due_notification_runs_recipient_fk" }).onDelete("cascade"), foreignKey({ columns: [table.notificationId], foreignColumns: [notifications.id], name: "due_notification_runs_notification_fk" }).onDelete("set null")]);

export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  customerUserId: int("customerUserId").notNull(),
  transactionId: int("transactionId"),
  assignedUserId: int("assignedUserId"),
  channel: mysqlEnum("channel", ["support", "abu_mishal_chat"]).default("support").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "awaiting_customer", "resolved", "closed"]).default("open").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  closedAt: timestamp("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("support_tickets_customer_idx").on(table.customerUserId, table.updatedAt), index("support_tickets_channel_updated_idx").on(table.channel, table.updatedAt), index("support_tickets_assignee_idx").on(table.assignedUserId, table.status), index("support_tickets_transaction_idx").on(table.transactionId), foreignKey({ columns: [table.customerUserId], foreignColumns: [users.id], name: "support_tickets_customer_fk" }).onDelete("restrict"), foreignKey({ columns: [table.transactionId], foreignColumns: [transactions.id], name: "support_tickets_transaction_fk" }).onDelete("set null"), foreignKey({ columns: [table.assignedUserId], foreignColumns: [users.id], name: "support_tickets_assignee_fk" }).onDelete("set null")]);

export const ticketMessages = mysqlTable("ticket_messages", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  authorUserId: int("authorUserId").notNull(),
  body: text("body").notNull(),
  isInternal: boolean("isInternal").default(false).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("ticket_messages_ticket_idx").on(table.ticketId, table.createdAt), foreignKey({ columns: [table.ticketId], foreignColumns: [supportTickets.id], name: "ticket_messages_ticket_fk" }).onDelete("cascade"), foreignKey({ columns: [table.authorUserId], foreignColumns: [users.id], name: "ticket_messages_author_fk" }).onDelete("restrict")]);

export const knowledgeArticles = mysqlTable("knowledge_articles", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  category: varchar("category", { length: 120 }),
  language: mysqlEnum("language", ["ar", "en"]).default("ar").notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  sourceLabel: varchar("sourceLabel", { length: 255 }),
  sourceUrl: varchar("sourceUrl", { length: 1024 }),
  publishedAt: timestamp("publishedAt"),
  createdByUserId: int("createdByUserId").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("knowledge_articles_status_language_idx").on(table.status, table.language, table.updatedAt), foreignKey({ columns: [table.createdByUserId], foreignColumns: [users.id], name: "knowledge_articles_creator_fk" }).onDelete("restrict")]);

export const faqItems = mysqlTable("faq_items", {
  id: int("id").autoincrement().primaryKey(),
  question: varchar("question", { length: 500 }).notNull(),
  answer: text("answer").notNull(),
  category: varchar("category", { length: 120 }),
  language: mysqlEnum("language", ["ar", "en"]).default("ar").notNull(),
  isPublished: boolean("isPublished").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("faq_items_public_idx").on(table.isPublished, table.language, table.sortOrder), foreignKey({ columns: [table.createdByUserId], foreignColumns: [users.id], name: "faq_items_creator_fk" }).onDelete("restrict")]);

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId"),
  action: varchar("action", { length: 120 }).notNull(),
  resourceType: varchar("resourceType", { length: 120 }).notNull(),
  resourceId: varchar("resourceId", { length: 120 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("audit_logs_actor_idx").on(table.actorUserId, table.createdAt), index("audit_logs_resource_idx").on(table.resourceType, table.resourceId, table.createdAt), foreignKey({ columns: [table.actorUserId], foreignColumns: [users.id], name: "audit_logs_actor_fk" }).onDelete("set null")]);

export const cloudRecords = mysqlTable("cloud_records", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  recordType: mysqlEnum("recordType", ["transactions", "workspace", "inquiries"]).notNull(),
  payload: json("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("cloud_records_owner_type_unique").on(table.ownerUserId, table.recordType), foreignKey({ columns: [table.ownerUserId], foreignColumns: [users.id], name: "cloud_records_owner_fk" }).onDelete("cascade")]);

export const requestDrafts = mysqlTable("request_drafts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  organizationId: int("organizationId"),
  serviceId: int("serviceId"),
  entityId: int("entityId"),
  submittedRequestId: int("submittedRequestId"),
  beneficiaryType: mysqlEnum("beneficiaryType", ["individual", "establishment", "company", "association", "nonprofit", "representative"]),
  structuredData: json("structuredData").notNull(),
  completionPercentage: int("completionPercentage").default(0).notNull(),
  validationStatus: mysqlEnum("validationStatus", ["pending", "errors", "warnings", "passed"]).default("pending").notNull(),
  status: mysqlEnum("status", ["draft", "reviewing", "awaiting_confirmation", "submitting", "submitted", "needs_human_review", "cancelled", "expired"]).default("draft").notNull(),
  summaryVersion: int("summaryVersion").default(0).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull(),
  expiresAt: timestamp("expiresAt"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("request_drafts_owner_idempotency_unique").on(table.ownerUserId, table.idempotencyKey), index("request_drafts_owner_status_idx").on(table.ownerUserId, table.status, table.updatedAt), foreignKey({ columns: [table.ownerUserId], foreignColumns: [users.id], name: "request_drafts_owner_fk" }).onDelete("cascade"), foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "request_drafts_organization_fk" }).onDelete("set null"), foreignKey({ columns: [table.serviceId], foreignColumns: [governmentServices.id], name: "request_drafts_service_fk" }).onDelete("set null"), foreignKey({ columns: [table.entityId], foreignColumns: [governmentEntities.id], name: "request_drafts_entity_fk" }).onDelete("set null"), foreignKey({ columns: [table.submittedRequestId], foreignColumns: [serviceRequests.id], name: "request_drafts_submitted_request_fk" }).onDelete("set null")]);

export const aiConversations = mysqlTable("ai_conversations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  draftId: varchar("draftId", { length: 36 }),
  status: mysqlEnum("status", ["active", "paused", "submitted", "needs_human_review", "cancelled", "expired"]).default("active").notNull(),
  currentState: mysqlEnum("currentState", ["started", "identifying_intent", "selecting_beneficiary", "selecting_service", "selecting_entity", "collecting_information", "collecting_documents", "validating_information", "reviewing_summary", "awaiting_confirmation", "submitting", "submitted", "needs_human_review", "cancelled", "expired"]).default("started").notNull(),
  detectedIntent: varchar("detectedIntent", { length: 64 }),
  language: mysqlEnum("language", ["ar", "en"]).default("ar").notNull(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("ai_conversations_owner_activity_idx").on(table.ownerUserId, table.lastActivityAt), index("ai_conversations_draft_idx").on(table.draftId), foreignKey({ columns: [table.ownerUserId], foreignColumns: [users.id], name: "ai_conversations_owner_fk" }).onDelete("cascade"), foreignKey({ columns: [table.draftId], foreignColumns: [requestDrafts.id], name: "ai_conversations_draft_fk" }).onDelete("set null")]);

export const aiMessages = mysqlTable("ai_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  conversationId: varchar("conversationId", { length: 36 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant", "tool"]).notNull(),
  content: text("content").notNull(),
  toolName: varchar("toolName", { length: 120 }),
  toolCallId: varchar("toolCallId", { length: 96 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("ai_messages_conversation_created_idx").on(table.conversationId, table.createdAt), foreignKey({ columns: [table.conversationId], foreignColumns: [aiConversations.id], name: "ai_messages_conversation_fk" }).onDelete("cascade")]);

export const requestDraftDocuments = mysqlTable("request_draft_documents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  draftId: varchar("draftId", { length: 36 }).notNull(),
  documentId: int("documentId").notNull(),
  requirementKey: varchar("requirementKey", { length: 120 }),
  classificationStatus: mysqlEnum("classificationStatus", ["pending", "confirmed", "unclear", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("request_draft_documents_unique").on(table.draftId, table.documentId), index("request_draft_documents_document_idx").on(table.documentId), foreignKey({ columns: [table.draftId], foreignColumns: [requestDrafts.id], name: "request_draft_documents_draft_fk" }).onDelete("cascade"), foreignKey({ columns: [table.documentId], foreignColumns: [documents.id], name: "request_draft_documents_document_fk" }).onDelete("cascade")]);

export const userConsents = mysqlTable("user_consents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  draftId: varchar("draftId", { length: 36 }).notNull(),
  consentType: mysqlEnum("consentType", ["terms", "privacy", "request_submission"]).notNull(),
  policyVersion: varchar("policyVersion", { length: 64 }).notNull(),
  summaryVersion: int("summaryVersion").notNull(),
  consentTextHash: varchar("consentTextHash", { length: 128 }).notNull(),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
}, (table) => [index("user_consents_owner_draft_idx").on(table.ownerUserId, table.draftId, table.consentType), foreignKey({ columns: [table.ownerUserId], foreignColumns: [users.id], name: "user_consents_owner_fk" }).onDelete("cascade"), foreignKey({ columns: [table.draftId], foreignColumns: [requestDrafts.id], name: "user_consents_draft_fk" }).onDelete("cascade")]);

export const handoffRequests = mysqlTable("handoff_requests", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  conversationId: varchar("conversationId", { length: 36 }).notNull(),
  draftId: varchar("draftId", { length: 36 }),
  ticketId: int("ticketId"),
  assignedToUserId: int("assignedToUserId"),
  reason: varchar("reason", { length: 255 }).notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  status: mysqlEnum("status", ["pending", "assigned", "resolved", "cancelled"]).default("pending").notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("handoff_requests_owner_status_idx").on(table.ownerUserId, table.status), index("handoff_requests_assignee_status_idx").on(table.assignedToUserId, table.status), foreignKey({ columns: [table.ownerUserId], foreignColumns: [users.id], name: "handoff_requests_owner_fk" }).onDelete("cascade"), foreignKey({ columns: [table.conversationId], foreignColumns: [aiConversations.id], name: "handoff_requests_conversation_fk" }).onDelete("cascade"), foreignKey({ columns: [table.draftId], foreignColumns: [requestDrafts.id], name: "handoff_requests_draft_fk" }).onDelete("set null"), foreignKey({ columns: [table.ticketId], foreignColumns: [supportTickets.id], name: "handoff_requests_ticket_fk" }).onDelete("set null"), foreignKey({ columns: [table.assignedToUserId], foreignColumns: [users.id], name: "handoff_requests_assignee_fk" }).onDelete("set null")]);

export const automationEvents = mysqlTable("automation_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventName: varchar("eventName", { length: 96 }).notNull(),
  aggregateType: varchar("aggregateType", { length: 64 }).notNull(),
  aggregateId: varchar("aggregateId", { length: 96 }).notNull(),
  ownerUserId: int("ownerUserId"),
  payload: json("payload").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("automation_events_idempotency_unique").on(table.idempotencyKey), index("automation_events_name_occurred_idx").on(table.eventName, table.occurredAt), index("automation_events_owner_occurred_idx").on(table.ownerUserId, table.occurredAt), foreignKey({ columns: [table.ownerUserId], foreignColumns: [users.id], name: "automation_events_owner_fk" }).onDelete("set null")]);

export const automationRules = mysqlTable("automation_rules", {
  id: varchar("id", { length: 36 }).primaryKey(),
  key: varchar("key", { length: 96 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  triggerEvent: varchar("triggerEvent", { length: 96 }).notNull(),
  conditions: json("conditions").notNull(),
  actions: json("actions").notNull(),
  priority: int("priority").default(100).notNull(),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("automation_rules_key_unique").on(table.key), index("automation_rules_trigger_enabled_idx").on(table.triggerEvent, table.enabled, table.priority), foreignKey({ columns: [table.createdByUserId], foreignColumns: [users.id], name: "automation_rules_creator_fk" }).onDelete("set null")]);

export const automationRuns = mysqlTable("automation_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ruleId: varchar("ruleId", { length: 36 }).notNull(),
  eventId: varchar("eventId", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "succeeded", "failed", "skipped"]).default("pending").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull(),
  result: json("result"),
  errorCode: varchar("errorCode", { length: 96 }),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("automation_runs_idempotency_unique").on(table.idempotencyKey), index("automation_runs_rule_status_idx").on(table.ruleId, table.status, table.createdAt), index("automation_runs_event_idx").on(table.eventId), foreignKey({ columns: [table.ruleId], foreignColumns: [automationRules.id], name: "automation_runs_rule_fk" }).onDelete("cascade"), foreignKey({ columns: [table.eventId], foreignColumns: [automationEvents.id], name: "automation_runs_event_fk" }).onDelete("cascade")]);

export const notificationPreferences = mysqlTable("notification_preferences", {
  userId: int("userId").primaryKey(),
  inAppEnabled: boolean("inAppEnabled").default(true).notNull(),
  digestFrequency: mysqlEnum("digestFrequency", ["immediate", "daily"]).default("immediate").notNull(),
  quietHoursEnabled: boolean("quietHoursEnabled").default(false).notNull(),
  quietStartHour: int("quietStartHour"),
  quietEndHour: int("quietEndHour"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "notification_preferences_user_fk" }).onDelete("cascade")]);

export const notificationDeliveryLogs = mysqlTable("notification_delivery_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  notificationId: int("notificationId").notNull(),
  channel: mysqlEnum("channel", ["in_app"]).default("in_app").notNull(),
  status: mysqlEnum("status", ["queued", "delivered", "suppressed", "failed"]).default("queued").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull(),
  details: json("details"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("notification_delivery_logs_idempotency_unique").on(table.idempotencyKey), index("notification_delivery_logs_notification_idx").on(table.notificationId, table.createdAt), foreignKey({ columns: [table.notificationId], foreignColumns: [notifications.id], name: "notification_delivery_logs_notification_fk" }).onDelete("cascade")]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = typeof serviceRequests.$inferInsert;
export type TransactionRecord = typeof transactions.$inferSelect;
export type InsertTransactionRecord = typeof transactions.$inferInsert;
export type CloudRecord = typeof cloudRecords.$inferSelect;
