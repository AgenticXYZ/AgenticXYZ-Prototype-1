import { afterEach, describe, expect, it, vi } from "vitest";

import { AnthropicDriver } from "../../server/providers/anthropic";
import type { ServerConfig } from "../../server/config";
import { DeepSeekDriver, toDeepSeekStrictSchema } from "../../server/providers/deepseek";
import { checkProviderConnection } from "../../server/providers/connectivity";
import { ProviderHttpError, parseArguments, postJson } from "../../server/providers/http";
import { OpenAIDriver } from "../../server/providers/openai";
import { answerGuideQuestion } from "../../server/runtime/guide";
import type { ProviderDriver, ProviderRequest } from "../../server/providers/types";

const request: ProviderRequest = {
  provider: "openai",
  model: "test-model",
  role: "user-side",
  systemPrompt: "system",
  userPrompt: "user",
  tool: {
    name: "submit_user_side_proposal",
    description: "test tool",
    schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false }
  },
  timeoutMs: 100,
  maxOutputTokens: 2400
};

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

afterEach(() => vi.unstubAllGlobals());

describe.each([
  {
    name: "OpenAI Responses",
    driver: () => new OpenAIDriver("server-key", "https://openai.test/v1"),
    body: { id: "oa-1", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Prepared" }] }, { type: "function_call", call_id: "call-1", name: request.tool.name, arguments: "{\"ok\":true}" }], usage: { input_tokens: 10, output_tokens: 4 } },
    endpoint: "/responses",
    auth: "Bearer server-key"
  },
  {
    name: "Anthropic Messages",
    driver: () => new AnthropicDriver("server-key", "https://anthropic.test/v1"),
    body: { id: "an-1", stop_reason: "tool_use", content: [{ type: "text", text: "Prepared" }, { type: "tool_use", id: "call-1", name: request.tool.name, input: { ok: true } }], usage: { input_tokens: 10, output_tokens: 4 } },
    endpoint: "/messages",
    auth: "server-key"
  },
  {
    name: "DeepSeek Chat Completions",
    driver: () => new DeepSeekDriver("server-key", "https://deepseek.test"),
    body: { id: "ds-1", choices: [{ finish_reason: "tool_calls", message: { content: "Prepared", tool_calls: [{ id: "call-1", function: { name: request.tool.name, arguments: "{\"ok\":true}" } }] } }], usage: { prompt_tokens: 10, completion_tokens: 4 } },
    endpoint: "/beta/chat/completions",
    auth: "Bearer server-key"
  }
])("$name driver contract", ({ driver, body, endpoint, auth }) => {
  it("normalizes assistant text, one tool call, stop state, and usage", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn((url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return response(body);
    }));
    const result = await driver().run(request);
    expect(capturedUrl).toContain(endpoint);
    expect(JSON.stringify(capturedInit?.headers)).toContain(auth);
    expect(result.text).toContain("Prepared");
    expect(result.toolCall).toMatchObject({ name: request.tool.name, arguments: { ok: true } });
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 4 });
  });
});

it("keeps API keys in server request headers rather than request bodies", async () => {
  let init: RequestInit | undefined;
  vi.stubGlobal("fetch", vi.fn((_url: string | URL | Request, value?: RequestInit) => {
    init = value;
    return response({ output: [{ type: "function_call", name: request.tool.name, arguments: "{\"ok\":true}" }] });
  }));
  await new OpenAIDriver("server-secret", "https://openai.test/v1").run(request);
  expect(String(init?.body)).not.toContain("server-secret");
  expect(JSON.stringify(init?.headers)).toContain("server-secret");
});

