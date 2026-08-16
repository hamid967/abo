import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { canAccessCustomerRecord, canManageKnowledge, canManageOperations, canOperateTransactions, canViewAuditLogs, canViewSystemDashboard } from "./authorization";
import * as db from "./db";
import { answerGuidanceQuestion, guideRequestIntake, requestIntakeStageSchema } from "./abu-mishal-assistant";
import { detectRequestIntent, draftPatchFromDetection } from "./intent-detection";
import { requestDraftPatchSchema } from "./request-draft-policy";
import { isCloudPayloadWithinLimit } from "./cloud-sync";
import { storageGetSignedUrl, storagePut } from "./storage";
import { emitAndProcessAutomationEvent, previewAutomationRule } from "./automation-engine";
import { defaultAutomationRules } from "./default-automation-rules";
import { validateQuietHours } from "./notification-preferences-policy";
import { checkAssistantRateLimit } from "./assistant-rate-limit";
import { summarizeDocumentText } from "./document-summary";

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
    })).mutation(async ({ ctx, input }) => {
      if (input.organizationId && !await db.canUseOrganization(ctx.user.id, input.organizationId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ORGANIZATION_ACCESS_DENIED" });
      }
      return db.createServiceRequest({ ...input, customerUserId: ctx.user.id });
    }),
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
      await emitAndProcessAutomationEvent({ eventName: "transaction.status_changed", aggregateType: "transaction", aggregateId: String(input.id), ownerUserId: transaction.customerUserId, payload: { transactionId: input.id, status: input.status, automationOrigin: false }, idempotencyKey: `transaction-status:${input.id}:${input.status}:${Date.now()}` });
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
    intakeGuide: protectedProcedure.input(z.object({
      message: z.string().trim().min(1).max(1200),
      stage: requestIntakeStageSchema,
      language: z.enum(["ar", "en"]).default("ar"),
      context: z.object({
        serviceType: z.string().trim().max(180).optional(),
        agency: z.string().trim().max(180).optional(),
        title: z.string().trim().max(255).optional(),
        description: z.string().trim().max(1000).optional(),
      }),
    })).mutation(async ({ ctx, input }) => {
      const response = await guideRequestIntake(input);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.request_intake_guidance", resourceType: "assistant", metadata: { stage: input.stage, messageLength: input.message.length } });
      return response;
    }),
  }),
  documentSummary: router({
    analyze: protectedProcedure.input(z.object({
      title: z.string().trim().min(2).max(180).optional(),
      text: z.string().trim().min(200).max(18_000),
      language: z.enum(["ar", "en"]).default("ar"),
      consentToProcess: z.literal(true),
    })).mutation(async ({ ctx, input }) => {
      const allowance = checkAssistantRateLimit({ userId: ctx.user.id, action: "document_summary" });
      if (!allowance.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "DOCUMENT_SUMMARY_RATE_LIMITED" });
      try {
        const summary = await summarizeDocumentText({ text: input.text, language: input.language });
        await db.createAuditLog({ actorUserId: ctx.user.id, action: "document_summary.analyzed", resourceType: "document_summary", metadata: { title: input.title ?? null, textLength: input.text.length, language: input.language } });
        return summary;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DOCUMENT_SUMMARY_UNAVAILABLE" });
      }
    }),
  }),
  executiveAssistant: router({
    start: protectedProcedure.input(z.object({ language: z.enum(["ar", "en"]).default("ar"), idempotencyKey: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const allowance = checkAssistantRateLimit({ userId: ctx.user.id, action: "start" });
      if (!allowance.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "ASSISTANT_RATE_LIMITED" });
      const session = await db.createRequestConversation({ ownerUserId: ctx.user.id, language: input.language, idempotencyKey: input.idempotencyKey });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.conversation_started", resourceType: "ai_conversation", resourceId: session.conversation?.id, metadata: { reused: session.reused } });
      return session;
    }),
    detail: protectedProcedure.input(z.object({ conversationId: z.string().uuid() })).query(async ({ ctx, input }) => {
      const session = await db.getRequestConversation(ctx.user.id, input.conversationId);
      if (!session?.conversation) throw new TRPCError({ code: "NOT_FOUND" });
      const messages = await db.listConversationMessages(ctx.user.id, input.conversationId);
      return { ...session, messages };
    }),
    listDrafts: protectedProcedure.query(({ ctx }) => db.listActiveRequestDrafts(ctx.user.id)),
    updateDraft: protectedProcedure.input(z.object({ conversationId: z.string().uuid(), patch: requestDraftPatchSchema })).mutation(async ({ ctx, input }) => {
      if (input.patch.organizationId && !await db.canUseOrganization(ctx.user.id, input.patch.organizationId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ORGANIZATION_ACCESS_DENIED" });
      }
      const session = await db.updateRequestDraftFields({ ownerUserId: ctx.user.id, conversationId: input.conversationId, patch: input.patch });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.draft_updated", resourceType: "request_draft", resourceId: session?.draft?.id, metadata: { fields: Object.keys(input.patch) } });
      return session;
    }),
    validateDraft: protectedProcedure.input(z.object({ conversationId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const result = await db.validateRequestDraft(ctx.user.id, input.conversationId);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.draft_validated", resourceType: "ai_conversation", resourceId: input.conversationId, metadata: { validationStatus: result.validationStatus, resultCount: result.results.length } });
      return result;
    }),
    transition: protectedProcedure.input(z.object({ conversationId: z.string().uuid(), nextState: z.enum(["identifying_intent", "selecting_beneficiary", "selecting_service", "selecting_entity", "collecting_information", "collecting_documents", "validating_information", "reviewing_summary", "awaiting_confirmation", "needs_human_review", "cancelled"]) })).mutation(async ({ ctx, input }) => {
      try {
        return await db.moveConversationState(ctx.user.id, input.conversationId, input.nextState);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("INVALID_CONVERSATION_TRANSITION")) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid conversation state transition." });
        throw error;
      }
    }),
    prepareReview: protectedProcedure.input(z.object({ conversationId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const result = await db.prepareDraftReview(ctx.user.id, input.conversationId);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.review_prepared", resourceType: "request_draft", resourceId: result?.draft?.id, metadata: { summaryVersion: result?.draft?.summaryVersion } });
      return result;
    }),
    recordConsent: protectedProcedure.input(z.object({ conversationId: z.string().uuid(), consentType: z.enum(["terms", "privacy", "request_submission"]) })).mutation(async ({ ctx, input }) => {
      const result = await db.recordDraftConsent({ ownerUserId: ctx.user.id, ...input });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.consent_recorded", resourceType: "ai_conversation", resourceId: input.conversationId, metadata: { consentType: input.consentType, summaryVersion: result.summaryVersion } });
      return result;
    }),
    submitDraft: protectedProcedure.input(z.object({ conversationId: z.string().uuid(), language: z.enum(["ar", "en"]).default("ar") })).mutation(async ({ ctx, input }) => {
      try {
        const result = await db.submitRequestDraft(ctx.user.id, input.conversationId, input.language);
        if (!result.alreadySubmitted && result.transactionId) await emitAndProcessAutomationEvent({ eventName: "request.created", aggregateType: "service_request", aggregateId: String(result.requestId), ownerUserId: ctx.user.id, payload: { requestId: result.requestId, transactionId: result.transactionId, automationOrigin: false }, idempotencyKey: `request-created:${result.requestId}` });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "SUBMISSION_FAILED";
        if (["EXPLICIT_CONSENT_REQUIRED", "SUBMISSION_IN_PROGRESS", "DRAFT_NOT_FOUND"].includes(message)) throw new TRPCError({ code: "BAD_REQUEST", message });
        throw error;
      }
    }),
    listDraftDocuments: protectedProcedure.input(z.object({ conversationId: z.string().uuid() })).query(({ ctx, input }) => db.listDraftDocuments(ctx.user.id, input.conversationId)),
    attachDocument: protectedProcedure.input(z.object({ conversationId: z.string().uuid(), documentId: z.number().int().positive(), requirementKey: z.string().trim().max(120).optional() })).mutation(async ({ ctx, input }) => {
      const result = await db.attachDocumentToDraft({ ownerUserId: ctx.user.id, ...input });
      await emitAndProcessAutomationEvent({ eventName: "draft.document_attached", aggregateType: "ai_conversation", aggregateId: input.conversationId, ownerUserId: ctx.user.id, payload: { documentId: input.documentId, automationOrigin: false }, idempotencyKey: `draft-document:${input.conversationId}:${input.documentId}` });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.draft_document_attached", resourceType: "ai_conversation", resourceId: input.conversationId, metadata: { documentId: input.documentId } });
      return result;
    }),
    removeDocument: protectedProcedure.input(z.object({ conversationId: z.string().uuid(), documentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await db.removeDocumentFromDraft({ ownerUserId: ctx.user.id, ...input });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.draft_document_removed", resourceType: "ai_conversation", resourceId: input.conversationId, metadata: { documentId: input.documentId } });
      return result;
    }),
    cancelDraft: protectedProcedure.input(z.object({ conversationId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const result = await db.cancelRequestConversation(ctx.user.id, input.conversationId);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.draft_cancelled", resourceType: "ai_conversation", resourceId: input.conversationId });
      return result;
    }),
    deleteConversationData: protectedProcedure.input(z.object({ conversationId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const result = await db.deleteAssistantConversationContent(ctx.user.id, input.conversationId);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.conversation_content_deleted", resourceType: "ai_conversation", resourceId: input.conversationId, metadata: { submittedRequestPreserved: result.submittedRequestPreserved } });
      return result;
    }),
    requestHumanHandoff: protectedProcedure.input(z.object({ conversationId: z.string().uuid(), reason: z.string().trim().min(3).max(255), language: z.enum(["ar", "en"]).default("ar") })).mutation(async ({ ctx, input }) => {
      const result = await db.requestHumanHandoff({ ownerUserId: ctx.user.id, ...input });
      if (!result.reused) await emitAndProcessAutomationEvent({ eventName: "conversation.handoff_requested", aggregateType: "ai_conversation", aggregateId: input.conversationId, ownerUserId: ctx.user.id, payload: { handoffId: result.handoffId, ticketId: result.ticketId, automationOrigin: false }, idempotencyKey: `handoff-requested:${result.handoffId}` });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.human_handoff_requested", resourceType: "ai_conversation", resourceId: input.conversationId, metadata: { handoffId: result.handoffId, ticketId: result.ticketId, reused: result.reused } });
      return result;
    }),
    sendMessage: protectedProcedure.input(z.object({ conversationId: z.string().uuid(), message: z.string().trim().min(1).max(4000), language: z.enum(["ar", "en"]).default("ar") })).mutation(async ({ ctx, input }) => {
      const allowance = checkAssistantRateLimit({ userId: ctx.user.id, action: "message" });
      if (!allowance.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "ASSISTANT_RATE_LIMITED" });
      const session = await db.getRequestConversation(ctx.user.id, input.conversationId);
      if (!session?.conversation) throw new TRPCError({ code: "NOT_FOUND" });
      try {
        const detection = await detectRequestIntent({ message: input.message, language: input.language });
        await db.appendConversationMessage({ ownerUserId: ctx.user.id, conversationId: input.conversationId, role: "user", content: input.message, metadata: { intent: detection.intent, confidence: detection.confidence } });
        const draftPatch = draftPatchFromDetection(detection);
        const updatedSession = Object.keys(draftPatch).length ? await db.updateRequestDraftFields({ ownerUserId: ctx.user.id, conversationId: input.conversationId, patch: draftPatch }) : session;
        if (session.conversation.currentState === "started") await db.saveConversationProgress({ ownerUserId: ctx.user.id, conversationId: input.conversationId, nextState: "identifying_intent" });
        const reply = input.language === "ar"
          ? (detection.requiresHumanReview ? "شكرًا، سيتولى فريق المتابعة مراجعة هذا الطلب معك. لن ننفذ أي إجراء حساس عبر المحادثة." : "أبشر، سجلت التفاصيل الأولية. سأكمل معك سؤالاً واحداً في كل مرة قبل عرض الملخص للمراجعة.")
          : (detection.requiresHumanReview ? "Thank you. The support team will review this with you; no sensitive action will be completed in chat." : "I recorded the initial details. I will continue with one main question at a time before showing a review summary.");
        await db.appendConversationMessage({ ownerUserId: ctx.user.id, conversationId: input.conversationId, role: "assistant", content: reply, metadata: { intent: detection.intent } });
        await db.createAuditLog({ actorUserId: ctx.user.id, action: "assistant.intent_detected", resourceType: "ai_conversation", resourceId: input.conversationId, metadata: { intent: detection.intent, confidence: detection.confidence, humanReview: detection.requiresHumanReview } });
        return { detection, reply, draft: updatedSession?.draft ?? null };
      } catch (error) {
        const message = error instanceof Error ? error.message : "INVALID_MESSAGE";
        if (message === "SENSITIVE_CONVERSATION_CONTENT" || message === "INVALID_CHAT_MESSAGE") throw new TRPCError({ code: "BAD_REQUEST", message: "Sensitive or invalid message content." });
        throw error;
      }
    }),
  }),
  taskTracking: router({
    list: protectedProcedure.query(({ ctx }) => db.listTaskTrackingForUser(ctx.user.id)),
    updateStatus: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), status: z.enum(["new", "in_progress", "awaiting_customer", "awaiting_external", "completed", "cancelled"]) })).mutation(async ({ ctx, input }) => {
      const updated = await db.updateTrackedTaskStatus({ userId: ctx.user.id, ...input });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "task.status_updated", resourceType: "task", resourceId: input.taskId, metadata: { status: input.status } });
      return { success: true } as const;
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
    list: protectedProcedure.query(({ ctx }) => db.listOwnedDocuments(ctx.user.id)),
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
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "document.uploaded", resourceType: "document", resourceId: id, metadata: { mimeType: input.mimeType, fileSizeBytes: bytes.length } });
      return { id, key, url, fileSizeBytes: bytes.length };
    }),
    downloadUrl: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const document = await db.getOwnedDocumentForAccess(ctx.user.id, input.documentId);
      if (!document) throw new TRPCError({ code: "NOT_FOUND" });
      const url = await storageGetSignedUrl(document.storageKey);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "document.download_link_requested", resourceType: "document", resourceId: input.documentId });
      return { url, fileName: document.fileName };
    }),
    delete: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await db.softDeleteOwnedDocument(ctx.user.id, input.documentId);
        await db.createAuditLog({ actorUserId: ctx.user.id, action: "document.soft_deleted", resourceType: "document", resourceId: input.documentId });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "DOCUMENT_DELETE_FAILED";
        if (["DOCUMENT_NOT_FOUND", "DOCUMENT_LINKED_TO_RECORD"].includes(message)) throw new TRPCError({ code: "BAD_REQUEST", message });
        throw error;
      }
    }),
  }),
  playbooks: router({
    activeForService: protectedProcedure.input(z.object({ serviceId: z.number().int().positive() })).query(async ({ input }) => db.getPublishedPlaybookForService(input.serviceId)),
    services: protectedProcedure.query(async ({ ctx }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return db.listActiveServicesForPlaybooks();
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const result = await db.listPlaybooksForAdmin();
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "playbook.list_viewed", resourceType: "playbook" });
      return result;
    }),
    detail: protectedProcedure.input(z.object({ playbookId: z.string().uuid(), versionId: z.string().uuid() })).query(async ({ ctx, input }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const result = await db.getPlaybookVersionDetails(input.playbookId, input.versionId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND" });
      return result;
    }),
    create: protectedProcedure.input(z.object({ serviceId: z.number().int().positive(), name: z.string().trim().min(3).max(255) })).mutation(async ({ ctx, input }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      try {
        const result = await db.createServicePlaybook({ ...input, createdByUserId: ctx.user.id });
        await db.createAuditLog({ actorUserId: ctx.user.id, action: "playbook.created", resourceType: "playbook", resourceId: result.id, metadata: { serviceId: input.serviceId } });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "PLAYBOOK_CREATE_FAILED";
        if (["SERVICE_NOT_FOUND", "ACTIVE_PLAYBOOK_ALREADY_EXISTS"].includes(message)) throw new TRPCError({ code: "BAD_REQUEST", message });
        throw error;
      }
    }),
    createVersion: protectedProcedure.input(z.object({ playbookId: z.string().uuid(), title: z.string().trim().min(3).max(255), description: z.string().trim().max(3000).optional(), requirements: z.array(z.string().trim().min(1).max(500)).max(30).optional(), exceptions: z.array(z.string().trim().min(1).max(500)).max(20).optional(), steps: z.array(z.object({ stepKey: z.string().trim().regex(/^[a-z][a-z0-9_]{1,78}$/), title: z.string().trim().min(2).max(255), instructions: z.string().trim().max(2000).optional(), actionType: z.enum(["instruction", "document", "approval", "task"]), assignmentRule: z.enum(["transaction_assignee", "least_loaded_staff", "request_owner", "unassigned"]).optional(), isRequired: z.boolean(), expectedDurationMinutes: z.number().int().min(1).max(43_200).optional(), slaMinutes: z.number().int().min(15).max(43_200).optional() })).min(1).max(40) })).mutation(async ({ ctx, input }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const result = await db.createPlaybookVersion({ ...input, createdByUserId: ctx.user.id });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "playbook.version_created", resourceType: "playbook_version", resourceId: result.id, metadata: { playbookId: input.playbookId, versionNumber: result.versionNumber, stepCount: input.steps.length } });
      return result;
    }),
    publish: protectedProcedure.input(z.object({ playbookId: z.string().uuid(), versionId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      try {
        const result = await db.publishPlaybookVersion({ ...input, publishedByUserId: ctx.user.id });
        await db.createAuditLog({ actorUserId: ctx.user.id, action: "playbook.version_published", resourceType: "playbook_version", resourceId: input.versionId, metadata: { playbookId: input.playbookId } });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "PLAYBOOK_PUBLISH_FAILED";
        if (["PLAYBOOK_VERSION_NOT_FOUND", "ARCHIVED_VERSION_CANNOT_BE_PUBLISHED", "PLAYBOOK_STEPS_REQUIRED"].includes(message)) throw new TRPCError({ code: "BAD_REQUEST", message });
        throw error;
      }
    }),
    archive: protectedProcedure.input(z.object({ playbookId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const result = await db.archiveServicePlaybook(input.playbookId);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "playbook.archived", resourceType: "playbook", resourceId: input.playbookId });
      return result;
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
  abuMishalChat: router({
    mine: protectedProcedure.query(async ({ ctx }) => {
      if (canViewSystemDashboard(ctx.user.role)) return null;
      return db.getCustomerAbuMishalChat(ctx.user.id);
    }),
    detail: protectedProcedure.input(z.object({ ticketId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const ticket = await db.getSupportTicketById(input.ticketId);
      const isAdmin = canViewSystemDashboard(ctx.user.role);
      if (!ticket || ticket.channel !== "abu_mishal_chat" || (!isAdmin && ticket.customerUserId !== ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND" });
      const messages = await db.listTicketMessages(ticket.id, false);
      return { ticket, messages, isAdmin };
    }),
    adminInbox: protectedProcedure.query(async ({ ctx }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return db.listAbuMishalChatThreads();
    }),
    send: protectedProcedure.input(z.object({ ticketId: z.number().int().positive().optional(), body: z.string().trim().min(1).max(4000) })).mutation(async ({ ctx, input }) => {
      const isAdmin = canViewSystemDashboard(ctx.user.role);
      let ticket = input.ticketId ? await db.getSupportTicketById(input.ticketId) : undefined;
      if (isAdmin) {
        if (!ticket || ticket.channel !== "abu_mishal_chat") throw new TRPCError({ code: "NOT_FOUND" });
        const message = await db.addTicketMessage({ ticketId: ticket.id, authorUserId: ctx.user.id, body: input.body, isInternal: false, nextStatus: "awaiting_customer" });
        await db.createInAppNotification({ recipientUserId: ticket.customerUserId, title: "رد جديد من أبو مشعل", body: "وصلك رد جديد في محادثتك مع أبو مشعل.", type: "abu_mishal_chat", data: { ticketId: ticket.id } });
        await db.createAuditLog({ actorUserId: ctx.user.id, action: "abu_mishal_chat.admin_message_sent", resourceType: "support_ticket", resourceId: ticket.id });
        return { ...message, ticketId: ticket.id };
      }
      if (ticket && (ticket.channel !== "abu_mishal_chat" || ticket.customerUserId !== ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND" });
      ticket = ticket ?? await db.createCustomerAbuMishalChat(ctx.user.id);
      if (!ticket) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر بدء المحادثة حالياً." });
      const message = await db.addTicketMessage({ ticketId: ticket.id, authorUserId: ctx.user.id, body: input.body, isInternal: false, nextStatus: "in_progress" });
      const admins = await db.listAdminNotificationRecipients();
      await Promise.all(admins.map((admin) => db.createInAppNotification({ recipientUserId: admin.id, title: "رسالة جديدة إلى أبو مشعل", body: "وصلت رسالة جديدة من أحد العملاء في صندوق المحادثات.", type: "abu_mishal_chat", data: { ticketId: ticket!.id } })));
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "abu_mishal_chat.customer_message_sent", resourceType: "support_ticket", resourceId: ticket.id });
      return { ...message, ticketId: ticket.id };
    }),
    markRead: protectedProcedure.input(z.object({ ticketId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const ticket = await db.getSupportTicketById(input.ticketId);
      const isAdmin = canViewSystemDashboard(ctx.user.role);
      if (!ticket || ticket.channel !== "abu_mishal_chat" || (!isAdmin && ticket.customerUserId !== ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND" });
      return db.markAbuMishalChatRead({ ticketId: ticket.id, viewerUserId: ctx.user.id, customerUserId: ticket.customerUserId, adminViewer: isAdmin });
    }),
    updateStatus: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), status: supportTicketStatusSchema })).mutation(async ({ ctx, input }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const ticket = await db.getSupportTicketById(input.ticketId);
      if (!ticket || ticket.channel !== "abu_mishal_chat") throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateSupportTicket(ticket.id, { status: input.status });
      await db.createInAppNotification({ recipientUserId: ticket.customerUserId, title: "تحديث على محادثة أبو مشعل", body: "تم تحديث حالة محادثتك مع أبو مشعل.", type: "abu_mishal_chat", data: { ticketId: ticket.id } });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "abu_mishal_chat.status_updated", resourceType: "support_ticket", resourceId: ticket.id, metadata: { status: input.status } });
      return { success: true } as const;
    }),
  }),
  security: router({
    loginActivity: protectedProcedure.query(async ({ ctx }) => {
      const result = await db.listLoginActivity(ctx.user.id);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "auth.login_activity_viewed", resourceType: "login_security" });
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
  notificationPreferences: router({
    get: protectedProcedure.query(({ ctx }) => db.getNotificationPreferences(ctx.user.id)),
    update: protectedProcedure.input(z.object({ inAppEnabled: z.boolean(), digestFrequency: z.enum(["immediate", "daily"]), quietHoursEnabled: z.boolean(), quietStartHour: z.number().int().min(0).max(23).nullable().optional(), quietEndHour: z.number().int().min(0).max(23).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const quiet = validateQuietHours({ enabled: input.quietHoursEnabled, start: input.quietStartHour, end: input.quietEndHour });
      if (!quiet.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid quiet hours" });
      const result = await db.updateNotificationPreferences({ userId: ctx.user.id, ...input, quietStartHour: quiet.start, quietEndHour: quiet.end });
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "notification.preferences_updated", resourceType: "notification_preferences", resourceId: ctx.user.id });
      return result;
    }),
    deliveryLog: protectedProcedure.query(({ ctx }) => db.listNotificationDeliveryLogs(ctx.user.id)),
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
  automationOps: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      await db.seedDefaultAutomationRules(defaultAutomationRules);
      const result = await db.getAutomationOperationsDashboard();
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "automation.dashboard_view", resourceType: "automation_dashboard" });
      return result;
    }),
    setRuleEnabled: protectedProcedure.input(z.object({ ruleId: z.string().uuid(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const result = await db.setAutomationRuleEnabled(input.ruleId, input.enabled);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "automation.rule_toggled", resourceType: "automation_rule", resourceId: input.ruleId, metadata: { enabled: input.enabled } });
      return result;
    }),
    previewRule: protectedProcedure.input(z.object({
      ruleId: z.string().uuid(),
      payload: z.record(z.string().trim().min(1).max(80), z.union([z.string().max(200), z.number().finite(), z.boolean(), z.null()])).refine((value) => Object.keys(value).length <= 20, "Too many preview fields"),
    })).mutation(async ({ ctx, input }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const rule = await db.getAutomationRuleById(input.ruleId);
      if (!rule) throw new TRPCError({ code: "NOT_FOUND" });
      const preview = previewAutomationRule(rule, input.payload);
      await db.createAuditLog({ actorUserId: ctx.user.id, action: "automation.rule_previewed", resourceType: "automation_rule", resourceId: input.ruleId, metadata: { matched: preview.matched, payloadKeys: Object.keys(input.payload) } });
      return preview;
    }),
  }),
});

export type AppRouter = typeof appRouter;
