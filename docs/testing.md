# Testing

Status: **active** as of MAS-20.

This document describes how tests are organized, what stack runs them, and what the project's coverage expectations are. It complements `docs/adr/ADR-001-stack-selection.md` (which mandates the choices) with the practical "how to run / where things live" detail.

## Stack

| Layer | Tool | Why |
|-------|------|-----|
| Unit tests (logic, pure functions, server modules) | **Vitest** (`^4`) | Native TS + ESM, no Babel/SWC config. Aligns with Next.js's Vite-compatible toolchain. Faster than Jest. |
| Coverage | **`@vitest/coverage-v8`** | First-party, uses V8's built-in coverage — no nyc/istanbul instrumentation. |
| End-to-end (HTTP, browser) | **Playwright** | Lands in a later issue. Will live under `e2e/`. |

We do not use Jest. We do not use ts-jest. If you find yourself reaching for either, stop and re-read ADR-001.

## Layout

```
masjidoasis/
├── src/
│   └── lib/
│       ├── env.ts
│       └── env.test.ts          ← unit test colocated with source
├── tests/
│   └── sanity.test.ts           ← cross-cutting / wiring tests
├── vitest.config.ts             ← single source of test config
└── e2e/                         ← Playwright (future, not yet present)
```

Conventions:

- **Unit tests are colocated.** A test for `src/lib/foo.ts` lives at `src/lib/foo.test.ts`. This keeps the test next to the code it exercises — easier to discover, easier to delete with the module if the module dies.
- **Cross-cutting tests live in `tests/`.** Anything that doesn't belong to a single source file (smoke checks, configuration regressions, integration-style flows that touch multiple modules).
- **E2E tests will live in `e2e/`** when Playwright is wired up.

## Running tests

```bash
npm test               # one-shot run (CI mode)
npm run test:watch     # watch mode for local TDD
npm run test:coverage  # one-shot run + coverage report under coverage/
```

Coverage output:

- `coverage/index.html` — human-readable, open in a browser.
- `coverage/lcov.info` — machine-readable, ready for CI uploaders (Codecov etc., not wired yet).
- Console summary printed at the end of the run.

## Coverage policy

Per ADR-001 §Testing:

> Coverage threshold **60% lines/functions** for payment and wallet modules.

Implementation reality (MAS-20):

- The wallet and payment modules do not yet exist. They will land in subsequent issues (MAS-2x series).
- For now, the threshold is enforced **globally** at 60% lines / 60% functions / 60% statements / 50% branches against everything under `src/lib/**` and `src/server/**` — see `vitest.config.ts` for the exact include/exclude list.
- When `src/server/payment/**` and `src/server/wallet/**` land, the issue that introduces them MUST land with tests that keep the global threshold green. There is no "we'll add tests later" exception.

Files explicitly excluded from coverage math (wiring code, type-only):

- `src/server/db.ts` — Prisma client singleton, no logic.
- `**/*.d.ts`
- `**/index.ts` — re-export barrels.

If you add a wiring/barrel file that should not count toward coverage, add it to the `exclude` list in `vitest.config.ts` in the same commit and explain why in the PR description.

## Writing a test

Minimal example (`src/lib/example.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { doThing } from "./example";

describe("doThing", () => {
  it("returns the thing", () => {
    expect(doThing(2)).toBe(4);
  });
});
```

Rules:

1. **One `describe` per public function / class** unless tests are trivial (1–2 cases).
2. **Test names describe behavior, not implementation.** "returns frozen output" not "calls Object.freeze".
3. **No live network, no real database, no real Redis.** Use the adapter pattern (see ADR-001 §Architecture) and inject fakes.
4. **No `process.env` mutation.** Pass a synthetic env to `validateEnv(source)` rather than mutating the live `process.env`. The test stays parallel-safe.
5. **Async is fine** — Vitest awaits returned promises. Just `async () => { await ... }` in your `it`.

## CI integration

The `test` job in `.github/workflows/ci.yml` (added in MAS-18) runs:

```yaml
- run: npm test --if-present
```

This means:
- Adding/removing the `test` script in `package.json` is enough to enable/disable CI tests — no workflow change required.
- Tests must be fast enough to run on every push. If a future suite is slow, split into `test` (fast, runs always) and `test:e2e` / `test:integration` (runs on a schedule or label).

## E2E (forthcoming)

Playwright will be added in a separate issue. Planned shape:

- Config: `playwright.config.ts` at repo root.
- Tests: `e2e/**/*.spec.ts`.
- Run locally: `npm run e2e` (script not yet defined).
- CI: separate job, runs against a built preview deploy, not on every push.

When that lands, this section will be expanded with concrete invocation.

## Troubleshooting

**"Cannot find module" for a `@/` import in a test.**
The `@/` alias is resolved by `vitest.config.ts` (`resolve.alias`). If a test can't find a `@/foo` import, check that file exists and that the path under `src/` matches.

**Coverage threshold fails locally but I didn't touch that file.**
Coverage is computed on the union of files imported by tests. Adding a new module without a corresponding test will drop coverage. Either add a test or, if the module is genuinely wiring (no logic), add it to the `exclude` list in `vitest.config.ts` with a one-line justification in the PR.

**`process.env` leaks between tests.**
Don't mutate `process.env` in tests. Pass an explicit env object to the function under test. If a function reads `process.env` directly and isn't injectable, refactor it before testing.

## References

- ADR-001 — stack selection rationale.
- `vitest.config.ts` — authoritative test config.
- `package.json` — `test`, `test:watch`, `test:coverage` scripts.
- `.github/workflows/ci.yml` — CI integration.
