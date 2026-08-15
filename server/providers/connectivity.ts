import type { ProviderId } from "../../src/core/types.js";
import { ProviderHttpError } from "./http.js";

function modelsEndpoint(provider: ProviderId, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  if (provider === "deepseek" && base.endsWith("/beta")) return `${base.slice(0, -5)}/models`;
  return `${base}/models`;
}

export async function checkProviderConnection(
  provider: ProviderId,
  apiKey: string,
  baseUrl: string,
  timeoutMs = 30_000
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = provider === "anthropic"
    ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
    : { Authorization: `Bearer ${apiKey}` };

  try {
    const response = await fetch(modelsEndpoint(provider, baseUrl), {
      method: "GET",
      headers,
      signal: controller.signal
    });
    if (response.ok) return;
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } | string };
      message = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? text;
    } catch {
      // Keep the bounded response text for a useful, redacted configuration error.
    }
    throw new ProviderHttpError(response.status, message);
  } finally {
    clearTimeout(timeout);
  }
}
