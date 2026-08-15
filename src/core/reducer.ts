import { ACTORS } from "./constants";
import { checksum } from "./hash";
import {
  buildIntegrationContract,
  buildKpr,
  completeImpactAnalysis,
  createContributorAttestation,
  defaultClaimResolutions,
  defaultImpactAnalysis,
  knowledgeGate
} from "./kpr";
import { scanKpr } from "./privacy";
import {
  applyReferenceAppChange,
  buildReferenceAppKprDraft,
  buildReferenceAppKprRun,
  resetReferenceApp,
  rollbackReferenceAppChange,
  verifyReferenceAppChange
} from "./referenceApps";
import { createId, nowIso } from "./time";
import type {
  AgentRun,
  AppState,
  ClaimDecision,
  ClaimResolution,
  ImpactItem,
  ProjectCandidate,
  PrincipleId,
  ProviderConfig,
  ModifiableReferenceAppId,
  ReferenceAppChangeKind,
  RunMode,
  RuntimeProposal,
  UserOverlay,
  WorkspaceView
} from "./types";
import { allRequiredPassed, verifyProjectCandidate, verifyUserOverlay } from "./verifiers";
import { createInitialState } from "../data/initial";

export type AppAction =
  | { type: "SET_VIEW"; view: WorkspaceView }
  | { type: "SET_PRINCIPLE"; principle?: PrincipleId }
  | { type: "SET_MODE"; mode: RunMode }
  | { type: "SET_PROVIDER_CONFIG"; config: ProviderConfig }
  | { type: "SET_USER_REQUEST"; value: string }
  | { type: "APPLY_REFERENCE_APP_CHANGE"; appId: ModifiableReferenceAppId; kind: ReferenceAppChangeKind }
  | { type: "VERIFY_REFERENCE_APP_CHANGE"; changeId: string }
  | { type: "ROLLBACK_REFERENCE_APP_CHANGE"; appId: ModifiableReferenceAppId }
  | { type: "RESET_REFERENCE_APP"; appId: ModifiableReferenceAppId }
  | { type: "CREATE_REFERENCE_APP_KPR"; changeId: string }
  | { type: "APPLY_AGENT_RESPONSE"; run: AgentRun; proposal?: RuntimeProposal }
  | { type: "APPROVE_OVERLAY" }
  | { type: "VERIFY_OVERLAY" }
  | { type: "ROLLBACK_OVERLAY" }
  | { type: "CREATE_KPR" }
  | { type: "EDIT_CONTRIBUTOR_CLAIM"; claimId: string; statement: string }
  | { type: "ATTEST_KPR" }
  | { type: "SCAN_KPR" }
  | { type: "SUBMIT_KPR" }
  | { type: "RUN_KNOWLEDGE_GATE" }
  | { type: "APPLY_IMPACT_ANALYSIS"; impacts?: ImpactItem[]; resolutions?: ClaimResolution[] }
  | {
      type: "SET_CLAIM_DECISION";
      claimId: string;
      decision?: ClaimDecision;
      finalStatement?: string;
      rationale?: string;
      targetScopes?: string[];
      rollout?: string;
      requiredVerifierIds?: string[];
    }
  | { type: "GENERATE_CONTRACT" }
  | { type: "SET_PROJECT_CANDIDATE"; candidate: ProjectCandidate }
  | { type: "VERIFY_PROJECT_CANDIDATE" }
  | { type: "ROLLBACK_PROJECT_CANDIDATE" }
  | { type: "ADOPT_PROJECT_CANDIDATE" }
  | { type: "TOGGLE_RUNTIME"; value?: boolean }
  | { type: "ADD_NOTIFICATION"; kind: "info" | "success" | "warning" | "error"; message: string }
  | { type: "DISMISS_NOTIFICATION"; id: string }
  | { type: "LOAD_STATE"; state: AppState }
  | { type: "RESET" };

