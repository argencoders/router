/// <reference types="vitest" />
// Configure Vitest (https://vitest.dev/config/)

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // use global to avoid globals imports (describe, test, expect):
    globals: true,
    globalSetup: "./test/global-setup.ts",
    env: { TEST: "true" },
    exclude: ["node_modules", "dist", ".git"],
    mockReset: true,
    restoreMocks: true,
    testTimeout: 5000,
  },
});
