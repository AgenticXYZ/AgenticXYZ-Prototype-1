import { describe, expect, it } from "vitest";

import { exportKprJson, exportKprMarkdown, exportProjectState, exportPublicKprJson, exportPublicReplayState } from "../../src/core/export";
import { checksum } from "../../src/core/hash";
import { parseImportedState } from "../../src/core/import";
import { CANONICAL_CONTRIBUTOR_CORRECTION, PROJECT_VERIFIER_IDS, buildIntegrationContract, completeImpactAnalysis, defaultClaimResolutions, knowledgeGate } from "../../src/core/kpr";
import { authorizeToolCall, checkRunBudget } from "../../src/core/policy";
import { redactText, scanText } from "../../src/core/privacy";
import { isReferenceAppPresetRequest, referenceAppConversationReply, referenceAppPresetFor } from "../../src/core/referenceApps";
import { appReducer } from "../../src/core/reducer";
import { fallbackResponse } from "../../src/core/runs";
import type { AppAction } from "../../src/core/reducer";
import type { AppState, ProjectCandidate } from "../../src/core/types";
import { allRequiredPassed, verifyProjectCandidate } from "../../src/core/verifiers";
import { createInitialState } from "../../src/data/initial";
import { recordedResponse } from "../../src/data/replay";

function reduce(state: AppState, action: AppAction) {
  return appReducer(state, action);
}

function stateWithKpr(): AppState {
  let state = createInitialState();
  const user = recordedResponse("user-side");
  state = reduce(state, { type: "APPLY_AGENT_RESPONSE", run: user.run, proposal: user.proposal });
  state = reduce(state, { type: "APPROVE_OVERLAY" });
  state = reduce(state, { type: "VERIFY_OVERLAY" });
  state = reduce(state, { type: "CREATE_KPR" });
  state = reduce(state, { type: "ATTEST_KPR" });
  state = reduce(state, { type: "SCAN_KPR" });
  return state;
}

