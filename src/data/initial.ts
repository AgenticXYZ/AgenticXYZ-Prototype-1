import { DEFAULT_USER_REQUEST } from "../core/constants";
import { checksum } from "../core/hash";
import { normalizeReferenceApps, REFERENCE_APP_DEFAULTS } from "../core/referenceApps";
import type {
  AppState,
  BriefDocument,
  ChangeWorkspace,
  ProjectManifest,
  ProjectPolicy
} from "../core/types";

export const REFERENCE_BRIEF: BriefDocument = {
  title: "Do smaller language models belong in local research workflows?",
  question: "When should a research team prefer a smaller local model over a hosted frontier model?",
  conclusion:
    "Use a smaller local model when privacy, predictable cost, or offline availability matters more than frontier reasoning quality; keep a hosted model available for the hardest synthesis and verification tasks.",
  context:
    "Research teams increasingly mix local and hosted models. The decision is not a single quality ranking: it depends on data sensitivity, latency, hardware, task difficulty, and the cost of verification.",
  evidence: [
    {
      id: "source-1",
      claim: "Local inference can keep sensitive prompts inside a controlled environment.",
      source: "Project privacy notes",
      url: "project://knowledge/privacy-notes"
    },
    {
      id: "source-2",
      claim: "Hosted frontier models remain stronger on difficult synthesis tasks in the reference evaluation.",
      source: "Reference evaluation v0.1",
      url: "project://evidence/reference-eval"
    },
    {
      id: "source-3",
      claim: "The total cost depends on utilization and local hardware, not token price alone.",
      source: "Cost model assumptions",
      url: "project://knowledge/cost-model"
    }
  ],
  limitations: [
    "The reference evaluation is illustrative, not a comprehensive model benchmark.",
    "Local deployment still requires security updates and operational expertise."
  ]
};

export const PROJECT_MANIFEST: ProjectManifest = {
  schemaVersion: "0.1.0",
  projectId: "research-brief",
  projectVersion: "0.1.0",
  name: "Research Brief",
  description: "A source-preserving application for concise research briefs.",
  knowledgeLayers: [
    {
      id: "developer-intent",
      label: "Developer Intent / Policy",
      authority: "Project maintainer",
      mutableBy: ["maintainer"]
    },
    {
      id: "reference-core",
      label: "Reference Capability Core",
      authority: "Project repository",
      mutableBy: ["project"]
    },
    {
      id: "user-realization",
      label: "User Realization / Overlay",
      authority: "Local user",
      mutableBy: ["user-side", "contributor"]
    }
  ],
  capabilities: [
    {
      id: "render_brief",
      label: "Render research brief",
      description: "Render context, conclusion, evidence, sources, and limitations.",
      purpose: "Render a source-preserving Research Brief using the reference behavior or an approved local overlay.",
      inputSchema: { type: "object", required: ["document"] },
      outputSchema: { type: "object", required: ["sections", "sourceCount"] },
      sideEffects: [],
      permissionLevel: "R0",
      riskLevel: "R0",
      reversible: true,
      examples: ["Render the reference brief while keeping every source link visible."],
      failureModes: ["A required section is missing.", "A conclusion is shown without linked evidence."],
      humanApprovalRequired: false,
      mutableSurfaces: ["summary-layout"],
      verifierIds: ["source-preservation", "required-sections"]
    },
    {
      id: "configure_summary_layout",
      label: "Configure summary layout",
      description: "Change the order in which the conclusion and evidence are presented.",
      purpose: "Create a reversible User Overlay for conclusion-first presentation and confirmed preference memory.",
      inputSchema: { type: "object", required: ["conclusionFirst"] },
      outputSchema: { type: "object", required: ["overlay"] },
      sideEffects: ["Writes a local User Overlay after Contributor approval."],
      permissionLevel: "R1",
      riskLevel: "R1",
      reversible: true,
      examples: ["Put the conclusion first for this user without changing the public default."],
      failureModes: ["The overlay changes the protected public core.", "Sources are removed.", "The preference is saved without confirmation."],
      humanApprovalRequired: true,
      mutableSurfaces: ["summary-layout", "preference-memory"],
      verifierIds: ["source-preservation", "public-core-unchanged", "reversible-overlay"]
    }
  ],
  mutableSurfaces: [
    {
      id: "summary-layout",
      label: "Summary layout",
      category: "interface",
      protected: false,
      userLocal: true,
      projectConfigurable: true,
      contributable: true,
      reversible: true
    },
    {
      id: "theme",
      label: "Reference visual theme",
      category: "interface",
      protected: true,
      userLocal: false,
      projectConfigurable: true,
      contributable: false,
      reversible: true
    },
    {
      id: "preference-memory",
      label: "Confirmed preference memory",
      category: "preference",
      protected: false,
      userLocal: true,
      projectConfigurable: false,
      contributable: true,
      reversible: true
    }
  ],
  protectedInvariants: [
    "Source links remain visible and attached to evidence.",
    "The public default does not change without Maintainer approval.",
    "Private preferences are not submitted automatically.",
    "Project Agent completion requires verifier evidence.",
    "Final public adoption belongs to the Maintainer."
  ],
  verifierIds: [
    "source-preservation",
    "required-sections",
    "public-core-unchanged",
    "reversible-overlay",
    "unsupported-conclusion",
    "human-attestation",
    "privacy-scan",
    "project-default-stability",
    "project-source-preservation",
    "project-scope-boundary",
    "project-confirmation",
    "project-unsupported-conclusion"
  ],
  riskPolicyVersion: "0.1.0",
  kprSchemaVersion: "0.1.0"
};

