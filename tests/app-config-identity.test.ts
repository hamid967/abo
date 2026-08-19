import { afterEach, describe, expect, it, vi } from "vitest";

const identityEnvKeys = [
  "EXPO_APPLICATION_ID",
  "EXPO_IOS_BUNDLE_IDENTIFIER",
  "EXPO_ANDROID_PACKAGE",
  "EXPO_DEEP_LINK_SCHEME",
  "EXPO_APP_SLUG",
] as const;

async function loadConfig() {
  vi.resetModules();
  return (await import("../app.config.js")).default;
}

afterEach(() => {
  for (const key of identityEnvKeys) delete process.env[key];
  vi.resetModules();
});

describe("Expo application identity", () => {
  it("uses stable Abu Mishal defaults", async () => {
    const config = await loadConfig();

    expect(config.name).toBe("أبو مشعل");
    expect(config.slug).toBe("abu-mishal");
    expect(config.scheme).toBe("abumishaal");
    expect(config.ios?.bundleIdentifier).toBe("sa.abumishal.app");
    expect(config.android?.package).toBe("sa.abumishal.app");
  });

  it("allows published store identifiers to be retained via environment", async () => {
    process.env.EXPO_IOS_BUNDLE_IDENTIFIER = "sa.existing.abumishal";
    process.env.EXPO_ANDROID_PACKAGE = "sa.existing.abumishal.android";
    process.env.EXPO_DEEP_LINK_SCHEME = "abumishal-beta";

    const config = await loadConfig();

    expect(config.ios?.bundleIdentifier).toBe("sa.existing.abumishal");
    expect(config.android?.package).toBe("sa.existing.abumishal.android");
    expect(config.scheme).toBe("abumishal-beta");
  });

  it("falls back safely when environment values are invalid", async () => {
    process.env.EXPO_APPLICATION_ID = "123";
    process.env.EXPO_DEEP_LINK_SCHEME = "123 invalid";

    const config = await loadConfig();

    expect(config.ios?.bundleIdentifier).toBe("sa.abumishal.app");
    expect(config.android?.package).toBe("sa.abumishal.app");
    expect(config.scheme).toBe("abumishaal");
  });
});
