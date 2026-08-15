import { describe, expect, it } from "vitest";
import { validateQuietHours } from "../server/notification-preferences-policy";

describe("notification preferences policy", () => {
  it("accepts valid different quiet-hour boundaries and clears them when disabled", () => {
    expect(validateQuietHours({ enabled: true, start: 22, end: 7 })).toEqual({ valid: true, start: 22, end: 7 });
    expect(validateQuietHours({ enabled: false, start: 22, end: 7 })).toEqual({ valid: true, start: null, end: null });
  });

  it("rejects an invalid same-hour quiet window", () => {
    expect(validateQuietHours({ enabled: true, start: 7, end: 7 }).valid).toBe(false);
  });
});
