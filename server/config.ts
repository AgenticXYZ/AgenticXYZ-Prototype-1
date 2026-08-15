import path from "node:path";

import { config as loadDotenv } from "dotenv";

import type { ProviderId } from "../src/core/types.js";

export function loadEnvironmentFiles(directory = process.cwd()) {
  loadDotenv({
    path: [path.join(directory, ".env.local"), path.join(directory, ".env")],
    override: false,
    quiet: true
  });
}

loadEnvironmentFiles();

export interface ServerConfig {
  port: number;
  activeProvider: ProviderId;
  activeModel: string;
  maxToolCalls: number;
  maxProviderCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxRetries: number;
  requestTimeoutMs: number;
  providers: {
    openai: { apiKey?: string; baseUrl: string };
    anthropic: { apiKey?: string; baseUrl: string };
    deepseek: { apiKey?: string; baseUrl: string; reasoningEffort: "low" | "high" | "max" };
  };
}

function providerId(value: string | undefined): ProviderId {
  return value === "anthropic" || value === "deepseek" ? value : "openai";
}

function deepSeekReasoningEffort(value: string | undefined): "low" | "high" | "max" {
  return value === "low" || value === "max" ? value : "high";
}

export function loadConfig(): ServerConfig {
  return {
    port: Number(process.env.AGENTICXYZ_PORT ?? 8787),
    activeProvider: providerId(process.env.AGENTICXYZ_PROVIDER),
    activeModel: process.env.AGENTICXYZ_MODEL ?? "gpt-5.6-terra",
    maxToolCalls: Math.max(1, Math.min(10, Number(process.env.AGENTICXYZ_MAX_TOOL_CALLS ?? 6))),
    maxProviderCalls: Math.max(1, Math.min(3, Number(process.env.AGENTICXYZ_MAX_PROVIDER_CALLS ?? 1))),
    maxInputTokens: Math.max(1_000, Math.min(100_000, Number(process.env.AGENTICXYZ_MAX_INPUT_TOKENS ?? 20_000))),
    maxOutputTokens: Math.max(256, Math.min(64_000, Number(process.env.AGENTICXYZ_MAX_OUTPUT_TOKENS ?? 32_000))),
    maxRetries: Math.max(0, Math.min(2, Number(process.env.AGENTICXYZ_MAX_RETRIES ?? 0))),
    requestTimeoutMs: (() => {
      const configured = Number(process.env.AGENTICXYZ_REQUEST_TIMEOUT_MS ?? 0);
      return configured === 0 ? 0 : Math.max(5_000, Math.min(600_000, configured));
    })(),
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseUrl: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1"
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
        reasoningEffort: deepSeekReasoningEffort(process.env.DEEPSEEK_REASONING_EFFORT)
      }
    }
  };
}
