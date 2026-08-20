import { describe, expect, it } from "vitest";

import { createLocalRequestNumber, guestRequestNextAction } from "../lib/guest-request";

describe("guest request storage", () => {
  it("creates a device-local request reference without a user account", () => {
    expect(createLocalRequestNumber(new Date("2026-08-20T10:11:12.345Z"))).toBe("AM-LOCAL-2026-672345");
  });

  it("discloses that the visitor request remains local and is not automatically synced", () => {
    const message = guestRequestNextAction();
    expect(message).toContain("هذا الجهاز فقط");
    expect(message).toContain("لا يُرسل إلى الخادم");
    expect(message).toContain("لا تتم مزامنته تلقائياً");
  });
});
