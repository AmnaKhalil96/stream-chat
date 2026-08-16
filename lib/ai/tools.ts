import { tool, type InferUITools } from "ai";
import { z } from "zod";

// Zod schema is the single source of truth for the tool's input shape — the
// language model, the server-side executor, and the client's typed UI parts
// (via InferUITools below) all derive from this one definition.
export const leadInputSchema = z.object({
  company: z.string().trim().min(1, "Company name is required").max(200),
  budget: z.number().nonnegative("Budget must be zero or greater"),
  timeline: z.string().trim().min(1, "Timeline is required").max(100),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

export type LeadCategory = "Hot" | "Warm" | "Cold";

export interface LeadAnalysis {
  score: number;
  category: LeadCategory;
  reasons: string[];
  summary: string;
}

// Roughly how many weeks a timeline phrase like "2 months" or "next
// quarter" represents, so urgency can be scored on one consistent scale.
const UNIT_TO_WEEKS: Record<string, number> = {
  day: 1 / 7,
  week: 1,
  month: 4.345,
  quarter: 13,
  year: 52,
};

function estimateTimelineWeeks(timeline: string): number | null {
  const lower = timeline.toLowerCase();
  if (/\b(asap|urgent|immediately|right away)\b/.test(lower)) return 0;

  const match = lower.match(/(\d+(?:\.\d+)?)\s*(day|week|month|quarter|year)/);
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  const unitWeeks = UNIT_TO_WEEKS[match[2]];
  return value * unitWeeks;
}

function scoreBudget(budget: number): { points: number; reason: string } {
  const formatted = `$${budget.toLocaleString("en-US")}`;
  if (budget >= 50_000) {
    return { points: 45, reason: `Budget of ${formatted} shows strong purchasing power.` };
  }
  if (budget >= 20_000) {
    return { points: 32, reason: `Budget of ${formatted} indicates solid investment capacity.` };
  }
  if (budget >= 5_000) {
    return { points: 18, reason: `Budget of ${formatted} shows genuine intent, though modest.` };
  }
  if (budget > 0) {
    return { points: 8, reason: `Budget of ${formatted} is small relative to a typical deal.` };
  }
  return { points: 0, reason: "No budget was specified, which limits deal confidence." };
}

function scoreTimeline(timeline: string): { points: number; reason: string } {
  const weeks = estimateTimelineWeeks(timeline);

  if (weeks === null) {
    return {
      points: 10,
      reason: `Timeline ("${timeline}") wasn't specific enough to gauge urgency precisely.`,
    };
  }
  if (weeks <= 2) {
    return { points: 45, reason: `Very short timeline ("${timeline}") signals high urgency.` };
  }
  if (weeks <= 6) {
    return { points: 32, reason: `Near-term timeline ("${timeline}") suggests real momentum.` };
  }
  if (weeks <= 13) {
    return { points: 20, reason: `Timeline ("${timeline}") is moderate — decision isn't imminent.` };
  }
  return { points: 8, reason: `Longer timeline ("${timeline}") suggests lower near-term urgency.` };
}

function categorize(score: number): LeadCategory {
  if (score >= 65) return "Hot";
  if (score >= 35) return "Warm";
  return "Cold";
}

// Deterministic, local scoring — no external APIs — so the tool behaves
// reliably in this demo/assignment without extra services or API keys.
function analyzeLeadLocally(input: LeadInput): LeadAnalysis {
  // Development-safe, documented trigger for exercising the `output-error`
  // UI state: including this phrase in the company name makes the tool
  // throw on purpose. See README's "Tool Contract" section.
  if (input.company.toLowerCase().includes("trigger-error")) {
    throw new Error(
      "Simulated failure: analyzeLead intentionally errored because the company name contained the test trigger phrase 'trigger-error'."
    );
  }

  const budgetScore = scoreBudget(input.budget);
  const timelineScore = scoreTimeline(input.timeline);
  const score = Math.min(100, budgetScore.points + timelineScore.points);
  const category = categorize(score);

  const summary = `${input.company} is a ${category.toLowerCase()} lead (${score}/100) — budget of $${input.budget.toLocaleString(
    "en-US"
  )} with a "${input.timeline}" timeline.`;

  return {
    score,
    category,
    reasons: [budgetScore.reason, timelineScore.reason],
    summary,
  };
}

export const tools = {
  analyzeLead: tool({
    description:
      "Analyze and score a sales lead from its company name, budget, and timeline. " +
      "Returns a 0-100 score, a Hot/Warm/Cold category, supporting reasons, and a summary. " +
      "Call this whenever the user asks to analyze, score, evaluate, or qualify a lead " +
      "instead of estimating it yourself.",
    inputSchema: leadInputSchema,
    execute: async (input): Promise<LeadAnalysis> => analyzeLeadLocally(input),
  }),
};

export type ChatTools = InferUITools<typeof tools>;
