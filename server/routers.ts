import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { canAccessCustomerRecord, canManageOperations } from "./authorization";
import * as db from "./db";
import { answerGuidanceQuestion } from "./abu-mishal-assistant";

const beneficiaryTypeSchema = z.enum(["individual", "establishment", "company", "association", "nonprofit", "representative"]);
const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);
const transactionStatusSchema = z.enum(["draft", "received", "under_review", "awaiting_assignment", "assigned", "document_verification", "awaiting_customer_documents", "ready_for_submission", "submitted_to_agency", "under_agency_review", "awaiting_appointment", "beneficiary_attendance_required", "payment_required", "revision_required", "suspended", "overdue", "completed", "rejected", "cancelled", "archived"]);

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
});

export type AppRouter = typeof appRouter;
