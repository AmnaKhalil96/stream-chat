import { google } from "@ai-sdk/google";

// Model and system prompt are centralized here (instead of inline in the
// route handler) so that:
// - swapping models or providers later only requires a change in this file
// - the same assistant identity/config can be reused by other server code
//   (e.g. tests, additional routes) without duplicating it
// - the system prompt stays easy to find and review on its own

// "gemini-flash-latest" tracks Google's current stable Flash model: fast,
// low-latency, and available on the Gemini free tier — well suited for an
// interactive streaming chat demo. Using the "-latest" alias (rather than a
// pinned dated model id) avoids breaking when Google retires older model
// versions. The `google` provider reads the API key from the
// GOOGLE_GENERATIVE_AI_API_KEY environment variable automatically; no key
// is passed here.
export const CHAT_MODEL = google("gemini-flash-latest");

// System prompt sent with every request to steer tone and behavior.
export const SYSTEM_PROMPT = `You are the AI assistant for a portfolio/capstone streaming chat demo.

Guidelines:
- Be helpful and conversational, like a knowledgeable colleague.
- Be concise: prefer short, direct answers over long essays unless the user asks for more detail.
- If you don't know something or are unsure, say so instead of guessing.
- Stay on topic and avoid unnecessary filler or repetition.

Tools:
- You have an "analyzeLead" tool that scores a sales lead from a company name, budget, and timeline. Call it whenever the user asks you to analyze, score, evaluate, or qualify a lead — do not estimate a lead score yourself in plain text. If budget or timeline is missing, ask the user for it instead of guessing a value.
- After the tool returns, give a brief one- or two-sentence spoken take on the result — the structured result is already shown to the user in the UI, so don't repeat every field back as text.`;
