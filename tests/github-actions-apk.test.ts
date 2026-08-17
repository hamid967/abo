import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GitHub Actions Android APK workflow", () => {
  const workflow = readFileSync(".github/workflows/android-debug-apk.yml", "utf8");
  const guide = readFileSync("docs/github-actions-apk.md", "utf8");

  it("builds a manual installable debug APK after quality validation", () => {
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("pnpm check");
    expect(workflow).toContain("pnpm lint");
    expect(workflow).toContain("npx expo prebuild --platform android --non-interactive --clean");
    expect(workflow).toContain("./gradlew app:assembleDebug");
    expect(workflow).toContain("app-debug.apk");
  });

  it("keeps Firebase configuration optional and outside the repository", () => {
    expect(workflow).toContain("GOOGLE_SERVICES_JSON_BASE64");
    expect(workflow).toContain("base64 --decode > google-services.json");
    expect(guide).toContain("GOOGLE_SERVICES_JSON_BASE64");
    expect(guide).toContain("لا يحفظ الملف في المستودع");
  });
});
