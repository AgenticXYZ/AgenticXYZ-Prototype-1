import type { AgentTurnRequest } from "../../src/core/types.js";
import { redactText } from "../../src/core/privacy.js";
import type { SkillDefinition } from "../../src/core/types.js";
import type { FunctionTool } from "../providers/types.js";

const COMMON = `You are operating inside AgenticXYZ Prototype 1.

System principles:
- Agent-centered, Human-governed.
- Knowledge before code. Evidence before adoption.
- You may only return the one structured tool proposal provided to you.
- Never claim that a proposal is applied, verified, merged, or adopted.
- Do not expose private data, credentials, hidden reasoning, or unsupported certainty.
- Keep unknowns and policy conflicts visible.
- The application, not you, executes tools and verifiers.`;

const ROLE_PROMPTS = {
  "user-side": `You are the User-side Agent. Help a contributor combine software knowledge with user knowledge in a reversible local overlay. You have no authority over the public project. Preserve sources and the public core. Turn the request into a bounded plan and proposal for human approval.`,
  "maintainer-side": `You are the Maintainer-side Agent. Help the Maintainer understand and shape a KPR from the perspective of knowledge, impact, evidence, and Project Policy. Clearly separate explicit contributor claims from your inferences. You cannot approve claims, write code, or change the product.`,
  project: `You are the Project Agent. Implement only the Maintainer-approved Knowledge Integration Contract inside a structured candidate workspace. Blind Reconstruction is mandatory: do not ask for or infer the contributor patch. You cannot change product goals, approve your output, or merge public state.`
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Some Provider strict-schema subsets omit array cardinality keywords. Keep
 * the canonical Runtime schema authoritative and repeat those exact bounds in
 * the prompt so a Provider can satisfy them on the first bounded call.
 */
export function describeArrayBounds(schema: Record<string, unknown>): string[] {
  const rules: string[] = [];
  const visit = (value: unknown, path: string) => {
    if (!isRecord(value)) return;
    const minimum = typeof value.minItems === "number" ? value.minItems : undefined;
    const maximum = typeof value.maxItems === "number" ? value.maxItems : undefined;
    if (value.type === "array" && (minimum !== undefined || maximum !== undefined)) {
      const range = minimum !== undefined && maximum !== undefined
        ? `between ${minimum} and ${maximum} items, inclusive`
        : minimum !== undefined
          ? `at least ${minimum} item${minimum === 1 ? "" : "s"}`
          : `at most ${maximum} items`;
      rules.push(`${path}: ${range}.`);
    }
    if (isRecord(value.properties)) {
      for (const [name, property] of Object.entries(value.properties)) {
        visit(property, path ? `${path}.${name}` : name);
      }
    }
    if (value.type === "array") visit(value.items, `${path}[]`);
  };
  visit(schema, "");
  return rules;
}

export function buildPrompts(request: AgentTurnRequest, skill: SkillDefinition, tool: FunctionTool): { systemPrompt: string; userPrompt: string } {
  const context = {
    manifest: request.context.manifest,
    policy: request.context.policy,
    brief: request.role === "user-side" ? request.context.brief : undefined,
    overlay: request.role === "user-side" ? request.context.overlay : undefined,
    kpr: request.role === "maintainer-side" ? request.context.kpr : undefined,
    contract: request.role === "project" ? request.context.contract : undefined,
    contextBoundary: {
      contributorPatchVisible: false,
      privateTrajectoryVisible: false,
      publicMergeAuthority: false
    }
  };
  const arrayBounds = describeArrayBounds(tool.schema);
  const outputBounds = arrayBounds.length > 0
    ? `\nCanonical JSON Schema cardinality rules (the Runtime will reject violations):\n${arrayBounds.map((rule) => `- ${rule}`).join("\n")}`
    : "";
  const outputLanguage = request.language === "zh-CN"
    ? "Return every human-readable field in professional Simplified Chinese. Keep established technical terms such as Agent, KPR, Provider, API, Runtime, token, diff, and JSON when that is clearer than a forced translation."
    : "Return every human-readable field in English.";
  return {
    systemPrompt: `${COMMON}\n\n${ROLE_PROMPTS[request.role]}\n\nOutput language: ${outputLanguage}\n\nActive Skill: ${skill.id}@${skill.version}\nPurpose: ${skill.purpose}\nAllowed workflow tools: ${skill.allowedToolIds.join(", ")}\nRequired human gates: ${skill.requiredHumanGates.join(", ")}\nRequired verifiers: ${skill.requiredVerifierIds.join(", ")}${outputBounds}`,
    userPrompt: redactText(`Human request:\n${request.userMessage}\n\nAuthorized context:\n${JSON.stringify(context, null, 2)}`)
  };
}
