import { describe, expect, it } from "vitest";

import { getSlaStatus } from "../lib/sla-status";

const now = new Date("2026-08-16T12:00:00.000Z");

describe("SLA status", () => {
  it("marks a task without a deadline as unset rather than inventing an SLA", () => {
    expect(getSlaStatus(undefined, "new", now).state).toBe("unset");
  });

  it("shows a healthy task when more than eight hours remain", () => {
    expect(getSlaStatus("2026-08-17T01:00:00.000Z", "new", now).state).toBe("on_track");
  });

  it("warns before the deadline and escalates the final two hours", () => {
    expect(getSlaStatus("2026-08-16T18:00:00.000Z", "in_progress", now).state).toBe("at_risk");
    expect(getSlaStatus("2026-08-16T13:30:00.000Z", "in_progress", now).state).toBe("critical");
  });

  it("marks expired and completed tasks distinctly", () => {
    expect(getSlaStatus("2026-08-16T11:30:00.000Z", "new", now).state).toBe("overdue");
    expect(getSlaStatus("2026-08-16T11:30:00.000Z", "completed", now).state).toBe("completed");
  });
});
