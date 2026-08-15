import type { AgentRole } from "../../src/core/types.js";
import type { FunctionTool } from "../providers/types.js";

const planSchema = { type: "array", minItems: 2, maxItems: 8, items: { type: "string" } };
const openQuestionsSchema = { type: "array", items: { type: "string" } };

const userTool: FunctionTool = {
  name: "submit_user_side_proposal",
  description: "Submit a bounded, reversible User Overlay proposal for human review. This does not apply the change.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["role", "summary", "plan", "proposedOverlay", "proposedClaims", "openQuestions"],
    properties: {
      role: { const: "user-side" },
      summary: { type: "string" },
      plan: planSchema,
      proposedOverlay: {
        type: "object",
        additionalProperties: false,
        required: ["conclusionFirst", "preserveSources", "theme", "rememberPreference", "scope"],
        properties: {
          conclusionFirst: { type: "boolean" },
          preserveSources: { const: true },
          theme: { const: "light" },
          rememberPreference: { type: "boolean" },
          scope: { enum: ["private", "contributable"] }
        }
      },
      proposedClaims: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "statement", "scope", "confidence"],
          properties: {
            type: { enum: ["problem", "intent", "expected_behavior", "constraint", "acceptance_criterion", "invariant", "decision", "counterexample", "open_question"] },
            statement: { type: "string" },
            scope: { type: "array", items: { type: "string" } },
            confidence: { enum: ["low", "medium", "high"] }
          }
        }
      },
      openQuestions: openQuestionsSchema
    }
  }
};

const impactSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "dimension", "title", "description", "source", "confidence", "affectedScopes", "humanDecisionRequired", "evidenceRequired"],
  properties: {
    id: { type: "string" },
    dimension: { enum: ["product_behavior", "interface", "user_preference", "data_provenance", "permissions_privacy", "compatibility", "performance_cost", "verification", "documentation", "rollout_rollback"] },
    title: { type: "string" },
    description: { type: "string" },
    source: { enum: ["explicit", "agent-inferred", "policy-required", "maintainer-confirmed", "unknown"] },
    confidence: { enum: ["low", "medium", "high"] },
    affectedScopes: { type: "array", items: { type: "string" } },
    humanDecisionRequired: { type: "boolean" },
    evidenceRequired: { type: "boolean" }
  }
};

const resolutionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["claimId", "decision", "rationale", "targetScopes", "requiredVerifierIds"],
  properties: {
    claimId: { type: "string" },
    decision: { enum: ["accept", "modify", "narrow", "defer", "reject", "request_evidence"] },
    finalStatement: { type: "string" },
    rationale: { type: "string" },
    targetScopes: { type: "array", items: { type: "string" } },
    rollout: { type: "string" },
    requiredVerifierIds: { type: "array", items: { type: "string" } }
  }
};

const maintainerTool: FunctionTool = {
  name: "submit_maintainer_review",
  description: "Submit a knowledge-first impact analysis and resolution suggestions. These remain drafts until the human Maintainer decides.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["role", "summary", "plan", "impactAnalysis", "resolutionSuggestions", "openQuestions"],
    properties: {
      role: { const: "maintainer-side" },
      summary: { type: "string" },
      plan: planSchema,
      impactAnalysis: { type: "array", minItems: 3, items: impactSchema },
      resolutionSuggestions: { type: "array", minItems: 1, items: resolutionSchema },
      openQuestions: openQuestionsSchema
    }
  }
};

const projectTool: FunctionTool = {
  name: "submit_project_candidate",
  description: "Submit a bounded project candidate derived only from the approved Integration Contract. This does not merge or adopt the candidate.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["role", "summary", "plan", "projectCandidate", "openQuestions"],
    properties: {
      role: { const: "project" },
      summary: { type: "string" },
      plan: planSchema,
      projectCandidate: {
        type: "object",
        additionalProperties: false,
        required: ["featureId", "label", "enabledByDefault", "applicableDocumentTypes", "preserveSources", "saveOnlyAfterConfirmation", "rollout"],
        properties: {
          featureId: { type: "string" },
          label: { type: "string" },
          enabledByDefault: { type: "boolean" },
          applicableDocumentTypes: { type: "array", items: { type: "string" } },
          preserveSources: { type: "boolean" },
          saveOnlyAfterConfirmation: { type: "boolean" },
          rollout: { enum: ["experimental", "stable"] }
        }
      },
      openQuestions: openQuestionsSchema
    }
  }
};

export function toolForRole(role: AgentRole): FunctionTool {
  if (role === "maintainer-side") return maintainerTool;
  if (role === "project") return projectTool;
  return userTool;
}
