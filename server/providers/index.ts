import type { ProviderId } from "../../src/core/types.js";
import type { ServerConfig } from "../config.js";
import { AnthropicDriver } from "./anthropic.js";
import { DeepSeekDriver } from "./deepseek.js";
import { OpenAIDriver } from "./openai.js";
import type { ProviderDriver } from "./types.js";

export function createProvider(config: ServerConfig, providerId: ProviderId): ProviderDriver {
  const provider = config.providers[providerId];
  if (!provider.apiKey) {
    throw new Error(`No server-side API key is configured for ${providerId}.`);
  }
  if (providerId === "anthropic") return new AnthropicDriver(provider.apiKey, provider.baseUrl);
  if (providerId === "deepseek") {
    const deepseek = config.providers.deepseek;
    return new DeepSeekDriver(deepseek.apiKey!, deepseek.baseUrl, deepseek.reasoningEffort);
  }
  return new OpenAIDriver(provider.apiKey, provider.baseUrl);
}
