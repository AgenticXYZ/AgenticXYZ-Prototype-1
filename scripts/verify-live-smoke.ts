import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { checksum } from "../src/core/hash";
import { parseImportedState } from "../src/core/import";
import { scanText } from "../src/core/privacy";
import type { AgentRole, AppState } from "../src/core/types";

interface LiveSmokeSummary {
  artifactFormatVersion?: string;
  reviewStatus?: string;
  provider?: string;
  model?: string;
  providerOptions?: { thinking?: string; reasoningEffort?: string; strictToolCalls?: boolean };
  source?: { revision?: string; worktreeDirty?: boolean };
  checks?: Record<string, string>;
  humanGovernance?: {
    gateExecution?: string;
    decisionStatus?: string;
    representedActor?: string;
    decisionCount?: number;
    agentSuggestionsRetainedInReplay?: boolean;
  };
  runs?: Array<{ role?: AgentRole; run?: { status?: string; provider?: string; model?: string; events?: Array<{ type?: string }> } }>;
}

export function verifyLiveSmoke(input: string): string {
  const directory = path.resolve(process.cwd(), input);
  const required = ["live-smoke.json", "kpr.json", "kpr.md", "replay-state.json", "review.md", "checksums.json"];
  for (const name of required) {
    if (!fs.existsSync(path.join(directory, name))) throw new Error(`Missing Live Smoke artifact: ${name}`);
  }

  const checksums = JSON.parse(fs.readFileSync(path.join(directory, "checksums.json"), "utf8")) as {
    algorithm?: string;
    artifacts?: Record<string, string>;
  };
  for (const name of required.filter((item) => item !== "checksums.json")) {
    const contents = fs.readFileSync(path.join(directory, name), "utf8");
    if (scanText(contents).status !== "pass") throw new Error(`Privacy scan failed for ${name}`);
    if (checksums.artifacts?.[name] !== checksum(contents)) throw new Error(`Checksum mismatch for ${name}`);
  }

  const summary = JSON.parse(fs.readFileSync(path.join(directory, "live-smoke.json"), "utf8")) as LiveSmokeSummary;
  if (summary.artifactFormatVersion !== "0.1.0") throw new Error("Unsupported Live Smoke artifact format.");
  if (summary.reviewStatus !== "pending_human_review") throw new Error("Machine verification cannot replace the required human review status.");
  if (!summary.source?.revision) throw new Error("Live Smoke summary has no source revision attribution.");
  if (summary.provider === "deepseek" && (
    summary.model !== "deepseek-v4-flash"
    || summary.providerOptions?.thinking !== "enabled"
    || summary.providerOptions?.reasoningEffort !== "high"
    || summary.providerOptions?.strictToolCalls !== true
  )) {
    throw new Error("DeepSeek Live Smoke does not prove the required V4 Flash Thinking/high strict configuration.");
  }
  if (!summary.checks || Object.values(summary.checks).some((value) => value !== "pass")) throw new Error("One or more Live Smoke checks did not pass.");
  if (
    summary.humanGovernance?.gateExecution !== "automated_test_harness"
    || summary.humanGovernance.decisionStatus !== "pending_human_review"
  ) throw new Error("Machine verification must preserve the automated-gate and pending-human-decision boundary.");
  const expectedRoles: AgentRole[] = ["user-side", "maintainer-side", "project"];
  for (const role of expectedRoles) {
    const record = summary.runs?.find((item) => item.role === role);
    if (!record || record.run?.status !== "completed") throw new Error(`Missing completed ${role} run.`);
    if (record.run.provider !== summary.provider || record.run.model !== summary.model) throw new Error(`${role} Provider/model mismatch.`);
    if (!record.run.events?.some((event) => event.type === "tool_call")) throw new Error(`${role} has no structured tool-call evidence.`);
  }

  const publicKpr = JSON.parse(fs.readFileSync(path.join(directory, "kpr.json"), "utf8")) as {
    localImplementationReference?: unknown;
    humanAttestation?: { actor?: { type?: string } };
    integrationContract?: { approvedBy?: { type?: string } };
    decisionRecord?: Array<{ actor?: { type?: string }; action?: string }>;
  };
  if ("localImplementationReference" in publicKpr) throw new Error("Public KPR contains the contributor implementation reference.");
  if (publicKpr.humanAttestation?.actor?.type !== "human") throw new Error("Public KPR has no human Contributor attestation.");
  if (publicKpr.integrationContract?.approvedBy?.type !== "human") throw new Error("Public KPR Contract does not preserve the human-governed actor boundary.");
  if (!publicKpr.decisionRecord?.some((item) => item.actor?.type === "human" && item.action?.includes("Knowledge Integration Contract"))) {
    throw new Error("Public KPR has no explicit human-governed Contract decision slot.");
  }
  if (!summary.humanGovernance.representedActor || !summary.humanGovernance.decisionCount) throw new Error("Live Smoke summary has no Maintainer gate-structure evidence.");
  const replay = parseImportedState(fs.readFileSync(path.join(directory, "replay-state.json"), "utf8")) as AppState;
  if (replay.version !== "0.1.0" || replay.mode !== "replay") throw new Error("Public replay state is not importable as a Recorded Replay snapshot.");
  if (replay.providerConfig.available || replay.providerConfig.source !== "none") throw new Error("Public replay exposes credential availability state.");
  if (replay.kpr?.localImplementationReference) throw new Error("Public replay contains the contributor implementation reference.");

  return `Live Smoke machine verification passed for ${summary.provider}/${summary.model}. Human review remains required.`;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: npm run verify:live-smoke -- live-smoke/<provider>/<timestamp>");
  process.stdout.write(`${verifyLiveSmoke(input)}\n`);
}
