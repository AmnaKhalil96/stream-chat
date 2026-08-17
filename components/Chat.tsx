"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type TouchEvent,
  type UIEvent,
  type WheelEvent,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { ChatTools } from "@/lib/ai/tools";
import { ToolInputAvailable, ToolInputStreaming } from "@/components/tools/ToolInput";
import { LeadScoreCard } from "@/components/tools/LeadScoreCard";
import { ToolError } from "@/components/tools/ToolError";

// Extends the base UIMessage with the analyzeLead tool's typed input/output,
// so every `part.type === "tool-analyzeLead"` branch below is narrowed to
// the tool's real input/output types instead of `unknown`.
type ChatMessage = UIMessage<unknown, Record<string, unknown>, ChatTools>;

// Whether a message has anything worth rendering yet — plain text or a tool
// part. A message can have parts (e.g. a `step-start` marker) before it has
// anything visible, so this is stricter than `parts.length > 0`.
function hasVisibleContent(parts: ChatMessage["parts"]): boolean {
  return parts.some(
    (part) => (part.type === "text" && part.text.length > 0) || part.type === "tool-analyzeLead"
  );
}

// How close to the bottom (in px) still counts as "at the bottom". A small
// tolerance instead of exact equality, since scrollHeight/scrollTop can be
// off by a fraction of a pixel due to browser subpixel rounding.
const BOTTOM_THRESHOLD_PX = 64;

// Pending state: not just a spinner. The skeleton lines below the "Thinking"
// label approximate the size/shape of an incoming text response so that
// real content replacing it causes minimal layout shift.
function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[85%] flex-col gap-2.5 rounded-2xl bg-zinc-100 px-4 py-3 sm:max-w-[75%] dark:bg-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Thinking</span>
          <span className="flex gap-0.5">
            <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-current" />
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="h-2.5 w-44 animate-pulse rounded-full bg-zinc-300/70 dark:bg-zinc-700/70" />
          <span className="h-2.5 w-56 animate-pulse rounded-full bg-zinc-300/70 dark:bg-zinc-700/70" />
          <span className="h-2.5 w-32 animate-pulse rounded-full bg-zinc-300/70 dark:bg-zinc-700/70" />
        </div>
      </div>
    </div>
  );
}

// output-error at the chat level (not a tool error): the whole assistant
// response failed. Answers "what went wrong?" distinctly from a tool error —
// no raw error text, just a safe explanation plus a Retry action.
function ChatErrorNotice({
  onRetry,
  isRetrying,
  disabled,
}: {
  onRetry: (event: MouseEvent<HTMLButtonElement>) => void;
  isRetrying: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex justify-start" role="alert">
      <div className="flex max-w-[85%] flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm sm:max-w-[75%] dark:border-red-900/60 dark:bg-red-950/30">
        <div className="flex items-center gap-2 font-medium text-red-700 dark:text-red-400">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.63-1.516 2.63H3.72c-1.347 0-2.189-1.463-1.516-2.63L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          <span>Response couldn&apos;t be completed</span>
        </div>
        <p className="text-red-600 dark:text-red-300/90">
          Something interrupted the AI response. You can retry the failed response without
          resending the whole conversation.
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={disabled}
          className="self-start rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50 dark:bg-red-500"
        >
          {isRetrying ? "Retrying…" : "Retry"}
        </button>
      </div>
    </div>
  );
}

const EXAMPLE_PROMPTS = [
  "Explain React Server Components simply.",
  "Help me debug a TypeScript error.",
  "Explain this code step by step.",
];

