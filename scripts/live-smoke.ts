import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { loadConfig } from "../server/config";
import { runAgent } from "../server/runtime/runAgent";
import { exportKprMarkdown, exportPublicKprJson, exportPublicReplayState } from "../src/core/export";
import { checksum } from "../src/core/hash";
import { CANONICAL_CONTRIBUTOR_CORRECTION, defaultClaimResolutions } from "../src/core/kpr";
import { scanText } from "../src/core/privacy";
import { appReducer } from "../src/core/reducer";
import type { AgentRole, AgentTurnRequest, AppState } from "../src/core/types";
import { createInitialState } from "../src/data/initial";

const config = loadConfig();
if (!config.providers[config.activeProvider].apiKey) {
  throw new Error(`No server-side key is configured for ${config.activeProvider}. Configure .env.local before Live Smoke.`);
}

function gitOutput(args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unavailable";
  }
}

const sourceRevision = gitOutput(["rev-parse", "HEAD"]);
const sourceWorktreeDirty = gitOutput(["status", "--porcelain"]) !== "";

let state: AppState = {
  ...createInitialState(),
  mode: "live",
  providerConfig: { provider: config.activeProvider, model: config.activeModel, available: true, source: "environment" }
};
const records: Array<{ role: AgentRole; response: Awaited<ReturnType<typeof runAgent>> }> = [];

async function turn(role: AgentRole, userMessage: string) {
  const request: AgentTurnRequest = {
    role,
    provider: config.activeProvider,
    model: config.activeModel,
    userMessage,
    context: {
      manifest: state.manifest,
      policy: state.policy,
      brief: role === "user-side" ? state.brief : undefined,
      overlay: role === "user-side" ? state.activeOverlay : undefined,
      kpr: role === "maintainer-side" ? state.kpr : undefined,
      contract: role === "project" ? state.contract : undefined
    }
  };
  const response = await runAgent(request, config);
  records.push({ role, response });
  if (response.run.status !== "completed" || !response.proposal) {
    const diagnostic = [...response.run.events].reverse().find((event) => event.type === "tool_result" || event.type === "provider_error")?.summary;
    throw new Error(`${role} Live Smoke failed: ${response.run.terminationReason ?? response.assistantMessage}${diagnostic ? ` Diagnostic: ${diagnostic}` : ""}`);
  }
  state = appReducer(state, { type: "APPLY_AGENT_RESPONSE", run: response.run, proposal: response.proposal });
}

await turn("user-side", state.userRequest);
state = appReducer(state, { type: "APPROVE_OVERLAY" });
state = appReducer(state, { type: "VERIFY_OVERLAY" });
state = appReducer(state, { type: "CREATE_KPR" });
state = appReducer(state, { type: "EDIT_CONTRIBUTOR_CLAIM", claimId: "claim-problem", statement: CANONICAL_CONTRIBUTOR_CORRECTION });
state = appReducer(state, { type: "ATTEST_KPR" });
state = appReducer(state, { type: "SCAN_KPR" });
state = appReducer(state, { type: "SUBMIT_KPR" });
state = appReducer(state, { type: "RUN_KNOWLEDGE_GATE" });
if (state.kpr?.status !== "accepted_for_synthesis") throw new Error("Live KPR did not pass the Knowledge Gate.");

await turn("maintainer-side", "Map this human-attested KPR's knowledge impact and propose bounded Claim Resolutions without deciding for the Maintainer.");
if (!state.kpr) throw new Error("Live Maintainer review did not retain the KPR.");
const maintainerDecisions = defaultClaimResolutions(state.kpr);
state = appReducer(state, {
  type: "APPLY_IMPACT_ANALYSIS",
  impacts: state.kpr.impactAnalysis,
  resolutions: maintainerDecisions
});
state = appReducer(state, { type: "GENERATE_CONTRACT" });
if (!state.contract || state.contract.unresolvedQuestions.length > 0) throw new Error("Live Maintainer review did not produce a synthesis-ready Contract.");

await turn("project", "Use Blind Reconstruction to propose only the approved Contract capability. Do not adopt or merge it.");
state = appReducer(state, { type: "VERIFY_PROJECT_CANDIDATE" });
if (state.projectWorkspace.status !== "verified") throw new Error("Live Project candidate did not pass every required Verifier.");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const directory = path.resolve(process.cwd(), "live-smoke", config.activeProvider, stamp);
fs.mkdirSync(directory, { recursive: true });
const safeRecords = records.map(({ role, response }) => ({ role, run: response.run, proposal: response.proposal, assistantMessage: response.assistantMessage }));
const summary = {
  artifactFormatVersion: "0.1.0",
  reviewStatus: "pending_human_review",
  provider: config.activeProvider,
  model: config.activeModel,
  providerOptions: config.activeProvider === "deepseek"
    ? {
        thinking: "enabled",
        reasoningEffort: config.providers.deepseek.reasoningEffort,
        strictToolCalls: true
      }
    : undefined,
  date: new Date().toISOString(),
  source: {
    revision: sourceRevision,
    worktreeDirty: sourceWorktreeDirty
  },
  checks: {
    connection: "pass",
    userSideClaimExtraction: "pass",
    structuredToolCall: records.every((item) => item.response.run.events.some((event) => event.type === "tool_call")) ? "pass" : "fail",
    projectSynthesis: "pass",
    verifierResult: "pass",
    maintainerGateTransition: state.contract?.approvedBy.type === "human" ? "pass" : "fail",
    exportAndRedaction: "pending"
  },
  humanGovernance: {
    gateExecution: "automated_test_harness",
    decisionStatus: "pending_human_review",
    representedActor: state.contract?.approvedBy.label,
    decisionCount: maintainerDecisions.length,
    agentSuggestionsRetainedInReplay: Boolean(state.proposals["maintainer-side"]?.resolutionSuggestions)
  },
  runs: safeRecords,
  verification: state.projectWorkspace.verifierResults
};
const kprJson = `${exportPublicKprJson(state.kpr!)}\n`;
const kprMarkdown = exportKprMarkdown(state.kpr!);
const replayState = `${exportPublicReplayState(state)}\n`;
const projectProposal = records.find((item) => item.role === "project")?.response.proposal;
const projectQuestions = projectProposal?.role === "project" ? projectProposal.openQuestions : [];
const maintainerProposal = records.find((item) => item.role === "maintainer-side")?.response.proposal;
const agentResolutionSuggestions = maintainerProposal?.role === "maintainer-side" ? maintainerProposal.resolutionSuggestions ?? [] : [];
const agentSuggestionByClaim = new Map(agentResolutionSuggestions.map((resolution) => [resolution.claimId, resolution.decision]));
const stagedDecisionReview = maintainerDecisions
  .map((decision) => {
    const suggestion = agentSuggestionByClaim.get(decision.claimId) ?? "not supplied";
    return `| \`${decision.claimId}\` | ${suggestion} | ${decision.decision} | ${suggestion === decision.decision ? "same" : "**review divergence**"} |`;
  })
  .join("\n");
