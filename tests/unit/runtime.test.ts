import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerConfig } from "../../server/config";
import { buildPrompts, describeArrayBounds } from "../../server/runtime/prompt";
import { runAgent } from "../../server/runtime/runAgent";
import { toolForRole } from "../../server/runtime/schemas";
import { cancelledRun } from "../../src/core/runs";
import type { AgentTurnRequest } from "../../src/core/types";
import { createInitialState } from "../../src/data/initial";
import { USER_REPLAY_PROPOSAL } from "../../src/data/replay";
import { defaultSkillForRole, SKILLS } from "../../src/data/skills";

const initial = createInitialState();
const config: ServerConfig = {
  port: 8787,
  activeProvider: "openai",
  activeModel: "test-model",
  maxToolCalls: 6,
  maxProviderCalls: 1,
  maxInputTokens: 20_000,
  maxOutputTokens: 32_000,
  maxRetries: 0,
  requestTimeoutMs: 1000,
  providers: {
    openai: { apiKey: undefined, baseUrl: "https://openai.test/v1" },
    anthropic: { apiKey: undefined, baseUrl: "https://anthropic.test/v1" },
    deepseek: { apiKey: undefined, baseUrl: "https://deepseek.test", reasoningEffort: "high" }
  }
};

afterEach(() => vi.unstubAllGlobals());

function request(overrides: Partial<AgentTurnRequest> = {}): AgentTurnRequest {
  return {
    role: "user-side",
    provider: "openai",
    model: "test-model",
    userMessage: "Prepare a bounded local overlay proposal.",
    context: { manifest: initial.manifest, policy: initial.policy, brief: initial.brief },
    ...overrides
  };
}