// First-run empty state: onboarding, not an error. Clicking an example fills
// the input (via onSelectPrompt) without sending it.
function EmptyState({ onSelectPrompt }: { onSelectPrompt: (prompt: string) => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Start a conversation
        </h2>
        <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
          Ask anything, or try one of these to see what this chat can do.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/40"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Chat() {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, sendMessage, status, stop, error, regenerate } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  // Guards against a double-click firing `regenerate()` twice: the ref is
  // checked synchronously (no render lag), the state drives the button's
  // visible "Retrying…" label and disabled attribute.
  const isRetryingRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  async function handleRetry(event: MouseEvent<HTMLButtonElement>) {
    if (isRetryingRef.current || isBusy) return;
    isRetryingRef.current = true;
    // Disable the actual DOM button synchronously, before any state update
    // or await: React re-renders (and the `disabled` prop) land a tick
    // later, which leaves a window where two clicks fired in the same
    // synchronous burst can both pass the ref/state checks. A disabled
    // button doesn't dispatch further click events at all (per the HTML
    // spec), so this closes that race outright rather than racing it.
    const button = event.currentTarget;
    button.disabled = true;
    setIsRetrying(true);
    try {
      // Regenerates the last assistant message in place — it does not send
      // a new user message and does not leave a duplicate assistant message
      // behind, unlike calling sendMessage() again with the same text.
      await regenerate();
    } finally {
      isRetryingRef.current = false;
      button.disabled = false;
      setIsRetrying(false);
    }
  }

  function handleSelectPrompt(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  // "Following" = the viewport should keep pinning to the bottom as new
  // content arrives. A ref (checked inside the scroll effect, not a
  // dependency of it) avoids re-running the auto-scroll effect just because
  // the user scrolled — only new message content should trigger it. The
  // mirrored state is only for re-rendering the "Jump to latest" button.
  const isFollowingRef = useRef(true);
  const [isFollowing, setIsFollowing] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
    isFollowingRef.current = atBottom;
    setIsFollowing(atBottom);
  }

  // Under very fast streaming, a chunk can arrive (and re-pin the scroll
  // position via the effect below) in the brief window between a wheel/touch
  // gesture moving scrollTop and the browser dispatching the resulting
  // `scroll` event — which would make the auto-pin win the race and silently
  // swallow the user's gesture. Releasing the lock the instant an upward
  // gesture is detected, rather than waiting for its `scroll` aftermath,
  // closes that race regardless of how fast content is arriving.
  function releaseFollowing() {
    if (!isFollowingRef.current) return;
    isFollowingRef.current = false;
    setIsFollowing(false);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (event.deltaY < 0) releaseFollowing();
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    const startY = touchStartYRef.current;
    const currentY = event.touches[0]?.clientY;
    if (startY == null || currentY == null) return;
    // Finger moving down the screen drags older content into view (scrolls
    // away from the bottom).
    if (currentY > startY) releaseFollowing();
    touchStartYRef.current = currentY;
  }

  function jumpToLatest() {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    isFollowingRef.current = true;
    setIsFollowing(true);
  }

  // Only re-pin the scroll position when message content actually changes
  // (new message, or new streamed text on the last one) — never on
  // unrelated re-renders — and only while the user hasn't scrolled away.
  // Coalesced into at most one scrollTop write per animation frame: under
  // very fast streaming, `messages` can change many times within a single
  // frame, and writing scrollTop on every single one forces a synchronous
  // layout read/write each time, which can visibly jank the page. Skipping
  // straight to the latest scrollHeight once per frame keeps the same
  // "pinned to bottom" result without the redundant layout thrashing.
  const scrollRafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isFollowingRef.current) return;
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (!isFollowingRef.current) return;
      const el = scrollContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  useEffect(
    () => () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    },
    []
  );

  // The assistant message is pushed into `messages` (with empty parts) as
  // soon as the stream starts, before any text has arrived. Treat that
  // "message exists but has no text yet" state — as well as the brief
  // window between sending and the stream starting — as "thinking", so the
  // indicator swaps cleanly into the real text the moment it appears
  // instead of racing a separate timer.
  const lastMessage = messages[messages.length - 1];
  const isThinking =
    isBusy && (lastMessage?.role !== "assistant" || !hasVisibleContent(lastMessage.parts));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    // Sending a message is an explicit "show me the response" action, same
    // intent as clicking "Jump to latest" — resume following the bottom.
    isFollowingRef.current = true;
    setIsFollowing(true);
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl min-h-0 flex-1 flex-col">
      <header className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          AI Chat
        </h1>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className="absolute inset-0 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4"
        >
          {messages.length === 0 && !isBusy && (
            <EmptyState onSelectPrompt={handleSelectPrompt} />
          )}

          {messages.map((message) => {
            const isUser = message.role === "user";

            // The in-progress assistant message is rendered by the thinking
            // indicator / streaming bubble below instead, so it doesn't
            // briefly show up here as an empty bubble.
            if (message.id === lastMessage?.id && !isUser && !hasVisibleContent(message.parts)) {
              return null;
            }

            return (
              <div
                key={message.id}
                className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    if (!part.text) return null;
                    return (
                      <div
                        key={index}
                        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap sm:max-w-[75%] ${
                          isUser
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                        }`}
                      >
                        {part.text}
                      </div>
                    );
                  }

                  if (part.type === "tool-analyzeLead") {
                    switch (part.state) {
                      case "input-streaming":
                        return <ToolInputStreaming key={part.toolCallId} input={part.input} />;
                      case "input-available":
                        return <ToolInputAvailable key={part.toolCallId} input={part.input} />;
                      case "output-available":
                        return <LeadScoreCard key={part.toolCallId} result={part.output} />;
                      case "output-error":
                        return <ToolError key={part.toolCallId} message={part.errorText} />;
                      default:
                        return null;
                    }
                  }

                  return null;
                })}
              </div>
            );
          })}

          {isThinking && <ThinkingIndicator />}

          {error && (
            <ChatErrorNotice
              onRetry={handleRetry}
              isRetrying={isRetrying}
              disabled={isRetrying || isBusy}
            />
          )}
        </div>

        {!isFollowing && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <button
              type="button"
              onClick={jumpToLatest}
              className="pointer-events-auto rounded-full bg-zinc-800 px-4 py-1.5 text-xs font-medium text-white shadow-md dark:bg-zinc-200 dark:text-zinc-900"
            >
              Jump to latest
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-zinc-200 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-800"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message..."
          aria-label="Message"
          className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {isBusy ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-full bg-zinc-800 px-5 py-2 text-sm font-medium text-white dark:bg-zinc-200 dark:text-zinc-900"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