function notification(kind: "info" | "success" | "warning" | "error", message: string) {
  return { id: createId("notice"), kind, message };
}

function overlayWorkspace(state: AppState, overlay: UserOverlay): AppState["userWorkspace"] {
  const checkpoint = {
    id: "checkpoint-user-before-overlay",
    label: "Before User Overlay",
    createdAt: nowIso(),
    files: structuredClone(state.userWorkspace.files)
  };
  const content = JSON.stringify(overlay, null, 2);
  return {
    ...state.userWorkspace,
    status: "approved",
    files: [
      ...state.userWorkspace.files.filter((file) => file.layer !== "user_overlay"),
      { path: "user-overlay.json", content, layer: "user_overlay", checksum: checksum(content) }
    ],
    checkpoints: [...state.userWorkspace.checkpoints, checkpoint]
  };
}

function candidateWorkspace(state: AppState, candidate: ProjectCandidate): AppState["projectWorkspace"] {
  const checkpoint = {
    id: "checkpoint-project-before-candidate",
    label: "Before Project Candidate",
    createdAt: nowIso(),
    files: structuredClone(state.projectWorkspace.files)
  };
  const content = JSON.stringify(candidate, null, 2);
  return {
    ...state.projectWorkspace,
    status: "proposed",
    files: [
      ...state.projectWorkspace.files.filter((file) => file.layer !== "project_candidate"),
      { path: "capabilities/conclusion-first.json", content, layer: "project_candidate", checksum: checksum(content) }
    ],
    checkpoints: [...state.projectWorkspace.checkpoints, checkpoint]
  };
}

