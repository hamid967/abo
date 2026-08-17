import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("today dashboard", () => {
  const screen = readFileSync("app/today/index.tsx", "utf8");
  const home = readFileSync("app/(tabs)/index.tsx", "utf8");

  it("derives actionable cards from real transaction states and due dates", () => {
    expect(screen).toContain("useTransactions");
    expect(screen).toContain('transaction.status === "awaiting_customer_documents"');
    expect(screen).toContain("daysUntil(transaction.dueDate)");
    expect(screen).toContain("reason");
    expect(screen).toContain('pathname: "/transaction/[id]"');
    expect(screen).toContain("useTodayActions");
    expect(screen).toContain("nextDayAtNine");
    expect(screen).toContain("إخفاء من يومي");
  });

  it("links the existing home dashboard to the dedicated daily view", () => {
    expect(home).toContain('router.push("/today" as never)');
  });
});
