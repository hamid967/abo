import { describe, expect, it } from "vitest";

import { isTodayActionHidden, nextDayAtNine, upsertTodayAction } from "../lib/today-actions";

describe("today action state", () => {
  const now = new Date("2026-08-17T08:00:00.000Z");

  it("hides dismissed and future-snoozed actions without deleting their source", () => {
    expect(isTodayActionHidden({ itemId: "a", transactionId: "t-1", dismissedAt: now.toISOString(), updatedAt: now.toISOString() }, now)).toBe(true);
    expect(isTodayActionHidden({ itemId: "b", transactionId: "t-1", snoozedUntil: "2026-08-18T09:00:00.000Z", updatedAt: now.toISOString() }, now)).toBe(true);
    expect(isTodayActionHidden({ itemId: "c", transactionId: "t-1", snoozedUntil: "2026-08-16T09:00:00.000Z", updatedAt: now.toISOString() }, now)).toBe(false);
  });

  it("uses a stable next-day reminder time and updates a single action by its source key", () => {
    expect(nextDayAtNine(now)).toBe("2026-08-18T09:00:00.000Z");
    const first = { itemId: "item-1", transactionId: "transaction-1", updatedAt: now.toISOString() };
    const updated = { ...first, snoozedUntil: "2026-08-18T09:00:00.000Z" };
    expect(upsertTodayAction([first], updated)).toEqual([updated]);
  });
});
