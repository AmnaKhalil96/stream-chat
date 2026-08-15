import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { CHAT_MODEL, SYSTEM_PROMPT } from "@/lib/ai/config";

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
  });

  return result.toUIMessageStreamResponse();
}
