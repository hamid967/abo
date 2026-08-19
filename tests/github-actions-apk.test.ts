import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GitHub Actions Android APK workflow", () => {
  const workflow = readFileSync(".github/workflows/android-debug-apk.yml", "utf8");
  const guide = readFileSync("docs/github-actions-apk.md", "utf8");

  it("builds a manually triggered Android APK after quality validation", () => {
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("pnpm check");
    expect(workflow).toContain("pnpm lint");
    expect(workflow).toContain("npx expo prebuild --platform android --non-interactive --clean");
    expect(workflow).toContain("./gradlew app:assembleDebug");
  });

  it("keeps Firebase configuration optional and outside the repository", () => {
    expect(workflow).toContain("GOOGLE_SERVICES_JSON_BASE64");
    expect(workflow).toContain("base64 --decode > google-services.json");
    expect(guide).toContain("GOOGLE_SERVICES_JSON_BASE64");
    expect(guide).toContain("لا يحفظ الملف في المستودع");
  });

  it("requires external release signing secrets and builds a release artifact", () => {
    expect(workflow).toContain("ANDROID_RELEASE_KEYSTORE_BASE64");
    expect(workflow).toContain("Restore release keystore");
    expect(workflow).toContain("configure-android-release-signing.cjs");
    expect(workflow).toContain("./gradlew app:assembleRelease");
    expect(workflow).toContain("abu-mishal-android-${{ env.BUILD_VARIANT }}-${{ env.PACKAGE_FORMAT }}");
  });

  it("supports a signed Android App Bundle for Google Play distribution", () => {
    expect(workflow).toContain("package_format");
    expect(workflow).toContain("app:bundleRelease");
    expect(workflow).toContain("app-release.aab");
    expect(workflow).toContain("AAB distribution packages must use the release variant.");
  });
});
