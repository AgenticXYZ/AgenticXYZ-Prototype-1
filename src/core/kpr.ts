import { ACTORS } from "./constants";
import { createId, nowIso } from "./time";
import type {
  AppState,
  ClaimResolution,
  HumanAttestation,
  ImpactItem,
  KnowledgeClaim,
  KnowledgeIntegrationContract,
  KPR,
  UserOverlay
} from "./types";

export const CANONICAL_CONTRIBUTOR_CORRECTION =
  "In this Research Brief scenario, the current layout delays the decision-relevant conclusion until after the supporting context.";

function source(id: string, type: "human_statement" | "agent_extraction" | "workspace" | "policy" | "verifier" | "decision", label: string) {
  return { id, type, label, timestamp: nowIso() } as const;
}

export function createContributorAttestation(scope: string[]): HumanAttestation {
  return {
    actor: ACTORS.contributor,
    statement:
      "I confirm that these claims accurately represent my request and local verification. I reviewed the submission scope and excluded private information.",
    attestedAt: nowIso(),
    scope
  };
}

export function buildKnowledgeClaims(overlay: UserOverlay, attestation?: HumanAttestation): KnowledgeClaim[] {
  const humanSource = source("source-user-request", "human_statement", "Contributor request");
  const agentSource = source("source-agent-extraction", "agent_extraction", "User-side Agent extraction");
  const workspaceSource = source("source-local-workspace", "workspace", "Verified local overlay");
  const base = {
    createdBy: ACTORS.userAgent,
    derivedFrom: [humanSource, agentSource, workspaceSource],
    agentGenerated: true,
    confidence: "high" as const,
    status: attestation ? "human_attested" as const : "agent_extracted" as const,
    conflictsWith: [],
    supersedes: [],
    limitations: ["Verified in the Research Brief reference scenario only."],
    ...(attestation ? { humanAttestation: attestation } : {})
  };
  return [
    {
      ...base,
      id: "claim-problem",
      type: "problem",
      statement: "The current brief makes readers traverse context before they see the decision-relevant conclusion.",
      scope: ["research-brief", "summary-layout"],
      evidenceRefs: ["evidence-layout-order"]
    },
    {
      ...base,
      id: "claim-expected-order",
      type: "expected_behavior",
      statement: "A reader can choose a conclusion-first layout with supporting evidence immediately after it.",
      scope: ["research-brief", "summary-layout"],
      evidenceRefs: ["evidence-layout-order"]
    },
    {
      ...base,
      id: "claim-preserve-sources",
      type: "constraint",
      statement: "Changing the layout must not remove evidence or source links.",
      scope: ["research-brief", "sources"],
      evidenceRefs: ["evidence-source-preservation"]
    },
    {
      ...base,
      id: "claim-remember-preference",
      type: "intent",
      statement: overlay.rememberPreference
        ? "Remember the conclusion-first layout after the user explicitly confirms it."
        : "Do not persist the layout preference.",
      scope: ["user-preference"],
      evidenceRefs: ["evidence-reversible-overlay"]
    },
    {
      ...base,
      id: "claim-local-first",
      type: "decision",
      statement: "Prove the behavior in a reversible User Overlay before proposing a public capability.",
      scope: ["user-realization", "contribution"],
      evidenceRefs: ["evidence-public-core", "evidence-reversible-overlay"]
    },
    {
      ...base,
      id: "claim-invariant-sources",
      type: "invariant",
      statement: "Every conclusion remains linked to visible supporting evidence and sources.",
      scope: ["public-core", "sources"],
      evidenceRefs: ["evidence-source-preservation"]
    },
    {
      ...base,
      id: "claim-public-capability",
      type: "open_question",
      statement: "Should the project offer conclusion-first summaries as an optional public capability?",
      scope: ["public-product"],
      confidence: "medium",
      evidenceRefs: ["evidence-layout-order", "evidence-source-preservation"]
    }
  ];
}

