import { redactText, scanText } from "../../src/core/privacy.js";
import type { ServerConfig } from "../config.js";
import { createProvider } from "../providers/index.js";
import type { FunctionTool } from "../providers/types.js";

export type GuideAction = "open_provider" | "show_next" | "go_user" | "go_kpr" | "go_developer" | "open_runtime" | "none";

export interface GuideRequest {
  question: string;
  language: "en" | "zh-CN";
  context: {
    activeView: string;
    guidedStep: number;
    overlayStatus: string;
    kprStatus: string;
    contractReady: boolean;
    candidateStatus: string;
  };
}

const guideTool: FunctionTool = {
  name: "answer_agenticxyz_question",
  description: "Return a concise, evidence-bounded answer about AgenticXYZ Prototype 1 and an optional navigation suggestion. This tool cannot mutate application state.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["answer", "suggestedAction"],
    properties: {
      answer: { type: "string", minLength: 1, maxLength: 1800 },
      suggestedAction: { type: "string", enum: ["open_provider", "show_next", "go_user", "go_kpr", "go_developer", "open_runtime", "none"] }
    }
  }
};

function isGuideAction(value: unknown): value is GuideAction {
  return typeof value === "string" && ["open_provider", "show_next", "go_user", "go_kpr", "go_developer", "open_runtime", "none"].includes(value);
}

export async function answerGuideQuestion(request: GuideRequest, config: ServerConfig, signal?: AbortSignal) {
  const provider = createProvider(config, config.activeProvider);
  const chinese = request.language === "zh-CN";
  const result = await provider.run({
    provider: config.activeProvider,
    model: config.activeModel,
    role: "user-side",
    systemPrompt: `You are the read-only Guide Agent inside AgenticXYZ Prototype 1.

The prototype explores: Agents with People. Agent First is the architecture principle; human governance is the authority principle. The software itself is an Agent-readable and Agent-operable target. Core objects are Agentic Software, User Overlay, Knowledge-based Pull Request (KPR), Project Policy, Knowledge Integration Contract, Agentic Runtime, verifier evidence, checkpoints, rollback, and human decisions.

You may explain the current screen, Provider setup, the guided workflow, terminology, and the difference between contributor knowledge and project-owned implementation. You may suggest navigation. You must never claim to approve, attest, merge, adopt, verify, or mutate anything. Do not invent project state beyond the supplied context. Keep the answer under 220 words. ${chinese ? "Answer in professional Simplified Chinese while retaining established terms such as Agent, KPR, Provider, API, Runtime, token, diff, and JSON where appropriate." : "Answer in English."}`,
    userPrompt: redactText(`Question:\n${request.question}\n\nCurrent application context:\n${JSON.stringify(request.context, null, 2)}`),
    tool: guideTool,
    timeoutMs: config.requestTimeoutMs,
    maxOutputTokens: Math.min(config.maxOutputTokens, 4_000),
    signal
  });
  const args = result.toolCall?.arguments;
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("The Guide Agent did not return a structured answer.");
  const answer = redactText(String((args as Record<string, unknown>).answer ?? "")).trim();
  const suggestedAction = (args as Record<string, unknown>).suggestedAction;
  if (!answer || !isGuideAction(suggestedAction)) throw new Error("The Guide Agent returned an invalid answer.");
  if (scanText(answer).status !== "pass") throw new Error("The Guide Agent answer was blocked by the privacy boundary.");
  return { answer, action: suggestedAction, source: "provider", usage: result.usage };
}
