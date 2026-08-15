import { redactText } from "./privacy";
import type { AppState, KPR } from "./types";

export function exportKprJson(kpr: KPR): string {
  const clean = {
    ...kpr,
    localImplementationReference: kpr.localImplementationReference
      ? { ...kpr.localImplementationReference, visibleToProjectAgent: false }
      : undefined
  };
  return redactText(JSON.stringify(clean, null, 2));
}

export function exportPublicKprJson(kpr: KPR): string {
  const { localImplementationReference: _privateImplementation, ...publicKpr } = kpr;
  return redactText(JSON.stringify(publicKpr, null, 2));
}

export function exportKprMarkdown(kpr: KPR): string {
  const claims = kpr.knowledgeClaims
    .map(
      (claim) => {
        const corrected = kpr.decisionRecord.some((item) => item.id === `decision-contributor-correction-${claim.id}`);
        const source = claim.agentGenerated
          ? `${corrected ? "Agent-extracted, human-corrected" : "Agent-extracted"}${claim.humanAttestation ? ", human-attested" : ", not attested"}`
          : "Human-authored";
        return `- **${claim.type}** — ${claim.statement}\n  - Source: ${source}\n  - Evidence: ${claim.evidenceRefs.join(", ") || "None"}`;
      }
    )
    .join("\n");
  const evidence = kpr.evidence
    .map((item) => `- **${item.result.toUpperCase()}** ${item.title}: ${item.summary}
  - Produced by: ${item.source.label}
  - Supports: ${item.supportsClaimIds.join(", ") || "No Claim linked"}
  - Cannot prove: ${item.cannotProve.join(" ") || "Not stated"}
  - Replayable: ${item.replayable ? "yes" : "no"}
  - Human confirmed: ${item.humanConfirmed ? "yes" : "no — Verifier-produced evidence remains subject to review"}
  - Handling: ${item.handling}`)
    .join("\n");
  const decisions = kpr.decisionRecord
    .map((item) => `- **${item.action}** — ${item.actor.label} (${item.timestamp})\n  - ${item.rationale}`)
    .join("\n");
  const provenance = kpr.provenance
    .map((item) => `- **${item.type}** — ${item.label} (${item.timestamp})`)
    .join("\n");
  const impacts = kpr.impactAnalysis.length > 0
    ? kpr.impactAnalysis.map((item) => `- **${item.dimension} / ${item.source}** — ${item.title}: ${item.description}
  - Confidence: ${item.confidence}; scopes: ${item.affectedScopes.join(", ") || "none"}
  - Human decision: ${item.humanDecisionRequired ? "required" : "not required"}; additional evidence: ${item.evidenceRequired ? "required" : "not required"}`).join("\n")
    : "Not generated yet.";
  const contract = kpr.integrationContract
    ? `- Approved by: ${kpr.integrationContract.approvedBy.label} at ${kpr.integrationContract.approvedAt}
- Accepted knowledge:
${kpr.integrationContract.acceptedKnowledge.map((item) => `  - **${item.decision}** ${item.finalStatement ?? item.claimId} — scopes: ${item.targetScopes.join(", ") || "none"}`).join("\n") || "  - None"}
- Rejected knowledge:
${kpr.integrationContract.rejectedKnowledge.map((item) => `  - **${item.decision}** ${item.finalStatement ?? item.claimId}`).join("\n") || "  - None"}
- Implementation boundary:
${kpr.integrationContract.implementationBoundary.map((item) => `  - ${item}`).join("\n")}
- Required Verifiers: ${kpr.integrationContract.requiredVerifiers.join(", ")}
- Unresolved questions: ${kpr.integrationContract.unresolvedQuestions.join(", ") || "none"}`
    : "Not approved yet.";
  return redactText(`# ${kpr.title}

**KPR:** ${kpr.id}<br>
**Status:** ${kpr.status}<br>
**Schema:** ${kpr.schemaVersion}

## Decision brief

${kpr.problem}

## Expected behavior

${kpr.expectedBehavior.map((item) => `- ${item}`).join("\n")}

## Acceptance criteria

${kpr.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}

## Knowledge claims

${claims}

## Evidence

${evidence}

## Decision record

${decisions || "No human decision recorded yet."}

## Failed attempts and counterexamples

${kpr.failedAttempts.map((item) => `- ${item}`).join("\n") || "- None recorded."}

## Open questions

${kpr.openQuestions.map((item) => `- ${item}`).join("\n") || "- None."}

## Provenance

${provenance}

## Knowledge impact analysis

${impacts}

## Knowledge Integration Contract

${contract}

## Protected invariants

${kpr.protectedInvariants.map((item) => `- ${item}`).join("\n")}

## Non-goals

${kpr.nonGoals.map((item) => `- ${item}`).join("\n")}

## Human attestation

${kpr.humanAttestation?.statement ?? "Missing"}

## Contributor implementation boundary

The local implementation reference is intentionally omitted from this Markdown export. It remains evidence, not Project Agent authority.

## Privacy and license

- Scan: ${kpr.privacyAndLicense.privacyScan.status}
- License: ${kpr.privacyAndLicense.license}
- Contributor owns content: ${kpr.privacyAndLicense.contributorOwnsContent ? "yes" : "no"}
`);
}

export function exportProjectState(state: AppState): string {
  const cleanState: AppState = {
    ...state,
    providerConfig: { ...state.providerConfig, source: state.providerConfig.available ? "environment" : "none" },
    notifications: []
  };
  return redactText(JSON.stringify(cleanState, null, 2));
}

export function exportPublicReplayState(state: AppState): string {
  const publicKpr = state.kpr
    ? (({ localImplementationReference: _privateImplementation, ...kpr }) => kpr)(state.kpr)
    : undefined;
  const cleanState: AppState = {
    ...state,
    mode: "replay",
    providerConfig: { ...state.providerConfig, available: false, source: "none" },
    kpr: publicKpr,
    notifications: []
  };
  return redactText(JSON.stringify(cleanState, null, 2));
}

export function downloadText(filename: string, contents: string, mime = "text/plain"): void {
  const blob = new Blob([contents], { type: mime });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
