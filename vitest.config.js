import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/.worktrees/**"],
    coverage: { reporter: ["text", "html"] },
    restoreMocks: true,
  },
});
