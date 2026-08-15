import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { canAccessCustomerRecord, canManageKnowledge, canManageOperations, canOperateTransactions, canViewAuditLogs, canViewSystemDashboard } from "./authorization";
import * as db from "./db";
import { answerGuidanceQuestion } from "./abu-mishal-assistant";
import { isCloudPayloadWithinLimit } from "./cloud-sync";
import { storagePut } from "./storage";

const beneficiaryTypeSchema = z.enum(["individual", "establishment", "company", "association", "nonprofit", "representative"]);
const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);
const transactionStatusSchema = z.enum(["draft", "received", "under_review", "awaiting_assignment", "assigned", "document_verification", "awaiting_customer_documents", "ready_for_submission", "submitted_to_agency", "under_agency_review", "awaiting_appointment", "beneficiary_attendance_required", "payment_required", "revision_required", "suspended", "overdue", "completed", "rejected", "cancelled", "archived"]);
const cloudRecordTypeSchema = z.enum(["transactions", "workspace", "inquiries"]);
const supportedDocumentMimeTypes = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const;
const supportTicketStatusSchema = z.enum(["open", "in_progress", "awaiting_customer", "resolved", "closed"]);
const knowledgeLanguageSchema = z.enum(["ar", "en"]);

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  requests: router({
    list: protectedProcedure.query(({ ctx }) => db.listServiceRequests(ctx.user.id, ctx.user.role)),
    create: protectedProcedure.input(z.object({
      beneficiaryType: beneficiaryTypeSchema,
      title: z.string().trim().min(3).max(255),
      description: z.string().trim().max(4000).optional(),
      customerPhone: z.string().trim().min(8).max(32).optional(),
      city: z.string().trim().max(120).optional(),
      priority: prioritySchema.default("normal"),
      organizationId: z.number().int().positive().optional(),
      serviceId: z.number().int().positive().optional(),
      desiredDueAt: z.date().optional(),
    })).mutation(({ ctx, input }) => db.createServiceRequest({ ...input, customerUserId: ctx.user.id })),
  }),
  transactions: router({
    list: protectedProcedure.query(({ ctx }) => db.listTransactions(ctx.user.id, ctx.user.role)),
    createForRequest: protectedProcedure.input(z.object({
      requestId: z.number().int().positive(),
      customerUserId: z.number().int().positive(),
      organizationId: z.number().int().positive().optional(),
      entityId: z.number().int().positive().optional(),
      serviceId: z.number().int().positive().optional(),
      referenceNumber: z.string().trim().max(128).optional(),
      priority: prioritySchema.default("normal"),
      dueAt: z.date().optional(),
      nextAction: z.string().trim().max(4000).optional(),
    })).mutation(async ({ ctx, input }) => {
      if (!canManageOperations(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return db.createTransaction({ ...input, status: "received", assigneeUserId: ctx.user.id });
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      status: transactionStatusSchema,
      nextAction: z.string().trim().max(4000).optional(),
      assigneeUserId: z.number().int().positive().optional(),
    })).mutation(async ({ ctx, input }) => {
      const transaction = await db.getTransactionById(input.id);
      if (!transaction || !canAccessCustomerRecord(ctx.user.role, transaction.customerUserId, ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND" });
      if (!canOperateTransactions(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      await db.updateTransactionStatus(input.id, input.status, input.nextAction, input.assigneeUserId);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "transaction.status_updated", resourceType: "transaction", resourceId: input.id, metadata: { status: input.status } });
      return { success: true };
    }),
  }),
  assistant: router({
    ask: protectedProcedure.input(z.object({ question: z.string().trim().min(3).max(1200), language: z.enum(["ar", "en"]).default("ar") })).mutation(async ({ ctx, input }) => {
      const response = await answerGuidanceQuestion(input.question, input.language);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.guidance_question", resourceType: "assistant", metadata: { questionLength: input.question.length, sourceCount: response.sources.length } });
      return response;
    }),
  }),
  cloud: router({
    get: protectedProcedure.input(z.object({ recordType: cloudRecordTypeSchema })).query(async ({ ctx, input }) => {
      const record = await db.getCloudRecord(ctx.user.id, input.recordType);
      return record ? { payload: record.payload, updatedAt: record.updatedAt } : null;
    }),
    put: protectedProcedure.input(z.object({ recordType: cloudRecordTypeSchema, payload: z.unknown() })).mutation(({ ctx, input }) => {
      if (!isCloudPayloadWithinLimit(input.payload)) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Cloud record exceeds the allowed size." });
      return db.upsertCloudRecord(ctx.user.id, input.recordType, input.payload);
    }),
  }),
  documents: router({
    upload: protectedProcedure.input(z.object({
      fileName: z.string().trim().min(1).max(180),
      mimeType: z.enum(supportedDocumentMimeTypes),
      fileSizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
      contentsBase64: z.string().min(1).max(7_200_000),
    })).mutation(async ({ ctx, input }) => {
      const bytes = Buffer.from(input.contentsBase64, "base64");
      if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes.length > input.fileSizeBytes + 2048) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid document payload." });
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { key, url } = await storagePut(`abu-mishal/${ctx.user.id}/documents/${Date.now()}-${safeName}`, bytes, input.mimeType);
      const id = await db.createUploadedDocument({ ownerUserId: ctx.user.id, fileName: input.fileName, storageKey: key, mimeType: input.mimeType, fileSizeBytes: bytes.length });
      return { id, key, url, fileSizeBytes: bytes.length };
    }),
  }),
  tickets: router({
    list: protectedProcedure.query(({ ctx }) => db.listSupportTickets(ctx.user.id, ctx.user.role)),
    detail: protectedProcedure.input(z.object({ ticketId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const ticket = await db.getSupportTicketById(input.ticketId);
      if (!ticket || !canAccessCustomerRecord(ctx.user.role, ticket.customerUserId, ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND" });
      const messages = await db.listTicketMessages(ticket.id, canOperateTransactions(ctx.user.role));
      return { ticket, messages };
    }),
    create: protectedProcedure.input(z.object({ subject: z.string().trim().min(3).max(255), initialMessage: z.string().trim().min(3).max(4000), priority: prioritySchema.default("normal"), transactionId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      if (input.transactionId) {
        const transaction = await db.getTransactionById(input.transactionId);
        if (!transaction || !canAccessCustomerRecord(ctx.user.role, transaction.customerUserId, ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND" });
      }
      const ticket = await db.createSupportTicket({ ...input, customerUserId: ctx.user.id });
      await db.createInAppNotification({ recipientUserId: ctx.user.id, title: "تم استلام تذكرة الدعم", body: "سيتابع فريق أبو مشعل طلبك عبر مركز الدعم.", type: "support_ticket", data: { ticketId: ticket.id } });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "ticket.created", resourceType: "support_ticket", resourceId: ticket.id, metadata: { transactionId: input.transactionId ?? null } });
      return ticket;
    }),
    reply: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), body: z.string().trim().min(1).max(4000), isInternal: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      const ticket = await db.getSupportTicketById(input.ticketId);
      if (!ticket || !canAccessCustomerRecord(ctx.user.role, ticket.customerUserId, ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.isInternal && !canOperateTransactions(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const isOperator = canOperateTransactions(ctx.user.role);
      const message = await db.addTicketMessage({ ...input, authorUserId: ctx.user.id, nextStatus: isOperator ? "awaiting_customer" : "in_progress" });
      if (isOperator && !input.isInternal) await db.createInAppNotification({ recipientUserId: ticket.customerUserId, title: "رد جديد على تذكرة الدعم", body: `وصل رد بخصوص: ${ticket.subject}`, type: "support_ticket", data: { ticketId: ticket.id } });
      if (!isOperator && ticket.assignedUserId) await db.createInAppNotification({ recipientUserId: ticket.assignedUserId, title: "رسالة جديدة من العميل", body: `تذكرة الدعم: ${ticket.subject}`, type: "support_ticket", data: { ticketId: ticket.id } });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: input.isInternal ? "ticket.internal_message_added" : "ticket.message_added", resourceType: "support_ticket", resourceId: ticket.id });
      return message;
    }),
    update: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), status: supportTicketStatusSchema.optional(), priority: prioritySchema.optional(), assignedUserId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
      if (!canOperateTransactions(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const ticket = await db.getSupportTicketById(input.ticketId);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      const { ticketId, ...update } = input;
      const result = await db.updateSupportTicket(ticketId, update);
      if (update.status) await db.createInAppNotification({ recipientUserId: ticket.customerUserId, title: "تم تحديث حالة تذكرة الدعم", body: `التذكرة «${ticket.subject}» أصبحت: ${update.status}`, type: "support_ticket", data: { ticketId } });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "ticket.updated", resourceType: "support_ticket", resourceId: ticketId, metadata: update });
      return result;
    }),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => db.listNotifications(ctx.user.id)),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await db.markNotificationRead(input.notificationId, ctx.user.id);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "notification.read", resourceType: "notification", resourceId: input.notificationId });
      return result;
    }),
  }),
  knowledge: router({
    list: protectedProcedure.input(z.object({ language: knowledgeLanguageSchema.default("ar") })).query(({ input }) => db.listPublishedKnowledge(input.language)),
    createArticle: protectedProcedure.input(z.object({ title: z.string().trim().min(3).max(255), excerpt: z.string().trim().max(1200).optional(), content: z.string().trim().min(10).max(12000), category: z.string().trim().max(120).optional(), language: knowledgeLanguageSchema.default("ar"), sourceLabel: z.string().trim().max(255).optional(), sourceUrl: z.string().url().max(1024).optional() })).mutation(async ({ ctx, input }) => {
      if (!canManageKnowledge(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const result = await db.createKnowledgeArticle({ ...input, createdByUserId: ctx.user.id });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "knowledge.article_created", resourceType: "knowledge_article", resourceId: result.id });
      return result;
    }),
    createFaq: protectedProcedure.input(z.object({ question: z.string().trim().min(3).max(500), answer: z.string().trim().min(3).max(5000), category: z.string().trim().max(120).optional(), language: knowledgeLanguageSchema.default("ar"), sortOrder: z.number().int().min(0).max(9999).optional() })).mutation(async ({ ctx, input }) => {
      if (!canManageKnowledge(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const result = await db.createFaqItem({ ...input, createdByUserId: ctx.user.id });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "knowledge.faq_created", resourceType: "faq", resourceId: result.id });
      return result;
    }),
  }),
  search: router({
    records: protectedProcedure.input(z.object({ term: z.string().trim().min(2).max(120) })).query(async ({ ctx, input }) => {
      const result = await db.searchAccessibleRecords(ctx.user.id, ctx.user.role, input.term);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "search.records", resourceType: "search", metadata: { termLength: input.term.length } });
      return result;
    }),
  }),
  audit: router({
    list: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) })).query(async ({ ctx, input }) => {
      if (!canViewAuditLogs(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return db.listAuditLogs(input.limit);
    }),
  }),
  adminDashboard: router({
    overview: protectedProcedure.input(z.object({ status: transactionStatusSchema.optional(), search: z.string().trim().min(2).max(120).optional() })).query(async ({ ctx, input }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
      const overview = await db.getSystemTransactionDashboard(input.status, input.search);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: input.search ? "admin.dashboard_search" : "admin.dashboard_view", resourceType: "admin_dashboard", metadata: { status: input.status ?? null, searchLength: input.search?.length ?? 0 } });
      return overview;
    }),
  }),
});

export type AppRouter = typeof appRouter;