describe("controlled Runtime preconditions", () => {
  it("registers every reference Skill with a role, version, tools, gates, verifiers, and bounded budget", () => {
    expect(SKILLS.map((skill) => skill.id)).toEqual(expect.arrayContaining([
      "adapt_software_locally", "describe_to_kpr", "understand_kpr", "analyze_knowledge_impact",
      "draft_integration_contract", "implement_from_contract", "verify_candidate"
    ]));
    for (const skill of SKILLS) {
      expect(skill.version).toBe("0.1.0");
      expect(skill.allowedToolIds.length).toBeGreaterThan(0);
      expect(skill.requiredHumanGates.length).toBeGreaterThan(0);
      expect(skill.requiredVerifierIds.length).toBeGreaterThan(0);
      expect(skill.budget.maxProviderCalls).toBe(1);
      expect(skill.budget.maxDurationMs).toBe(0);
    }
    expect(defaultSkillForRole("user-side").role).toBe("user-side");
    expect(defaultSkillForRole("maintainer-side").role).toBe("maintainer-side");
    expect(defaultSkillForRole("project").role).toBe("project");
    expect(defaultSkillForRole("user-side").budget.maxOutputTokens).toBe(16_000);
    expect(defaultSkillForRole("maintainer-side").budget.maxOutputTokens).toBe(32_000);
    expect(defaultSkillForRole("maintainer-side").budget.maxDurationMs).toBe(0);
    expect(defaultSkillForRole("project").budget.maxOutputTokens).toBe(16_000);
  });
  it("enforces one active Provider and model", async () => {
    const result = await runAgent(request({ provider: "anthropic" }), config);
    expect(result.run.status).toBe("failed");
    expect(result.run.terminationReason).toContain("One Active Provider");
  });

  it("records the role-bound, versioned Skill and its effective budget", async () => {
    const result = await runAgent(request({ provider: "anthropic" }), config);
    expect(result.run.skillId).toBe("adapt_software_locally");
    expect(result.run.budget.maxProviderCalls).toBe(1);
    expect(result.run.budget.maxRetries).toBe(0);
  });

  it("requires KPR context for the Maintainer-side role", async () => {
    const result = await runAgent(request({ role: "maintainer-side", context: { manifest: initial.manifest, policy: initial.policy } }), config);
    expect(result.run.terminationReason).toBe("Missing KPR context.");
  });

  it("requires a resolved Contract for the Project role", async () => {
    const missing = await runAgent(request({ role: "project", context: { manifest: initial.manifest, policy: initial.policy } }), config);
    expect(missing.run.terminationReason).toBe("Missing Integration Contract.");
  });

  it("stops oversized context before a Provider call", async () => {
    const boundedConfig = { ...config, maxInputTokens: 1000 };
    const result = await runAgent(request({ userMessage: "x".repeat(20_000) }), boundedConfig);
    expect(result.run.terminationReason).toBe("Input token budget exceeded.");
    expect(result.run.budget.providerCallsUsed).toBe(0);
  });

  it("records cancellation without accepting a proposal", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runAgent(request(), config, controller.signal);
    expect(result.run.status).toBe("cancelled");
    expect(result.proposal).toBeUndefined();
  });

  it("records browser cancellation with the active role Skill budget", () => {
    const run = cancelledRun("maintainer-side", { provider: "deepseek", model: "deepseek-v4-flash", available: true, source: "environment" });
    const skill = defaultSkillForRole("maintainer-side");
    expect(run.status).toBe("cancelled");
    expect(run.skillId).toBe(skill.id);
    expect(run.budget).toMatchObject({
      maxDurationMs: 0,
      maxOutputTokens: 32_000,
      maxProviderCalls: skill.budget.maxProviderCalls,
      maxToolCalls: skill.budget.maxToolCalls
    });
  });

  it("repeats canonical array bounds that a Provider strict-schema subset may omit", () => {
    expect(describeArrayBounds(toolForRole("maintainer-side").schema)).toEqual([
      "plan: between 2 and 8 items, inclusive.",
      "impactAnalysis: at least 3 items.",
      "resolutionSuggestions: at least 1 item."
    ]);
    const prompts = buildPrompts(request(), defaultSkillForRole("user-side"), toolForRole("user-side"));
    expect(prompts.systemPrompt).toContain("plan: between 2 and 8 items, inclusive.");
    expect(prompts.systemPrompt).toContain("Runtime will reject violations");
  });

  it("blocks sensitive Provider output before it reaches application state", async () => {
    const secret = ["sk", "runtimeSensitiveValue123456789"].join("-");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      status: "completed",
      output: [{
        type: "function_call",
        name: "submit_user_side_proposal",
        arguments: JSON.stringify({ ...USER_REPLAY_PROPOSAL, summary: `Unsafe ${secret}` })
      }],
      usage: { input_tokens: 10, output_tokens: 10 }
    }), { status: 200 }))));
    const liveConfig: ServerConfig = {
      ...config,
      providers: { ...config.providers, openai: { ...config.providers.openai, apiKey: "server-key" } }
    };
    const result = await runAgent(request(), liveConfig);
    expect(result.run.terminationReason).toBe("Provider proposal failed privacy scan.");
    expect(result.proposal).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("records a safe HTTP status without retaining Provider error text", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: { message: "account-specific remote detail" } }), { status: 429 }))));
    const liveConfig: ServerConfig = {
      ...config,
      providers: { ...config.providers, openai: { ...config.providers.openai, apiKey: "server-key" } }
    };
    const result = await runAgent(request(), liveConfig);
    expect(result.run.terminationReason).toBe("Provider error (HTTP 429).");
    const providerEvent = result.run.events.find((event) => event.type === "provider_error");
    expect(providerEvent?.payload).toMatchObject({ httpStatus: 429, errorKind: "http" });
    expect(JSON.stringify(result)).not.toContain("account-specific remote detail");
  });

  it("classifies malformed Provider tool JSON without retaining its raw value", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      status: "completed",
      output: [{ type: "function_call", name: "submit_user_side_proposal", arguments: "{not-valid-json" }]
    }), { status: 200 }))));
    const liveConfig: ServerConfig = {
      ...config,
      providers: { ...config.providers, openai: { ...config.providers.openai, apiKey: "server-key" } }
    };
    const result = await runAgent(request(), liveConfig);
    expect(result.run.terminationReason).toBe("Provider returned invalid JSON tool arguments.");
    expect(result.run.events.find((event) => event.type === "provider_error")?.payload).toMatchObject({ errorKind: "invalid_tool_arguments" });
    expect(JSON.stringify(result)).not.toContain("{not-valid-json");
  });
});
