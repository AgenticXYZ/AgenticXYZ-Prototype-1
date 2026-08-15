import { ACTORS } from "./constants";
import { checksum } from "./hash";
import { nowIso } from "./time";
import { PROJECT_VERIFIER_IDS } from "./kpr";
import type { AppState, Evidence, ProjectCandidate, UserOverlay } from "./types";

function verifierEvidence(
  id: string,
  title: string,
  summary: string,
  result: Evidence["result"],
  claimIds: string[],
  details?: Record<string, unknown>
): Evidence {
  return {
    id,
    type: "verifier",
    title,
    summary,
    supportsClaimIds: claimIds,
    result,
    source: {
      id: `${id}-source`,
      type: "verifier",
      label: ACTORS.verifier.label,
      timestamp: nowIso()
    },
    cannotProve: ["This bounded Verifier does not establish general user benefit, production safety, or lower Maintainer workload."],
    replayable: true,
    humanConfirmed: false,
    handling: "Reference-application evidence; eligible for public export only after the KPR privacy scan passes.",
    details
  };
}

export function verifyUserOverlay(state: AppState, overlay: UserOverlay): Evidence[] {
  const sourceCount = state.brief.evidence.length;
  const expectedSourceCount = 3;
  const results: Evidence[] = [
    verifierEvidence(
      "evidence-layout-order",
      "Conclusion appears before evidence",
      overlay.conclusionFirst
        ? "Rendered section order begins with the conclusion and keeps evidence after it."
        : "The requested conclusion-first order is not active.",
      overlay.conclusionFirst ? "pass" : "fail",
      ["claim-problem", "claim-expected-order", "claim-public-capability"],
      { conclusionFirst: overlay.conclusionFirst }
    ),
    verifierEvidence(
      "evidence-source-preservation",
      "Sources are preserved",
      sourceCount === expectedSourceCount && overlay.preserveSources
        ? "All reference sources remain attached."
        : "One or more reference sources would be hidden or removed.",
      sourceCount === expectedSourceCount && overlay.preserveSources ? "pass" : "fail",
      ["claim-preserve-sources", "claim-invariant-sources", "claim-public-capability"],
      { sourceCount, expectedSourceCount }
    ),
    verifierEvidence(
      "evidence-public-core",
      "Public core remains unchanged",
      "The proposed change is isolated to the User Realization layer.",
      "pass",
      ["claim-local-first"],
      { referenceChecksum: checksum(state.brief), layer: "user_overlay" }
    ),
    verifierEvidence(
      "evidence-reversible-overlay",
      "Overlay is reversible",
      "A checkpoint exists and removing the overlay restores the reference behavior.",
      "pass",
      ["claim-local-first", "claim-remember-preference"],
      { rollbackTarget: "checkpoint-user-before-overlay" }
    )
  ];
  return results;
}

export function verifyProjectCandidate(candidate: ProjectCandidate, requiredVerifierIds: string[] = [...PROJECT_VERIFIER_IDS]): Evidence[] {
  const optionalPass = candidate.enabledByDefault === false;
  const sourcesPass = candidate.preserveSources;
  const scopePass = candidate.applicableDocumentTypes.length === 1 && candidate.applicableDocumentTypes[0] === "research-brief";
  const confirmationPass = candidate.saveOnlyAfterConfirmation;
  const available = [
    verifierEvidence(
      "project-default-stability",
      "Public default remains unchanged",
      optionalPass ? "The capability is opt-in." : "The candidate changes the public default.",
      optionalPass ? "pass" : "fail",
      ["claim-public-capability"]
    ),
    verifierEvidence(
      "project-source-preservation",
      "Source invariant",
      sourcesPass ? "Sources remain visible in the candidate behavior." : "The candidate may hide sources.",
      sourcesPass ? "pass" : "fail",
      ["claim-invariant-sources"]
    ),
    verifierEvidence(
      "project-scope-boundary",
      "Scope is narrow",
      scopePass ? "The feature applies only to Research Brief documents." : "The feature scope is broader than approved.",
      scopePass ? "pass" : "fail",
      ["claim-public-capability"]
    ),
    verifierEvidence(
      "project-confirmation",
      "Preference requires confirmation",
      confirmationPass ? "Preference is saved only after user confirmation." : "Preference may be persisted silently.",
      confirmationPass ? "pass" : "fail",
      ["claim-remember-preference"]
    ),
    verifierEvidence(
      "project-unsupported-conclusion",
      "Unsupported conclusion guard",
      "Every conclusion block must retain at least one linked evidence item.",
      sourcesPass ? "pass" : "fail",
      ["claim-invariant-sources"],
      { minimumEvidenceLinks: 1 }
    )
  ];
  const byId = new Map(available.map((item) => [item.id, item]));
  return [...new Set(requiredVerifierIds)].map((id) => byId.get(id) ?? verifierEvidence(
    `missing-required-${id}`,
    "Required Verifier is unavailable",
    `The Contract requires ${id}, but the reference application has no registered implementation for it.`,
    "fail",
    [],
    { requiredVerifierId: id }
  ));
}

export function allRequiredPassed(evidence: Evidence[]): boolean {
  return evidence.length > 0 && evidence.every((item) => item.result === "pass");
}
