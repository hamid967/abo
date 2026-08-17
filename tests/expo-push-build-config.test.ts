import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Expo Push build configuration", () => {
  it("keeps an EAS project identifier and mobile build profiles for push credentials", () => {
    const appConfig = readFileSync("app.config.js", "utf8");
    const easConfig = JSON.parse(readFileSync("eas.json", "utf8")) as {
      build?: Record<string, { developmentClient?: boolean; distribution?: string }>;
    };

    expect(appConfig).toContain('projectId: "3992dd3d-3961-4695-b697-f923729fd168"');
    expect(appConfig).toContain('"expo-notifications"');
    expect(easConfig.build?.development).toMatchObject({ developmentClient: true, distribution: "internal" });
    expect(easConfig.build?.production).toBeDefined();
  });
});
