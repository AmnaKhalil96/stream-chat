import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { LeadAnalysis } from "@/lib/ai/tools";
import { LeadScoreCard } from "./LeadScoreCard";

describe("LeadScoreCard", () => {
  it("renders a hot lead's score, category, summary, and reasons", () => {
    const result: LeadAnalysis = {
      score: 87,
      category: "Hot",
      summary: "Acme Corp is ready to move fast with a strong budget.",
      reasons: [
        "Budget of $75,000 shows strong purchasing power",
        "Timeline of 1 week signals urgent buying intent",
      ],
    };

    render(<LeadScoreCard result={result} />);

    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.getByText("/ 100")).toBeInTheDocument();
    expect(screen.getByText("Hot lead")).toBeInTheDocument();
    expect(screen.getByText(result.summary)).toBeInTheDocument();
    for (const reason of result.reasons) {
      expect(screen.getByText(reason)).toBeInTheDocument();
    }
  });

  it("renders a cold lead with no reasons without showing an empty reasons list", () => {
    const result: LeadAnalysis = {
      score: 12,
      category: "Cold",
      summary: "Not enough signal to gauge interest yet.",
      reasons: [],
    };

    render(<LeadScoreCard result={result} />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Cold lead")).toBeInTheDocument();
    expect(screen.getByText(result.summary)).toBeInTheDocument();
    // The reasons <ul> is only rendered when there's at least one reason.
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