describe("knowledge collaboration state machine", () => {
  it("resets the guided demo without changing the configured Provider or run mode", () => {
    const initial = createInitialState();
    let state = reduce(initial, {
      type: "SET_PROVIDER_CONFIG",
      config: { provider: "deepseek", model: "deepseek-v4-flash", available: true, source: "session" }
    });
    state = reduce(state, { type: "SET_MODE", mode: "live" });
    state = reduce(state, { type: "SET_USER_REQUEST", value: "A locally edited request" });
    const user = recordedResponse("user-side");
    state = reduce(state, { type: "APPLY_AGENT_RESPONSE", run: user.run, proposal: user.proposal });

    const reset = reduce(state, { type: "RESET" });

    expect(reset.providerConfig).toEqual({ provider: "deepseek", model: "deepseek-v4-flash", available: true, source: "session" });
    expect(reset.mode).toBe("live");
    expect(reset.userRequest).toBe(initial.userRequest);
    expect(reset.runs).toEqual([]);
    expect(reset.guidedStep).toBe(initial.guidedStep);
    expect(reset.referenceApps).toEqual(initial.referenceApps);
  });

  it("defines preset workflows only for the first three reference applications", () => {
    const presets = ["research-brief", "agent-demo", "daily-news"].map((appId) => referenceAppPresetFor(appId as "research-brief" | "agent-demo" | "daily-news"));
    expect(presets.every(Boolean)).toBe(true);
    expect(presets.every((preset) => preset!.steps.length === 4)).toBe(true);
    expect(presets.every((preset) => isReferenceAppPresetRequest(preset!.request))).toBe(true);
    expect(referenceAppPresetFor("issue-triage")).toBeUndefined();
    expect(referenceAppPresetFor("release-desk")).toBeUndefined();
    expect(isReferenceAppPresetRequest("My edited request")).toBe(false);
  });

  it("uses one bounded conversation resolver for both XYZ entry points", () => {
    expect(referenceAppConversationReply("Add a terminal sidebar", "agent-demo").action).toBe("add-interactive-sidebar");
    expect(referenceAppConversationReply("使用 16px 字号和蓝色主题", "agent-demo").action).toBe("apply-visual-preferences");
    expect(referenceAppConversationReply("Reconstruct the news headlines", "daily-news").action).toBe("rewrite-news-headlines");
    expect(referenceAppConversationReply("添加时钟", "daily-news").message).toContain("outside this application's scope");
    expect(referenceAppConversationReply("Configure Provider", "agent-demo").action).toBeUndefined();
    expect(referenceAppConversationReply("Configure Provider", "agent-demo").message).toContain("outside this application's scope");
  });

  it("opens the inspectable Runtime in a fresh guided demo", () => {
    expect(createInitialState().showRuntime).toBe(true);
  });

  it("retains reruns as append-only audit history", () => {
    let state = createInitialState();
    const first = recordedResponse("user-side");
    const second = structuredClone(first);
    second.run.id = "run-replay-user-side-rerun";
    state = reduce(state, { type: "APPLY_AGENT_RESPONSE", run: first.run, proposal: first.proposal });
    state = reduce(state, { type: "APPLY_AGENT_RESPONSE", run: second.run, proposal: second.proposal });
    expect(state.runs.map((run) => run.id)).toEqual([first.run.id, second.run.id]);
  });

  it("keeps the User Overlay isolated, verified, and human-attested", () => {
    const state = stateWithKpr();
    expect(state.userWorkspace.status).toBe("verified");
    expect(state.userWorkspace.files.some((file) => file.layer === "user_overlay")).toBe(true);
    expect(state.projectWorkspace.files.some((file) => file.layer === "user_overlay")).toBe(false);
    expect(state.kpr?.humanAttestation?.actor.type).toBe("human");
    expect(state.kpr?.knowledgeClaims.every((claim) => claim.humanAttestation)).toBe(true);
    expect(state.kpr?.localImplementationReference?.visibleToProjectAgent).toBe(false);
    expect(state.kpr?.decisionRecord.some((item) => item.id === "decision-contributor-correction-claim-problem")).toBe(false);
    expect(state.kpr?.decisionRecord.some((item) => item.id === "decision-contributor-attestation")).toBe(true);
    for (const claim of state.kpr!.knowledgeClaims) {
      for (const evidenceId of claim.evidenceRefs) {
        const evidence = state.kpr!.evidence.find((item) => item.id === evidenceId);
        expect(evidence, `${evidenceId} must exist`).toBeDefined();
        expect(evidence?.supportsClaimIds).toContain(claim.id);
        expect(evidence?.cannotProve.length).toBeGreaterThan(0);
      }
    }
  });

  it("requires an explicit human action for attestation but not a performative Claim edit", () => {
    let state = createInitialState();
    const user = recordedResponse("user-side");
    state = reduce(state, { type: "APPLY_AGENT_RESPONSE", run: user.run, proposal: user.proposal });
    state = reduce(state, { type: "APPROVE_OVERLAY" });
    state = reduce(state, { type: "VERIFY_OVERLAY" });
    state = reduce(state, { type: "CREATE_KPR" });
    expect(state.kpr?.humanAttestation).toBeUndefined();
    expect(state.kpr?.knowledgeClaims.every((claim) => claim.status === "agent_extracted")).toBe(true);
    state = reduce(state, { type: "ATTEST_KPR" });
    expect(state.kpr?.humanAttestation?.actor.type).toBe("human");
    expect(state.kpr?.decisionRecord.some((item) => item.id.startsWith("decision-contributor-correction-"))).toBe(false);
  });

  it("retains optional Contributor corrections with provenance before attestation", () => {
    let state = createInitialState();
    const user = recordedResponse("user-side");
    state = reduce(state, { type: "APPLY_AGENT_RESPONSE", run: user.run, proposal: user.proposal });
    state = reduce(state, { type: "APPROVE_OVERLAY" });
    state = reduce(state, { type: "VERIFY_OVERLAY" });
    state = reduce(state, { type: "CREATE_KPR" });
    state = reduce(state, { type: "EDIT_CONTRIBUTOR_CLAIM", claimId: "claim-problem", statement: CANONICAL_CONTRIBUTOR_CORRECTION });
    state = reduce(state, { type: "ATTEST_KPR" });
    expect(state.kpr?.humanAttestation?.actor.type).toBe("human");
    expect(state.kpr?.decisionRecord.some((item) => item.id === "decision-contributor-correction-claim-problem")).toBe(true);
  });

  it("restores reference behavior from the User Overlay checkpoint", () => {
    let state = createInitialState();
    const user = recordedResponse("user-side");
    state = reduce(state, { type: "APPLY_AGENT_RESPONSE", run: user.run, proposal: user.proposal });
    state = reduce(state, { type: "APPROVE_OVERLAY" });
    expect(state.activeOverlay).toBeDefined();
    state = reduce(state, { type: "ROLLBACK_OVERLAY" });
    expect(state.activeOverlay).toBeUndefined();
    expect(state.userWorkspace.status).toBe("rolled_back");
    expect(state.userWorkspace.files.every((file) => file.layer === "reference")).toBe(true);
  });

  it("blocks the Knowledge Gate without attestation or privacy proof", () => {
    const state = stateWithKpr();
    const kpr = structuredClone(state.kpr!);
    kpr.humanAttestation = undefined;
    kpr.knowledgeClaims = kpr.knowledgeClaims.map((claim) => ({ ...claim, humanAttestation: undefined }));
    kpr.privacyAndLicense.privacyScan.status = "not_run";
    const gate = knowledgeGate(kpr);
    expect(gate.passed).toBe(false);
    expect(gate.reasons.join(" ")).toContain("Human attestation");
    expect(gate.reasons.join(" ")).toContain("Privacy scan");
  });

  it("turns fine-grained Maintainer decisions into an executable Contract", () => {
    const state = stateWithKpr();
    const resolutions = defaultClaimResolutions(state.kpr!);
    const contract = buildIntegrationContract(state.kpr!, resolutions);
    expect(contract.acceptedKnowledge).toHaveLength(state.kpr!.knowledgeClaims.length);
    expect(contract.requiredVerifiers).toContain("project-default-stability");
    expect(contract.implementationBoundary).toContain("Contributor patch remains hidden from Project Agent");
    expect(contract.unresolvedQuestions).toEqual([]);
    expect(resolutions.flatMap((item) => item.requiredVerifierIds).every((id) => PROJECT_VERIFIER_IDS.includes(id as (typeof PROJECT_VERIFIER_IDS)[number]))).toBe(true);
  });

  it("blocks synthesis when a Claim requests an unregistered Verifier", () => {
    const state = stateWithKpr();
    const resolutions = defaultClaimResolutions(state.kpr!);
    resolutions[0] = { ...resolutions[0], requiredVerifierIds: ["project-verifier-that-does-not-exist"] };
    const contract = buildIntegrationContract(state.kpr!, resolutions);
    expect(contract.unresolvedQuestions).toContain("unknown_verifier:project-verifier-that-does-not-exist");
    expect(contract.requiredVerifiers).toContain("project-verifier-that-does-not-exist");
  });

  it("persists Maintainer scope, rollout, proof, and rationale shaping into the Contract", () => {
    let state = stateWithKpr();
    state = reduce(state, { type: "SUBMIT_KPR" });
    state = reduce(state, { type: "RUN_KNOWLEDGE_GATE" });
    state = reduce(state, { type: "APPLY_IMPACT_ANALYSIS" });
    state = reduce(state, {
      type: "SET_CLAIM_DECISION",
      claimId: "claim-public-capability",
      decision: "narrow",
      finalStatement: "Offer the capability only to an experimental Research Brief cohort.",
      rationale: "Evidence is limited to this document type and cohort.",
      targetScopes: ["research-brief", "experimental-cohort"],
      rollout: "experimental",
      requiredVerifierIds: ["project-scope-boundary", "project-default-stability"]
    });
    state = reduce(state, { type: "GENERATE_CONTRACT" });
    const shaped = state.contract?.acceptedKnowledge.find((item) => item.claimId === "claim-public-capability");
    expect(shaped).toMatchObject({
      decision: "narrow",
      targetScopes: ["research-brief", "experimental-cohort"],
      rollout: "experimental",
      requiredVerifierIds: ["project-scope-boundary", "project-default-stability"]
    });
    expect(shaped?.rationale).toContain("limited");
    expect(state.kpr?.decisionRecord.some((item) => item.id === "decision-maintainer-contract")).toBe(true);
  });

  it("keeps deferred knowledge unresolved and blocks Project synthesis", () => {
    let state = stateWithKpr();
    state = reduce(state, { type: "SUBMIT_KPR" });
    state = reduce(state, { type: "RUN_KNOWLEDGE_GATE" });
    state = reduce(state, { type: "APPLY_IMPACT_ANALYSIS" });
    state = reduce(state, { type: "SET_CLAIM_DECISION", claimId: "claim-public-capability", decision: "defer" });
    state = reduce(state, { type: "GENERATE_CONTRACT" });
    expect(state.contract?.unresolvedQuestions).toContain("claim-public-capability");
    state = reduce(state, {
      type: "SET_PROJECT_CANDIDATE",
      candidate: {
        featureId: "blocked", label: "blocked", enabledByDefault: false,
        applicableDocumentTypes: ["research-brief"], preserveSources: true,
        saveOnlyAfterConfirmation: true, rollout: "experimental"
      }
    });
    expect(state.projectCandidate).toBeUndefined();
  });

  it("supports checkpoint, verifier-driven completion, rollback, and human adoption", () => {
    let state = stateWithKpr();
    state = reduce(state, { type: "SUBMIT_KPR" });
    state = reduce(state, { type: "RUN_KNOWLEDGE_GATE" });
    const maintainer = recordedResponse("maintainer-side", state.kpr);
    state = reduce(state, { type: "APPLY_AGENT_RESPONSE", run: maintainer.run, proposal: maintainer.proposal });
    state = reduce(state, { type: "GENERATE_CONTRACT" });
    const project = recordedResponse("project", state.kpr);
    state = reduce(state, { type: "APPLY_AGENT_RESPONSE", run: project.run, proposal: project.proposal });
    expect(state.projectWorkspace.status).toBe("proposed");
    expect(state.projectWorkspace.checkpoints).toHaveLength(1);
    state = reduce(state, { type: "ADOPT_PROJECT_CANDIDATE" });
    expect(state.projectWorkspace.status).toBe("proposed");
    state = reduce(state, { type: "VERIFY_PROJECT_CANDIDATE" });
    expect(state.projectWorkspace.status).toBe("verified");
    state = reduce(state, { type: "ROLLBACK_PROJECT_CANDIDATE" });
    expect(state.projectWorkspace.status).toBe("rolled_back");
    expect(state.projectCandidate).toBeUndefined();

    const replay = recordedResponse("project", state.kpr);
    state = reduce(state, { type: "APPLY_AGENT_RESPONSE", run: replay.run, proposal: replay.proposal });
    state = reduce(state, { type: "VERIFY_PROJECT_CANDIDATE" });
    state = reduce(state, { type: "ADOPT_PROJECT_CANDIDATE" });
    expect(state.kpr?.status).toBe("adopted");
    expect(state.guidedStep).toBe(9);
  });

  it("keeps reference-application capabilities user-local, verified, and reversible", () => {
    let state = createInitialState();
    state = reduce(state, { type: "APPLY_REFERENCE_APP_CHANGE", appId: "agent-demo", kind: "add-interactive-sidebar" });
    const change = state.referenceApps.changes.at(-1)!;
    expect(state.referenceApps.agentDemo.interactiveSidebar).toBe(true);
    expect(change.status).toBe("applied");
    expect(change.checkpointId).toContain("reference-checkpoint");

    state = reduce(state, { type: "VERIFY_REFERENCE_APP_CHANGE", changeId: change.id });
    expect(state.referenceApps.changes.at(-1)?.status).toBe("verified");
    expect(state.referenceApps.changes.at(-1)?.evidence.length).toBeGreaterThanOrEqual(3);

    state = reduce(state, { type: "ROLLBACK_REFERENCE_APP_CHANGE", appId: "agent-demo" });
    expect(state.referenceApps.agentDemo.interactiveSidebar).toBe(false);
    expect(state.referenceApps.changes.at(-1)?.status).toBe("rolled_back");
  });

  it("structures a KPR draft only after verification and records an inspectable run", () => {
    let state = createInitialState();
    state = reduce(state, { type: "APPLY_REFERENCE_APP_CHANGE", appId: "daily-news", kind: "rewrite-news-headlines" });
    const changeId = state.referenceApps.changes.at(-1)!.id;
    state = reduce(state, { type: "CREATE_REFERENCE_APP_KPR", changeId });
    expect(state.referenceApps.kprDraft).toBeUndefined();

    state = reduce(state, { type: "VERIFY_REFERENCE_APP_CHANGE", changeId });
    state = reduce(state, { type: "CREATE_REFERENCE_APP_KPR", changeId });
    expect(state.referenceApps.kprDraft).toMatchObject({ appId: "daily-news", sourceChangeId: changeId, status: "agent_structured" });
    expect(state.runs.at(-1)?.skillId).toBe("skill-user-local-kpr-draft@0.1.0");
    expect(state.runs.at(-1)?.budget.providerCallsUsed).toBe(0);
    expect(state.showRuntime).toBe(true);
    expect(state.activeView).toBe("kpr");

    state = reduce(state, { type: "ROLLBACK_REFERENCE_APP_CHANGE", appId: "daily-news" });
    expect(state.referenceApps.kprDraft).toBeUndefined();
  });
});

