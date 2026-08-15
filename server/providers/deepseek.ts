import type { ProviderDriver, ProviderRequest, ProviderResult } from "./types.js";
import { parseArguments, postJson } from "./http.js";

interface DeepSeekResponse {
  id?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
      tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

type JsonSchema = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function enumType(values: unknown[]): "string" | "number" | "boolean" | undefined {
  if (!values.length) return undefined;
  const types = new Set(values.map((value) => typeof value));
  if (types.size !== 1) return undefined;
  const [type] = [...types];
  return type === "string" || type === "number" || type === "boolean" ? type : undefined;
}

/**
 * DeepSeek strict Tool Calls accepts a documented subset of JSON Schema.
 * The canonical Runtime schema remains authoritative; this is only the
 * provider transport projection used to make generation more reliable.
 */
export function toDeepSeekStrictSchema(schema: JsonSchema): JsonSchema {
  const transform = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(transform);
    if (!isRecord(value)) return value;

    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key === "minItems" || key === "maxItems") continue;
      if (key === "const") {
        result.enum = [transform(nested)];
        continue;
      }
      result[key] = transform(nested);
    }

    if (result.type === "object" && isRecord(result.properties)) {
      result.additionalProperties = false;
      result.required = Object.keys(result.properties);
    }
    if (!result.type && Array.isArray(result.enum)) {
      const inferred = enumType(result.enum);
      if (inferred) result.type = inferred;
    }
    return result;
  };

  return transform(schema) as JsonSchema;
}

function strictBaseUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return base.endsWith("/beta") ? base : `${base}/beta`;
}

export class DeepSeekDriver implements ProviderDriver {
  readonly id = "deepseek" as const;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly reasoningEffort: "low" | "high" | "max" = "high"
  ) {}

  async run(request: ProviderRequest): Promise<ProviderResult> {
    const body = {
      model: request.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: request.tool.name,
            description: request.tool.description,
            parameters: toDeepSeekStrictSchema(request.tool.schema),
            strict: true
          }
        }
      ],
      thinking: { type: "enabled" },
      reasoning_effort: this.reasoningEffort,
      max_tokens: request.maxOutputTokens
    };
    const data = (await postJson(
      `${strictBaseUrl(this.baseUrl)}/chat/completions`,
      { Authorization: `Bearer ${this.apiKey}` },
      body,
      request.timeoutMs,
      request.signal
    )) as DeepSeekResponse;
    const choice = data.choices?.[0];
    const calls = choice?.message?.tool_calls ?? [];
    const call = calls.length === 1 ? calls[0] : undefined;
    return {
      text: choice?.message?.content ?? "",
      toolCall: call?.function?.name
        ? {
            id: call.id ?? "deepseek-tool-call",
            name: call.function.name,
            arguments: parseArguments(call.function.arguments)
          }
        : undefined,
      stopReason: choice?.finish_reason,
      usage: { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
      responseId: data.id
    };
  }
}
