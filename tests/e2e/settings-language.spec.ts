import { expect, test } from "@playwright/test";

import { resetDemo } from "./helpers";

test("switches the full navigation shell between Chinese and English and remembers the choice", async ({ page }) => {
  await resetDemo(page);
  await page.getByRole("button", { name: "中" }).click();
  await expect(page.getByRole("heading", { name: "Agents with People · 智能体与人协作" })).toBeVisible();
  await expect(page.getByText("用户工作区", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "让软件知识与用户知识结合。" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Issue 分诊台/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开 AgenticXYZ 引导 Agent" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  for (const viewport of [{ width: 1000, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Agents with People · 智能体与人协作" })).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Agents with People" })).toBeVisible();
});

test("keeps the upper-right controls aligned at desktop width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await resetDemo(page);
  const selectors = [
    ".compact-field select",
    ".provider-readout",
    ".language-switch",
    ".header-action",
    ".header-menu > summary"
  ];
  const boxes = await Promise.all(selectors.map(async (selector) => {
    const box = await page.locator(selector).boundingBox();
    expect(box, `${selector} should be visible`).not.toBeNull();
    return box!;
  }));
  for (const box of boxes) {
    expect(Math.abs(box.y - boxes[0].y)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.height - boxes[0].height)).toBeLessThanOrEqual(1);
  }
});

test("opens Runtime by default while the reference application and User-side Agent stay side by side", async ({ page }) => {
  await resetDemo(page);
  await expect(page.getByTestId("runtime-sidebar")).toBeVisible();

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1000, height: 900 },
    { width: 700, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    const galleryBox = await page.getByTestId("reference-app-gallery").boundingBox();
    const agentBox = await page.getByRole("complementary", { name: "User-side Agent panel" }).boundingBox();
    expect(galleryBox, `gallery should be visible at ${viewport.width}px`).not.toBeNull();
    expect(agentBox, `User-side Agent should be visible at ${viewport.width}px`).not.toBeNull();
    expect(Math.abs(galleryBox!.y - agentBox!.y)).toBeLessThanOrEqual(2);
    expect(galleryBox!.x + galleryBox!.width).toBeLessThanOrEqual(agentBox!.x + 2);
  }
});

test("presents distinct reference applications and a governance-constrained Guide Agent", async ({ page }) => {
  await resetDemo(page);
  const gallery = page.getByTestId("reference-app-gallery");
  await expect(gallery.getByText("Running reference application", { exact: true })).toBeVisible();

  await gallery.getByRole("tab", { name: /Issue Triage/ }).click();
  await expect(gallery).toContainText("Human decision required");
  await expect(gallery).toContainText("keeps the complete governed KPR path scoped to Research Brief");

  await gallery.getByRole("tab", { name: /Release Desk/ }).click();
  await expect(gallery).toContainText("Agent target map");
  await expect(gallery).toContainText("Approve and publish");

  await page.getByRole("button", { name: "Open AgenticXYZ Guide Agent" }).click();
  const guide = page.getByRole("dialog", { name: "AgenticXYZ Guide Agent" });
  await expect(guide).toContainText("Global scope · all applications and the workbench");
  await expect(guide).toContainText("never approve, attest, merge, or adopt");
  await guide.getByRole("button", { name: "What is a KPR?" }).click();
  await expect(guide).toContainText("governed knowledge package");

  await guide.getByRole("button", { name: "Set up Provider" }).click();
  await expect(page.getByRole("dialog", { name: "Model API settings" })).toBeVisible();
});

