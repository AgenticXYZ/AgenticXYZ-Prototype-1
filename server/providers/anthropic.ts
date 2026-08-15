import type { ProviderDriver, ProviderRequest, ProviderResult } from "./types.js";
import { postJson } from "./http.js";

interface AnthropicResponse {
  id?: string;
  content?: Array<{
    type?: "text" | "tool_use";
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
  }>;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicDriver implements ProviderDriver {
  readonly id = "anthropic" as const;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string
  ) {}

  async run(request: ProviderRequest): Promise<ProviderResult> {
    const body = {
      model: request.model,
      max_tokens: request.maxOutputTokens,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
      tools: [
        {
          name: request.tool.name,
          description: request.tool.description,
          input_schema: request.tool.schema
        }
      ],
      tool_choice: { type: "tool", name: request.tool.name, disable_parallel_tool_use: true }
    };
    const data = (await postJson(
      `${this.baseUrl.replace(/\/$/, "")}/messages`,
      { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body,
      request.timeoutMs,
      request.signal
    )) as AnthropicResponse;
    const call = data.content?.find((item) => item.type === "tool_use");
    return {
      text: data.content?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n") ?? "",
      toolCall: call?.name
        ? { id: call.id ?? "anthropic-tool-call", name: call.name, arguments: call.input }
        : undefined,
      stopReason: data.stop_reason,
      usage: { inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
      responseId: data.id
    };
  }
}