export const PROJECT_POLICY: ProjectPolicy = {
  schemaVersion: "0.1.0",
  projectId: "research-brief",
  productPrinciples: [
    {
      id: "product-source-visible",
      category: "product",
      title: "Sources stay visible",
      statement: "Every public brief must preserve evidence and source links.",
      effect: "require_verification",
      appliesTo: ["user-side", "maintainer-side", "project"]
    },
    {
      id: "product-default-stable",
      category: "product",
      title: "Public defaults remain stable",
      statement: "A single user preference cannot silently become the public default.",
      effect: "require_approval",
      appliesTo: ["maintainer-side", "project"]
    }
  ],
  safetyRules: [
    {
      id: "safety-no-shell",
      category: "safety",
      title: "No arbitrary shell",
      statement: "Agents may only use allowlisted structured tools.",
      effect: "deny",
      appliesTo: ["user-side", "maintainer-side", "project"]
    },
    {
      id: "safety-verifier-completion",
      category: "safety",
      title: "Verifiers determine completion",
      statement: "An Agent message cannot mark a change complete without required verifier results.",
      effect: "require_verification",
      appliesTo: ["user-side", "project"]
    }
  ],
  privacyRules: [
    {
      id: "privacy-private-overlay",
      category: "privacy",
      title: "Private overlay stays local",
      statement: "Private preferences are excluded from a KPR unless the contributor explicitly selects them.",
      effect: "deny",
      appliesTo: ["user-side", "maintainer-side", "project"]
    },
    {
      id: "privacy-scan-before-submit",
      category: "privacy",
      title: "Scan before submission",
      statement: "KPR submission is blocked until privacy and secret scanning passes.",
      effect: "require_verification",
      appliesTo: ["user-side"]
    }
  ],
  contributionRules: [
    {
      id: "contribution-attestation",
      category: "contribution",
      title: "Human attestation required",
      statement: "Agent-extracted claims cannot be submitted as user requirements without contributor attestation.",
      effect: "require_approval",
      appliesTo: ["user-side"]
    },
    {
      id: "contribution-blind-reconstruction",
      category: "contribution",
      title: "Blind reconstruction",
      statement: "The Project Agent implements from the approved contract, not the contributor patch.",
      effect: "deny",
      appliesTo: ["project"]
    }
  ],
  runtimeRules: [
    {
      id: "runtime-one-provider",
      category: "runtime",
      title: "One active provider",
      statement: "All Agent roles use the same provider and model within a guided run.",
      effect: "allow",
      appliesTo: ["user-side", "maintainer-side", "project"]
    },
    {
      id: "runtime-r3-human",
      category: "runtime",
      title: "Human approval for public state",
      statement: "Public adoption and merge remain human decisions.",
      effect: "require_approval",
      appliesTo: ["project"]
    }
  ],
  approvalRules: [
    {
      id: "approval-user-overlay",
      action: "Apply a reversible User Overlay",
      riskLevel: "R1",
      requiredActor: "contributor"
    },
    {
      id: "approval-integration-contract",
      action: "Approve Claim Resolutions and the Knowledge Integration Contract",
      riskLevel: "R2",
      requiredActor: "maintainer"
    },
    {
      id: "approval-public-adoption",
      action: "Adopt a verified Project candidate into public state",
      riskLevel: "R3",
      requiredActor: "maintainer"
    }
  ],
  evidenceRequirements: [
    {
      id: "evidence-user-overlay",
      appliesTo: "user_overlay",
      verifierIds: ["source-preservation", "public-core-unchanged", "reversible-overlay"]
    },
    {
      id: "evidence-knowledge-gate",
      appliesTo: "knowledge_gate",
      verifierIds: ["human-attestation", "privacy-scan"]
    },
    {
      id: "evidence-project-candidate",
      appliesTo: "project_candidate",
      verifierIds: ["project-default-stability", "project-source-preservation", "project-scope-boundary", "project-confirmation", "project-unsupported-conclusion"]
    }
  ],
  protectedInvariants: [
    "Source links remain visible and attached to evidence.",
    "The public default does not change without Maintainer approval.",
    "Private preferences are not submitted automatically.",
    "Project Agent completion requires verifier evidence.",
    "Final public adoption belongs to the Maintainer."
  ],
  defaultBehavior: {
    conclusionFirst: false,
    preserveSources: true,
    theme: "light",
    savePreference: false
  }
};

function createWorkspace(id: string, ownerRole: "user-side" | "project"): ChangeWorkspace {
  const content = JSON.stringify({ document: REFERENCE_BRIEF, overlay: null }, null, 2);
  return {
    id,
    ownerRole,
    status: "clean",
    baseVersion: "0.1.0",
    files: [{ path: "research-brief.json", content, layer: "reference", checksum: checksum(content) }],
    checkpoints: [],
    verifierResults: []
  };
}

export function createInitialState(): AppState {
  return {
    version: "0.1.0",
    activeView: "user",
    mode: "replay",
    providerConfig: { provider: "openai", model: "gpt-5.6-terra", available: false, source: "none" },
    guidedStep: 0,
    manifest: PROJECT_MANIFEST,
    policy: PROJECT_POLICY,
    brief: REFERENCE_BRIEF,
    referenceApps: structuredClone(REFERENCE_APP_DEFAULTS),
    userRequest: DEFAULT_USER_REQUEST,
    userWorkspace: createWorkspace("workspace-user", "user-side"),
    projectWorkspace: createWorkspace("workspace-project", "project"),
    proposals: {},
    runs: [],
    notifications: [],
    showRuntime: true
  };
}

export function normalizeAppState(value: AppState): AppState {
  const baseline = createInitialState();
  return {
    ...baseline,
    ...value,
    providerConfig: { ...baseline.providerConfig, ...(value.providerConfig ?? {}) },
    referenceApps: normalizeReferenceApps(value.referenceApps)
  };
}
