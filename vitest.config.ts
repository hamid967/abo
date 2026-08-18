import { defineConfig } from "vitest/config";

export default defineConfig({
  // The independent React Native app owns its Jest suite and TypeScript config.
  // Root Vitest still imports selected framework-agnostic modules for contract
  // coverage, but must not resolve the nested app's dev-only tsconfig package.
  esbuild: { tsconfigRaw: {} },
  test: {
    exclude: ["**/node_modules/**", "native-independent/__tests__/**"],
  },
});
