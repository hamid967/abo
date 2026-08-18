import { describe, expect, it } from "vitest";

import { documentExtractionInstructions, documentFieldExtractionSchema } from "../server/document-field-extraction";

describe("document field extraction", () => {
  it("keeps extraction scoped to visible metadata and masks sensitive identifiers", () => {
    expect(documentExtractionInstructions("ar")).toContain("آخر أربع خانات");
    expect(documentExtractionInstructions("ar")).toContain("لا تخمّن");
  });

  it("accepts bounded preview fields and rejects an unmasked identifier-sized value", () => {
    expect(documentFieldExtractionSchema.safeParse({ documentType: "رخصة", expiryDate: "2027-02-11", fields: [{ label: "رقم الرخصة", value: "***-4821", confidence: "high" }], reviewNote: "راجع الحقول الظاهرة قبل تأكيد الحفظ." }).success).toBe(true);
    expect(documentFieldExtractionSchema.safeParse({ documentType: null, expiryDate: "2027-99-99", fields: [], reviewNote: "ملاحظة مراجعة كافية." }).success).toBe(false);
  });
});
