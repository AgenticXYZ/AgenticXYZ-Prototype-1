import type { AgentRole, SkillDefinition } from "../core/types";

const objectSchema = { type: "object" } as const;
const commonBudget = {
  maxProviderCalls: 1,
  maxToolCalls: 6,
  maxDurationMs: 0,
  maxInputTokens: 20_000,
  maxOutputTokens: 16_000,
  maxRetries: 0
};

const maintainerBudget = {
  ...commonBudget,
  maxOutputTokens: 32_000
};

export const SKILLS: SkillDefinition[] = [
  {
    id: "adapt_software_locally", version: "0.1.0", role: "user-side",
    purpose: "Combine project knowledge with a user's bounded preference in a reversible local overlay.",
    inputSchema: objectSchema, outputSchema: objectSchema,
    allowedToolIds: ["read_project_manifest", "read_project_policy", "inspect_workspace", "propose_change", "preview_workspace_patch", "submit_user_side_proposal"],
    requiredHumanGates: ["approve_user_overlay"],
    requiredVerifierIds: ["source-preservation", "public-core-unchanged", "reversible-overlay"], budget: commonBudget
  },
  {
    id: "describe_to_kpr", version: "0.1.0", role: "user-side",
    purpose: "Turn a verified local need into human-attested, provenance-linked contribution knowledge.",
    inputSchema: objectSchema, outputSchema: objectSchema,
    allowedToolIds: ["propose_knowledge_claims", "link_evidence_to_claim", "request_human_attestation", "build_kpr", "check_secret_and_privacy", "submit_kpr"],
    requiredHumanGates: ["human_attestation", "submit_kpr"],
    requiredVerifierIds: ["privacy-scan", "knowledge-gate"], budget: commonBudget
  },
  {
    id: "understand_kpr", version: "0.1.0", role: "maintainer-side",
    purpose: "Separate known, inferred, and unknown KPR knowledge before implementation review.",
    inputSchema: objectSchema, outputSchema: objectSchema,
    allowedToolIds: ["read_knowledge_claim", "read_evidence", "analyze_knowledge_impact", "submit_maintainer_review"],
    requiredHumanGates: ["maintainer_claim_resolution"], requiredVerifierIds: ["knowledge-gate"], budget: maintainerBudget
  },
  {
    id: "analyze_knowledge_impact", version: "0.1.0", role: "maintainer-side",
    purpose: "Map product, policy, provenance, verification, compatibility, and rollout consequences.",
    inputSchema: objectSchema, outputSchema: objectSchema,
    allowedToolIds: ["read_project_policy", "read_evidence", "analyze_knowledge_impact", "propose_claim_resolution", "submit_maintainer_review"],
    requiredHumanGates: ["maintainer_claim_resolution"], requiredVerifierIds: ["policy-compliance"], budget: maintainerBudget
  },
  {
    id: "draft_integration_contract", version: "0.1.0", role: "maintainer-side",
    purpose: "Compile human Claim decisions into a bounded, executable knowledge contract.",
    inputSchema: objectSchema, outputSchema: objectSchema,
    allowedToolIds: ["read_knowledge_claim", "propose_claim_resolution", "request_more_knowledge", "reject_kpr"],
    requiredHumanGates: ["approve_integration_contract"], requiredVerifierIds: ["contract-completeness"], budget: maintainerBudget
  },
  {
    id: "implement_from_contract", version: "0.1.0", role: "project",
    purpose: "Blindly reconstruct a project-owned candidate from the Maintainer-approved Contract.",
    inputSchema: objectSchema, outputSchema: objectSchema,
    allowedToolIds: ["read_project_manifest", "read_project_policy", "read_integration_contract", "inspect_workspace", "propose_change", "create_checkpoint", "submit_project_candidate"],
    requiredHumanGates: ["approve_integration_contract", "maintainer_final_review"],
    requiredVerifierIds: ["contract-scope", "source-preservation", "project-default-stability", "confirmation-before-save", "experimental-rollout"], budget: commonBudget
  },
  {
    id: "verify_candidate", version: "0.1.0", role: "project",
    purpose: "Evaluate a project candidate against the Contract without accepting the Agent's own completion claim.",
    inputSchema: objectSchema, outputSchema: objectSchema,
    allowedToolIds: ["run_verifier", "compare_behavior", "check_policy_compliance", "check_secret_and_privacy", "rollback_change"],
    requiredHumanGates: ["maintainer_final_review"],
    requiredVerifierIds: ["contract-scope", "source-preservation", "project-default-stability", "confirmation-before-save", "experimental-rollout"], budget: commonBudget
  }
];

const DEFAULT_SKILL: Record<AgentRole, string> = {
  "user-side": "adapt_software_locally",
  "maintainer-side": "understand_kpr",
  project: "implement_from_contract"
};

export function defaultSkillForRole(role: AgentRole): SkillDefinition {
  const skill = SKILLS.find((item) => item.id === DEFAULT_SKILL[role]);
  if (!skill) throw new Error(`No default Skill is registered for ${role}.`);
  return skill;
}