describe("policy, risk, budget, and completion", () => {
  it("completes every Maintainer impact analysis to all ten required dimensions", () => {
    const completed = completeImpactAnalysis([{
      id: "provider-impact",
      dimension: "product_behavior",
      title: "Provider analysis",
      description: "A bounded behavior change.",
      source: "agent-inferred",
      confidence: "medium",
      affectedScopes: ["research-brief"],
      humanDecisionRequired: true,
      evidenceRequired: true
    }]);
    expect(new Set(completed.map((item) => item.dimension))).toEqual(new Set([
      "product_behavior", "interface", "user_preference", "data_provenance", "permissions_privacy",
      "compatibility", "performance_cost", "verification", "documentation", "rollout_rollback"
    ]));
    expect(completed.find((item) => item.id === "provider-impact")?.source).toBe("agent-inferred");
  });

  it("denies non-allowlisted and cross-role tools", () => {
    expect(authorizeToolCall("user-side", "arbitrary_shell").allowed).toBe(false);
    expect(authorizeToolCall("user-side", "submit_project_candidate").allowed).toBe(false);
  });

  it("requires explicit human approval for R3 public state", () => {
    const waiting = authorizeToolCall("project", "adopt_public_candidate");
    expect(waiting.allowed).toBe(false);
    expect(waiting.requiresHumanApproval).toBe(true);
    expect(authorizeToolCall("project", "adopt_public_candidate", true).allowed).toBe(true);
  });

  it("stops at provider, tool, and duration budgets", () => {
    const limit = { maxProviderCalls: 1, maxToolCalls: 2, maxDurationMs: 1000 };
    expect(checkRunBudget({ providerCalls: 1, toolCalls: 0, elapsedMs: 1 }, limit).reason).toContain("Provider");
    expect(checkRunBudget({ providerCalls: 0, toolCalls: 2, elapsedMs: 1 }, limit).reason).toContain("Tool");
    expect(checkRunBudget({ providerCalls: 0, toolCalls: 0, elapsedMs: 1000 }, limit).reason).toContain("timeout");
    expect(checkRunBudget({ providerCalls: 0, toolCalls: 0, elapsedMs: Number.MAX_SAFE_INTEGER }, { ...limit, maxDurationMs: 0 }).allowed).toBe(true);
  });

  it("rejects an unsafe candidate even if an Agent says it is done", () => {
    const unsafe: ProjectCandidate = {
      featureId: "unsafe", label: "Unsafe", enabledByDefault: true,
      applicableDocumentTypes: ["all"], preserveSources: false,
      saveOnlyAfterConfirmation: false, rollout: "stable"
    };
    const evidence = verifyProjectCandidate(unsafe);
    expect(allRequiredPassed(evidence)).toBe(false);
    expect(evidence.filter((item) => item.result === "fail").length).toBeGreaterThanOrEqual(4);
  });
});

