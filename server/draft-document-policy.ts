export const supportedDraftDocumentTypes = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const;

export function canAttachDraftDocument(input: { mimeType: string; fileSizeBytes: number; ownerMatches: boolean }) {
  if (!input.ownerMatches) return { allowed: false, reason: "DOCUMENT_NOT_OWNED" as const };
  if (!supportedDraftDocumentTypes.includes(input.mimeType as (typeof supportedDraftDocumentTypes)[number])) return { allowed: false, reason: "UNSUPPORTED_DOCUMENT_TYPE" as const };
  if (input.fileSizeBytes < 1 || input.fileSizeBytes > 5 * 1024 * 1024) return { allowed: false, reason: "INVALID_DOCUMENT_SIZE" as const };
  return { allowed: true, reason: null } as const;
}
