"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MotionButtonState = "idle" | "loading" | "success" | "error";

interface UseMotionButtonStateOptions {
  /** How long the success state stays visible before auto-returning to idle. */
  successDurationMs?: number;
  onStateChange?: (state: MotionButtonState) => void;
}

export interface MotionButtonStateController {
  state: MotionButtonState;
  /**
   * Runs `action` through the idle -> loading -> success/error state
   * machine. Ignored while a previous run is still in flight (spam-click /
   * duplicate-activation guard). Safe to call again from the error state —
   * that's what makes error "retryable".
   */
  run: (action: () => Promise<void>) => void;
}

const DEFAULT_SUCCESS_DURATION_MS = 1600;

export function useMotionButtonState(
  options: UseMotionButtonStateOptions = {}
): MotionButtonStateController {
  const { successDurationMs = DEFAULT_SUCCESS_DURATION_MS, onStateChange } = options;

  const [state, setState] = useState<MotionButtonState>("idle");

  // Synchronous re-entrancy guard, checked and set before any await. A
  // React state read (`state === "loading"`) would still let two clicks
  // fired in the same synchronous burst both slip through, since neither
  // sees the other's update until the next render — a ref is checked/set
  // immediately, closing that race outright.
  const isRunningRef = useRef(false);
  // Bumped on every run(). An in-flight run's async continuation only
  // applies its result if it still owns the current generation, so a run
  // that gets superseded (e.g. a fresh activation while an old success's
  // auto-return-to-idle timer is still pending) can never clobber newer
  // state with a stale one.
  const generationRef = useRef(0);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onStateChangeRef = useRef(onStateChange);

  // Keeps the ref in sync without mutating it during render (unsafe per
  // react-hooks/refs) — this only needs to be current by the time the next
  // run() actually fires, not synchronously during this render.
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const applyState = useCallback((next: MotionButtonState) => {
    setState(next);
    onStateChangeRef.current?.(next);
  }, []);

  const run = useCallback(
    (action: () => Promise<void>) => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }

      const generation = ++generationRef.current;
      applyState("loading");

      action().then(
        () => {
          isRunningRef.current = false;
          if (!mountedRef.current || generation !== generationRef.current) return;
          applyState("success");
          successTimeoutRef.current = setTimeout(() => {
            if (!mountedRef.current || generation !== generationRef.current) return;
            applyState("idle");
          }, successDurationMs);
        },
        () => {
          isRunningRef.current = false;
          if (!mountedRef.current || generation !== generationRef.current) return;
          applyState("error");
        }
      );
    },
    [applyState, successDurationMs]
  );

  return { state, run };
}
