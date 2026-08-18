import { test, expect } from "@playwright/test";

// Same AI SDK UI-message-stream wire format used by the Vitest mocks in
// test-utils/mockChatRoute.ts (standard `data: <json>\n\n` SSE), rebuilt
// here as a plain string since Playwright's route.fulfill() takes a body,
// not a ReadableStream.
function sseBody(events: Record<string, unknown>[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n";
}

test("sends a message and shows the mocked assistant's streamed response", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody([
        { type: "start" },
        { type: "start-step" },
        { type: "text-start", id: "0" },
        { type: "text-delta", id: "0", delta: "Hello from the mocked assistant!" },
        { type: "text-end", id: "0" },
        { type: "finish-step" },
        { type: "finish" },
      ]),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Start a conversation" })).toBeVisible();

  const input = page.getByRole("textbox", { name: "Message" });
  await input.fill("Hi there");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Hi there")).toBeVisible();
  await expect(page.getByText("Hello from the mocked assistant!")).toBeVisible();
});
