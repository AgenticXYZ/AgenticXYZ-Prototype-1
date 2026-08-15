import Ajv2020 from "ajv/dist/2020.js";

import { ACTORS } from "../../src/core/constants.js";
import { authorizeToolCall, checkRunBudget } from "../../src/core/policy.js";
import { redactText, scanText } from "../../src/core/privacy.js";
import { createId, nowIso } from "../../src/core/time.js";
import type { AgentRun, AgentRunEvent, AgentTurnRequest, AgentTurnResponse, RuntimeProposal } from "../../src/core/types.js";
import { defaultSkillForRole } from "../../src/data/skills.js";
import type { ServerConfig } from "../config.js";
import { createProvider } from "../providers/index.js";
import { ProviderHttpError } from "../providers/http.js";
import { buildPrompts } from "./prompt.js";
import { toolForRole } from "./schemas.js";

const ajv = new Ajv2020({ allErrors: true, strict: false });

function actorForRole(role: AgentTurnRequest["role"]) {
  if (role === "maintainer-side") return ACTORS.maintainerAgent;
  if (role === "project") return ACTORS.projectAgent;
  return ACTORS.userAgent;
}

function event(
  events: AgentRunEvent[],
  request: AgentTurnRequest,
  type: AgentRunEvent["type"],
  plane: AgentRunEvent["plane"],
  title: string,
  summary: string,
  payload?: Record<string, unknown>
) {
  events.push({
    id: createId("event"),
    sequence: events.length + 1,
    timestamp: nowIso(),
    type,
    plane,
    title,
    summary,
    actor: actorForRole(request.role),
    payload
  });
}

function baseRun(request: AgentTurnRequest, events: AgentRunEvent[], startedAt: string, config: ServerConfig): AgentRun {
  const skill = defaultSkillForRole(request.role);
  return {
    id: createId("run-live"),
    mode: "live",
    role: request.role,
    skillId: skill.id,
    provider: request.provider,
    model: request.model,
    status: "running",
    startedAt,
    events,
    budget: {
      maxProviderCalls: Math.min(config.maxProviderCalls, skill.budget.maxProviderCalls),
      providerCallsUsed: 0,
      maxToolCalls: Math.min(config.maxToolCalls, skill.budget.maxToolCalls),
      toolCallsUsed: 0,
      maxDurationMs: config.requestTimeoutMs === 0 || skill.budget.maxDurationMs === 0
        ? 0
        : Math.min(config.requestTimeoutMs, skill.budget.maxDurationMs),
      maxInputTokens: Math.min(config.maxInputTokens, skill.budget.maxInputTokens),
      maxOutputTokens: Math.min(config.maxOutputTokens, skill.budget.maxOutputTokens),
      maxRetries: Math.min(config.maxRetries, skill.budget.maxRetries),
      retriesUsed: 0
    }
  };
}