test("switches to an application-only stage and runs the governed flow through XYZ", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await resetDemo(page);
  await page.getByRole("button", { name: "Open AgenticXYZ Guide Agent" }).click();
  const guide = page.getByRole("dialog", { name: "AgenticXYZ Guide Agent" });
  await guide.getByTestId("toggle-application-view").click();

  await expect(page.locator(".app-shell")).toHaveAttribute("data-application-only", "true");
  await expect(page.getByRole("heading", { name: "Agents with People" })).toHaveCount(0);
  await expect(page.locator(".left-rail")).toHaveCount(0);
  await expect(page.getByTestId("reference-app-gallery")).toBeVisible();
  const galleryBox = await page.getByTestId("reference-app-gallery").boundingBox();
  expect(galleryBox).not.toBeNull();
  expect(galleryBox!.x).toBeLessThanOrEqual(20);
  expect(galleryBox!.width).toBeGreaterThan(1350);

  const currentAction = guide.getByTestId("guide-current-action");
  await currentAction.click();
  await expect(currentAction).toHaveText("Approve local overlay");
  await currentAction.click();
  await expect(page.getByTestId("reference-app-gallery")).toContainText("local overlay active");
  await expect(currentAction).toHaveText("Run local verifiers");
  await currentAction.click();
  await expect(currentAction).toHaveText("Create KPR draft");
  await currentAction.click();

  await expect(currentAction).toHaveText("Attest reviewed knowledge");
  await currentAction.click();
  await expect(currentAction).toHaveText("Run privacy scan");
  await currentAction.click();
  await expect(currentAction).toHaveText("Submit KPR");
  await currentAction.click();
  await expect(currentAction).toHaveText("Run Knowledge Gate");
  await currentAction.click();
  await expect(currentAction).toHaveText("Ask Maintainer-side Agent");
  await currentAction.click();
  await expect(currentAction).toHaveText("Approve decisions & generate Contract");
  await currentAction.click();
  await expect(currentAction).toHaveText("Start blind reconstruction");
  await currentAction.click();
  await expect(currentAction).toHaveText("Run Contract verifiers");
  await currentAction.click();
  await expect(currentAction).toHaveText("Maintainer adopts candidate");
  await currentAction.click();
  await expect(guide.getByTestId("guide-workflow-complete")).toContainText("Human-governed adoption is complete");

  await guide.getByTestId("toggle-application-view").click();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-application-only", "false");
  await expect(page.getByRole("heading", { name: "Agents with People" })).toBeVisible();
  await expect(page.getByTestId("developer-workspace")).toBeVisible();
});

test("nests one scope-bound XYZ inside every reference application", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await resetDemo(page);
  const gallery = page.getByTestId("reference-app-gallery");

  for (const appName of ["Research Brief", "Agent Demo", "Daily News & Notes", "Issue Triage", "Release Desk"]) {
    await gallery.getByRole("tab", { name: new RegExp(appName.replaceAll("&", "\\&")) }).click();
    await expect(page.getByRole("button", { name: `Open Local XYZ Agent for ${appName}` })).toBeVisible();
  }
  await gallery.getByRole("tab", { name: /Research Brief/ }).click();

  await page.getByRole("button", { name: "Open Local XYZ Agent for Research Brief" }).click();
  await expect(page.getByTestId("local-xyz-panel-research-brief")).toContainText("Only this application");
  await page.getByTestId("local-xyz-panel-research-brief").getByRole("button", { name: "Close Local XYZ Agent" }).click();

  await gallery.getByRole("tab", { name: /Agent Demo/ }).click();
  await gallery.getByRole("button", { name: "Open this application's XYZ Agent" }).click();
  const local = page.getByTestId("local-xyz-panel-agent-demo");
  await expect(local).toContainText("Application scope · Agent Demo");
  await local.getByLabel("Ask the Local XYZ Agent").fill("Configure Provider and switch to Daily News");
  await local.getByRole("button", { name: "Send question" }).click();
  await expect(local).toContainText("outside this application's scope");
  await expect(page.getByRole("dialog", { name: "Model API settings" })).toHaveCount(0);

  await local.getByRole("button", { name: "Add a sidebar" }).click();
  await expect(local.getByTestId("local-xyz-thread-agent-demo")).toContainText("Adds a user-local terminal sidebar");
  await expect(local.locator(".local-xyz-answer")).toHaveCount(0);
  await local.getByRole("button", { name: "Apply reversible change" }).click();
  await expect(gallery.getByLabel("Interactive terminal sidebar")).toBeVisible();
  await local.getByRole("button", { name: "Verify local change" }).click();
  await local.getByRole("button", { name: "Form this application's KPR" }).click();
  const referenceKpr = page.getByTestId("kpr-workspace");
  await expect(referenceKpr).toHaveAttribute("data-kpr-kind", "reference-application");
  await expect(referenceKpr.getByTestId("reference-kpr-brief")).toContainText("The minimal Agent Demo has no dedicated surface");
  await expect(referenceKpr.getByTestId("reference-kpr-change")).toContainText("reference-checkpoint");
  await referenceKpr.getByTestId("reference-kpr-rollback").click();
  await expect(page.getByTestId("user-workspace")).toBeVisible();
  await expect(gallery.getByLabel("Interactive terminal sidebar")).toHaveCount(0);

  await gallery.getByRole("tab", { name: /Issue Triage/ }).click();
  await page.getByRole("button", { name: "Open Local XYZ Agent for Issue Triage" }).click();
  const triageLocal = page.getByTestId("local-xyz-panel-issue-triage");
  await triageLocal.getByRole("button", { name: "What can you do here?" }).click();
  await expect(triageLocal).toContainText("Closing, assigning, or accepting an Issue remains human-only");
  await expect(page.getByRole("button", { name: "Open AgenticXYZ Guide Agent" })).toBeVisible();
});

