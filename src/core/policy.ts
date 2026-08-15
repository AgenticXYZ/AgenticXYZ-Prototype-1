import type { AgentRole, RiskLevel } from "./types";

export interface ToolPolicy {
  id: string;
  riskLevel: RiskLevel;
  allowedRoles: AgentRole[];
  sideEffect: "none" | "local-proposal" | "project-proposal" | "public-state";
  humanApproval: "not_required" | "before_execution" | "before_adoption";
}

export interface PermissionDecision {
  allowed: boolean;
  requiresHumanApproval: boolean;
  reason: string;
  policy?: ToolPolicy;
}

export interface RunBudgetState {
  providerCalls: number;
  toolCalls: number;
  elapsedMs: number;
}

export interface RunBudgetLimit {
  maxProviderCalls: number;
  maxToolCalls: number;
  maxDurationMs: number;
}

const TOOL_POLICIES: ToolPolicy[] = [
  {
    id: "submit_user_side_proposal",
    riskLevel: "R1",
    allowedRoles: ["user-side"],
    sideEffect: "local-proposal",
    humanApproval: "before_execution"
  },
  {
    id: "submit_maintainer_review",
    riskLevel: "R0",
    allowedRoles: ["maintainer-side"],
    sideEffect: "none",
    humanApproval: "before_adoption"
  },
  {
    id: "submit_project_candidate",
    riskLevel: "R2",
    allowedRoles: ["project"],
    sideEffect: "project-proposal",
    humanApproval: "before_adoption"
  },
  {
    id: "adopt_public_candidate",
    riskLevel: "R3",
    allowedRoles: ["project"],
    sideEffect: "public-state",
    humanApproval: "before_execution"
  }
];

export function policyForTool(toolId: string): ToolPolicy | undefined {
  return TOOL_POLICIES.find((item) => item.id === toolId);
}

export function authorizeToolCall(role: AgentRole, toolId: string, humanApproved = false): PermissionDecision {
  const policy = policyForTool(toolId);
  if (!policy) {
    return { allowed: false, requiresHumanApproval: false, reason: `Tool ${toolId} is not allowlisted.` };
  }
  if (!policy.allowedRoles.includes(role)) {
    return { allowed: false, requiresHumanApproval: false, reason: `${role} is not authorized to call ${toolId}.`, policy };
  }
  const approvalRequired = policy.riskLevel === "R3" || policy.humanApproval === "before_execution";
  if (approvalRequired && !humanApproved) {
    return {
      allowed: policy.sideEffect !== "public-state",
      requiresHumanApproval: true,
      reason:
        policy.sideEffect === "public-state"
          ? "R3 public-state behavior is blocked until explicit human approval."
          : "The proposal may be prepared, but execution remains behind a human gate.",
      policy
    };
  }
  return { allowed: true, requiresHumanApproval: false, reason: "Role, risk, and human-gate policy passed.", policy };
}

export function checkRunBudget(state: RunBudgetState, limit: RunBudgetLimit): { allowed: boolean; reason: string } {
  if (state.providerCalls >= limit.maxProviderCalls) return { allowed: false, reason: "Provider-call budget exceeded." };
  if (state.toolCalls >= limit.maxToolCalls) return { allowed: false, reason: "Tool-call budget exceeded." };
  if (limit.maxDurationMs > 0 && state.elapsedMs >= limit.maxDurationMs) return { allowed: false, reason: "Run timeout exceeded." };
  return { allowed: true, reason: "Run budget available." };
}
