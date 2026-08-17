import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deferred integration states", () => {
  const catalog = readFileSync("lib/integration-catalog.ts", "utf8");
  const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");

  it("lists deferred integrations as explicitly disconnected", () => {
    expect(catalog).toContain('description: "غير متصل"');
    expect(catalog).toContain('key: "government"');
    expect(catalog).toContain('key: "payments"');
  });

  it("explains prerequisites without initiating an external connection", () => {
    expect(settings).toContain("التكاملات الخارجية");
    expect(settings).toContain("هذه الخدمات غير متصلة حالياً");
    expect(settings).toContain("Alert.alert(integration.title, integration.prerequisite)");
  });
});