it("answers Guide Agent questions through the active Provider with a read-only structured boundary", async () => {
  let capturedBody: Record<string, unknown> = {};
  vi.stubGlobal("fetch", vi.fn((_url: string | URL | Request, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return response({
      output: [{
        type: "function_call",
        name: "answer_agenticxyz_question",
        arguments: JSON.stringify({ answer: "KPR 是受治理的知识包。", suggestedAction: "go_kpr" })
      }],
      usage: { input_tokens: 20, output_tokens: 8 }
    });
  }));
  const config: ServerConfig = {
    port: 8787,
    activeProvider: "openai",
    activeModel: "test-model",
    maxToolCalls: 6,
    maxProviderCalls: 1,
    maxInputTokens: 20_000,
    maxOutputTokens: 8_000,
    maxRetries: 0,
    requestTimeoutMs: 0,
    providers: {
      openai: { apiKey: "server-key", baseUrl: "https://openai.test/v1" },
      anthropic: { baseUrl: "https://anthropic.test/v1" },
      deepseek: { baseUrl: "https://deepseek.test", reasoningEffort: "high" }
    }
  };
  const result = await answerGuideQuestion({
    question: "什么是 KPR？",
    language: "zh-CN",
    context: { activeView: "user", guidedStep: 0, overlayStatus: "clean", kprStatus: "not_created", contractReady: false, candidateStatus: "clean" }
  }, config);

  expect(result).toMatchObject({ answer: "KPR 是受治理的知识包。", action: "go_kpr", source: "provider" });
  expect(capturedBody).toMatchObject({
    tool_choice: { type: "function", name: "answer_agenticxyz_question" },
    parallel_tool_calls: false
  });
  expect(String(capturedBody.instructions)).toContain("read-only Guide Agent");
  expect(String(capturedBody.instructions)).toContain("professional Simplified Chinese");
});

it.each([
  { provider: "openai" as const, baseUrl: "https://openai.test/v1", endpoint: "/v1/models", authHeader: "Bearer browser-key" },
  { provider: "anthropic" as const, baseUrl: "https://anthropic.test/v1", endpoint: "/v1/models", authHeader: "browser-key" },
  { provider: "deepseek" as const, baseUrl: "https://deepseek.test/beta", endpoint: "/models", authHeader: "Bearer browser-key" }
])("checks $provider credentials without placing the key in the URL or a body", async ({ provider, baseUrl, endpoint, authHeader }) => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  vi.stubGlobal("fetch", vi.fn((url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedInit = init;
    return response({ data: [] });
  }));
  await checkProviderConnection(provider, "browser-key", baseUrl);
  expect(capturedUrl).toContain(endpoint);
  expect(capturedUrl).not.toContain("browser-key");
  expect(capturedInit?.body).toBeUndefined();
  expect(JSON.stringify(capturedInit?.headers)).toContain(authHeader);
});

it("constrains every Provider request to one role-specific structured proposal boundary", async () => {
  const bodies: Record<string, Record<string, unknown>> = {};
  vi.stubGlobal("fetch", vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    bodies[target] = JSON.parse(String(init?.body)) as Record<string, unknown>;
    if (target.includes("anthropic")) {
      return response({ content: [{ type: "tool_use", name: request.tool.name, input: { ok: true } }] });
    }
    if (target.includes("deepseek")) {
      return response({ choices: [{ message: { tool_calls: [{ function: { name: request.tool.name, arguments: "{\"ok\":true}" } }] } }] });
    }
    return response({ output: [{ type: "function_call", name: request.tool.name, arguments: "{\"ok\":true}" }] });
  }));

  await new OpenAIDriver("server-key", "https://openai.test/v1").run(request);
  await new AnthropicDriver("server-key", "https://anthropic.test/v1").run(request);
  await new DeepSeekDriver("server-key", "https://deepseek.test").run(request);

  expect(bodies["https://openai.test/v1/responses"]).toMatchObject({
    tool_choice: { type: "function", name: request.tool.name },
    parallel_tool_calls: false,
    max_output_tokens: request.maxOutputTokens
  });
  expect(bodies["https://anthropic.test/v1/messages"]).toMatchObject({
    tool_choice: { type: "tool", name: request.tool.name, disable_parallel_tool_use: true },
    max_tokens: request.maxOutputTokens
  });
  expect(bodies["https://anthropic.test/v1/messages"]).not.toHaveProperty("disable_parallel_tool_use");
  expect(bodies["https://deepseek.test/beta/chat/completions"]).toMatchObject({
    thinking: { type: "enabled" },
    reasoning_effort: "high",
    tools: [{ function: { strict: true } }],
    max_tokens: request.maxOutputTokens
  });
  expect(bodies["https://deepseek.test/beta/chat/completions"]).not.toHaveProperty("tool_choice");
});

