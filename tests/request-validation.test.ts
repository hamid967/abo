import { describe, expect, it } from "vitest";
import { validateRequestData, validationStatusFromResults } from "../server/request-validation";

describe("request validation engine", () => {
  it("blocks incomplete and malformed drafts", () => {
    const results = validateRequestData({ title: "طلب" , phoneNumber: "123" }, false);
    expect(results.some((item) => item.severity === "error")).toBe(true);
    expect(validationStatusFromResults(results)).toBe("errors");
  });

  it("returns a warning for a similar open request without blocking review", () => {
    const results = validateRequestData({ beneficiaryType: "individual", serviceName: "خدمة", entityName: "جهة", title: "عنوان", description: "وصف", beneficiaryName: "اسم", phoneNumber: "0501234567" }, true);
    expect(results.some((item) => item.code === "possible_duplicate" && item.severity === "warning")).toBe(true);
    expect(validationStatusFromResults(results)).toBe("warnings");
  });
});
