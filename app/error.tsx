"use client";

import { useEffect } from "react";

// Next.js 16.3 route-level error boundary. As of 16.3.0 the boundary passes
// both `reset` (clear the boundary's local error state) and the newer,
// recommended `retry` (re-fetch the segment via router.refresh(), then
// reset) — see node_modules/next/dist/client/components/error-boundary.js.
// `retry` is used here since it's the more complete recovery of the two.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Server-side details are already stripped by Next.js in production
    // (see error.digest); this is just for local/browser debugging.
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Something went wrong
        </h2>
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          This page hit an unexpected error. It&apos;s on our side, not something you did — try
          again.
        </p>
      </div>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