export async function runAgent(request: AgentTurnRequest, config: ServerConfig, signal?: AbortSignal): Promise<AgentTurnResponse> {
  const startedAt = nowIso();
  const events: AgentRunEvent[] = [];
  const run = baseRun(request, events, startedAt, config);
  const skill = defaultSkillForRole(request.role);
  event(events, request, "run_started", "action", `${actorForRole(request.role).label} started`, "Live provider request initiated through the local gateway.");
  event(events, request, "context_assembled", "context", "Authorized context and Skill assembled", "Only role-scoped context is included; private trajectory and contributor patch are excluded.", { skillId: skill.id, skillVersion: skill.version });

  if (request.provider !== config.activeProvider || request.model !== config.activeModel) {
    event(events, request, "policy_check", "policy", "One-provider rule blocked the request", "The requested provider or model differs from the server's active configuration.");
    return {
      run: { ...run, status: "failed", completedAt: nowIso(), terminationReason: "One Active Provider policy conflict." },
      assistantMessage: "The request was blocked by the One Active Provider policy."
    };
  }
  if (request.role === "maintainer-side" && !request.context.kpr) {
    event(events, request, "policy_check", "policy", "KPR context missing", "Maintainer-side review requires a submitted KPR.");
    return { run: { ...run, status: "failed", completedAt: nowIso(), terminationReason: "Missing KPR context." }, assistantMessage: "A KPR is required." };
  }
  if (request.role === "project" && !request.context.contract) {
    event(events, request, "policy_check", "policy", "Contract context missing", "Project Agent synthesis requires a Maintainer-approved Contract.");
    return { run: { ...run, status: "failed", completedAt: nowIso(), terminationReason: "Missing Integration Contract." }, assistantMessage: "An approved Integration Contract is required." };
  }
  if (request.role === "project" && request.context.contract?.unresolvedQuestions.length) {
    event(events, request, "policy_check", "policy", "Unresolved knowledge blocked synthesis", "The Contract contains unresolved claims.");
    return { run: { ...run, status: "failed", completedAt: nowIso(), terminationReason: "Unresolved Contract." }, assistantMessage: "Resolve the Contract before synthesis." };
  }

  event(events, request, "policy_check", "policy", "Role and authority checked", "The request may produce a proposal but cannot mutate public state.");
  const tool = toolForRole(request.role);
  if (!skill.allowedToolIds.includes(tool.name)) {
    event(events, request, "policy_check", "policy", "Skill boundary blocked the tool", `${tool.name} is not allowlisted by ${skill.id}@${skill.version}.`);
    return {
      run: { ...run, status: "failed", completedAt: nowIso(), terminationReason: "Skill tool boundary denied." },
      assistantMessage: "The active Skill does not authorize the requested structured tool."
    };
  }
  const permission = authorizeToolCall(request.role, tool.name);
  if (!permission.allowed) {
    event(events, request, "policy_check", "policy", "Tool permission denied", permission.reason, {
      tool: tool.name,
      riskLevel: permission.policy?.riskLevel
    });
    return {
      run: { ...run, status: "failed", completedAt: nowIso(), terminationReason: "Tool permission denied." },
      assistantMessage: "The requested tool is outside this Agent role's authority."
    };
  }
  const budget = checkRunBudget(
    { providerCalls: 0, toolCalls: 0, elapsedMs: Date.now() - Date.parse(startedAt) },
    { maxProviderCalls: run.budget.maxProviderCalls, maxToolCalls: run.budget.maxToolCalls, maxDurationMs: run.budget.maxDurationMs }
  );
  if (!budget.allowed) {
    event(events, request, "run_stopped", "policy", "Run budget blocked execution", budget.reason);
    return {
      run: { ...run, status: "failed", completedAt: nowIso(), terminationReason: budget.reason },
      assistantMessage: "The run stopped at its configured budget boundary."
    };
  }
  event(events, request, "policy_check", "policy", "Tool risk and gate checked", permission.reason, {
    tool: tool.name,
    riskLevel: permission.policy?.riskLevel,
    sideEffect: permission.policy?.sideEffect,
    requiresHumanApproval: permission.requiresHumanApproval
  });
  const validate = ajv.compile(tool.schema);
  const prompts = buildPrompts(request, skill, tool);
  const estimatedInputTokens = Math.ceil((prompts.systemPrompt.length + prompts.userPrompt.length) / 4);
  if (estimatedInputTokens > run.budget.maxInputTokens) {
    event(events, request, "run_stopped", "policy", "Estimated input budget exceeded", `Estimated ${estimatedInputTokens} tokens exceeds the ${run.budget.maxInputTokens} token input budget.`);
    return {
      run: { ...run, status: "failed", completedAt: nowIso(), terminationReason: "Input token budget exceeded." },
      assistantMessage: "The authorized context exceeds this run's input budget."
    };
  }
  let providerCallStarted = false;
  try {
    const provider = createProvider(config, request.provider);
    event(events, request, "plan_proposed", "action", "Structured proposal requested", `The provider must call ${tool.name}; free-form mutation is unavailable.`);
    providerCallStarted = true;
    const result = await provider.run({
      provider: request.provider,
      model: request.model,
      role: request.role,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      tool,
      timeoutMs: run.budget.maxDurationMs,
      maxOutputTokens: run.budget.maxOutputTokens,
      signal
    });
    const safeAssistantText = redactText(result.text ?? "");
    if (safeAssistantText) {
      event(events, request, "assistant_message", "action", "Reviewable Provider message", safeAssistantText.slice(0, 500), { stopReason: result.stopReason });
    }
    if (!result.toolCall || result.toolCall.name !== tool.name) {
      event(events, request, "refusal", "proof", "Structured proposal missing", "The provider did not return the required allowlisted tool call.");
      return {
        run: {
          ...run,
          status: "failed",
          completedAt: nowIso(),
          budget: { ...run.budget, providerCallsUsed: 1 },
          terminationReason: "Required structured tool call missing.",
          usage: result.usage
        },
        assistantMessage: safeAssistantText || "The provider did not produce a structured proposal."
      };
    }
    event(events, request, "tool_call", "action", result.toolCall.name, "Provider returned a structured proposal for validation.");
    const valid = validate(result.toolCall.arguments);
    if (!valid) {
      event(events, request, "tool_result", "proof", "Schema validation failed", ajv.errorsText(validate.errors));
      return {
        run: {
          ...run,
          status: "failed",
          completedAt: nowIso(),
          budget: { ...run.budget, providerCallsUsed: 1, toolCallsUsed: 1 },
          terminationReason: "Tool arguments failed JSON Schema validation.",
          usage: result.usage
        },
        assistantMessage: "The model proposal did not satisfy the required schema."
      };
    }
    const proposalPrivacy = scanText(JSON.stringify(result.toolCall.arguments));
    if (proposalPrivacy.status !== "pass") {
      event(events, request, "policy_check", "policy", "Provider proposal failed privacy scan", `${proposalPrivacy.findings.length} sensitive value(s) were blocked before application state.`);
      return {
        run: {
          ...run,
          status: "failed",
          completedAt: nowIso(),
          budget: { ...run.budget, providerCallsUsed: 1, toolCallsUsed: 1 },
          terminationReason: "Provider proposal failed privacy scan.",
          usage: result.usage
        },
        assistantMessage: "The structured proposal was blocked by the Runtime privacy boundary."
      };
    }
    const proposal = result.toolCall.arguments as RuntimeProposal;
    if ((result.usage?.inputTokens ?? 0) > run.budget.maxInputTokens || (result.usage?.outputTokens ?? 0) > run.budget.maxOutputTokens) {
      event(events, request, "run_stopped", "proof", "Reported token budget exceeded", "Provider usage exceeded the configured token boundary; the proposal was not accepted.", result.usage as Record<string, unknown>);
      return {
        run: {
          ...run,
          status: "failed",
          completedAt: nowIso(),
          events,
          budget: { ...run.budget, providerCallsUsed: 1, toolCallsUsed: 1 },
          terminationReason: "Token budget exceeded.",
          usage: result.usage
        },
        assistantMessage: "The proposal exceeded this run's token budget."
      };
    }
    event(events, request, "tool_result", "action", "Proposal accepted into review state", "The application accepted the structured proposal without applying or verifying it.");
    event(events, request, "approval_requested", "policy", "Human gate required", request.role === "user-side" ? "Contributor approval is required." : "Maintainer approval is required.");
    event(events, request, "usage", "proof", "Provider usage recorded", "Token totals and stop reason are retained; hidden reasoning is not stored.", { ...(result.usage ?? {}), stopReason: result.stopReason });
    event(events, request, "run_completed", "memory", "Run completed at proposal boundary", "The proposal is inspectable and no public action occurred.");
    return {
      run: {
        ...run,
        status: "completed",
        completedAt: nowIso(),
        events,
        budget: { ...run.budget, providerCallsUsed: 1, toolCallsUsed: 1 },
        terminationReason: "Structured proposal produced; awaiting the appropriate human gate.",
        usage: result.usage
      },
      proposal,
      assistantMessage: safeAssistantText || proposal.summary
    };
  } catch (error) {
    if (signal?.aborted) {
      event(events, request, "run_stopped", "policy", "Human cancelled the live run", "The provider request was aborted and no proposal was accepted.");
      return {
        run: {
          ...run,
          status: "cancelled",
          completedAt: nowIso(),
          events,
          budget: { ...run.budget, providerCallsUsed: providerCallStarted ? 1 : 0 },
          terminationReason: "Cancelled by human."
        },
        assistantMessage: "The live run was cancelled."
      };
    }
    const isHttpError = error instanceof ProviderHttpError;
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const isInvalidToolArguments = error instanceof Error && error.message === "The provider returned invalid JSON tool arguments.";
    const isInvalidProviderJson = error instanceof SyntaxError;
    const terminationReason = isHttpError
      ? `Provider error (HTTP ${error.status}).`
      : isTimeout
        ? "Provider request timed out."
        : isInvalidToolArguments
          ? "Provider returned invalid JSON tool arguments."
          : isInvalidProviderJson
            ? "Provider returned an invalid JSON response."
            : "Provider request failed.";
    const errorKind = isHttpError
      ? "http"
      : isTimeout
        ? "timeout"
        : isInvalidToolArguments
          ? "invalid_tool_arguments"
          : isInvalidProviderJson
            ? "invalid_response"
            : "unknown";
    event(events, request, "provider_error", "proof", isTimeout ? "Provider request timed out" : "Provider response rejected", "The external Provider did not complete the bounded request; no proposal entered application state.", {
      ...(isHttpError ? { httpStatus: error.status } : {}),
      errorKind
    });
    return {
      run: {
        ...run,
        status: "failed",
        completedAt: nowIso(),
        events,
        budget: { ...run.budget, providerCallsUsed: providerCallStarted ? 1 : 0 },
        terminationReason
      },
      assistantMessage: "The live provider request failed. Switch to Recorded Replay or inspect the local gateway configuration."
    };
  }
}
