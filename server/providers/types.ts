import type { AgentRole, ProviderId } from "../../src/core/types.js";

export interface FunctionTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface ProviderRequest {
  provider: ProviderId;
  model: string;
  role: AgentRole;
  systemPrompt: string;
  userPrompt: string;
  tool: FunctionTool;
  timeoutMs: number;
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export interface ProviderToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface ProviderResult {
  text: string;
  toolCall?: ProviderToolCall;
  stopReason?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  responseId?: string;
}

export interface ProviderDriver {
  id: ProviderId;
  run(request: ProviderRequest): Promise<ProviderResult>;
}
