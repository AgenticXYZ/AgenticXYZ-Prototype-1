import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

import { chromium, type Page } from "playwright";

const root = process.cwd();
const temporary = path.join(root, ".demo-video-tmp");
const destination = path.join(root, "demo/agenticxyz-prototype-1.webm");
const demoUrl = "http://127.0.0.1:4173/";
fs.mkdirSync(temporary, { recursive: true });
fs.mkdirSync(path.dirname(destination), { recursive: true });

async function reachable(): Promise<boolean> {
  try {
    const response = await fetch(demoUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureWebServer(): Promise<ChildProcess | undefined> {
  if (await reachable()) return undefined;
  const viteEntry = path.join(root, "node_modules/vite/bin/vite.js");
  const server = spawn(process.execPath, [viteEntry, "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Demo web server exited with code ${server.exitCode}.`);
    if (await reachable()) return server;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  server.kill("SIGTERM");
  throw new Error("Demo web server did not become ready within 10 seconds.");
}

let ownedServer: ChildProcess | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  ownedServer = await ensureWebServer();
  browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--force-device-scale-factor=1"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: temporary, size: { width: 1440, height: 1000 } }
  });
  const page = await context.newPage();
  const pause = (duration = 550) => page.waitForTimeout(duration);

  async function closeRuntime() {
    const button = page.getByRole("button", { name: "Close Runtime Inspector" });
    await button.waitFor({ state: "visible" });
    await pause(500);
    await button.click();
  }

  async function dismissNotifications(target: Page) {
    const buttons = target.getByRole("button", { name: "Dismiss notification" });
    while ((await buttons.count()) > 0) await buttons.first().click();
  }

  await page.route("**/api/health", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      activeProvider: "openai",
      activeModel: "recorded-reference-model",
      providers: [
        { provider: "openai", available: false, active: true },
        { provider: "anthropic", available: false, active: false },
        { provider: "deepseek", available: false, active: false }
      ],
      keyHandling: "server-environment-only"
    })
  }));
  await page.goto(demoUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("heading", { name: "Agents with People" }).waitFor();
  await pause(1200);

  await page.getByTestId("run-user-agent").click();
  await closeRuntime();
  await page.getByTestId("approve-overlay").click();
  await pause();
  await page.getByTestId("verify-overlay").click();
  await pause(900);
  await dismissNotifications(page);
  await page.getByTestId("create-kpr").click();
  await pause(900);
  await page.getByRole("tab", { name: "knowledge" }).click();
  await pause(900);
  await page.getByLabel("Contributor correction for claim-problem").fill(
    "In this Research Brief scenario, the current layout delays the decision-relevant conclusion until after the supporting context."
  );
  await page.getByTestId("attest-kpr").click();
  await pause(700);
  await page.getByTestId("scan-kpr").click();
  await page.getByTestId("submit-kpr").click();
  await page.getByTestId("knowledge-gate").click();
  await pause(900);

  await page.getByTestId("run-maintainer-agent").click();
  await closeRuntime();
  await page.locator(".review-sequence").getByRole("button", { name: /impact/ }).click();
  await pause(1100);
  await page.locator(".review-sequence").getByRole("button", { name: /integration/ }).click();
  await page.getByTestId("generate-contract").click();
  await dismissNotifications(page);
  await pause(1100);

  await page.getByTestId("run-project-agent").click();
  await closeRuntime();
  await page.locator(".review-sequence").getByRole("button", { name: /result/ }).click();
  await page.getByTestId("verify-project").click();
  await dismissNotifications(page);
  await pause(1100);
  await page.getByTestId("adopt-project").click();
  await dismissNotifications(page);
  await pause(1600);

  const video = page.video();
  await context.close();
  if (!video) throw new Error("Playwright did not create a video artifact.");
  await video.saveAs(destination);
} finally {
  if (browser?.isConnected()) await browser.close();
  fs.rmSync(temporary, { recursive: true, force: true });
  ownedServer?.kill("SIGTERM");
}

process.stdout.write(`Demo video saved to ${path.relative(root, destination)}\n`);
