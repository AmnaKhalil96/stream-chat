import type { LeadAnalysis, LeadCategory } from "@/lib/ai/tools";

const CATEGORY_STYLES: Record<
  LeadCategory,
  { badge: string; ring: string; bar: string }
> = {
  Hot: {
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    ring: "text-orange-500",
    bar: "bg-orange-500",
  },
  Warm: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    ring: "text-amber-500",
    bar: "bg-amber-500",
  },
  Cold: {
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    ring: "text-sky-500",
    bar: "bg-sky-500",
  },
};

// output-available: the tool finished successfully. Answers "what did the
// tool find?" — a real product component (score, category, reasons,
// summary), not JSON or a code block.
export function LeadScoreCard({ result }: { result: LeadAnalysis }) {
  const styles = CATEGORY_STYLES[result.category];

  return (
    <div className="tool-state-transition flex max-w-[85%] flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-sm shadow-sm sm:max-w-[75%] dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {result.score}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">/ 100</span>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles.badge}`}
        >
          {result.category} lead
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full ${styles.bar}`}
          style={{ width: `${Math.max(4, Math.min(100, result.score))}%` }}
        />
      </div>

      <p className="text-zinc-700 dark:text-zinc-300">{result.summary}</p>

      {result.reasons.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
          {result.reasons.map((reason, index) => (
            <li key={index} className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${styles.ring}`}
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
