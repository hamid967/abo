import { describe, expect, it } from "vitest";

import { isCloudPayloadWithinLimit } from "../server/cloud-sync";
import { getAccountStorageKey } from "../lib/cloud-storage";

describe("cloud sync payload validation", () => {
  it("accepts ordinary serializable snapshots", () => {
    expect(isCloudPayloadWithinLimit({ transactions: [{ id: "request-1", title: "طلب" }] })).toBe(true);
  });

  it("rejects oversized or circular snapshots", () => {
    expect(isCloudPayloadWithinLimit("x".repeat(32), 16)).toBe(false);
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(isCloudPayloadWithinLimit(circular)).toBe(false);
  });

  it("uses distinct local storage namespaces for different accounts", () => {
    expect(getAccountStorageKey("abu-mishal", 12)).toBe("abu-mishal:12");
    expect(getAccountStorageKey("abu-mishal", 13)).toBe("abu-mishal:13");
    expect(getAccountStorageKey("abu-mishal")).toBe("abu-mishal");
  });
});
