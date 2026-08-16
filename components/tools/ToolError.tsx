// output-error: the tool call failed. Answers "what went wrong?" — visually
// distinct (red, warning icon) from the success card, states plainly that
// the analysis failed, and never surfaces a raw stack trace or error object.
export function ToolError({ message }: { message: string }) {
  return (
    <div className="tool-state-transition flex max-w-[85%] flex-col gap-1.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm sm:max-w-[75%] dark:border-red-900/60 dark:bg-red-950/30">
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
        <span>Lead analysis failed</span>
      </div>
      <p className="text-red-600 dark:text-red-300/90">{message}</p>
    </div>
  );
}
