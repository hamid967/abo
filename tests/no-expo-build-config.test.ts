import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

describe("مسار البناء المجاني", () => {
  it("لا يعيد إدخال تكوين Expo Build أو EAS إلى المشروع", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const appConfig = readFileSync(resolve(root, "app.config.js"), "utf8");

    expect(existsSync(resolve(root, "eas.json"))).toBe(false);
    expect(packageJson.dependencies?.["eas-cli"]).toBeUndefined();
    expect(packageJson.devDependencies?.["eas-cli"]).toBeUndefined();
    expect(appConfig).not.toContain("EXPO_TOKEN");
    expect(appConfig).not.toMatch(/easProjectId|projectId\s*:\s*['\"]@/i);
  });

  it("يبقي بناء Android محلياً داخل GitHub Actions ثم Gradle", () => {
    const workflow = readFileSync(resolve(root, ".github/workflows/android-debug-apk.yml"), "utf8");

    expect(workflow).toContain("npx expo prebuild --platform android --non-interactive --clean");
    expect(workflow).toContain("./gradlew app:bundleRelease");
    expect(workflow).not.toMatch(/\beas\s+build\b/i);
  });
});
