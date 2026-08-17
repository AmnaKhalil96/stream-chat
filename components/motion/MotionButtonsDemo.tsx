"use client";

import { useRef, useState } from "react";
import MotionButton, { type MotionButtonHandle } from "./MotionButton";
import type { MotionButtonState } from "./useMotionButtonState";

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Fake async action with a randomized delay and a ~20% failure rate, as
// specified — shared by both buttons' real click path so the two demos
// behave consistently rather than each inventing its own timing.
function createFakeAsyncAction(label: string, failureRateOutOfOne = 0.2) {
  return async function fakeAsyncAction(): Promise<void> {
    const delayMs = 600 + Math.random() * 1400; // ~0.6s - 2.0s
    await wait(delayMs);
    if (Math.random() < failureRateOutOfOne) {
      throw new Error(`Simulated ${label} failure`);
    }
  };
}

const fakeSend = createFakeAsyncAction("send");
const fakeSave = createFakeAsyncAction("save");

// Deterministic action for the manual test controls: same state machine,
// forced outcome, so success/error can be verified without waiting on the
// random ~20% failure rate.
function forcedAction(shouldSucceed: boolean, delayMs = 700) {
  return async function forced(): Promise<void> {
    await wait(delayMs);
    if (!shouldSucceed) throw new Error("Forced test failure");
  };
}

const testControlClassName =
  "rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors duration-150 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

export default function MotionButtonsDemo() {
  const sendRef = useRef<MotionButtonHandle>(null);
  const saveRef = useRef<MotionButtonHandle>(null);
  const [sendState, setSendState] = useState<MotionButtonState>("idle");
  const [saveState, setSaveState] = useState<MotionButtonState>("idle");
  const [saveDisabled, setSaveDisabled] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400">
          FE-AA1 demo
        </p>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Buttons with a Brain: Motion &amp; State Micro-interactions
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          One reusable{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">
            MotionButton
          </code>{" "}
          component drives both buttons below through the same{" "}
          <span className="font-mono text-xs">idle → loading → success/error → idle</span> state
          machine. Click either button for the real (randomized, ~20% failure) demo, or use the
          manual test controls underneath for deterministic success/error checks.
        </p>
      </header>

      <section
        aria-labelledby="send-heading"
        className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
      >
        <h2 id="send-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Primary — Send Message
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <MotionButton
            ref={sendRef}
            variant="primary"
            labels={{ idle: "Send Message", loading: "Sending…", success: "Sent!", error: "Retry" }}
            onActivate={fakeSend}
            onStateChange={setSendState}
            aria-label="Send message"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            State: <span className="font-mono">{sendState}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={sendState === "loading"}
            onClick={() => sendRef.current?.trigger(forcedAction(true))}
            className={testControlClassName}
          >
            Test Send Success
          </button>
          <button
            type="button"
            disabled={sendState === "loading"}
            onClick={() => sendRef.current?.trigger(forcedAction(false))}
            className={testControlClassName}
          >
            Test Send Error
          </button>
        </div>
      </section>

      <section
        aria-labelledby="save-heading"
        className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
      >
        <h2 id="save-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Secondary — Save
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <MotionButton
            ref={saveRef}
            variant="secondary"
            labels={{ idle: "Save", loading: "Saving…", success: "Saved!", error: "Retry Save" }}
            onActivate={fakeSave}
            onStateChange={setSaveState}
            disabled={saveDisabled}
            aria-label="Save"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            State: <span className="font-mono">{saveState}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saveState === "loading" || saveDisabled}
            onClick={() => saveRef.current?.trigger(forcedAction(true))}
            className={testControlClassName}
          >
            Test Save Success
          </button>
          <button
            type="button"
            disabled={saveState === "loading" || saveDisabled}
            onClick={() => saveRef.current?.trigger(forcedAction(false))}
            className={testControlClassName}
          >
            Test Save Error
          </button>
          <label className="ml-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={saveDisabled}
              onChange={(event) => setSaveDisabled(event.target.checked)}
              className="h-3.5 w-3.5 accent-zinc-700 dark:accent-zinc-300"
            />
            Disabled (bonus state)
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl bg-zinc-50 p-5 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Motion rationale</h2>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">Hover/press (~200ms, ease-out):</strong>{" "}
            a small transform-only lift and press, so it feels responsive without ever
            touching layout.
          </li>
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">State swaps (~220ms, ease-out):</strong>{" "}
            the label/icon cross-fade in with a slight slide instead of snapping, so
            idle → loading → success/error reads as one continuous motion, not a flicker.
            The button reserves a minimum width so longer/shorter labels never reflow the
            layout around it — only opacity/transform animate.
          </li>
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">Success (~1.6s hold):</strong>{" "}
            long enough to register as real confirmation before auto-returning to idle,
            short enough not to block the next action.
          </li>
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">Error (400ms shake, ease-in-out):</strong>{" "}
            one decreasing-amplitude shake draws the eye once, then stops — the red
            color and alert icon (not the shake) are what keep the error legible
            afterward, and it never relies on color alone.
          </li>
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">Reduced motion:</strong>{" "}
            the shake and slide are wrapped so <code>prefers-reduced-motion: reduce</code>{" "}
            removes them entirely — state still changes instantly and stays fully legible
            via color, icon, and text. The loading spinner keeps spinning either way,
            since it communicates an active process rather than decoration.
          </li>
        </ul>
      </section>
    </div>
  );
}
