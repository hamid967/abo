import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("security log hygiene", () => {
  it("does not append database connection or user details to operational error logs", () => {
    const database = readFileSync("server/db.ts", "utf8");
    expect(database).not.toContain('console.warn("[Database] Failed to connect:", error)');
    expect(database).not.toContain('console.error("[Database] Failed to upsert user:", error)');
    expect(database).toContain('console.warn("[Database] Failed to initialize the database connection")');
  });
});
