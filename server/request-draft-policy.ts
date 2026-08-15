import { z } from "zod";

export const requestDraftPatchSchema = z.object({
  beneficiaryType: z.enum(["individual", "establishment", "company", "association", "nonprofit", "representative"]).optional(),
  serviceName: z.string().trim().min(2).max(180).optional(),
  entityName: z.string().trim().min(2).max(180).optional(),
  title: z.string().trim().min(3).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  city: z.string().trim().max(120).optional(),
  branch: z.string().trim().max(120).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  requestedDate: z.string().trim().max(40).optional(),
  beneficiaryName: z.string().trim().max(160).optional(),
  phoneNumber: z.string().trim().regex(/^(?:\+966|00966|0)?5\d{8}$/).optional(),
  email: z.string().trim().email().max(320).optional(),
  serviceId: z.number().int().positive().optional(),
  entityId: z.number().int().positive().optional(),
  organizationId: z.number().int().positive().nullable().optional(),
}).strict();

export type RequestDraftPatch = z.infer<typeof requestDraftPatchSchema>;

export function mergeRequestDraftData(current: unknown, patch: RequestDraftPatch) {
  const existing = current && typeof current === "object" && !Array.isArray(current) ? current as Record<string, unknown> : {};
  const { serviceId: _serviceId, entityId: _entityId, organizationId: _organizationId, ...structured } = patch;
  return { ...existing, ...structured };
}

export function calculateDraftCompletion(data: Record<string, unknown>) {
  const keys = ["beneficiaryType", "serviceName", "entityName", "title", "description", "beneficiaryName", "phoneNumber"];
  const completed = keys.filter((key) => typeof data[key] === "string" && String(data[key]).trim().length > 0).length;
  return Math.round((completed / keys.length) * 100);
}
