import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Playwright owns `e2e/**` — Vitest's default include glob would
    // otherwise also try (and fail) to run those `.spec.ts` files.
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
  },
});
