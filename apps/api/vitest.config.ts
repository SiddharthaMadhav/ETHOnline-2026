import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: 30_000,
    testTimeout: 30_000,
    globalSetup: ["./test/global-setup.ts"],
    // All integration tests share one Postgres test database and truncate
    // tables between tests - files must not run concurrently against it.
    fileParallelism: false,
  },
});