test("loads application presets automatically but never overwrites an edited request", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await resetDemo(page);
  const gallery = page.getByTestId("reference-app-gallery");
  const request = page.getByTestId("user-request");

  await expect(page.getByTestId("reference-app-preset")).toContainText("Conclusion-first Research Brief");
  await gallery.getByRole("tab", { name: /Agent Demo/ }).click();
  await expect(request).toHaveValue(/Add an interactive right sidebar to Agent Demo/);
  await expect(page.getByTestId("reference-app-preset")).toContainText("Interactive sidebar for Agent Demo");

  await gallery.getByRole("tab", { name: /Daily News & Notes/ }).click();
  await expect(request).toHaveValue(/Reconstruct the Daily News headlines/);
  await expect(page.getByTestId("reference-app-preset")).toContainText("Structured headlines for Daily News");

  const customRequest = "Keep my personally edited news workflow exactly as written.";
  await request.fill(customRequest);
  await gallery.getByRole("tab", { name: /Research Brief/ }).click();
  await expect(request).toHaveValue(customRequest);
  const preset = page.getByTestId("reference-app-preset");
  await expect(preset).toContainText("Custom request preserved");
  await preset.getByRole("button", { name: "Load this preset" }).click();
  await expect(request).toHaveValue(/Put the conclusion first/);

  await gallery.getByRole("tab", { name: /Agent Demo/ }).click();
  await page.getByTestId("run-user-agent").click();
  const conversation = page.getByTestId("user-xyz-conversation");
  await expect(conversation).toContainText("Adds a user-local terminal sidebar");
  await expect(page.getByTestId("local-xyz-panel-agent-demo")).toHaveCount(0);
  await conversation.getByRole("button", { name: "Apply reversible change" }).click();
  await expect(gallery.getByLabel("Interactive terminal sidebar")).toBeVisible();

  await gallery.getByRole("button", { name: "Open this application's XYZ Agent" }).click();
  const local = page.getByTestId("local-xyz-panel-agent-demo");
  await expect(local).toContainText("applied");
  await expect(local.getByRole("button", { name: "Verify local change" })).toBeVisible();
});

