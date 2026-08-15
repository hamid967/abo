import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const source = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("Arabic typography", () => {
  it("bundles the licensed Cairo font weights and its OFL license", () => {
    [
      "assets/fonts/Cairo-Regular.ttf",
      "assets/fonts/Cairo-SemiBold.ttf",
      "assets/fonts/Cairo-Bold.ttf",
      "assets/fonts/Cairo-ExtraBold.ttf",
      "assets/fonts/Cairo-OFL-1.1.txt",
    ].forEach((relativePath) => expect(existsSync(resolve(root, relativePath))).toBe(true));
  });

  it("loads Cairo before rendering and routes text components through the shared typography layer", () => {
    expect(source("app/_layout.tsx")).toContain('"Cairo-Regular": require("@/assets/fonts/Cairo-Regular.ttf")');
    expect(source("components/ui/app-text.tsx")).toContain("fontFamily: resolveFontFamily(style)");
    expect(source("app/(tabs)/index.tsx")).toContain('AppText as Text');
    expect(source("app/assistant/index.tsx")).toContain('AppTextInput as TextInput');
  });
});
