import { describe, expect, it } from "vitest";
import { calculateDraftCompletion, mergeRequestDraftData, requestDraftPatchSchema } from "../server/request-draft-policy";

describe("request draft update policy", () => {
  it("accepts only documented editable fields", () => {
    const patch = requestDraftPatchSchema.parse({ title: "متابعة طلب", phoneNumber: "0501234567", priority: "high" });
    expect(patch.title).toBe("متابعة طلب");
    expect(() => requestDraftPatchSchema.parse({ role: "admin" })).toThrow();
  });

  it("merges structured fields without carrying relational fields into JSON", () => {
    const merged = mergeRequestDraftData({ title: "قديم" }, { title: "جديد", serviceId: 5 });
    expect(merged).toEqual({ title: "جديد" });
    expect(calculateDraftCompletion({ beneficiaryType: "individual", serviceName: "خدمة", entityName: "جهة", title: "عنوان", description: "وصف", beneficiaryName: "اسم", phoneNumber: "0501234567" })).toBe(100);
  });
});
