import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { expect, test } from "@playwright/test";

import { closeRuntime, createKpr, generateContract, passKnowledgeGate, resetDemo, runMaintainerReview, synthesizeCandidate } from "./helpers";

const outputRoot = path.resolve(process.cwd(), "screenshots/canonical");
type ScreenshotLanguage = "en" | "zh-CN";

async function setLanguage(page: import("@playwright/test").Page, language: ScreenshotLanguage) {
  const expected = language === "zh-CN" ? "zh-CN" : "en";
  if (await page.locator("html").getAttribute("lang") === expected) return;
  await page.getByRole("button", { name: language === "zh-CN" ? "中" : "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", expected);
}

async function shot(page: import("@playwright/test").Page, output: string, name: string, language: ScreenshotLanguage) {
  const dismiss = page.locator(".notifications button");
  while ((await dismiss.count()) > 0) await dismiss.first().click();
  await setLanguage(page, language);
  await page.evaluate(async () => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    await document.fonts.ready;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false, animations: "disabled", caret: "hide" });
  if (language === "zh-CN") await setLanguage(page, "en");
}

function writeChecksums(output: string) {
  const files = fs.readdirSync(output).filter((name) => name.endsWith(".png")).sort();
  const checksums = Object.fromEntries(files.map((name) => [name, crypto.createHash("sha256").update(fs.readFileSync(path.join(output, name))).digest("hex")]));
  fs.writeFileSync(path.join(output, "checksums.json"), `${JSON.stringify({ algorithm: "SHA-256", viewport: "1920x1080", artifacts: checksums }, null, 2)}\n`);
}

async function generateCanonicalStory(page: import("@playwright/test").Page, language: ScreenshotLanguage) {
  const output = language === "en" ? outputRoot : path.join(outputRoot, "zh-CN");
  fs.mkdirSync(output, { recursive: true });
  await resetDemo(page);
  if (language === "en") {
    await setLanguage(page, "zh-CN");
    await setLanguage(page, "en");
  }
  await shot(page, output, "01-system-overview", language);

  await page.getByTestId("run-user-agent").click();
  await closeRuntime(page);
  await page.getByTestId("approve-overlay").click();
  await page.getByTestId("verify-overlay").click();
  await shot(page, output, "02-user-workspace", language);
  await page.getByTestId("create-kpr").click();
  await page.getByRole("tab", { name: "knowledge" }).click();
  await page.getByTestId("attest-kpr").click();
  await shot(page, output, "03-human-attestation", language);
  await shot(page, output, "05-knowledge-diff-provenance", language);

  await passKnowledgeGate(page);
  await runMaintainerReview(page);
  await shot(page, output, "04-decision-brief", language);
  await page.getByRole("button", { name: "03 impact", exact: true }).click();
  await shot(page, output, "06-impact-maintainer-shaping", language);
  await generateContract(page);
  await shot(page, output, "07-integration-contract", language);
  await synthesizeCandidate(page);
  await page.getByTestId("verify-project").click();
  await shot(page, output, "08-behavior-knowledge-evidence-diff", language);
  await page.getByRole("button", { name: "Open failure laboratory" }).click();
  await expect(page.getByTestId("failure-lab")).toContainText("4/4");
  await shot(page, output, "09-verification-failure-rollback", language);
  await page.getByRole("button", { name: "Hide failure laboratory" }).click();
  await page.getByTestId("adopt-project").click();
  await shot(page, output, "10-final-governance", language);
  writeChecksums(output);
}

for (const language of ["en", "zh-CN"] as const) {
  test(`generates all ten canonical screenshots in ${language}`, async ({ page }) => {
    await page.route("**/api/health", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        activeProvider: "openai",
        activeModel: "recorded-reference-model",
        providers: [
          { provider: "openai", available: false, active: true, source: "none" },
          { provider: "anthropic", available: false, active: false, source: "none" },
          { provider: "deepseek", available: false, active: false, source: "none" }
        ],
        keyHandling: "server-memory-or-environment"
      })
    }));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.clock.setFixedTime(new Date("2026-08-13T20:00:00.000Z"));
    await page.addInitScript(() => {
      let sequence = 0;
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        configurable: true,
        value: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`
      });
    });
    await generateCanonicalStory(page, language);
  });
}
