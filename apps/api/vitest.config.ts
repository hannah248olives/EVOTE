import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Run against the package's TypeScript source so tests need no build step.
      "@evote/database": fileURLToPath(
        new URL("../../packages/database/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 15000,
  },
});
