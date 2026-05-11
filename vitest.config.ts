import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration (MAS-20).
 *
 * Why Vitest (not Jest):
 *   - Native TypeScript + ESM, no babel/swc config needed.
 *   - Reuses Vite's transformer, so it matches Next.js's runtime.
 *   - First-party coverage via `@vitest/coverage-v8` (no nyc).
 *
 * Layout:
 *   - Unit tests colocated as `*.test.ts` next to source (e.g. `src/lib/env.test.ts`).
 *   - Cross-cutting / sanity tests under `tests/`.
 *   - E2E (Playwright) lives in a separate config — see ADR-001 §Testing.
 *
 * Coverage policy (ADR-001):
 *   - Minimum 60% lines/functions for payment + wallet modules.
 *   - Threshold is enforced only on files that exist today; new modules
 *     under `src/server/payment/**` and `src/server/wallet/**` MUST land
 *     with tests that keep the global threshold green.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist"],
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      // Only measure code we actually own.
      include: ["src/lib/**", "src/server/**"],
      // Exclude wiring + framework boundaries from coverage math.
      exclude: [
        "src/server/db.ts", // Prisma client singleton — pure wiring.
        "**/*.d.ts",
        "**/index.ts",
      ],
      thresholds: {
        // Global floor — kept conservative until more code lands.
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
