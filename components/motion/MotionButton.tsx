"use client";

import { forwardRef, useImperativeHandle, type ButtonHTMLAttributes } from "react";
import { useMotionButtonState, type MotionButtonState } from "./useMotionButtonState";

export interface MotionButtonLabels {
  idle: string;
  loading: string;
  success: string;
  error: string;
}

export interface MotionButtonHandle {
  /** Current state, for consumers that want to read it imperatively. */
  readonly state: MotionButtonState;
  /**
   * Runs `action` through the same state machine the button itself uses on
   * click — this is what lets an external "Test Success" / "Test Error"
   * control drive the button deterministically instead of duplicating the
   * animation/state logic.
   */
  trigger: (action: () => Promise<void>) => void;
}

export interface MotionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children"> {
  labels: MotionButtonLabels;
  /** The real async action performed when the button itself is clicked. */
  onActivate: () => Promise<void>;
  onStateChange?: (state: MotionButtonState) => void;
  successDurationMs?: number;
  /** Idle/hover color treatment only — loading/success/error colors are shared. */
  variant?: "primary" | "secondary";
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 0 1.415l-7.25 7.25a1 1 0 0 1-1.415 0L3.296 9.21a1 1 0 1 1 1.415-1.414l3.995 3.995 6.543-6.543a1 1 0 0 1 1.415 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Same alert-triangle path used by ChatErrorNotice / ToolError elsewhere in
// the app, so error states read as one consistent visual language.
function AlertIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.63-1.516 2.63H3.72c-1.347 0-2.189-1.463-1.516-2.63L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const VARIANT_IDLE_CLASSES: Record<"primary" | "secondary", string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-500",
  secondary: "bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
};

const VARIANT_LOADING_CLASSES: Record<"primary" | "secondary", string> = {
  primary: "bg-blue-600/90 text-white",
  secondary: "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900",
};

/**
 * Reusable button that carries a labeled action through
 * idle -> loading -> success/error -> idle, with one shared motion
 * language (compositor-friendly transform/opacity only). Both "Send
 * Message" and "Save" render this same component with different `labels`
 * and `variant` — see components/motion/MotionButtonsDemo.tsx.
 */
const MotionButton = forwardRef<MotionButtonHandle, MotionButtonProps>(function MotionButton(
  {
    labels,
    onActivate,
    onStateChange,
    successDurationMs,
    variant = "primary",
    className = "",
    disabled,
    ...buttonProps
  },
  ref
) {
  const { state, run } = useMotionButtonState({ successDurationMs, onStateChange });

  useImperativeHandle(ref, () => ({ state, trigger: run }), [state, run]);

  const isLoading = state === "loading";
  // Native `disabled` (same pattern as the existing chat Retry button):
  // browsers never dispatch click events to a disabled element at all, so
  // this alone blocks spam-clicking the button itself. The state-machine's
  // ref guard is the backstop for the *other* entry point — the imperative
  // `trigger()` called from external test controls, which aren't part of
  // this element and so aren't covered by its own disabled attribute.
  const isDisabled = Boolean(disabled) || isLoading;

  const label =
    state === "idle"
      ? labels.idle
      : state === "loading"
        ? labels.loading
        : state === "success"
          ? labels.success
          : labels.error;

  const stateClasses =
    state === "success"
      ? "bg-emerald-600 text-white"
      : state === "error"
        ? "bg-red-600 text-white"
        : state === "loading"
          ? VARIANT_LOADING_CLASSES[variant]
          : VARIANT_IDLE_CLASSES[variant];

  return (
    <button
      type="button"
      {...buttonProps}
      onClick={() => run(onActivate)}
      disabled={isDisabled}
      aria-busy={isLoading}
      aria-live="polite"
      aria-atomic="true"
      data-state={state}
      className={`relative inline-flex min-w-40 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium
        transition-[background-color,box-shadow,transform] duration-200 ease-out
        motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]
        outline-2 outline-offset-2 outline-transparent focus-visible:outline-blue-500 dark:focus-visible:outline-blue-400
        disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none
        ${stateClasses} ${className}`}
    >
      {/* Remounting this span on every state change (via `key`) replays its
          fade/slide-in animation automatically — the same "swap the key,
          let CSS animate the mount" technique already used for tool-state
          transitions in Chat.tsx, kept here as one small named class
          instead of Tailwind arbitrary values so the error variant can
          layer the shake on top without fighting CSS animation-shorthand
          composition. `inline-flex` (not a plain block wrapper around a
          separate flex child) avoids a ~4px extra line-height "strut" that
          a nested block-around-inline-flex span otherwise contributes —
          verified in the browser: idle (text-only) and loading/success/error
          (icon+text) now report the exact same button height. */}
      <span
        key={state}
        className={`inline-flex items-center gap-2 ${
          state === "error" ? "motion-button-content-in-error" : "motion-button-content-in"
        }`}
      >
        {isLoading && <SpinnerIcon />}
        {state === "success" && <CheckIcon />}
        {state === "error" && <AlertIcon />}
        <span>{label}</span>
      </span>
    </button>
  );
});

MotionButton.displayName = "MotionButton";

export default MotionButton;