export function buildKpr(state: AppState, attestation?: HumanAttestation): KPR {
  if (!state.activeOverlay) {
    throw new Error("An approved overlay is required before creating a KPR.");
  }
  const claims = buildKnowledgeClaims(state.activeOverlay, attestation);
  const createdAt = nowIso();
  return {
    schemaVersion: "0.1.0",
    id: createId("kpr"),
    title: "Optional conclusion-first research briefs",
    status: "contributor_review",
    problem: "Research Brief readers may need the conclusion before the supporting context.",
    scope: ["research-brief", "summary-layout", "user-preference"],
    expectedBehavior: [
      "Users can opt into a conclusion-first layout.",
      "Evidence and source links remain visible.",
      "The preference is saved only after explicit confirmation."
    ],
    acceptanceCriteria: [
      "Conclusion renders before evidence when the option is enabled.",
      "All source links remain attached.",
      "The existing public default remains unchanged.",
      "Removing the option restores reference behavior."
    ],
    nonGoals: [
      "Do not make conclusion-first the public default.",
      "Do not change non-Research-Brief applications.",
      "Do not adopt the contributor's local code directly."
    ],
    protectedInvariants: state.policy.protectedInvariants,
    knowledgeClaims: claims,
    evidence: state.userWorkspace.verifierResults,
    decisionRecord: [
      {
        id: "decision-local-overlay",
        actor: ACTORS.contributor,
        action: "Approved reversible local overlay",
        rationale: "Validate the need before asking the public project to change.",
        timestamp: createdAt
      }
    ],
    failedAttempts: [
      "A conclusion-only layout was rejected because it hid evidence and violated the source invariant."
    ],
    openQuestions: ["Should the capability remain experimental until more document types are evaluated?"],
    provenance: [
      source("source-user-request", "human_statement", "Contributor request"),
      source("source-agent-extraction", "agent_extraction", "User-side Agent extraction"),
      source("source-local-workspace", "workspace", "Verified local overlay"),
      source("source-project-policy", "policy", "Research Brief Project Policy")
    ],
    privacyAndLicense: {
      privacyScan: { status: "not_run", findings: [] },
      license: "MIT contribution",
      contributorOwnsContent: true
    },
    humanAttestation: attestation,
    localImplementationReference: {
      workspaceId: state.userWorkspace.id,
      summary: "Reversible JSON overlay changing layout and confirmed preference behavior.",
      visibleToProjectAgent: false
    },
    impactAnalysis: [],
    claimResolutions: [],
    createdAt,
    updatedAt: createdAt
  };
}

export function defaultImpactAnalysis(): ImpactItem[] {
  return [
    {
      id: "impact-behavior",
      dimension: "product_behavior",
      title: "Optional summary order",
      description: "Adds a conclusion-first path while leaving the reference default unchanged.",
      source: "explicit",
      confidence: "high",
      affectedScopes: ["render_brief", "summary-layout"],
      humanDecisionRequired: true,
      evidenceRequired: true
    },
    {
      id: "impact-interface",
      dimension: "interface",
      title: "Settings and presentation control",
      description: "Adds an explicit opt-in control and changes section order only when enabled.",
      source: "explicit",
      confidence: "high",
      affectedScopes: ["settings", "summary-layout"],
      humanDecisionRequired: true,
      evidenceRequired: true
    },
    {
      id: "impact-preference",
      dimension: "user_preference",
      title: "Preference persistence",
      description: "Persists only after explicit confirmation and remains removable.",
      source: "agent-inferred",
      confidence: "medium",
      affectedScopes: ["preference-memory"],
      humanDecisionRequired: true,
      evidenceRequired: true
    },
    {
      id: "impact-privacy",
      dimension: "permissions_privacy",
      title: "Local preference and contribution boundary",
      description: "Preference memory remains user-local; only human-selected claims enter the KPR.",
      source: "policy-required",
      confidence: "high",
      affectedScopes: ["user-overlay", "kpr-export"],
      humanDecisionRequired: false,
      evidenceRequired: true
    },
    {
      id: "impact-compatibility",
      dimension: "compatibility",
      title: "Document-type boundary",
      description: "Evidence covers Research Brief only; other document types remain unknown.",
      source: "unknown",
      confidence: "low",
      affectedScopes: ["other-document-types"],
      humanDecisionRequired: true,
      evidenceRequired: true
    },
    {
      id: "impact-cost",
      dimension: "performance_cost",
      title: "Rendering and Agent-call cost",
      description: "The local layout change is bounded; any Live Agent analysis remains within the configured call and token budgets.",
      source: "agent-inferred",
      confidence: "medium",
      affectedScopes: ["render-brief", "agent-runtime-budget"],
      humanDecisionRequired: false,
      evidenceRequired: false
    },
    {
      id: "impact-provenance",
      dimension: "data_provenance",
      title: "Source links and claim support",
      description: "The source-preservation invariant must remain visible in every layout.",
      source: "policy-required",
      confidence: "high",
      affectedScopes: ["sources", "evidence"],
      humanDecisionRequired: false,
      evidenceRequired: true
    },
    {
      id: "impact-documentation",
      dimension: "documentation",
      title: "Explain opt-in behavior and reset",
      description: "User and maintainer documentation must state the default, confirmation boundary, and rollback path.",
      source: "policy-required",
      confidence: "high",
      affectedScopes: ["settings-help", "contribution-guide"],
      humanDecisionRequired: false,
      evidenceRequired: true
    },
    {
      id: "impact-rollout",
      dimension: "rollout_rollback",
      title: "Experimental opt-in rollout",
      description: "Ship behind an experimental setting with a one-click reset path.",
      source: "agent-inferred",
      confidence: "medium",
      affectedScopes: ["settings", "release"],
      humanDecisionRequired: true,
      evidenceRequired: false
    },
    {
      id: "impact-verification",
      dimension: "verification",
      title: "Unsupported conclusion verifier",
      description: "Reject a conclusion block that has no linked evidence.",
      source: "policy-required",
      confidence: "high",
      affectedScopes: ["verifiers"],
      humanDecisionRequired: false,
      evidenceRequired: true
    }
  ];
}

