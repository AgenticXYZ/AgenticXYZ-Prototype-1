import { ACTORS } from "../core/constants";
import type {
  AgentRole,
  AgentRun,
  AgentRunEvent,
  AgentTurnResponse,
  KPR,
  RuntimeProposal
} from "../core/types";
import { defaultClaimResolutions, defaultImpactAnalysis } from "../core/kpr";
import { checksum } from "../core/hash";
import { defaultSkillForRole } from "./skills";

const REPLAY_TIME = "2026-08-13T20:00:00.000Z";

function actorForRole(role: AgentRole) {
  if (role === "user-side") return ACTORS.userAgent;
  if (role === "maintainer-side") return ACTORS.maintainerAgent;
  return ACTORS.projectAgent;
}

function event(
  role: AgentRole,
  sequence: number,
  type: AgentRunEvent["type"],
  plane: AgentRunEvent["plane"],
  title: string,
  summary: string,
  payload?: Record<string, unknown>
): AgentRunEvent {
  return {
    id: `replay-${role}-${sequence}`,
    sequence,
    timestamp: new Date(Date.parse(REPLAY_TIME) + sequence * 1000).toISOString(),
    type,
    plane,
    title,
    summary,
    actor: actorForRole(role),
    payload
  };
}

function run(role: AgentRole, events: AgentRunEvent[]): AgentRun {
  return {
    id: `run-replay-${role}`,
    mode: "replay",
    role,
    skillId: defaultSkillForRole(role).id,
    provider: "openai",
    model: "recorded-reference-model",
    status: "completed",
    startedAt: REPLAY_TIME,
    completedAt: new Date(Date.parse(REPLAY_TIME) + events.length * 1000).toISOString(),
    events,
    budget: {
      maxProviderCalls: 1,
      providerCallsUsed: 1,
      maxToolCalls: 6,
      toolCallsUsed: events.filter((item) => item.type === "tool_call").length,
      maxDurationMs: 60_000,
      maxInputTokens: 20_000,
      maxOutputTokens: 2_400,
      maxRetries: 0,
      retriesUsed: 0
    },
    terminationReason: "Required structured proposal produced; no public state changed.",
    usage: { inputTokens: 1480, outputTokens: 520 }
  };
}

export const USER_REPLAY_PROPOSAL: RuntimeProposal = {
  role: "user-side",
  summary: "Create a reversible local preference overlay that changes presentation order without changing public project behavior.",
  plan: [
    "Read the Agentic Software Contract and mutable surfaces.",
    "Propose a conclusion-first User Overlay.",
    "Preview the behavioral change before writing.",
    "Verify source preservation, public-core isolation, and rollback."
  ],
  proposedOverlay: {
    conclusionFirst: true,
    preserveSources: true,
    theme: "light",
    rememberPreference: true,
    scope: "contributable"
  },
  proposedClaims: [
    {
      type: "expected_behavior",
      statement: "Show the conclusion before evidence while keeping sources visible.",
      scope: ["research-brief", "summary-layout"],
      confidence: "high"
    }
  ],
  openQuestions: ["Should this remain private or be proposed as an optional public capability after verification?"]
};

export function maintainerReplayProposal(kpr?: KPR): RuntimeProposal {
  return {
    role: "maintainer-side",
    summary: "The need is credible, but the evidence supports an opt-in Research Brief capability rather than a new public default.",
    plan: [
      "Separate explicit user knowledge from project-side inference.",
      "Map behavioral, provenance, compatibility, verification, and rollout impact.",
      "Narrow the public scope and preserve project invariants.",
      "Draft a contract for Maintainer approval."
    ],
    impactAnalysis: defaultImpactAnalysis(),
    resolutionSuggestions: kpr ? defaultClaimResolutions(kpr) : [],
    openQuestions: ["Do we require evidence from a second document type before stable rollout?"]
  };
}

export const PROJECT_REPLAY_PROPOSAL: RuntimeProposal = {
  role: "project",
  summary: "Implement the approved contract as an experimental opt-in capability without reading the contributor patch.",
  plan: [
    "Read the Maintainer-approved Integration Contract.",
    "Create a checkpoint in the Project Candidate workspace.",
    "Implement the narrow optional capability.",
    "Run all contract verifiers and report any mismatch."
  ],
  projectCandidate: {
    featureId: "conclusion-first-research-brief",
    label: "Conclusion first",
    enabledByDefault: false,
    applicableDocumentTypes: ["research-brief"],
    preserveSources: true,
    saveOnlyAfterConfirmation: true,
    rollout: "experimental"
  },
  openQuestions: []
};

