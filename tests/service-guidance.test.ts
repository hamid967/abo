import { describe, expect, it } from "vitest";
import { normalizeServiceSearch, serviceMatchScore } from "../server/db";

describe("service guidance matching", () => {
  it("normalizes common Arabic spelling and diacritics", () => {
    expect(normalizeServiceSearch("إصدار رُخصة")).toBe("اصدار رخصه");
  });

  it("prefers exact and contained service names", () => {
    expect(serviceMatchScore("تجديد رخصة", "تجديد رخصة")).toBe(1);
    expect(serviceMatchScore("تجديد رخصة", "خدمة تجديد رخصة القيادة")).toBe(
      0.9,
    );
  });

  it("rejects unrelated services", () => {
    expect(serviceMatchScore("تجديد رخصة", "إصدار سجل تجاري")).toBeLessThan(
      0.67,
    );
  });

  it("provides a partial score for useful multi-word suggestions", () => {
    expect(
      serviceMatchScore("تجديد رخصة قيادة", "تجديد رخصة سير"),
    ).toBeGreaterThanOrEqual(0.34);
    expect(
      serviceMatchScore("تجديد رخصة قيادة", "تجديد رخصة سير"),
    ).toBeLessThan(0.9);
  });
});
