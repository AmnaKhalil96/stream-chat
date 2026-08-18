import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// `globals: true` is intentionally not set in vitest.config.ts, so RTL's
// own auto-cleanup (which detects a global `afterEach`) doesn't kick in —
// register it explicitly instead, otherwise DOM from one test leaks into
// the next within the same file.
afterEach(() => {
  cleanup();
  // Tests that install a fetch mock via vi.stubGlobal("fetch", ...) must
  // never leak it into a later test — this is the safety net that
  // guarantees that.
  vi.unstubAllGlobals();
});
