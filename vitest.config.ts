/// <reference types="vitest" />
// Configure Vitest (https://vitest.dev/config/)

import { defineConfig } from "vite";

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
    maxThreads: 1,
    minThreads: 1,
  },
});