it("projects canonical schemas into DeepSeek's strict Tool Calls subset", () => {
  const projected = toDeepSeekStrictSchema({
    type: "object",
    properties: {
      role: { const: "project" },
      plan: {
        type: "array",
        minItems: 2,
        maxItems: 8,
        items: {
          type: "object",
          properties: { label: { type: "string" }, enabled: { type: "boolean" } },
          required: ["label"]
        }
      }
    },
    required: ["role"]
  });

  expect(projected).toEqual({
    type: "object",
    properties: {
      role: { enum: ["project"], type: "string" },
      plan: {
        type: "array",
        items: {
          type: "object",
          properties: { label: { type: "string" }, enabled: { type: "boolean" } },
          required: ["label", "enabled"],
          additionalProperties: false
        }
      }
    },
    required: ["role", "plan"],
    additionalProperties: false
  });
});

it("honors an explicit DeepSeek reasoning effort and does not duplicate beta in the base URL", async () => {
  let capturedUrl = "";
  let capturedBody: Record<string, unknown> = {};
  vi.stubGlobal("fetch", vi.fn((url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return response({ choices: [{ message: { tool_calls: [{ function: { name: request.tool.name, arguments: "{\"ok\":true}" } }] } }] });
  }));

  await new DeepSeekDriver("server-key", "https://deepseek.test/beta/", "max").run(request);
  expect(capturedUrl).toBe("https://deepseek.test/beta/chat/completions");
  expect(capturedBody.reasoning_effort).toBe("max");
});

it("rejects ambiguous DeepSeek output containing more than one proposal call", async () => {
  vi.stubGlobal("fetch", vi.fn(() => response({
    choices: [{
      message: {
        tool_calls: [
          { function: { name: request.tool.name, arguments: "{\"ok\":true}" } },
          { function: { name: request.tool.name, arguments: "{\"ok\":false}" } }
        ]
      }
    }]
  })));

  const result = await new DeepSeekDriver("server-key", "https://deepseek.test").run(request);
  expect(result.toolCall).toBeUndefined();
});

it("rejects malformed tool arguments", () => {
  expect(() => parseArguments("not-json")).toThrow("invalid JSON");
});

it("normalizes rate-limit failures without echoing the full response", async () => {
  vi.stubGlobal("fetch", vi.fn(() => response({ error: { message: "rate limited" } }, 429)));
  await expect(new OpenAIDriver("server-key", "https://openai.test/v1").run(request)).rejects.toMatchObject({ status: 429, providerMessage: "rate limited" } satisfies Partial<ProviderHttpError>);
});

it("supports timeout and external cancellation", async () => {
  vi.stubGlobal("fetch", vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  })));
  await expect(postJson("https://provider.test", {}, {}, 5)).rejects.toMatchObject({ name: "AbortError" });
  const controller = new AbortController();
  const pending = postJson("https://provider.test", {}, {}, 1000, controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});

it("uses zero as a human-cancelled Provider wait without a local timer", async () => {
  vi.stubGlobal("fetch", vi.fn(() => response({ ok: true })));
  await expect(postJson("https://provider.test", {}, {}, 0)).resolves.toEqual({ ok: true });
});

it("represents refusal as a response without an allowlisted tool call", async () => {
  vi.stubGlobal("fetch", vi.fn(() => response({ status: "completed", output_text: "I cannot comply.", output: [] })));
  const result = await new OpenAIDriver("server-key", "https://openai.test/v1").run(request);
  expect(result.text).toContain("cannot");
  expect(result.toolCall).toBeUndefined();
});
