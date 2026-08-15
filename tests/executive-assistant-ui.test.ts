import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("executive assistant entry UI", () => {
  const screen = readFileSync("app/assistant/request-intake.tsx", "utf8");
  const transactions = readFileSync("app/(tabs)/transactions.tsx", "utf8");

  it("uses the persisted executive assistant API and privacy notice", () => {
    expect(screen).toContain("trpc.executiveAssistant.start.useMutation");
    expect(screen).toContain("trpc.executiveAssistant.sendMessage.useMutation");
    expect(screen).toContain("رمز التحقق");
  });

  it("routes the main transaction entry to chat intake", () => {
    expect(transactions).toContain('router.push("/assistant/request-intake" as never)');
  });
});
