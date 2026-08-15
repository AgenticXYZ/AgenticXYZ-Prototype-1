import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";

import { completeGuidedFlow, resetDemo } from "./helpers";

test("has no serious accessibility violations or console errors in the initial workspace", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await resetDemo(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 740 }
]) {
  test(`keeps primary content readable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await resetDemo(page);
    await expect(page.getByTestId("user-workspace")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("keeps API-key-like values and local paths out of browser persistence", async ({ page }) => {
  await resetDemo(page);
  await completeGuidedFlow(page);
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
  expect(storage).not.toMatch(/\/Users\/[A-Za-z0-9._-]+\//);
  const health = await page.request.get("http://127.0.0.1:8787/api/health");
  const text = await health.text();
  expect(text).toContain("server-memory-or-environment");
  expect(text).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
});

test("imports only privacy-clean state and resets claimed credential availability", async ({ page }) => {
  await resetDemo(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("agenticxyz-prototype-1-state"))).not.toBeNull();
  const stored = await page.evaluate(() => localStorage.getItem("agenticxyz-prototype-1-state"));
  const state = JSON.parse(stored!) as { providerConfig: Record<string, unknown>; userRequest: string };
  state.providerConfig = { provider: "openai", model: "test-model", available: true, source: "environment" };
  await page.locator('input[type="file"]').setInputFiles({ name: "replay-state.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(state)) });
  await expect(page.getByText(/Credential availability was reset/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("agenticxyz-prototype-1-state") ?? "{}").providerConfig?.available)).toBe(false);

  state.userRequest = ["Contact person", "@example.com"].join("");
  await page.locator('input[type="file"]').setInputFiles({ name: "unsafe-state.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(state)) });
  await expect(page.getByText(/privacy finding/)).toBeVisible();
});

test("the complete governed journey is keyboard operable", async ({ page }) => {
  await resetDemo(page);
  const activate = async (locator: Locator) => {
    await locator.focus();
    await page.keyboard.press("Enter");
  };
  await page.getByTestId("user-request").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("run-user-agent")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("user-proposal")).toBeVisible();
  await activate(page.getByRole("button", { name: "Close Runtime Inspector" }));
  await activate(page.getByTestId("approve-overlay"));
  await activate(page.getByTestId("verify-overlay"));
  await activate(page.getByTestId("create-kpr"));
  await activate(page.getByRole("tab", { name: "knowledge" }));
  await activate(page.getByTestId("attest-kpr"));
  await activate(page.getByTestId("scan-kpr"));
  await activate(page.getByTestId("submit-kpr"));
  await activate(page.getByTestId("knowledge-gate"));
  await activate(page.getByTestId("run-maintainer-agent"));
  await activate(page.getByRole("button", { name: "Close Runtime Inspector" }));
  await activate(page.locator(".review-sequence").getByRole("button", { name: /integration/ }));
  await activate(page.getByTestId("generate-contract"));
  await activate(page.getByTestId("run-project-agent"));
  await activate(page.getByRole("button", { name: "Close Runtime Inspector" }));
  await activate(page.locator(".review-sequence").getByRole("button", { name: /result/ }));
  await activate(page.getByTestId("verify-project"));
  await activate(page.getByTestId("adopt-project"));
  await expect(page.getByText("Maintainer adopted the verified candidate", { exact: false })).toBeVisible();
});
