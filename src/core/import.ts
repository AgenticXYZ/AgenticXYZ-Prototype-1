import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

import agentRunSchema from "../../schemas/agent-run.schema.json";
import changeWorkspaceSchema from "../../schemas/change-workspace.schema.json";
import kprSchema from "../../schemas/kpr.schema.json";
import projectManifestSchema from "../../schemas/project-manifest.schema.json";
import projectPolicySchema from "../../schemas/project-policy.schema.json";
import { scanText } from "./privacy";
import type { AppState, ProviderId, RunMode, WorkspaceView } from "./types";

const providers: ProviderId[] = ["openai", "anthropic", "deepseek"];
const modes: RunMode[] = ["live", "replay", "scripted"];
const views: WorkspaceView[] = ["user", "kpr", "developer"];
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateManifest = ajv.compile(projectManifestSchema);
const validatePolicy = ajv.compile(projectPolicySchema);
const validateRun = ajv.compile(agentRunSchema);
const validateWorkspace = ajv.compile(changeWorkspaceSchema);
const validateKpr = ajv.compile(kprSchema);

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertSchema(label: string, validate: ReturnType<typeof ajv.compile>, value: unknown) {
  if (!validate(value)) throw new Error(`${label} failed schema validation: ${ajv.errorsText(validate.errors)}`);
}

export function parseImportedState(contents: string): AppState {
  if (new TextEncoder().encode(contents).byteLength > 5_000_000) throw new Error("State file exceeds the 5 MB import limit.");
  const privacy = scanText(contents);
  if (privacy.status !== "pass") throw new Error(`State import blocked by ${privacy.findings.length} privacy finding(s).`);
  const parsed: unknown = JSON.parse(contents);
  if (!object(parsed) || parsed.version !== "0.1.0") throw new Error("Unsupported state file version.");
  if (!object(parsed.manifest) || parsed.manifest.projectId !== "research-brief") throw new Error("State file does not contain the Research Brief Manifest.");
  if (!object(parsed.policy) || parsed.policy.projectId !== "research-brief") throw new Error("State file does not contain the Research Brief Policy.");
  if (!object(parsed.providerConfig) || !providers.includes(parsed.providerConfig.provider as ProviderId) || typeof parsed.providerConfig.model !== "string") {
    throw new Error("State file has an invalid Provider configuration.");
  }
  if (!modes.includes(parsed.mode as RunMode) || !views.includes(parsed.activeView as WorkspaceView)) throw new Error("State file has an invalid mode or workspace view.");
  if (!object(parsed.userWorkspace) || !Array.isArray(parsed.userWorkspace.files) || !object(parsed.projectWorkspace) || !Array.isArray(parsed.projectWorkspace.files)) {
    throw new Error("State file has an invalid ChangeWorkspace.");
  }
  if (!Array.isArray(parsed.runs) || !Array.isArray(parsed.notifications) || !object(parsed.proposals)) throw new Error("State file has an invalid Runtime collection.");
  assertSchema("ProjectManifest", validateManifest, parsed.manifest);
  assertSchema("ProjectPolicy", validatePolicy, parsed.policy);
  assertSchema("User ChangeWorkspace", validateWorkspace, parsed.userWorkspace);
  assertSchema("Project ChangeWorkspace", validateWorkspace, parsed.projectWorkspace);
  for (const run of parsed.runs) assertSchema("AgentRun", validateRun, run);
  if (parsed.kpr !== undefined) assertSchema("KPR", validateKpr, parsed.kpr);

  return {
    ...(parsed as unknown as AppState),
    providerConfig: { provider: parsed.providerConfig.provider as ProviderId, model: parsed.providerConfig.model, available: false, source: "none" },
    notifications: []
  };
}
