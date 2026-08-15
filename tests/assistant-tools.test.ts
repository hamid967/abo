import { describe, expect, it } from "vitest";
import { assertIntentToolAllowed, intentToolAllowlist } from "../server/assistant-tools";

describe("assistant tool contracts", () => {
  it("allows draft creation only in suitable request flows", () => {
    expect(intentToolAllowlist.create_request).toContain("create_request_draft");
    expect(() => assertIntentToolAllowed("track_transaction", "submit_request")).toThrow("TOOL_NOT_ALLOWED_FOR_INTENT");
  });

  it("keeps payment intent limited to human handoff", () => {
    expect(intentToolAllowlist.pay_invoice).toEqual(["request_human_handoff"]);
  });
});
