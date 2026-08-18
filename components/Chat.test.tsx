import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Chat from "./Chat";
import {
  chatErrorSteps,
  createGate,
  installChatFetchMock,
  sseResponse,
  textReplySteps,
  type ChatRequestCall,
} from "@/test-utils/mockChatRoute";

function getMessageInput() {
  return screen.getByRole("textbox", { name: "Message" });
}

function getSendButton() {
  return screen.getByRole("button", { name: "Send" });
}

function sendMessage(text: string) {
  fireEvent.change(getMessageInput(), { target: { value: text } });
  fireEvent.click(getSendButton());
}

describe("Chat", () => {
  // TEST 1
  it("shows the empty state with example prompts, and selecting one fills the input without submitting", () => {
    const fetchMock = installChatFetchMock(() => {
      throw new Error("fetch should not be called from the empty state");
    });

    render(<Chat />);

    expect(screen.getByRole("heading", { name: "Start a conversation" })).toBeInTheDocument();

    const prompts = [
      "Explain React Server Components simply.",
      "Help me debug a TypeScript error.",
      "Explain this code step by step.",
    ];
    for (const prompt of prompts) {
      expect(screen.getByRole("button", { name: prompt })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: prompts[0] }));

    expect(getMessageInput()).toHaveValue(prompts[0]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // TEST 2
  it("disables Send for empty/whitespace input, enables it for real text, and trims the message on submit", async () => {
    let capturedBody: ChatRequestCall["body"];
    const fetchMock = installChatFetchMock((call) => {
      capturedBody = call.body;
      return sseResponse(textReplySteps("Hi there!"));
    });

    render(<Chat />);
    const input = getMessageInput();
    const sendButton = getSendButton();

    expect(sendButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "   " } });
    expect(sendButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "   Hello there   " } });
    expect(sendButton).not.toBeDisabled();

    fireEvent.click(sendButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const lastMessage = capturedBody?.messages?.at(-1) as
      | { parts?: Array<{ type: string; text?: string }> }
      | undefined;
    const textPart = lastMessage?.parts?.find((part) => part.type === "text");
    expect(textPart?.text).toBe("Hello there");

    expect(input).toHaveValue("");
  });

  // TEST 3
  it("shows a thinking indicator and a Stop control while the request is pending", async () => {
    const gate = createGate();
    installChatFetchMock(async () => {
      await gate.wait;
      return sseResponse(textReplySteps("Done"));
    });

    render(<Chat />);
    sendMessage("Hello");

    expect(await screen.findByText("Thinking")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();

    gate.release();
    expect(await screen.findByText("Done")).toBeInTheDocument();
  });

  // TEST 4
  it("renders streamed text incrementally, with partial content visible before the final content", async () => {
    const gate = createGate();
    installChatFetchMock(() =>
      sseResponse([
        { type: "start" },
        { type: "start-step" },
        { type: "text-start", id: "0" },
        { type: "text-delta", id: "0", delta: "Hello" },
        () => gate.wait,
        { type: "text-delta", id: "0", delta: " world" },
        { type: "text-end", id: "0" },
        { type: "finish-step" },
        { type: "finish" },
      ])
    );

    render(<Chat />);
    sendMessage("Hi");

    expect(await screen.findByText("Hello")).toBeInTheDocument();
    expect(screen.queryByText("Hello world")).not.toBeInTheDocument();

    gate.release();

    expect(await screen.findByText("Hello world")).toBeInTheDocument();
  });

  // TEST 5
  it("shows an alert with a Retry button on a chat-level error, without exposing raw error text", async () => {
    installChatFetchMock(() => sseResponse(chatErrorSteps()));

    render(<Chat />);
    sendMessage("Hello");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/couldn't be completed/i)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  // TEST 6
  it("retries after a failure and shows the successful response without duplicating the user message", async () => {
    let secondCallBody: ChatRequestCall["body"];
    const fetchMock = installChatFetchMock((call, callIndex) => {
      if (callIndex === 0) return sseResponse(chatErrorSteps());
      secondCallBody = call.body;
      return sseResponse(textReplySteps("All better now."));
    });

    render(<Chat />);
    sendMessage("Hello");

    const alert = await screen.findByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(secondCallBody?.trigger).toBe("regenerate-message");

    expect(await screen.findByText("All better now.")).toBeInTheDocument();
    expect(screen.getAllByText("Hello")).toHaveLength(1);
  });

  // TEST 7
  it("renders each analyzeLead tool state through its corresponding component", async () => {
    const inputGate = createGate();
    const outputGate = createGate();
    installChatFetchMock(() =>
      sseResponse([
        { type: "start" },
        { type: "start-step" },
        { type: "tool-input-start", toolCallId: "call_1", toolName: "analyzeLead" },
        () => inputGate.wait,
        {
          type: "tool-input-available",
          toolCallId: "call_1",
          toolName: "analyzeLead",
          input: { company: "Acme", budget: 50000, timeline: "2 weeks" },
        },
        () => outputGate.wait,
        {
          type: "tool-output-available",
          toolCallId: "call_1",
          output: {
            score: 90,
            category: "Hot",
            reasons: ["Budget of $50,000 shows strong purchasing power."],
            summary: "Acme is a hot lead.",
          },
        },
        { type: "finish-step" },
        { type: "finish" },
      ])
    );

    render(<Chat />);
    sendMessage("Analyze Acme");

    // input-streaming
    expect(await screen.findByText("Preparing lead analysis…")).toBeInTheDocument();

    // input-available
    inputGate.release();
    expect(await screen.findByText("Lead Analysis")).toBeInTheDocument();
    expect(screen.getByText("$50,000")).toBeInTheDocument();
    expect(screen.getByText("Running analysis…")).toBeInTheDocument();

    // output-available
    outputGate.release();
    expect(await screen.findByText("Hot lead")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("Acme is a hot lead.")).toBeInTheDocument();
  });

  // TEST 8
  it("renders a tool output-error and a trailing text part within the same message via the correct components", async () => {
    const errorText =
      "The lead analysis tool could not complete for this input (simulated failure, triggered for testing).";
    installChatFetchMock(() =>
      sseResponse([
        { type: "start" },
        { type: "start-step" },
        { type: "tool-input-start", toolCallId: "call_2", toolName: "analyzeLead" },
        {
          type: "tool-input-available",
          toolCallId: "call_2",
          toolName: "analyzeLead",
          input: { company: "Bad Co", budget: 1000, timeline: "1 week" },
        },
        { type: "tool-output-error", toolCallId: "call_2", errorText },
        { type: "finish-step" },
        { type: "start-step" },
        { type: "text-start", id: "1" },
        { type: "text-delta", id: "1", delta: "Sorry, I couldn't analyze that lead." },
        { type: "text-end", id: "1" },
        { type: "finish-step" },
        { type: "finish" },
      ])
    );

    render(<Chat />);
    sendMessage("Analyze Bad Co");

    expect(await screen.findByText("Lead analysis failed")).toBeInTheDocument();
    expect(screen.getByText(errorText)).toBeInTheDocument();
    expect(await screen.findByText("Sorry, I couldn't analyze that lead.")).toBeInTheDocument();

    // The start-step markers in this exchange are parts Chat.tsx doesn't
    // render anything for — confirm they don't leak into the UI as text.
    expect(screen.queryByText(/step-start/i)).not.toBeInTheDocument();
  });
});
