import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { canAccessCustomerRecord, canManageOperations, canViewSystemDashboard } from "./authorization";
import * as db from "./db";
import { answerGuidanceQuestion } from "./abu-mishal-assistant";
import { isCloudPayloadWithinLimit } from "./cloud-sync";
import { storagePut } from "./storage";

const beneficiaryTypeSchema = z.enum(["individual", "establishment", "company", "association", "nonprofit", "representative"]);
const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);
const transactionStatusSchema = z.enum(["draft", "received", "under_review", "awaiting_assignment", "assigned", "document_verification", "awaiting_customer_documents", "ready_for_submission", "submitted_to_agency", "under_agency_review", "awaiting_appointment", "beneficiary_attendance_required", "payment_required", "revision_required", "suspended", "overdue", "completed", "rejected", "cancelled", "archived"]);
const cloudRecordTypeSchema = z.enum(["transactions", "workspace", "inquiries"]);
const supportedDocumentMimeTypes = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const;

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
      if (!canManageOperations(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      await db.updateTransactionStatus(input.id, input.status, input.nextAction, input.assigneeUserId);
      return { success: true };
    }),
  }),
  assistant: router({
    ask: protectedProcedure.input(z.object({ question: z.string().trim().min(3).max(1200) })).mutation(async ({ input }) => ({ answer: await answerGuidanceQuestion(input.question) })),
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
  adminDashboard: router({
    overview: protectedProcedure.input(z.object({ status: transactionStatusSchema.optional() })).query(async ({ ctx, input }) => {
      if (!canViewSystemDashboard(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
      return db.getSystemTransactionDashboard(input.status);
    }),
  }),
});

export type AppRouter = typeof appRouter;