describe("privacy, exports, and replay", () => {
  it("redacts keys, email addresses, bearer tokens, and personal paths", () => {
    const text = "sk-exampleSecretKey123456789 a@example.com Bearer abcdefghijklmnopqrstuvwxyz /Users/person/private";
    const scan = scanText(text);
    expect(scan.status).toBe("blocked");
    expect(redactText(text)).not.toContain("exampleSecretKey");
    expect(redactText(text)).not.toContain("a@example.com");
    expect(redactText(text)).not.toContain("/Users/person/");
  });

  it("keeps secrets out of KPR and project exports", () => {
    const state = stateWithKpr();
    state.kpr!.problem += " sk-exampleSecretKey123456789 /Users/person/private";
    const kprExport = exportKprJson(state.kpr!);
    const projectExport = exportProjectState(state);
    expect(kprExport).toContain("[REDACTED:openai_or_compatible_api_key]");
    expect(projectExport).not.toContain("exampleSecretKey");
    expect(projectExport).not.toContain("/Users/person/");
  });

  it("exports a knowledge-complete Markdown KPR without contributor implementation authority", () => {
    const state = stateWithKpr();
    const markdown = exportKprMarkdown(state.kpr!);
    expect(markdown).toContain(`**KPR:** ${state.kpr!.id}<br>\n**Status:** contributor_review`);
    expect(markdown).toContain("## Acceptance criteria");
    expect(markdown).toContain("## Decision record");
    expect(markdown).toContain("## Failed attempts and counterexamples");
    expect(markdown).toContain("## Provenance");
    expect(markdown).toContain("Cannot prove:");
    expect(markdown).toContain("intentionally omitted");
    expect(markdown).not.toContain(state.kpr!.localImplementationReference!.workspaceId);
  });

  it("redacts authorization, cookie, environment-secret, and phone forms from public artifacts", () => {
    const sensitive = [
      ["Authorization", ": Basic ", "abcdefghijklmno"].join(""),
      ["Cookie", ": session=", "abcdefghijklmno"].join(""),
      ["SERVICE", "_TOKEN=", "abcdefghijklmno"].join(""),
      ["+1", " 415", "-555", "-0199"].join("")
    ].join("\n");
    expect(scanText(sensitive).findings.map((item) => item.kind)).toEqual(expect.arrayContaining([
      "authorization_header", "cookie_header", "environment_secret", "phone_number"
    ]));
    expect(redactText(sensitive)).not.toContain("abcdefghijklmno");
    expect(redactText(sensitive)).not.toContain("415-555-0199");
  });

  it("creates an importable public replay without contributor implementation or credential state", () => {
    const state = stateWithKpr();
    state.providerConfig = { provider: "openai", model: "test-model", available: true, source: "environment" };
    const publicKpr = exportPublicKprJson(state.kpr!);
    const replay = JSON.parse(exportPublicReplayState(state)) as AppState;
    expect(publicKpr).not.toContain("localImplementationReference");
    expect(replay.version).toBe("0.1.0");
    expect(replay.mode).toBe("replay");
    expect(replay.providerConfig).toMatchObject({ provider: "openai", model: "test-model", available: false, source: "none" });
    expect(replay.kpr?.localImplementationReference).toBeUndefined();
    const imported = parseImportedState(JSON.stringify({ ...replay, providerConfig: { ...replay.providerConfig, available: true, source: "environment" } }));
    expect(imported.providerConfig).toMatchObject({ available: false, source: "none" });
  });

  it("rejects malformed or sensitive imported state before it reaches the reducer", () => {
    expect(() => parseImportedState(JSON.stringify({ version: "0.1.0" }))).toThrow("Manifest");
    const structurallyInvalid = structuredClone(createInitialState()) as unknown as { manifest: Record<string, unknown> };
    delete structurallyInvalid.manifest.riskPolicyVersion;
    expect(() => parseImportedState(JSON.stringify(structurallyInvalid))).toThrow("ProjectManifest failed schema validation");
    const state = createInitialState();
    state.userRequest = ["Contact user", "@example.com"].join("");
    expect(() => parseImportedState(JSON.stringify(state))).toThrow("privacy finding");
    expect(() => parseImportedState("x".repeat(5_000_001))).toThrow("5 MB");
  });

  it("replays deterministically and labels fallback truthfully", () => {
    const first = fallbackResponse("replay", "user-side");
    const second = fallbackResponse("replay", "user-side");
    expect(checksum(first)).toBe(checksum(second));
    expect(first.run.mode).toBe("replay");
    expect(fallbackResponse("scripted", "user-side").run.terminationReason).toContain("not a model-generated run");
  });
});
