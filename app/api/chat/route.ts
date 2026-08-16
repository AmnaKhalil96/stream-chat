import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { CHAT_MODEL, SYSTEM_PROMPT } from "@/lib/ai/config";
import { tools } from "@/lib/ai/tools";

export const runtime = "nodejs";
// Long streamed responses can take longer than the default serverless
// function timeout on hosts like Vercel (10s on the hobby tier) — extend it
// so a long generation isn't cut off mid-stream after deployment.
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: CHAT_MODEL,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    // Allow a follow-up model step after a tool call (e.g. to comment on the
    // analyzeLead result) while still bounding the loop.
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    // Default AI SDK behavior already withholds raw error details from the
    // client; this override keeps that guarantee while logging the real
    // error server-side for debugging (e.g. the analyzeLead error-state
    // trigger, or a real model/tool failure).
    onError: (error) => {
      console.error("Chat stream error:", error);
      // Recognize (without forwarding) the analyzeLead dev-test trigger so
      // the UI can show a clear, specific message instead of a generic one
      // — still never the raw error object or stack trace.
      if (error instanceof Error && error.message.startsWith("Simulated failure")) {
        return "The lead analysis tool could not complete for this input (simulated failure, triggered for testing).";
      }
      return "Something went wrong while processing that. Please try again.";
    },
  });
}
