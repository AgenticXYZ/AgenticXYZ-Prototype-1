import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";

import type { AgentTurnRequest, ProviderId } from "../src/core/types.js";
import { redactText } from "../src/core/privacy.js";
import { loadConfig } from "./config.js";
import { checkProviderConnection } from "./providers/connectivity.js";
import { ProviderHttpError } from "./providers/http.js";
import { runAgent } from "./runtime/runAgent.js";
import { answerGuideQuestion, type GuideRequest } from "./runtime/guide.js";

const config = loadConfig();
const sessionConfiguredProviders = new Set<ProviderId>();
const app = express();
const allowedOrigins = new Set(["http://127.0.0.1:4173", "http://localhost:4173"]);

app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) callback(null, true);
      else callback(new Error("Origin is not allowed by the local gateway."));
    }
  })
);
app.use(express.json({ limit: "1mb" }));
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.get("/api/health", (_request, response) => {
  const providers = (Object.keys(config.providers) as ProviderId[]).map((provider) => ({
    provider,
    available: Boolean(config.providers[provider].apiKey),
    active: provider === config.activeProvider,
    source: sessionConfiguredProviders.has(provider)
      ? "session"
      : config.providers[provider].apiKey
        ? "environment"
        : "none"
  }));
  response.json({
    ok: true,
    activeProvider: config.activeProvider,
    activeModel: config.activeModel,
    providers,
    keyHandling: "server-memory-or-environment"
  });
});

app.post("/api/provider/configure", async (request, response) => {
  const body = request.body as { provider?: unknown; model?: unknown; apiKey?: unknown };
  const provider = body.provider;
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const suppliedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (provider !== "openai" && provider !== "anthropic" && provider !== "deepseek") {
    response.status(400).json({ error: "Choose a supported Provider." });
    return;
  }
  if (!model || model.length > 120) {
    response.status(400).json({ error: "Enter a valid model name." });
    return;
  }
  if (suppliedKey.length > 512) {
    response.status(400).json({ error: "The API key is too long." });
    return;
  }
  const apiKey = suppliedKey || config.providers[provider].apiKey;
  if (!apiKey) {
    response.status(400).json({ error: "Enter an API key for this Provider." });
    return;
  }

  try {
    await checkProviderConnection(provider, apiKey, config.providers[provider].baseUrl);
    config.providers[provider].apiKey = apiKey;
    config.activeProvider = provider;
    config.activeModel = model;
    if (suppliedKey) sessionConfiguredProviders.add(provider);
    response.json({
      ok: true,
      provider,
      model,
      available: true,
      source: sessionConfiguredProviders.has(provider) ? "session" : "environment",
      keyHandling: "server-memory-or-environment"
    });
  } catch (error) {
    const status = error instanceof ProviderHttpError ? error.status : 502;
    const detail = error instanceof ProviderHttpError
      ? error.providerMessage
      : error instanceof Error && error.name === "AbortError"
        ? "Connection check timed out."
        : "The Provider could not be reached.";
    response.status(status >= 400 && status < 500 ? 400 : 502).json({
      error: redactText(`Connection check failed. ${detail}`)
    });
  }
});

app.post("/api/agent/turn", async (request, response) => {
  const body = request.body as Partial<AgentTurnRequest>;
  if (!body.role || !body.provider || !body.model || !body.userMessage || !body.context) {
    response.status(400).json({ error: "role, provider, model, userMessage, and context are required." });
    return;
  }
  const controller = new AbortController();
  const abortIfDisconnected = () => {
    if (!response.writableEnded) controller.abort(new Error("Client disconnected."));
  };
  response.once("close", abortIfDisconnected);
  const result = await runAgent(body as AgentTurnRequest, config, controller.signal);
  response.off("close", abortIfDisconnected);
  if (controller.signal.aborted || response.headersSent) return;
  response.status(result.run.status === "failed" ? 422 : 200).json(result);
});

app.post("/api/guide/chat", async (request, response) => {
  const body = request.body as Partial<GuideRequest>;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 1200 || (body.language !== "en" && body.language !== "zh-CN") || !body.context || typeof body.context !== "object") {
    response.status(400).json({ error: "A bounded question, language, and current application context are required." });
    return;
  }
  if (!config.providers[config.activeProvider].apiKey) {
    response.status(409).json({ error: "Configure the active Provider before requesting a Live Guide answer." });
    return;
  }
  const incomingContext = body.context as Partial<GuideRequest["context"]>;
  const boundedLabel = (value: unknown, fallback: string) => typeof value === "string" ? value.slice(0, 80) : fallback;
  const guideRequest: GuideRequest = {
    question,
    language: body.language,
    context: {
      activeView: boundedLabel(incomingContext.activeView, "unknown"),
      guidedStep: Number.isFinite(incomingContext.guidedStep) ? Math.max(0, Math.min(9, Number(incomingContext.guidedStep))) : 0,
      overlayStatus: boundedLabel(incomingContext.overlayStatus, "unknown"),
      kprStatus: boundedLabel(incomingContext.kprStatus, "unknown"),
      contractReady: incomingContext.contractReady === true,
      candidateStatus: boundedLabel(incomingContext.candidateStatus, "unknown")
    }
  };
  const controller = new AbortController();
  const abortIfDisconnected = () => {
    if (!response.writableEnded) controller.abort(new Error("Client disconnected."));
  };
  response.once("close", abortIfDisconnected);
  try {
    const result = await answerGuideQuestion(guideRequest, config, controller.signal);
    if (!controller.signal.aborted && !response.headersSent) response.json(result);
  } catch (error) {
    if (!controller.signal.aborted && !response.headersSent) {
      const detail = error instanceof ProviderHttpError ? error.providerMessage : error instanceof Error ? error.message : "The Guide Agent could not answer.";
      response.status(error instanceof ProviderHttpError && error.status >= 400 && error.status < 500 ? 400 : 502).json({ error: redactText(detail) });
    }
  } finally {
    response.off("close", abortIfDisconnected);
  }
});

if (process.argv.includes("--serve-dist")) {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(directory, "../dist");
  app.use(express.static(dist));
  app.get("*splat", (_request, response) => response.sendFile(path.join(dist, "index.html")));
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected gateway error.";
  response.status(500).json({ error: message.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]") });
});

app.listen(config.port, "127.0.0.1", () => {
  process.stdout.write(
    `AgenticXYZ local gateway listening on http://127.0.0.1:${config.port} (${config.activeProvider}/${config.activeModel})\n`
  );
});
