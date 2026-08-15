export class ProviderHttpError extends Error {
  status: number;
  providerMessage: string;

  constructor(status: number, providerMessage: string) {
    super(`Provider request failed with HTTP ${status}.`);
    this.name = "ProviderHttpError";
    this.status = status;
    this.providerMessage = providerMessage.slice(0, 500);
  }
}

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<unknown> {
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  const timeout = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        message = parsed.error?.message ?? text;
      } catch {
        // Keep the bounded response text.
      }
      throw new ProviderHttpError(response.status, message);
    }
    return JSON.parse(text) as unknown;
  } finally {
    if (timeout) clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

export function parseArguments(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("The provider returned invalid JSON tool arguments.");
  }
}
