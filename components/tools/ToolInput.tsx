import type { LeadInput } from "@/lib/ai/tools";

const FIELD_LABELS: Record<keyof LeadInput, string> = {
  company: "Company",
  budget: "Budget",
  timeline: "Timeline",
};

function formatValue(key: keyof LeadInput, value: string | number | undefined): string {
  if (value === undefined || value === "") return "";
  if (key === "budget" && typeof value === "number") {
    return `$${value.toLocaleString("en-US")}`;
  }
  return String(value);
}

// input-streaming: the model is still generating arguments. Answers "what is
// happening right now?" — a lightweight, provisional skeleton that fills in
// as each field of the (partial) input arrives, not a finished-looking card.
export function ToolInputStreaming({ input }: { input: Partial<LeadInput> | undefined }) {
  const fields: Array<keyof LeadInput> = ["company", "budget", "timeline"];

  return (
    <div className="tool-state-transition flex max-w-[85%] flex-col gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-3 text-sm sm:max-w-[75%] dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute h-2 w-2 animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative h-2 w-2 rounded-full bg-blue-500" />
        </span>
        <span>Preparing lead analysis…</span>
      </div>
      <dl className="flex flex-col gap-1">
        {fields.map((key) => {
          const value = formatValue(key, input?.[key]);
          return (
            <div key={key} className="flex items-center gap-2">
              <dt className="w-16 shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                {FIELD_LABELS[key]}
              </dt>
              <dd className="min-w-0 flex-1">
                {value ? (
                  <span className="text-zinc-700 dark:text-zinc-300">{value}</span>
                ) : (
                  <span className="inline-block h-3 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

// input-available: arguments are finalized and the tool is about to (or is
// starting to) execute. Answers "what input will be used?" — a confident,
// fully-formed card rather than a skeleton.
export function ToolInputAvailable({ input }: { input: LeadInput }) {
  const fields: Array<keyof LeadInput> = ["company", "budget", "timeline"];

  return (
    <div className="tool-state-transition flex max-w-[85%] flex-col gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm sm:max-w-[75%] dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-50">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4 shrink-0 animate-spin text-blue-500"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <path d="M17.5 10a7.5 7.5 0 0 0-7.5-7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span>Lead Analysis</span>
      </div>
      <dl className="flex flex-col gap-1">
        {fields.map((key) => (
          <div key={key} className="flex items-baseline gap-2">
            <dt className="w-16 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
              {FIELD_LABELS[key]}
            </dt>
            <dd className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">
              {formatValue(key, input[key]) || "—"}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">Running analysis…</p>
    </div>
  );
}
