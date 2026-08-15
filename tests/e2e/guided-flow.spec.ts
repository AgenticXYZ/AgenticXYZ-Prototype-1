import { expect, test } from "@playwright/test";

import { closeRuntime, completeGuidedFlow, createKpr, generateContract, passKnowledgeGate, resetDemo, runMaintainerReview, synthesizeCandidate } from "./helpers";

test.beforeEach(async ({ page }) => resetDemo(page));

test("completes the canonical Agents with People guided flow", async ({ page }) => {
  await completeGuidedFlow(page);
  await expect(page.getByText("Adopt under human governance")).toBeVisible();
  await expect(page.getByText("Maintainer adopted the verified candidate", { exact: false })).toBeVisible();
});

test("restores the local reference behavior from a checkpoint", async ({ page }) => {
  await page.getByTestId("run-user-agent").click();
  await closeRuntime(page);
  await page.getByTestId("approve-overlay").click();
  await expect(page.getByText("local overlay active")).toBeVisible();
  await page.getByTestId("rollback-overlay").click();
  await expect(page.getByText("reference behavior", { exact: true })).toBeVisible();
  await expect(page.getByText("Context", { exact: true }).first()).toBeVisible();
});

test("principle lenses navigate to and highlight system objects", async ({ page }) => {
  await page.getByRole("button", { name: "Agent First", exact: true }).click();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-active-principle", "agent-first");
  await expect(page.getByTestId("software-contract")).toHaveCSS("outline-style", "solid");
  await page.getByRole("button", { name: "Agent First", exact: true }).click();
  await expect(page.locator(".app-shell")).not.toHaveAttribute("data-active-principle", "agent-first");
});

test("filters evidence from a Claim and exposes its limits", async ({ page }) => {
  await createKpr(page);
  await page.getByLabel("View evidence for claim-problem").click();
  await expect(page.getByText("Focused Claim:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conclusion appears before evidence" })).toBeVisible();
  await expect(page.getByText("Cannot prove", { exact: true })).toBeVisible();
  await expect(page.getByText("Verifier-produced; human review pending")).toBeVisible();
});

test("shows isolated Missing Attestation, Privacy, Policy, and verifier failures", async ({ page }) => {
  await createKpr(page);
  await passKnowledgeGate(page);
  await page.getByRole("button", { name: "Open failure laboratory" }).click();
  const lab = page.getByTestId("failure-lab");
  await expect(lab).toContainText("Missing Human Attestation");
  await expect(lab).toContainText("Privacy and secret block");
  await expect(lab).toContainText("Policy conflict and verifier failure");
  await expect(lab).toContainText("Agent says done, verifier says no");
  await expect(lab).toContainText("4/4");
});

test("blocks Project synthesis when the Maintainer requests more knowledge", async ({ page }) => {
  await createKpr(page);
  await passKnowledgeGate(page);
  await runMaintainerReview(page);
  await page.locator(".review-sequence").getByRole("button", { name: /knowledge/ }).click();
  await page.locator(".resolution-card").first().getByLabel("Maintainer decision").selectOption("request_evidence");
  await page.getByRole("button", { name: /integration/ }).click();
  await page.getByTestId("generate-contract").click();
  await expect(page.getByTestId("integration-contract")).toContainText("Synthesis blocked");
  await expect(page.getByTestId("run-project-agent")).toBeDisabled();
});

test("records explicit rejection without turning it into an Agent decision", async ({ page }) => {
  await createKpr(page);
  await passKnowledgeGate(page);
  await runMaintainerReview(page);
  await page.locator(".review-sequence").getByRole("button", { name: /knowledge/ }).click();
  await page.locator(".resolution-card").last().getByLabel("Maintainer decision").selectOption("reject");
  await page.getByRole("button", { name: /integration/ }).click();
  await page.getByTestId("generate-contract").click();
  await expect(page.getByTestId("integration-contract")).toContainText("Rejected knowledge");
  await expect(page.getByTestId("integration-contract")).toContainText("reject");
});

test("rolls a verified Project candidate back and can rebuild it", async ({ page }) => {
  await createKpr(page);
  await passKnowledgeGate(page);
  await runMaintainerReview(page);
  await generateContract(page);
  await synthesizeCandidate(page);
  await page.getByTestId("verify-project").click();
  await page.getByTestId("rollback-project").click();
  await expect(page.getByTestId("result-review")).toContainText("Approve a Contract");
  await page.getByRole("button", { name: /integration/ }).click();
  await page.getByTestId("run-project-agent").click();
  await closeRuntime(page);
  await page.getByRole("button", { name: /result/ }).click();
  await expect(page.getByTestId("verify-project")).toBeEnabled();
});

test("Scripted Fallback is complete without being represented as a model run", async ({ page }) => {
  await page.getByLabel("Run mode").selectOption("scripted");
  await page.getByTestId("run-user-agent").click();
  await expect(page.getByRole("dialog")).toContainText("No model request");
  await expect(page.getByRole("dialog")).toContainText("not a model-generated run");
});