const questionReview = projectQuestions.length > 0
  ? projectQuestions.map((question, index) => `${index + 1}. ${question}\n   - Classification: [ ] blocking Contract gap · [ ] non-blocking implementation clarification · [ ] future improvement`).join("\n")
  : "No Project Agent open questions were returned.";
const providerOptions = config.activeProvider === "deepseek"
  ? `\n- DeepSeek Thinking: enabled\n- DeepSeek reasoning effort: ${config.providers.deepseek.reasoningEffort}\n- DeepSeek strict Tool Calls: enabled`
  : "";
const review = `# Live Smoke Review — ${config.activeProvider}\n\n- Date: ${new Date().toISOString()}\n- Provider/model: ${config.activeProvider}/${config.activeModel}${providerOptions}\n- Reviewer:\n- Source revision: ${sourceRevision}\n- Worktree dirty during capture: ${sourceWorktreeDirty ? "yes" : "no"}\n\n## Evidence boundary\n\nThe automated Live Smoke harness exercised the Maintainer gate transition so the complete three-role path could be machine-checked. The human-labeled actor and staged Claim decisions in this unreviewed replay prove the system's governance structure; they do **not** prove that a real person approved those decisions. Only the reviewer named above may ratify or reject them.\n\n## Agent suggestions versus harness-staged decisions\n\n| Claim | Maintainer-side Agent suggestion | Harness-staged decision | Review signal |\n|---|---|---|---|\n${stagedDecisionReview}\n\n## Human review checklist\n\n- [ ] Connection is attributable to the selected Provider and model/options.\n- [ ] User-side Claim Extraction is meaningful and bounded.\n- [ ] Every Agent role used exactly one allowlisted structured tool.\n- [ ] I understand that the test harness, not a person, exercised the human-labeled Maintainer gate in this pending record.\n- [ ] I reviewed every Agent suggestion and harness-staged Claim decision above, including each divergence, and ratified or changed it explicitly.\n- [ ] Project synthesis implements only the resulting Contract.\n- [ ] Every Project Agent open question below is classified; no blocking Contract gap was silently treated as complete.\n- [ ] Every required Verifier passed independently of the Agent's completion claim.\n- [ ] No key, authorization header, personal path, private trajectory, or contributor patch appears in the public artifacts.\n- [ ] \`replay-state.json\` imports into the Workbench with Run mode shown as Recorded Replay.\n- [ ] Provider support matrix updated only after this review.\n\n## Project Agent open-question classification\n\n${questionReview}\n\nDecision: **Pending human review**\n`;
const candidateArtifacts = {
  "live-smoke.json": JSON.stringify(summary, null, 2),
  "kpr.json": kprJson,
  "kpr.md": kprMarkdown,
  "replay-state.json": replayState,
  "review.md": review
};
for (const [name, contents] of Object.entries(candidateArtifacts)) {
  const privacy = scanText(contents);
  if (privacy.status !== "pass") {
    throw new Error(`Live Smoke export ${name} blocked by ${privacy.findings.length} privacy finding(s).`);
  }
}
summary.checks.exportAndRedaction = "pass";
const finalSummary = `${JSON.stringify(summary, null, 2)}\n`;
const artifacts = {
  "live-smoke.json": finalSummary,
  "kpr.json": kprJson,
  "kpr.md": kprMarkdown,
  "replay-state.json": replayState,
  "review.md": review
};
for (const [name, contents] of Object.entries(artifacts)) {
  fs.writeFileSync(path.join(directory, name), contents, "utf8");
}
fs.writeFileSync(
  path.join(directory, "checksums.json"),
  `${JSON.stringify({
    algorithm: "FNV-1a 32-bit (artifact integrity, not cryptographic signing)",
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([name, contents]) => [name, checksum(contents)]))
  }, null, 2)}\n`,
  "utf8"
);
process.stdout.write(`Live Smoke passed for ${config.activeProvider}/${config.activeModel}. Redacted records: ${path.relative(process.cwd(), directory)}\n`);
