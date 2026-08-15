export type ProviderId = "openai" | "anthropic" | "deepseek";
export type RunMode = "replay" | "scripted" | "live";
export type AgentRole = "user-side" | "maintainer-side" | "project";
export type WorkspaceView = "user" | "kpr" | "developer";
export type ReferenceAppId = "research-brief" | "agent-demo" | "daily-news" | "issue-triage" | "release-desk";
export type ModifiableReferenceAppId = "agent-demo" | "daily-news";
export type ReferenceAppChangeKind =
  | "add-interactive-sidebar"
  | "apply-visual-preferences"
  | "add-clock-widget"
  | "rewrite-news-headlines";
export type RiskLevel = "R0" | "R1" | "R2" | "R3";
export type EvidenceLevel = "E1" | "E2";
export type PrincipleId = "agent-first" | "human-governed" | "knowledge-before-code" | "evidence-before-adoption" | "project-owned-implementation";

export interface ActorRef {
  id: string;
  type: "human" | "agent" | "verifier" | "system";
  label: string;
  role?: AgentRole | "contributor" | "maintainer";
}

export interface SourceRef {
  id: string;
  type: "human_statement" | "agent_extraction" | "workspace" | "policy" | "verifier" | "decision";
  label: string;
  timestamp: string;
}

export interface HumanAttestation {
  actor: ActorRef;
  statement: string;
  attestedAt: string;
  scope: string[];
}

export type KnowledgeClaimType =
  | "problem"
  | "intent"
  | "expected_behavior"
  | "constraint"
  | "acceptance_criterion"
  | "invariant"
  | "decision"
  | "evidence_interpretation"
  | "counterexample"
  | "open_question";

export type KnowledgeClaimStatus =
  | "captured"
  | "agent_extracted"
  | "human_attested"
  | "project_reviewed"
  | "accepted_for_synthesis"
  | "verified"
  | "adopted"
  | "rejected"
  | "superseded";

export type ClaimDecision = "accept" | "modify" | "narrow" | "defer" | "reject" | "request_evidence";

export interface KnowledgeClaim {
  id: string;
  type: KnowledgeClaimType;
  statement: string;
  scope: string[];
  createdBy: ActorRef;
  derivedFrom: SourceRef[];
  agentGenerated: boolean;
  humanAttestation?: HumanAttestation;
  evidenceRefs: string[];
  confidence: "low" | "medium" | "high";
  status: KnowledgeClaimStatus;
  conflictsWith: string[];
  supersedes: string[];
  limitations: string[];
}

export interface Evidence {
  id: string;
  type: "verifier" | "behavior" | "source" | "attestation" | "counterexample" | "policy";
  title: string;
  summary: string;
  supportsClaimIds: string[];
  result: "pass" | "fail" | "partial" | "informational";
  source: SourceRef;
  cannotProve: string[];
  replayable: boolean;
  humanConfirmed: boolean;
  handling: string;
  details?: Record<string, unknown>;
}

export interface ImpactItem {
  id: string;
  dimension:
    | "product_behavior"
    | "interface"
    | "user_preference"
    | "data_provenance"
    | "permissions_privacy"
    | "compatibility"
    | "performance_cost"
    | "verification"
    | "documentation"
    | "rollout_rollback";
  title: string;
  description: string;
  source: "explicit" | "agent-inferred" | "policy-required" | "maintainer-confirmed" | "unknown";
  confidence: "low" | "medium" | "high";
  affectedScopes: string[];
  humanDecisionRequired: boolean;
  evidenceRequired: boolean;
}

export interface ClaimResolution {
  claimId: string;
  decision: ClaimDecision;
  finalStatement?: string;
  rationale: string;
  targetScopes: string[];
  rollout?: string;
  requiredVerifierIds: string[];
}

export interface KnowledgeIntegrationContract {
  kprId: string;
  acceptedKnowledge: ClaimResolution[];
  rejectedKnowledge: ClaimResolution[];
  protectedInvariants: string[];
  implementationBoundary: string[];
  requiredVerifiers: string[];
  unresolvedQuestions: string[];
  approvedBy: ActorRef;
  approvedAt: string;
}

export type KprStatus =
  | "draft"
  | "contributor_review"
  | "submitted"
  | "knowledge_gate"
  | "needs_more_knowledge"
  | "rejected"
  | "accepted_for_synthesis"
  | "project_agent_synthesis"
  | "verification"
  | "revision_required"
  | "rolled_back"
  | "verification_passed"
  | "maintainer_review"
  | "adopted"
  | "deferred";

export interface PrivacyScan {
  status: "not_run" | "pass" | "blocked";
  findings: Array<{ kind: string; location: string; preview: string }>;
  scannedAt?: string;
}

