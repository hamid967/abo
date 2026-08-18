import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const authSource = readFileSync(resolve(process.cwd(), "lib/_core/auth.ts"), "utf8");
const callbackSource = readFileSync(resolve(process.cwd(), "app/oauth/callback.tsx"), "utf8");

describe("authentication logging safeguards", () => {
  it("does not log session tokens or stored user profiles", () => {
    expect(authSource).not.toMatch(/console\.(?:log|debug|info|warn|error)\s*\(/);
    expect(callbackSource).not.toMatch(/console\.(?:log|debug|info|warn|error)\s*\(/);
  });

  it("does not reveal token prefixes", () => {
    expect(authSource).not.toContain("token.substring");
    expect(authSource).not.toContain("token.slice");
  });
});