const USER_EVENTS = [
  event("user-side", 1, "run_started", "action", "User-side Agent started", "Recorded reference run; no live provider request is occurring."),
  event("user-side", 2, "context_assembled", "context", "Agentic Software context", "Manifest, Policy, Research Brief, mutable surfaces, and the user request were assembled."),
  event("user-side", 3, "policy_check", "policy", "Write boundary checked", "User-side Agent may propose only a reversible User Realization overlay.", { rule: "privacy-private-overlay", outcome: "allow-local-only" }),
  event("user-side", 4, "plan_proposed", "action", "Plan proposed", "Read → propose → preview → verify; public project state remains out of scope."),
  event("user-side", 5, "tool_call", "action", "propose_change", "Proposed a structured conclusion-first overlay.", { risk: "R1" }),
  event("user-side", 6, "tool_result", "action", "Overlay preview ready", "The proposal preserves sources, light theme, and a reset path."),
  event("user-side", 7, "checkpoint_created", "memory", "Rollback point recorded", "Reference workspace captured before the overlay is applied."),
  event("user-side", 8, "run_completed", "proof", "Proposal ready for human review", "No change was applied automatically.")
];

const MAINTAINER_EVENTS = [
  event("maintainer-side", 1, "run_started", "action", "Maintainer-side Agent started", "Knowledge review mode; this Agent has no code-write authority."),
  event("maintainer-side", 2, "context_assembled", "context", "KPR review context", "Human-attested claims, evidence, Project Policy, and contribution boundary were assembled."),
  event("maintainer-side", 3, "tool_call", "action", "analyze_knowledge_impact", "Mapped six impact dimensions before code synthesis."),
  event("maintainer-side", 4, "policy_check", "policy", "Default stability conflict", "The user preference cannot become a public default without Maintainer shaping."),
  event("maintainer-side", 5, "tool_call", "action", "propose_claim_resolution", "Proposed narrowing the capability to an experimental opt-in Research Brief setting."),
  event("maintainer-side", 6, "tool_result", "proof", "Evidence gaps remain visible", "Other document types remain unknown; no unsupported generalization was accepted."),
  event("maintainer-side", 7, "run_completed", "memory", "Review brief ready", "Suggestions are drafts until the Maintainer records decisions.")
];

const PROJECT_EVENTS = [
  event("project", 1, "run_started", "action", "Project Agent started", "Blind Reconstruction mode is active."),
  event("project", 2, "context_assembled", "context", "Contract-only implementation context", "Project Policy, approved Contract, reference code model, and verifiers were assembled; contributor patch was excluded."),
  event("project", 3, "policy_check", "policy", "Implementation boundary checked", "Only the experimental Research Brief capability may be changed."),
  event("project", 4, "checkpoint_created", "memory", "Project checkpoint created", "The candidate workspace can be rolled back independently."),
  event("project", 5, "tool_call", "action", "propose_change", "Generated a structured project candidate from the Contract."),
  event("project", 6, "tool_call", "proof", "run_verifier", "Requested all five Contract verifiers."),
  event("project", 7, "tool_result", "proof", "Candidate ready for verification", "Generation is not treated as completion."),
  event("project", 8, "run_completed", "memory", "Candidate returned to Maintainer", "No public merge or adoption occurred automatically.")
];

export const RECORDED_RUNS: Record<AgentRole, AgentRun> = {
  "user-side": run("user-side", USER_EVENTS),
  "maintainer-side": run("maintainer-side", MAINTAINER_EVENTS),
  project: run("project", PROJECT_EVENTS)
};

export const REPLAY_METADATA = {
  fixtureType: "reference_fixture" as const,
  provider: "openai" as const,
  model: "recorded-reference-model",
  runDate: REPLAY_TIME,
  redactionStatus: "reviewed",
  checksum: checksum(RECORDED_RUNS),
  evidenceLevel: "E1" as const,
  liveValidation: "separate from Provider support evidence"
};

export function recordedResponse(role: AgentRole, kpr?: KPR): AgentTurnResponse {
  const proposal =
    role === "user-side"
      ? USER_REPLAY_PROPOSAL
      : role === "maintainer-side"
        ? maintainerReplayProposal(kpr)
        : PROJECT_REPLAY_PROPOSAL;
  return {
    run: structuredClone(RECORDED_RUNS[role]),
    proposal: structuredClone(proposal),
    assistantMessage: proposal.summary
  };
}
