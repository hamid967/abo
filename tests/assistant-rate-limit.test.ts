import { describe, expect, it } from "vitest";
import { checkAssistantRateLimit, resetAssistantRateLimits } from "../server/assistant-rate-limit";

describe("assistant rate limits", () => {
  it("limits a user after 30 messages in a 15-minute rolling window", () => {
    resetAssistantRateLimits();
    const base = 1_000_000;
    for (let index = 0; index < 30; index += 1) expect(checkAssistantRateLimit({ userId: 8, action: "message", now: base + index }).allowed).toBe(true);
    expect(checkAssistantRateLimit({ userId: 8, action: "message", now: base + 100 }).allowed).toBe(false);
    expect(checkAssistantRateLimit({ userId: 8, action: "message", now: base + 15 * 60_000 + 1 }).allowed).toBe(true);
  });
});
