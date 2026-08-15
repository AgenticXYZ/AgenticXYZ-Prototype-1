import { knowledgeGate } from "./kpr";
import { scanKpr } from "./privacy";
import type { KPR, ProjectCandidate } from "./types";
import { verifyProjectCandidate } from "./verifiers";

export interface FailureScenarioResult {
  id: string;
  title: string;
  expected: string;
  observed: string;
  passed: boolean;
}

export function evaluateFailureScenarios(kpr: KPR): FailureScenarioResult[] {
  const unattested: KPR = {
    ...structuredClone(kpr),
    humanAttestation: undefined,
    knowledgeClaims: kpr.knowledgeClaims.map((claim) => ({ ...claim, humanAttestation: undefined }))
  };
  const attestationGate = knowledgeGate(unattested);

  const privateKpr: KPR = structuredClone(kpr);
  privateKpr.problem += " Contact researcher@example.com using sk-exampleSecretKey123456789.";
  const privacy = scanKpr(privateKpr);

  const unsafeCandidate: ProjectCandidate = {
    featureId: "unsafe-default",
    label: "Unsafe conclusion first",
    enabledByDefault: true,
    applicableDocumentTypes: ["all"],
    preserveSources: false,
    saveOnlyAfterConfirmation: false,
    rollout: "stable"
  };
  const verifierEvidence = verifyProjectCandidate(unsafeCandidate);
  const failedChecks = verifierEvidence.filter((item) => item.result === "fail");

  return [
    {
      id: "missing-attestation",
      title: "Missing Human Attestation",
      expected: "Knowledge Gate blocks Agent-extracted claims.",
      observed: "Human attestation was missing and Agent-extracted Claims remained unattested.",
      passed: !attestationGate.passed
    },
    {
      id: "privacy-block",
      title: "Privacy and secret block",
      expected: "Submission is blocked before project review.",
      observed: "Sensitive information was detected and the submission remained blocked.",
      passed: privacy.status === "blocked"
    },
    {
      id: "policy-conflict",
      title: "Policy conflict and verifier failure",
      expected: "Unsafe public default cannot be completed.",
      observed: "Unsafe defaults, broad scope, hidden sources, missing confirmation, and unsupported conclusions failed verification.",
      passed: failedChecks.length >= 4
    },
    {
      id: "agent-done-not-complete",
      title: "Agent says done, verifier says no",
      expected: "Natural language completion has no authority.",
      observed: "Candidate status remains failed until every required verifier passes.",
      passed: verifierEvidence.some((item) => item.result === "fail")
    }
  ];
}
