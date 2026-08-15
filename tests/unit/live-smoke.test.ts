import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { verifyLiveSmoke } from "../../scripts/verify-live-smoke";
import { checkReviewedReplay } from "../../scripts/check-reviewed-replay";
import { exportPublicKprJson, exportPublicReplayState } from "../../src/core/export";
import { checksum } from "../../src/core/hash";
import { CANONICAL_CONTRIBUTOR_CORRECTION, defaultClaimResolutions } from "../../src/core/kpr";
import { appReducer } from "../../src/core/reducer";
import type { AgentRole } from "../../src/core/types";
import { createInitialState } from "../../src/data/initial";
import { recordedResponse } from "../../src/data/replay";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function fixture(provider: "openai" | "deepseek" = "openai", includeProviderOptions = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "agenticxyz-live-smoke-test-"));
  directories.push(directory);
  const roles: AgentRole[] = ["user-side", "maintainer-side", "project"];
  let state = createInitialState();
  const user = recordedResponse("user-side");
  state = appReducer(state, { type: "APPLY_AGENT_RESPONSE", run: user.run, proposal: user.proposal });
  state = appReducer(state, { type: "APPROVE_OVERLAY" });
  state = appReducer(state, { type: "VERIFY_OVERLAY" });
  state = appReducer(state, { type: "CREATE_KPR" });
  state = appReducer(state, { type: "EDIT_CONTRIBUTOR_CLAIM", claimId: "claim-problem", statement: CANONICAL_CONTRIBUTOR_CORRECTION });
  state = appReducer(state, { type: "ATTEST_KPR" });
  state = appReducer(state, { type: "SCAN_KPR" });
  state = appReducer(state, { type: "SUBMIT_KPR" });
  state = appReducer(state, { type: "RUN_KNOWLEDGE_GATE" });
  const resolutions = defaultClaimResolutions(state.kpr!);
  state = appReducer(state, { type: "APPLY_IMPACT_ANALYSIS", resolutions });
  state = appReducer(state, { type: "GENERATE_CONTRACT" });
  const summary = {
    artifactFormatVersion: "0.1.0",
    reviewStatus: "pending_human_review",
    provider,
    model: provider === "deepseek" ? "deepseek-v4-flash" : "test-model",
    providerOptions: provider === "deepseek" && includeProviderOptions
      ? { thinking: "enabled", reasoningEffort: "high", strictToolCalls: true }
      : undefined,
    source: { revision: "4062db9", worktreeDirty: false },
    checks: { connection: "pass", userSideClaimExtraction: "pass", structuredToolCall: "pass", projectSynthesis: "pass", verifierResult: "pass", maintainerGateTransition: "pass", exportAndRedaction: "pass" },
    humanGovernance: {
      gateExecution: "automated_test_harness",
      decisionStatus: "pending_human_review",
      representedActor: "Project Maintainer",
      decisionCount: resolutions.length,
      agentSuggestionsRetainedInReplay: true
    },
    runs: roles.map((role) => ({ role, run: { status: "completed", provider, model: provider === "deepseek" ? "deepseek-v4-flash" : "test-model", events: [{ type: "tool_call" }] } }))
  };
  const artifacts: Record<string, string> = {
    "live-smoke.json": `${JSON.stringify(summary, null, 2)}\n`,
    "kpr.json": `${exportPublicKprJson(state.kpr!)}\n`,
    "kpr.md": "# Public KPR\n",
    "replay-state.json": `${exportPublicReplayState(state)}\n`,
    "review.md": "# Human review required\n"
  };
  for (const [name, contents] of Object.entries(artifacts)) fs.writeFileSync(path.join(directory, name), contents, "utf8");
  fs.writeFileSync(path.join(directory, "checksums.json"), `${JSON.stringify({
    algorithm: "FNV-1a 32-bit (artifact integrity, not cryptographic signing)",
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([name, contents]) => [name, checksum(contents)]))
  }, null, 2)}\n`, "utf8");
  return directory;
}

describe("Live Smoke artifact verification", () => {
  it("accepts a complete, redacted, checksummed, importable replay package", () => {
    expect(verifyLiveSmoke(fixture())).toContain("Human review remains required");
  });

  it("rejects an artifact changed after checksums were written", () => {
    const directory = fixture();
    fs.appendFileSync(path.join(directory, "kpr.md"), "tampered\n", "utf8");
    expect(() => verifyLiveSmoke(directory)).toThrow("Checksum mismatch");
  });

  it("accepts an attributable DeepSeek V4 Flash Thinking/high strict record", () => {
    expect(verifyLiveSmoke(fixture("deepseek"))).toContain("deepseek-v4-flash");
  });

  it("rejects a DeepSeek record that omits the required model options", () => {
    expect(() => verifyLiveSmoke(fixture("deepseek", false))).toThrow("Thinking/high strict configuration");
  });

  it("rejects a machine record that implies a real human already approved the harness-staged decisions", () => {
    const directory = fixture("deepseek");
    const summaryPath = path.join(directory, "live-smoke.json");
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    summary.humanGovernance.gateExecution = "human";
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    const checksumsPath = path.join(directory, "checksums.json");
    const checksums = JSON.parse(fs.readFileSync(checksumsPath, "utf8"));
    checksums.artifacts["live-smoke.json"] = checksum(fs.readFileSync(summaryPath, "utf8"));
    fs.writeFileSync(checksumsPath, `${JSON.stringify(checksums, null, 2)}\n`, "utf8");
    expect(() => verifyLiveSmoke(directory)).toThrow("automated-gate and pending-human-decision boundary");
  });
});

describe("Human-reviewed credentialed replay verification", () => {
  const reviewed = path.resolve(process.cwd(), "recorded-runs/reviewed/deepseek-v4-flash-2026-08-14");

  it("accepts the immutable capture plus explicit Human Review layer", () => {
    expect(checkReviewedReplay(reviewed)).toContain("Human-reviewed DeepSeek");
  });

  it("rejects a non-approved Human Review even when the package checksum is recomputed", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "agenticxyz-reviewed-replay-test-"));
    directories.push(directory);
    fs.cpSync(reviewed, directory, { recursive: true });
    const decisionPath = path.join(directory, "review-decision.json");
    const decision = JSON.parse(fs.readFileSync(decisionPath, "utf8"));
    decision.decision = "pending";
    const contents = `${JSON.stringify(decision, null, 2)}\n`;
    fs.writeFileSync(decisionPath, contents, "utf8");
    const checksumsPath = path.join(directory, "checksums.json");
    const checksums = JSON.parse(fs.readFileSync(checksumsPath, "utf8"));
    checksums.artifacts["review-decision.json"] = crypto.createHash("sha256").update(contents).digest("hex");
    fs.writeFileSync(checksumsPath, `${JSON.stringify(checksums, null, 2)}\n`, "utf8");
    expect(() => checkReviewedReplay(directory)).toThrow("Human Review decision");
  });
});
