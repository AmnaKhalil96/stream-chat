"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
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

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <span>Thinking</span>
        <span className="flex gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
        </span>
      </div>
    </div>
  );
}

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

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
          className="absolute inset-0 space-y-4 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 && !isBusy && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Send a message to start the conversation.
            </p>
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

          {status === "error" && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              Something went wrong. Please try again.
            </p>
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
        className="flex gap-2 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800"
      >
        <input
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
