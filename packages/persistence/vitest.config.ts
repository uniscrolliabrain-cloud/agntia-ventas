import { defineConfig } from "vitest/config";

// PGlite compiles Postgres to WASM and the first instance boot can take a few
// seconds on a cold cache, so the default 5s timeout is not enough here.
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