test("drags a Local XYZ launcher within its application and remembers its position", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await resetDemo(page);
  const gallery = page.getByTestId("reference-app-gallery");
  await gallery.getByRole("tab", { name: /Agent Demo/ }).click();

  const stage = page.getByTestId("reference-app-scope-agent-demo");
  const launcher = page.getByTestId("local-xyz-fab-agent-demo");
  const stageBox = (await stage.boundingBox())!;
  const before = (await launcher.boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x - 250, before.y + 140, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByTestId("local-xyz-panel-agent-demo")).toHaveCount(0);
  const moved = (await launcher.boundingBox())!;
  expect(moved.x).toBeLessThan(before.x - 150);
  expect(moved.y).toBeGreaterThan(before.y + 70);
  expect(moved.x).toBeGreaterThanOrEqual(stageBox.x + 7);
  expect(moved.y).toBeGreaterThanOrEqual(stageBox.y + 7);
  expect(moved.x + moved.width).toBeLessThanOrEqual(stageBox.x + stageBox.width - 7);
  expect(moved.y + moved.height).toBeLessThanOrEqual(stageBox.y + stageBox.height - 7);

  await gallery.getByRole("tab", { name: /Daily News & Notes/ }).click();
  await gallery.getByRole("tab", { name: /Agent Demo/ }).click();
  const remembered = (await page.getByTestId("local-xyz-fab-agent-demo").boundingBox())!;
  expect(Math.abs(remembered.x - moved.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(remembered.y - moved.y)).toBeLessThanOrEqual(1);

  await launcher.focus();
  await page.keyboard.press("ArrowLeft");
  const keyboardMoved = (await launcher.boundingBox())!;
  expect(keyboardMoved.x).toBeLessThan(remembered.x);

  await launcher.click();
  const local = page.getByTestId("local-xyz-panel-agent-demo");
  await local.getByRole("button", { name: "Reset icon position" }).click();
  const reset = (await launcher.boundingBox())!;
  const resetStage = (await stage.boundingBox())!;
  expect(Math.abs((reset.x - resetStage.x) - (before.x - stageBox.x))).toBeLessThanOrEqual(1);
  expect(Math.abs((reset.y - resetStage.y) - (before.y - stageBox.y))).toBeLessThanOrEqual(1);
});

test("points to the next action with a non-blocking red animated arrow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await resetDemo(page);
  await page.getByRole("button", { name: "Open AgenticXYZ Guide Agent" }).click();
  const guide = page.getByRole("dialog", { name: "AgenticXYZ Guide Agent" });
  await guide.getByTestId("toggle-application-view").click();
  await guide.getByRole("button", { name: "Show me where" }).click();

  const pointer = page.getByTestId("guide-attention-pointer");
  const target = guide.getByTestId("guide-current-action");
  await expect(pointer).toBeVisible();
  await expect(pointer).toHaveCSS("pointer-events", "none");
  expect(await pointer.evaluate((element) => getComputedStyle(element).animationName)).toContain("guide-pointer-pulse");
  const pointerBox = (await pointer.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  const overlaps = pointerBox.x < targetBox.x + targetBox.width
    && pointerBox.x + pointerBox.width > targetBox.x
    && pointerBox.y < targetBox.y + targetBox.height
    && pointerBox.y + pointerBox.height > targetBox.y;
  expect(overlaps).toBe(false);

  await guide.getByRole("button", { name: "Close Guide Agent" }).click();
  await expect(pointer).toHaveCount(0);
});

test("verifies a browser-entered API key through the Gateway without persisting it", async ({ page }) => {
  await resetDemo(page);
  let postedKey = "";
  await page.route("**/api/provider/configure", async (route) => {
    const body = route.request().postDataJSON() as { apiKey?: string };
    postedKey = body.apiKey ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ provider: "deepseek", model: "deepseek-v4-flash", available: true, source: "session" })
    });
  });
  await page.getByRole("button", { name: "Configure model API" }).click();
  await page.getByLabel("Provider").selectOption("deepseek");
  const testKey = ["sk", "browser-only-test-value"].join("-");
  await page.getByLabel("API key").fill(testKey);
  await page.getByRole("button", { name: "Test connection & use" }).click();
  await expect(page.getByText("session key", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Run mode")).toHaveValue("live");
  expect(postedKey).toBe(testKey);
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain(testKey);
});
