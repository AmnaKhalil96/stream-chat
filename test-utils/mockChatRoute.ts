import { vi, type Mock } from "vitest";

/**
 * One AI SDK UI-message-stream chunk, e.g. `{ type: "text-delta", id: "0",
 * delta: "Hi" }`. Shapes verified against the actual installed `ai@7.0.66`
 * wire format (`@ai-sdk/provider-utils`'s `parseJsonEventStream`, a
 * standard `data: <json>\n\n` SSE stream) — not guessed.
 */
export type SseEvent = Record<string, unknown>;

/**
 * A stream "step": either an event to encode and enqueue, or a
 * synchronization gate — an async function that's awaited before the
 * stream continues to the next step. Gates let a test pause a stream at an
 * exact point (assert an intermediate UI state), then resume it explicitly
 * by resolving a promise the test controls, instead of using a sleep.
 */
export type SseStep = SseEvent | (() => Promise<void>);

const encoder = new TextEncoder();

/** Builds a real `ReadableStream<Uint8Array>` of SSE bytes from `steps`. */
export function createSseStream(steps: SseStep[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      // Loops internally past any number of consecutive gate steps within
      // this one pull() call, rather than returning early and relying on
      // the stream to invoke pull() again — empirically, a pull() that
      // resolves without enqueueing or closing is not reliably re-invoked.
      while (index < steps.length) {
        const step = steps[index++];
        if (typeof step === "function") {
          await step();
          continue;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(step)}\n\n`));
        return;
      }
      controller.close();
    },
  });
}

/** Wraps `createSseStream` in a `Response` matching what
 * `result.toUIMessageStreamResponse()` actually returns. */
export function sseResponse(steps: SseStep[], init?: { status?: number }): Response {
  return new Response(createSseStream(steps), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** Creates a promise/resolver pair for use as a gate step — pass `wait` as
 * a step in `steps`, then call `release()` from the test when ready to let
 * the stream continue. */
export function createGate() {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
}

export interface ChatRequestCall {
  url: string;
  method: string;
  body: { messages?: unknown[]; trigger?: string; [key: string]: unknown } | undefined;
}

/**
 * Replaces `globalThis.fetch` with a mock that only ever intercepts
 * `POST .../api/chat` — anything else throws immediately, so a test can
 * never silently fall through to a real network call. `handler` is called
 * once per intercepted request (0-indexed) and returns the `Response` to
 * resolve with — different responses per call index is what powers the
 * retry-flow test (first call errors, second call succeeds).
 */
export function installChatFetchMock(
  handler: (call: ChatRequestCall, callIndex: number) => Response | Promise<Response>
): Mock {
  let callIndex = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();

    if (!url.includes("/api/chat") || method !== "POST") {
      throw new Error(
        `Test made an unexpected fetch call (${method} ${url}) — only POST /api/chat is mocked. ` +
          "This test suite must never reach a real network call."
      );
    }

    const body = init?.body ? (JSON.parse(init.body as string) as ChatRequestCall["body"]) : undefined;
    const response = await handler({ url, method, body }, callIndex);
    callIndex++;
    return response;
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Convenience: a short, complete, single-message assistant text reply. */
export function textReplySteps(text: string): SseEvent[] {
  return [
    { type: "start" },
    { type: "start-step" },
    { type: "text-start", id: "0" },
    { type: "text-delta", id: "0", delta: text },
    { type: "text-end", id: "0" },
    { type: "finish-step" },
    { type: "finish" },
  ];
}

/** A sanitized chat-level error stream, matching what
 * `app/api/chat/route.ts`'s `onError` actually produces on the wire. */
export function chatErrorSteps(
  errorText = "Something went wrong while processing that. Please try again."
): SseEvent[] {
  return [{ type: "start" }, { type: "error", errorText }];
}
