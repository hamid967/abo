import { describe, expect, it } from "vitest";
import { formatRequestNumber, submissionMessage } from "../server/request-submission";

describe("request submission helpers", () => {
  it("creates a stable unique server-side request number from the database id", () => {
    expect(formatRequestNumber(128, 2026)).toBe("AM-2026-000128");
    expect(formatRequestNumber(129, 2026)).not.toBe(formatRequestNumber(128, 2026));
  });

  it("does not claim government acceptance in the confirmation copy", () => {
    expect(submissionMessage("ar")).toContain("منصة أبو مشعل");
    expect(submissionMessage("ar")).not.toContain("قبول");
  });
});