function applyAgentProposal(state: AppState, run: AgentRun, proposal?: RuntimeProposal): AppState {
  const base: AppState = {
    ...state,
    proposals: proposal ? { ...state.proposals, [proposal.role]: proposal } : state.proposals,
    runs: [...state.runs, run],
    showRuntime: true
  };
  if (!proposal) return base;
  if (proposal.role === "user-side") {
    return {
      ...base,
      proposedOverlay: proposal.proposedOverlay,
      guidedStep: Math.max(base.guidedStep, 1),
      notifications: [...base.notifications, notification("info", "Agent proposal is ready. Human approval is still required.")]
    };
  }
  if (proposal.role === "maintainer-side" && base.kpr) {
    return {
      ...base,
      kpr: {
        ...base.kpr,
        impactAnalysis: completeImpactAnalysis(proposal.impactAnalysis),
        claimResolutions: proposal.resolutionSuggestions ?? defaultClaimResolutions(base.kpr),
        status: "maintainer_review",
        updatedAt: nowIso()
      },
      guidedStep: Math.max(base.guidedStep, 5),
      notifications: [...base.notifications, notification("info", "Impact analysis is a project-side inference, not a Maintainer decision.")]
    };
  }
  if (proposal.role === "project" && proposal.projectCandidate) {
    return {
      ...base,
      projectCandidate: proposal.projectCandidate,
      projectWorkspace: candidateWorkspace(base, proposal.projectCandidate),
      kpr: base.kpr ? { ...base.kpr, status: "project_agent_synthesis", updatedAt: nowIso() } : base.kpr,
      guidedStep: Math.max(base.guidedStep, 7),
      notifications: [...base.notifications, notification("info", "Project candidate generated. Verifiers, not the Agent message, determine completion.")]
    };
  }
  return base;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, activeView: action.view };
    case "SET_PRINCIPLE":
      return { ...state, activePrinciple: action.principle };
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "SET_PROVIDER_CONFIG":
      return { ...state, providerConfig: action.config };
    case "SET_USER_REQUEST":
      return { ...state, userRequest: action.value };
    case "APPLY_REFERENCE_APP_CHANGE": {
      const result = applyReferenceAppChange(state.referenceApps, action.appId, action.kind);
      if (!result.record) {
        return { ...state, notifications: [...state.notifications, notification("info", "That user-local change is already active.")] };
      }
      return {
        ...state,
        referenceApps: result.experience,
        notifications: [...state.notifications, notification("success", "The XYZ Agent applied a reversible user-local application change and recorded a checkpoint.")]
      };
    }
    case "VERIFY_REFERENCE_APP_CHANGE": {
      const change = state.referenceApps.changes.find((item) => item.id === action.changeId);
      if (!change || change.status !== "applied") return state;
      return {
        ...state,
        referenceApps: verifyReferenceAppChange(state.referenceApps, action.changeId),
        notifications: [...state.notifications, notification("success", "The user-local application change passed its bounded verifiers.")]
      };
    }
    case "ROLLBACK_REFERENCE_APP_CHANGE": {
      const active = [...state.referenceApps.changes].reverse().find((item) => item.appId === action.appId && item.status !== "rolled_back");
      if (!active) return state;
      return {
        ...state,
        referenceApps: rollbackReferenceAppChange(state.referenceApps, action.appId),
        notifications: [...state.notifications, notification("warning", "The last user-local application change was rolled back to its checkpoint.")]
      };
    }
    case "RESET_REFERENCE_APP":
      return {
        ...state,
        referenceApps: resetReferenceApp(state.referenceApps, action.appId),
        notifications: [...state.notifications, notification("warning", "The reference application realization was restored to its defaults.")]
      };
    case "CREATE_REFERENCE_APP_KPR": {
      const change = state.referenceApps.changes.find((item) => item.id === action.changeId);
      if (!change || change.status !== "verified") {
        return { ...state, notifications: [...state.notifications, notification("error", "Verify the user-local application change before asking the XYZ Agent to structure a KPR draft.")] };
      }
      const draft = buildReferenceAppKprDraft(change, state.mode);
      return {
        ...state,
        referenceApps: { ...state.referenceApps, kprDraft: draft },
        runs: [...state.runs, buildReferenceAppKprRun(change, draft, state.mode)],
        activeView: "kpr",
        showRuntime: true,
        notifications: [...state.notifications, notification("info", "The XYZ Agent structured the verified local change as a bounded KPR draft. Human review is still required.")]
      };
    }
    case "APPLY_AGENT_RESPONSE":
      return applyAgentProposal(state, action.run, action.proposal);
    case "APPROVE_OVERLAY": {
      if (!state.proposedOverlay) {
        return { ...state, notifications: [...state.notifications, notification("error", "No Agent proposal is available to approve.")] };
      }
      return {
        ...state,
        activeOverlay: state.proposedOverlay,
        userWorkspace: overlayWorkspace(state, state.proposedOverlay),
        guidedStep: Math.max(state.guidedStep, 2),
        notifications: [...state.notifications, notification("success", "Human approved a reversible local overlay.")]
      };
    }
    case "VERIFY_OVERLAY": {
      if (!state.activeOverlay) return state;
      const evidence = verifyUserOverlay(state, state.activeOverlay);
      const passed = allRequiredPassed(evidence);
      return {
        ...state,
        userWorkspace: { ...state.userWorkspace, status: passed ? "verified" : "failed", verifierResults: evidence },
        guidedStep: passed ? Math.max(state.guidedStep, 3) : state.guidedStep,
        notifications: [...state.notifications, notification(passed ? "success" : "error", passed ? "All local verifiers passed." : "A local verifier failed; the KPR cannot be created.")]
      };
    }
    case "ROLLBACK_OVERLAY": {
      const checkpoint = state.userWorkspace.checkpoints.at(-1);
      if (!checkpoint || !state.activeOverlay) return state;
      return {
        ...state,
        activeOverlay: undefined,
        userWorkspace: {
          ...state.userWorkspace,
          status: "rolled_back",
          files: structuredClone(checkpoint.files),
          verifierResults: []
        },
        notifications: [...state.notifications, notification("warning", "User Overlay removed. Reference behavior was restored from the checkpoint.")]
      };
    }
    case "CREATE_KPR": {
      if (state.userWorkspace.status !== "verified") {
        return { ...state, notifications: [...state.notifications, notification("error", "Verify the local change before creating a KPR.")] };
      }
      const kpr = buildKpr(state);
      return {
        ...state,
        kpr,
        activeView: "kpr",
        guidedStep: Math.max(state.guidedStep, 4),
        notifications: [...state.notifications, notification("info", "KPR draft created. Review the Agent extraction before Human Attestation; wording changes are optional.")]
      };
    }
    case "EDIT_CONTRIBUTOR_CLAIM": {
      if (!state.kpr || state.kpr.status !== "contributor_review" || state.kpr.humanAttestation) return state;
      const statement = action.statement;
      const claim = state.kpr.knowledgeClaims.find((item) => item.id === action.claimId);
      if (!claim || !statement.trim() || statement === claim.statement) return state;
      const timestamp = nowIso();
      const decisionId = `decision-contributor-correction-${claim.id}`;
      const correctionSource = {
        id: `source-contributor-correction-${claim.id}`,
        type: "decision" as const,
        label: "Contributor correction of Agent extraction",
        timestamp
      };
      return {
        ...state,
        kpr: {
          ...state.kpr,
          knowledgeClaims: state.kpr.knowledgeClaims.map((item) => item.id === claim.id
            ? {
                ...item,
                statement,
                derivedFrom: [...item.derivedFrom.filter((source) => source.id !== correctionSource.id), correctionSource]
              }
            : item),
          decisionRecord: [
            ...state.kpr.decisionRecord.filter((item) => item.id !== decisionId),
            {
              id: decisionId,
              actor: ACTORS.contributor,
              action: `Corrected Agent-extracted claim ${claim.id}`,
              rationale: `Changed the Agent wording from “${claim.statement}” to “${statement}”.`,
              timestamp
            }
          ],
          updatedAt: timestamp
        }
      };
    }
    case "ATTEST_KPR": {
      if (!state.kpr || state.kpr.status !== "contributor_review" || state.kpr.humanAttestation) return state;
      const correction = state.kpr.decisionRecord.find((item) => item.id.startsWith("decision-contributor-correction-"));
      const attestation = createContributorAttestation(["problem", "expected_behavior", "constraints", "local_evidence"]);
      return {
        ...state,
        kpr: {
          ...state.kpr,
          humanAttestation: attestation,
          knowledgeClaims: state.kpr.knowledgeClaims.map((claim) => ({
            ...claim,
            humanAttestation: attestation,
            status: "human_attested"
          })),
          decisionRecord: [
            ...state.kpr.decisionRecord.filter((item) => item.id !== "decision-contributor-attestation"),
            {
              id: "decision-contributor-attestation",
              actor: ACTORS.contributor,
              action: "Attested the reviewed KPR knowledge",
              rationale: correction
                ? "The Contributor reviewed the Agent extraction, optionally corrected wording that needed revision, and confirmed the selected contribution scope."
                : "The Contributor reviewed the Agent extraction and confirmed its meaning and selected contribution scope without requiring a wording change.",
              timestamp: attestation.attestedAt
            }
          ],
          updatedAt: attestation.attestedAt
        },
        notifications: [...state.notifications, notification("success", "Human Attestation recorded after explicit Contributor review.")]
      };
    }
    case "SCAN_KPR": {
      if (!state.kpr) return state;
      const scan = scanKpr(state.kpr);
      return {
        ...state,
        kpr: {
          ...state.kpr,
          privacyAndLicense: { ...state.kpr.privacyAndLicense, privacyScan: scan },
          updatedAt: nowIso()
        },
        notifications: [...state.notifications, notification(scan.status === "pass" ? "success" : "error", scan.status === "pass" ? "Privacy and secret scan passed." : "Submission blocked by privacy findings.")]
      };
    }
    case "SUBMIT_KPR": {
      if (!state.kpr) return state;
      if (state.kpr.privacyAndLicense.privacyScan.status !== "pass") {
        return { ...state, notifications: [...state.notifications, notification("error", "Run and pass the privacy scan before submission.")] };
      }
      return {
        ...state,
        kpr: { ...state.kpr, status: "submitted", updatedAt: nowIso() },
        notifications: [...state.notifications, notification("success", "KPR submitted to the Knowledge Gate.")]
      };
    }
    case "RUN_KNOWLEDGE_GATE": {
      if (!state.kpr) return state;
      const gate = knowledgeGate(state.kpr);
      return {
        ...state,
        kpr: { ...state.kpr, status: gate.passed ? "accepted_for_synthesis" : "needs_more_knowledge", updatedAt: nowIso() },
        activeView: gate.passed ? "developer" : state.activeView,
        notifications: [...state.notifications, notification(gate.passed ? "success" : "error", gate.passed ? "Knowledge Gate passed." : gate.reasons.join(" "))]
      };
    }
    case "APPLY_IMPACT_ANALYSIS": {
      if (!state.kpr) return state;
      return {
        ...state,
        kpr: {
          ...state.kpr,
          impactAnalysis: completeImpactAnalysis(action.impacts),
          claimResolutions: action.resolutions ?? defaultClaimResolutions(state.kpr),
          status: "maintainer_review",
          updatedAt: nowIso()
        },
        guidedStep: Math.max(state.guidedStep, 5)
      };
    }
    case "SET_CLAIM_DECISION": {
      if (!state.kpr) return state;
      const existing = state.kpr.claimResolutions.find((item) => item.claimId === action.claimId);
      const claim = state.kpr.knowledgeClaims.find((item) => item.id === action.claimId);
      const defaultResolution = defaultClaimResolutions(state.kpr).find((item) => item.claimId === action.claimId);
      const next: ClaimResolution = {
        claimId: action.claimId,
        decision: action.decision ?? existing?.decision ?? "defer",
        finalStatement: action.finalStatement ?? existing?.finalStatement ?? claim?.statement,
        rationale: action.rationale ?? existing?.rationale ?? "Maintainer decision recorded in the Developer Workspace.",
        targetScopes: action.targetScopes ?? existing?.targetScopes ?? claim?.scope ?? [],
        rollout: action.rollout ?? existing?.rollout,
        requiredVerifierIds: action.requiredVerifierIds ?? existing?.requiredVerifierIds ?? defaultResolution?.requiredVerifierIds ?? []
      };
      return {
        ...state,
        kpr: {
          ...state.kpr,
          claimResolutions: [...state.kpr.claimResolutions.filter((item) => item.claimId !== action.claimId), next],
          updatedAt: nowIso()
        }
      };
    }
    case "GENERATE_CONTRACT": {
      if (!state.kpr) return state;
      const resolutions = state.kpr.claimResolutions.length > 0 ? state.kpr.claimResolutions : defaultClaimResolutions(state.kpr);
      const policyRequiredVerifierIds = state.policy.evidenceRequirements.find((item) => item.appliesTo === "project_candidate")?.verifierIds ?? [];
      const contract = buildIntegrationContract(state.kpr, resolutions, policyRequiredVerifierIds);
      if (contract.unresolvedQuestions.length > 0) {
        return {
          ...state,
          contract,
          notifications: [...state.notifications, notification("warning", "Contract contains unresolved claims; Project Agent synthesis remains blocked.")]
        };
      }
      return {
        ...state,
        contract,
        kpr: {
          ...state.kpr,
          claimResolutions: resolutions,
          integrationContract: contract,
          status: "accepted_for_synthesis",
          decisionRecord: [
            ...state.kpr.decisionRecord.filter((item) => item.id !== "decision-maintainer-contract"),
            {
              id: "decision-maintainer-contract",
              actor: ACTORS.maintainer,
              action: "Approved claim resolutions and Knowledge Integration Contract",
              rationale: "The Maintainer reviewed Agent suggestions, set the public scope, and retained final synthesis authority.",
              timestamp: contract.approvedAt
            }
          ],
          updatedAt: contract.approvedAt
        },
        guidedStep: Math.max(state.guidedStep, 6),
        notifications: [...state.notifications, notification("success", "Maintainer approved the Knowledge Integration Contract.")]
      };
    }
    case "SET_PROJECT_CANDIDATE": {
      if (!state.contract || state.contract.unresolvedQuestions.length > 0) {
        return { ...state, notifications: [...state.notifications, notification("error", "A resolved, Maintainer-approved Contract is required.")] };
      }
      return {
        ...state,
        projectCandidate: action.candidate,
        projectWorkspace: candidateWorkspace(state, action.candidate),
        kpr: state.kpr ? { ...state.kpr, status: "project_agent_synthesis", updatedAt: nowIso() } : state.kpr,
        guidedStep: Math.max(state.guidedStep, 7)
      };
    }
    case "VERIFY_PROJECT_CANDIDATE": {
      if (!state.projectCandidate) return state;
      const evidence = verifyProjectCandidate(state.projectCandidate, state.contract?.requiredVerifiers);
      const passed = allRequiredPassed(evidence);
      return {
        ...state,
        projectWorkspace: { ...state.projectWorkspace, status: passed ? "verified" : "failed", verifierResults: evidence },
        kpr: state.kpr ? { ...state.kpr, evidence: [...state.kpr.evidence.filter((item) => !item.id.startsWith("project-")), ...evidence], status: passed ? "verification_passed" : "revision_required", updatedAt: nowIso() } : state.kpr,
        guidedStep: passed ? Math.max(state.guidedStep, 8) : state.guidedStep,
        notifications: [...state.notifications, notification(passed ? "success" : "error", passed ? "Project candidate passed every Contract verifier." : "Verifier failure: generation is not completion. Roll back or revise.")]
      };
    }
    case "ROLLBACK_PROJECT_CANDIDATE": {
      const checkpoint = state.projectWorkspace.checkpoints.at(-1);
      if (!checkpoint) return state;
      return {
        ...state,
        projectCandidate: undefined,
        projectWorkspace: { ...state.projectWorkspace, status: "rolled_back", files: structuredClone(checkpoint.files), verifierResults: [] },
        kpr: state.kpr ? { ...state.kpr, status: "rolled_back", updatedAt: nowIso() } : state.kpr,
        notifications: [...state.notifications, notification("warning", "Project candidate rolled back to the checkpoint.")]
      };
    }
    case "ADOPT_PROJECT_CANDIDATE": {
      if (state.projectWorkspace.status !== "verified") {
        return { ...state, notifications: [...state.notifications, notification("error", "Only a verified candidate can be adopted.")] };
      }
      return {
        ...state,
        projectWorkspace: { ...state.projectWorkspace, status: "adopted" },
        kpr: state.kpr ? { ...state.kpr, status: "adopted", updatedAt: nowIso() } : state.kpr,
        guidedStep: 9,
        notifications: [...state.notifications, notification("success", "Maintainer adopted the verified candidate. Human governance is complete.")]
      };
    }
    case "TOGGLE_RUNTIME":
      return { ...state, showRuntime: action.value ?? !state.showRuntime };
    case "ADD_NOTIFICATION":
      return { ...state, notifications: [...state.notifications, notification(action.kind, action.message)] };
    case "DISMISS_NOTIFICATION":
      return { ...state, notifications: state.notifications.filter((item) => item.id !== action.id) };
    case "LOAD_STATE":
      return { ...createInitialState(), ...action.state, referenceApps: action.state.referenceApps ?? createInitialState().referenceApps };
    case "RESET": {
      const reset = createInitialState();
      return {
        ...reset,
        mode: state.mode,
        providerConfig: { ...state.providerConfig }
      };
    }
    default:
      return state;
  }
}