export interface KPR {
  schemaVersion: "0.1.0";
  id: string;
  title: string;
  status: KprStatus;
  problem: string;
  scope: string[];
  expectedBehavior: string[];
  acceptanceCriteria: string[];
  nonGoals: string[];
  protectedInvariants: string[];
  knowledgeClaims: KnowledgeClaim[];
  evidence: Evidence[];
  decisionRecord: Array<{ id: string; actor: ActorRef; action: string; rationale: string; timestamp: string }>;
  failedAttempts: string[];
  openQuestions: string[];
  provenance: SourceRef[];
  privacyAndLicense: {
    privacyScan: PrivacyScan;
    license: string;
    contributorOwnsContent: boolean;
  };
  humanAttestation?: HumanAttestation;
  localImplementationReference?: {
    workspaceId: string;
    summary: string;
    visibleToProjectAgent: boolean;
  };
  impactAnalysis: ImpactItem[];
  claimResolutions: ClaimResolution[];
  integrationContract?: KnowledgeIntegrationContract;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityDefinition {
  id: string;
  label: string;
  description: string;
  purpose: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  sideEffects: string[];
  permissionLevel: RiskLevel;
  riskLevel: RiskLevel;
  reversible: boolean;
  examples: string[];
  failureModes: string[];
  humanApprovalRequired: boolean;
  mutableSurfaces: string[];
  verifierIds: string[];
}

export interface MutableSurfaceDefinition {
  id: string;
  label: string;
  category: "resource" | "logic" | "interface" | "preference";
  protected: boolean;
  userLocal: boolean;
  projectConfigurable: boolean;
  contributable: boolean;
  reversible: boolean;
}

export interface ProjectManifest {
  schemaVersion: "0.1.0";
  projectId: string;
  projectVersion: string;
  name: string;
  description: string;
  knowledgeLayers: Array<{ id: string; label: string; authority: string; mutableBy: string[] }>;
  capabilities: CapabilityDefinition[];
  mutableSurfaces: MutableSurfaceDefinition[];
  protectedInvariants: string[];
  verifierIds: string[];
  riskPolicyVersion: string;
  kprSchemaVersion: "0.1.0";
}

export interface PolicyRule {
  id: string;
  category: "product" | "safety" | "privacy" | "contribution" | "runtime";
  title: string;
  statement: string;
  effect: "allow" | "deny" | "require_approval" | "require_verification";
  appliesTo: AgentRole[];
}

export interface ProjectPolicy {
  schemaVersion: "0.1.0";
  projectId: string;
  productPrinciples: PolicyRule[];
  safetyRules: PolicyRule[];
  privacyRules: PolicyRule[];
  contributionRules: PolicyRule[];
  runtimeRules: PolicyRule[];
  approvalRules: Array<{
    id: string;
    action: string;
    riskLevel: RiskLevel;
    requiredActor: "contributor" | "maintainer";
  }>;
  evidenceRequirements: Array<{
    id: string;
    appliesTo: "user_overlay" | "knowledge_gate" | "project_candidate";
    verifierIds: string[];
  }>;
  protectedInvariants: string[];
  defaultBehavior: Record<string, unknown>;
}

export type AgentRunEventType =
  | "run_started"
  | "context_assembled"
  | "plan_proposed"
  | "assistant_message"
  | "tool_call"
  | "policy_check"
  | "approval_requested"
  | "approval_recorded"
  | "tool_result"
  | "verifier_result"
  | "checkpoint_created"
  | "rollback"
  | "usage"
  | "refusal"
  | "provider_error"
  | "run_completed"
  | "run_stopped";

export interface AgentRunEvent {
  id: string;
  sequence: number;
  timestamp: string;
  type: AgentRunEventType;
  plane: "context" | "policy" | "action" | "proof" | "memory";
  title: string;
  summary: string;
  actor: ActorRef;
  riskLevel?: RiskLevel;
  payload?: Record<string, unknown>;
}

export interface AgentRun {
  id: string;
  mode: RunMode;
  role: AgentRole;
  skillId: string;
  provider?: ProviderId;
  model?: string;
  status: "idle" | "running" | "waiting_for_human" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  events: AgentRunEvent[];
  budget: {
    maxProviderCalls: number;
    providerCallsUsed: number;
    maxToolCalls: number;
    toolCallsUsed: number;
    maxDurationMs: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    maxRetries: number;
    retriesUsed: number;
  };
  terminationReason?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface SkillDefinition {
  id: string;
  version: string;
  role: AgentRole;
  purpose: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  allowedToolIds: string[];
  requiredHumanGates: string[];
  requiredVerifierIds: string[];
  budget: {
    maxProviderCalls: number;
    maxToolCalls: number;
    maxDurationMs: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    maxRetries: number;
  };
}

export interface WorkspaceFile {
  path: string;
  content: string;
  layer: "reference" | "user_overlay" | "project_candidate";
  checksum: string;
}

export interface ChangeWorkspace {
  id: string;
  ownerRole: AgentRole;
  status: "clean" | "proposed" | "approved" | "verified" | "failed" | "rolled_back" | "adopted";
  baseVersion: string;
  files: WorkspaceFile[];
  checkpoints: Array<{ id: string; label: string; createdAt: string; files: WorkspaceFile[] }>;
  verifierResults: Evidence[];
}

export interface ProviderConfig {
  provider: ProviderId;
  model: string;
  available: boolean;
  source: "environment" | "session" | "none";
}

export interface BriefDocument {
  title: string;
  question: string;
  conclusion: string;
  context: string;
  evidence: Array<{ id: string; claim: string; source: string; url: string }>;
  limitations: string[];
}

export interface UserOverlay {
  conclusionFirst: boolean;
  preserveSources: boolean;
  theme: "light";
  rememberPreference: boolean;
  scope: "private" | "contributable";
}

export interface AgentDemoRealization {
  theme: "neutral" | "blue";
  fontSize: 14 | 16;
  interactiveSidebar: boolean;
  clockWidget: boolean;
}

export interface DailyNewsRealization {
  theme: "neutral" | "blue";
  fontSize: 14 | 16;
  structuredHeadlines: boolean;
}

export interface ReferenceAppChangeRecord {
  id: string;
  appId: ModifiableReferenceAppId;
  kind: ReferenceAppChangeKind;
  title: string;
  summary: string;
  before: AgentDemoRealization | DailyNewsRealization;
  after: AgentDemoRealization | DailyNewsRealization;
  status: "applied" | "verified" | "rolled_back";
  checkpointId: string;
  appliedAt: string;
  verifiedAt?: string;
  evidence: string[];
}

export interface ReferenceAppKprDraft {
  schemaVersion: "0.1.0";
  id: string;
  sourceChangeId: string;
  appId: ModifiableReferenceAppId;
  title: string;
  problem: string;
  expectedBehavior: string[];
  acceptanceCriteria: string[];
  evidence: string[];
  provenance: string[];
  limitations: string[];
  status: "agent_structured";
  structuredBy: string;
  createdAt: string;
}

export interface ReferenceAppExperience {
  agentDemo: AgentDemoRealization;
  dailyNews: DailyNewsRealization;
  changes: ReferenceAppChangeRecord[];
  kprDraft?: ReferenceAppKprDraft;
}

export interface ProjectCandidate {
  featureId: string;
  label: string;
  enabledByDefault: boolean;
  applicableDocumentTypes: string[];
  preserveSources: boolean;
  saveOnlyAfterConfirmation: boolean;
  rollout: "experimental" | "stable";
}

export interface AppState {
  version: "0.1.0";
  activeView: WorkspaceView;
  activePrinciple?: PrincipleId;
  mode: RunMode;
  providerConfig: ProviderConfig;
  guidedStep: number;
  manifest: ProjectManifest;
  policy: ProjectPolicy;
  brief: BriefDocument;
  referenceApps: ReferenceAppExperience;
  userRequest: string;
  proposedOverlay?: UserOverlay;
  activeOverlay?: UserOverlay;
  userWorkspace: ChangeWorkspace;
  projectWorkspace: ChangeWorkspace;
  kpr?: KPR;
  contract?: KnowledgeIntegrationContract;
  projectCandidate?: ProjectCandidate;
  proposals: Partial<Record<AgentRole, RuntimeProposal>>;
  runs: AgentRun[];
  notifications: Array<{ id: string; kind: "info" | "success" | "warning" | "error"; message: string }>;
  showRuntime: boolean;
}

export interface RuntimeProposal {
  role: AgentRole;
  summary: string;
  plan: string[];
  proposedOverlay?: UserOverlay;
  proposedClaims?: Array<Pick<KnowledgeClaim, "type" | "statement" | "scope" | "confidence">>;
  impactAnalysis?: ImpactItem[];
  resolutionSuggestions?: ClaimResolution[];
  projectCandidate?: ProjectCandidate;
  openQuestions: string[];
}

export interface AgentTurnRequest {
  role: AgentRole;
  provider: ProviderId;
  model: string;
  language?: "en" | "zh-CN";
  userMessage: string;
  context: {
    manifest: ProjectManifest;
    policy: ProjectPolicy;
    brief?: BriefDocument;
    overlay?: UserOverlay;
    kpr?: KPR;
    contract?: KnowledgeIntegrationContract;
  };
}

export interface AgentTurnResponse {
  run: AgentRun;
  proposal?: RuntimeProposal;
  assistantMessage: string;
}
