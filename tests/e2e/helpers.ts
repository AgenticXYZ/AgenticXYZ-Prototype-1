import { expect, type Page } from "@playwright/test";

export async function resetDemo(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Agents with People" })).toBeVisible();
}

export async function closeRuntime(page: Page) {
  const close = page.getByRole("button", { name: "Close Runtime Inspector" });
  await close.waitFor({ state: "visible" });
  await close.click();
}

export async function createKpr(page: Page) {
  await page.getByTestId("run-user-agent").click();
  await expect(page.getByTestId("user-proposal")).toBeVisible();
  await closeRuntime(page);
  await page.getByTestId("approve-overlay").click();
  await page.getByTestId("verify-overlay").click();
  await expect(page.getByTestId("user-verifiers")).toContainText("Sources are preserved");
  await page.getByTestId("create-kpr").click();
  await expect(page.getByTestId("kpr-workspace")).toBeVisible();
  await page.getByRole("tab", { name: "knowledge" }).click();
  await page.getByTestId("attest-kpr").click();
  await expect(page.getByText("Agent-extracted · Human-attested").first()).toBeVisible();
}

export async function passKnowledgeGate(page: Page) {
  await page.getByTestId("scan-kpr").click();
  await page.getByTestId("submit-kpr").click();
  await page.getByTestId("knowledge-gate").click();
  await expect(page.getByTestId("developer-workspace")).toBeVisible();
}

export async function runMaintainerReview(page: Page) {
  await page.getByTestId("run-maintainer-agent").click();
  await closeRuntime(page);
  await expect(page.locator(".review-sequence").getByRole("button", { name: /knowledge/ })).toBeVisible();
}

export async function generateContract(page: Page) {
  await page.getByRole("button", { name: /integration/ }).click();
  await page.getByTestId("generate-contract").click();
  await expect(page.getByTestId("integration-contract")).toContainText("Contributor patch:");
  await expect(page.getByTestId("integration-contract")).toContainText("hidden");
}

export async function synthesizeCandidate(page: Page) {
  await page.getByTestId("run-project-agent").click();
  await closeRuntime(page);
  await page.getByRole("button", { name: /result/ }).click();
  await expect(page.getByTestId("result-review")).toContainText("Optional conclusion-first mode");
}

export async function completeGuidedFlow(page: Page) {
  await createKpr(page);
  await passKnowledgeGate(page);
  await runMaintainerReview(page);
  await generateContract(page);
  await synthesizeCandidate(page);
  await page.getByTestId("verify-project").click();
  await expect(page.getByTestId("result-review")).toContainText("Public default remains unchanged");
  await page.getByTestId("adopt-project").click();
  await expect(page.getByTestId("result-review")).toContainText("adopted");
}