export function completeImpactAnalysis(items: ImpactItem[] = []): ImpactItem[] {
  const present = new Set(items.map((item) => item.dimension));
  return [...items, ...defaultImpactAnalysis().filter((item) => !present.has(item.dimension))];
}

export const PROJECT_VERIFIER_IDS = [
  "project-default-stability",
  "project-source-preservation",
  "project-scope-boundary",
  "project-confirmation",
  "project-unsupported-conclusion"
] as const;

const CLAIM_PROJECT_VERIFIERS: Record<string, string[]> = {
  "claim-problem": [],
  "claim-expected-order": ["project-default-stability", "project-scope-boundary"],
  "claim-preserve-sources": ["project-source-preservation", "project-unsupported-conclusion"],
  "claim-remember-preference": ["project-confirmation"],
  "claim-local-first": ["project-default-stability"],
  "claim-invariant-sources": ["project-source-preservation", "project-unsupported-conclusion"],
  "claim-public-capability": ["project-scope-boundary", "project-default-stability"]
};

export function defaultClaimResolutions(kpr: KPR): ClaimResolution[] {
  return kpr.knowledgeClaims.map((claim) => {
    if (claim.id === "claim-public-capability") {
      return {
        claimId: claim.id,
        decision: "narrow",
        finalStatement: "Offer conclusion-first summaries as an experimental, opt-in capability for Research Brief documents only.",
        rationale: "The local evidence supports one document type and does not justify a public default change.",
        targetScopes: ["research-brief", "experimental-settings"],
        rollout: "experimental",
        requiredVerifierIds: ["project-scope-boundary", "project-default-stability"]
      };
    }
    if (claim.id === "claim-problem") {
      return {
        claimId: claim.id,
        decision: "accept",
        finalStatement: claim.statement,
        rationale: "The local scenario and attestation establish a credible user problem.",
        targetScopes: claim.scope,
        requiredVerifierIds: []
      };
    }
    return {
      claimId: claim.id,
      decision: "accept",
      finalStatement: claim.statement,
      rationale: "The claim is human-attested and linked to local evidence or a protected invariant.",
      targetScopes: claim.scope,
      requiredVerifierIds: CLAIM_PROJECT_VERIFIERS[claim.id] ?? []
    };
  });
}

export function buildIntegrationContract(
  kpr: KPR,
  resolutions: ClaimResolution[],
  policyRequiredVerifierIds: string[] = [...PROJECT_VERIFIER_IDS]
): KnowledgeIntegrationContract {
  const accepted = resolutions.filter((item) => ["accept", "modify", "narrow"].includes(item.decision));
  const requestedVerifierIds = [...new Set(accepted.flatMap((item) => item.requiredVerifierIds))];
  const unknownVerifierIds = requestedVerifierIds.filter((id) => !PROJECT_VERIFIER_IDS.includes(id as (typeof PROJECT_VERIFIER_IDS)[number]));
  const unresolvedQuestions = resolutions
    .filter((item) => item.decision === "request_evidence" || item.decision === "defer")
    .map((item) => item.claimId)
    .concat(unknownVerifierIds.map((id) => `unknown_verifier:${id}`));
  return {
    kprId: kpr.id,
    acceptedKnowledge: accepted,
    rejectedKnowledge: resolutions.filter((item) => item.decision === "reject"),
    protectedInvariants: kpr.protectedInvariants,
    implementationBoundary: [
      "Research Brief documents only",
      "Opt-in setting; public default unchanged",
      "Preference saved only after confirmation",
      "Contributor patch remains hidden from Project Agent"
    ],
    requiredVerifiers: [...new Set([...policyRequiredVerifierIds, ...requestedVerifierIds])],
    unresolvedQuestions,
    approvedBy: ACTORS.maintainer,
    approvedAt: nowIso()
  };
}

export function knowledgeGate(kpr: KPR): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!kpr.humanAttestation) reasons.push("Human attestation is missing.");
  if (!kpr.problem.trim()) reasons.push("Problem is missing.");
  if (kpr.expectedBehavior.length === 0) reasons.push("Expected behavior is missing.");
  if (kpr.acceptanceCriteria.length === 0) reasons.push("Acceptance criteria are missing.");
  if (kpr.protectedInvariants.length === 0) reasons.push("Protected invariants are missing.");
  if (kpr.privacyAndLicense.privacyScan.status !== "pass") reasons.push("Privacy scan has not passed.");
  const unattested = kpr.knowledgeClaims.filter((claim) => claim.agentGenerated && !claim.humanAttestation);
  if (unattested.length > 0) reasons.push(`${unattested.length} Agent-extracted claims lack attestation.`);
  return { passed: reasons.length === 0, reasons };
}
