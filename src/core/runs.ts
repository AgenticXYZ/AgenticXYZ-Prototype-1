import { ACTORS } from "./constants";
import { createId, nowIso } from "./time";
import type { AgentRole, AgentRun, AgentRunEvent, AgentTurnResponse, KPR, ProviderConfig, RunMode } from "./types";
import { recordedResponse } from "../data/replay";
import { defaultSkillForRole } from "../data/skills";

function roleActor(role: AgentRole) {
  if (role === "user-side") return ACTORS.userAgent;
  if (role === "maintainer-side") return ACTORS.maintainerAgent;
  return ACTORS.projectAgent;
}

export function scriptedResponse(role: AgentRole, kpr?: KPR): AgentTurnResponse {
  const replay = recordedResponse(role, kpr);
  const startedAt = nowIso();
  const events: AgentRunEvent[] = replay.run.events.map((item, index) => ({
    ...item,
    id: createId(`scripted-event-${role}`),
    sequence: index + 1,
    timestamp: startedAt,
    summary: index === 0 ? "Deterministic fallback; no model provider was called." : item.summary,
    actor: roleActor(role)
  }));
  const run: AgentRun = {
    ...replay.run,
    id: createId(`run-scripted-${role}`),
    mode: "scripted",
    provider: undefined,
    model: undefined,
    startedAt,
    completedAt: startedAt,
    events,
    usage: undefined,
    terminationReason: "Deterministic fallback completed. This is not a model-generated run."
  };
  return { ...replay, run };
}

export function fallbackResponse(mode: Exclude<RunMode, "live">, role: AgentRole, kpr?: KPR) {
  return mode === "replay" ? recordedResponse(role, kpr) : scriptedResponse(role, kpr);
}

export function cancelledRun(role: AgentRole, provider: ProviderConfig): AgentRun {
  const timestamp = nowIso();
  const skill = defaultSkillForRole(role);
  return {
    id: createId("run-cancelled"),
    mode: "live",
    role,
    skillId: skill.id,
    provider: provider.provider,
    model: provider.model,
    status: "cancelled",
    startedAt: timestamp,
    completedAt: timestamp,
    events: [{
      id: createId("event-cancelled"), sequence: 1, timestamp, type: "run_stopped", plane: "policy",
      title: "Human cancelled the request", summary: "The browser aborted the in-flight gateway request. No proposal was applied.",
      actor: { id: "human-controller", type: "human", label: "Human controller", role: "maintainer" }
    }],
    budget: {
      maxProviderCalls: skill.budget.maxProviderCalls, providerCallsUsed: 0,
      maxToolCalls: skill.budget.maxToolCalls, toolCallsUsed: 0,
      maxDurationMs: skill.budget.maxDurationMs,
      maxInputTokens: skill.budget.maxInputTokens,
      maxOutputTokens: skill.budget.maxOutputTokens,
      maxRetries: skill.budget.maxRetries, retriesUsed: 0
    },
    terminationReason: "Cancelled by human."
  };
}
