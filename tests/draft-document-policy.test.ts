import { describe, expect, it } from "vitest";
import { canAttachDraftDocument } from "../server/draft-document-policy";

describe("draft document policy", () => {
  it("accepts only owned supported files within the size cap", () => {
    expect(canAttachDraftDocument({ ownerMatches: true, mimeType: "application/pdf", fileSizeBytes: 100 })).toEqual({ allowed: true, reason: null });
    expect(canAttachDraftDocument({ ownerMatches: false, mimeType: "application/pdf", fileSizeBytes: 100 }).reason).toBe("DOCUMENT_NOT_OWNED");
    expect(canAttachDraftDocument({ ownerMatches: true, mimeType: "text/plain", fileSizeBytes: 100 }).reason).toBe("UNSUPPORTED_DOCUMENT_TYPE");
  });
});
