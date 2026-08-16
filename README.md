This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Tool Contract

The chat route (`app/api/chat/route.ts`) registers a server-side AI SDK tool, `analyzeLead`, defined in `lib/ai/tools.ts`. Gemini decides on its own when to call it based on the system prompt and the user's message — try "Analyze this lead: ABC Academy, budget 50000, timeline 2 weeks."

**Purpose:** Scores a sales lead from its company name, budget, and timeline using deterministic, local logic (no external API calls), and returns a structured result the UI renders as a real component.

**Input schema** (Zod, `leadInputSchema`):

| Field      | Type     | Notes                          |
| ---------- | -------- | ------------------------------- |
| `company`  | `string` | 1–200 chars                     |
| `budget`   | `number` | ≥ 0                              |
| `timeline` | `string` | 1–100 chars, free text (e.g. "2 weeks", "next quarter") |

**Return shape** (`LeadAnalysis`):

| Field      | Type                          | Notes                                   |
| ---------- | ------------------------------ | ---------------------------------------- |
| `score`    | `number`                       | 0–100                                    |
| `category` | `"Hot" \| "Warm" \| "Cold"`     | derived from `score`                     |
| `reasons`  | `string[]`                     | one reason per scoring factor            |
| `summary`  | `string`                       | one-line human-readable summary          |

Both types are inferred from `leadInputSchema`/hand-written in `lib/ai/tools.ts`, and `InferUITools` derives the client-side tool part types from the same tool definition — there's a single source of truth for input/output shapes across server and UI.

**Testing the error state:** including the phrase `trigger-error` in the `company` field (e.g. "Analyze this lead: Trigger-Error Inc, budget 10000, timeline 1 month.") makes the tool intentionally throw, so the `output-error` UI can be exercised on demand without needing a real failure.

### Tool lifecycle UI

`components/Chat.tsx` renders `message.parts`, and for any part of type `tool-analyzeLead` it switches on `part.state`:

- **`input-streaming`** — `components/tools/ToolInput.tsx` (`ToolInputStreaming`): a dashed, skeleton-style card ("Preparing lead analysis…") that fills in each field as the model streams its arguments.
- **`input-available`** — `components/tools/ToolInput.tsx` (`ToolInputAvailable`): a solid card showing the finalized company/budget/timeline the tool is about to run with.
- **`output-available`** — `components/tools/LeadScoreCard.tsx`: the score, category badge, progress bar, summary, and reasons as a real product component (no JSON, no code block).
- **`output-error`** — `components/tools/ToolError.tsx`: a red, warning-styled card with a sanitized message. The server's `onError` handler (in `app/api/chat/route.ts`) always maps thrown errors to a safe, generic string before they reach the client, so raw stack traces are never exposed.

Each state transition applies a 200ms fade/slide-in (`.tool-state-transition` in `app/globals.css`) so the swap between states reads as intentional rather than a layout jump.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
