import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/contract/**/*.pacttest.ts"],
    testTimeout: 30000,
  },
});
