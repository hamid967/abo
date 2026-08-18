import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/android-native-independent.yml", "utf8");
const gradle = readFileSync("native-independent/android/app/build.gradle", "utf8");

describe("سير بناء Android المستقل", () => {
  it("يبني من مشروع React Native المستقل دون Expo أو EAS", () => {
    expect(workflow).toContain("working-directory: native-independent");
    expect(workflow).toContain("pnpm exec tsc --noEmit");
    expect(workflow).toContain("native-independent/android");
    expect(workflow).not.toContain("expo prebuild");
    expect(workflow).not.toContain("eas build");
  });

  it("يفرض أسرار التوقيع ويصدر APK أو AAB موقعة كـArtifact", () => {
    expect(workflow).toContain("ANDROID_RELEASE_KEYSTORE_BASE64");
    expect(workflow).toContain("configure-android-release-signing.cjs android/app/build.gradle");
    expect(workflow).toContain("app:bundleRelease");
    expect(workflow).toContain("app:assembleRelease");
    expect(workflow).toContain("actions/upload-artifact@v4");
  });

  it("يحافظ على هوية حزمة Android ويقبل رقم إصدار من سير العمل", () => {
    expect(gradle).toContain('applicationId "com.app.governmenttransactionstracker"');
    expect(gradle).toContain('findProperty("ABU_MISHAL_VERSION_CODE")');
    expect(gradle).toContain('findProperty("ABU_MISHAL_VERSION_NAME")');
  });
});
