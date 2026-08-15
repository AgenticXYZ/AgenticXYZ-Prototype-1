import type { ProviderDriver, ProviderRequest, ProviderResult } from "./types.js";
import { parseArguments, postJson } from "./http.js";

interface OpenAIResponse {
  id?: string;
  output?: Array<{
    type?: string;
    id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  output_text?: string;
  status?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class OpenAIDriver implements ProviderDriver {
  readonly id = "openai" as const;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string
  ) {}

  async run(request: ProviderRequest): Promise<ProviderResult> {
    const body = {
      model: request.model,
      instructions: request.systemPrompt,
      input: request.userPrompt,
      tools: [
        {
          type: "function",
          name: request.tool.name,
          description: request.tool.description,
          parameters: request.tool.schema,
          strict: true
        }
      ],
      tool_choice: { type: "function", name: request.tool.name },
      parallel_tool_calls: false,
      max_output_tokens: request.maxOutputTokens
    };
    const data = (await postJson(
      `${this.baseUrl.replace(/\/$/, "")}/responses`,
      { Authorization: `Bearer ${this.apiKey}` },
      body,
      request.timeoutMs,
      request.signal
    )) as OpenAIResponse;
    const call = data.output?.find((item) => item.type === "function_call");
    const text =
      data.output_text ??
      data.output
        ?.flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text ?? "")
        .join("\n") ??
      "";
    return {
      text,
      toolCall: call?.name
        ? {
            id: call.call_id ?? call.id ?? "openai-tool-call",
            name: call.name,
            arguments: parseArguments(call.arguments)
          }
        : undefined,
      stopReason: data.status,
      usage: { inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
      responseId: data.id
    };
  }
}
