import fs from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

import { appReducer } from "../../src/core/reducer";
import { createInitialState, PROJECT_MANIFEST, PROJECT_POLICY, REFERENCE_BRIEF } from "../../src/data/initial";
import { RECORDED_RUNS, recordedResponse } from "../../src/data/replay";

const root = path.resolve(process.cwd(), "schemas");
const referenceRoot = path.resolve(process.cwd(), "reference-app");
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

function validator(name: string) {
  const instance = new Ajv2020({ allErrors: true, strict: false });
  addFormats(instance);
  return instance.compile(schema(name));
}

function schema(name: string) {
  return JSON.parse(fs.readFileSync(path.join(root, name), "utf8")) as Record<string, unknown>;
}

function valid(name: string, value: unknown) {
  const instance = new Ajv2020({ allErrors: true, strict: false });
  addFormats(instance);
  const validate = instance.compile(schema(name));
  const result = validate(value);
  if (!result) throw new Error(instance.errorsText(validate.errors));
  return result;
}

it("validates every one of the five core objects", () => {
  let state = createInitialState();
  const response = recordedResponse("user-side");
  state = appReducer(state, { type: "APPLY_AGENT_RESPONSE", run: response.run, proposal: response.proposal });
  state = appReducer(state, { type: "APPROVE_OVERLAY" });
  state = appReducer(state, { type: "VERIFY_OVERLAY" });
  state = appReducer(state, { type: "CREATE_KPR" });
  expect(valid("project-manifest.schema.json", PROJECT_MANIFEST)).toBe(true);
  expect(valid("project-policy.schema.json", PROJECT_POLICY)).toBe(true);
  expect(valid("agent-run.schema.json", RECORDED_RUNS["user-side"])).toBe(true);
  expect(valid("change-workspace.schema.json", state.userWorkspace)).toBe(true);
  expect(valid("kpr.schema.json", state.kpr)).toBe(true);
});

it("keeps the published Agentic Software Contract synchronized and machine-readable", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(referenceRoot, "agentic.manifest.json"), "utf8"));
  const policy = JSON.parse(fs.readFileSync(path.join(referenceRoot, "project-policy.yaml"), "utf8"));
  const surfaces = JSON.parse(fs.readFileSync(path.join(referenceRoot, "mutable-surfaces.json"), "utf8"));
  const reference = JSON.parse(fs.readFileSync(path.join(referenceRoot, "reference/research-brief.json"), "utf8"));
  const verifiers = JSON.parse(fs.readFileSync(path.join(referenceRoot, "verifiers/definitions.json"), "utf8")) as Array<{ id: string }>;
  const capabilitySchema = JSON.parse(fs.readFileSync(path.join(referenceRoot, "capabilities.schema.json"), "utf8"));
  const stateSchema = JSON.parse(fs.readFileSync(path.join(referenceRoot, "state.schema.json"), "utf8"));

  expect(manifest).toEqual(PROJECT_MANIFEST);
  expect(policy).toEqual(PROJECT_POLICY);
  expect(surfaces).toEqual(PROJECT_MANIFEST.mutableSurfaces);
  expect(reference).toEqual(REFERENCE_BRIEF);
  expect(valid("project-manifest.schema.json", manifest)).toBe(true);
  expect(valid("project-policy.schema.json", policy)).toBe(true);

  const validateCapability = ajv.compile(capabilitySchema);
  for (const capability of PROJECT_MANIFEST.capabilities) expect(validateCapability(capability)).toBe(true);
  const validateState = ajv.compile(stateSchema);
  expect(validateState({ document: reference, overlay: null })).toBe(true);

  const verifierIds = new Set(verifiers.map((item) => item.id));
  expect(new Set(PROJECT_MANIFEST.verifierIds)).toEqual(verifierIds);
  const referenced = new Set([
    ...PROJECT_MANIFEST.verifierIds,
    ...PROJECT_MANIFEST.capabilities.flatMap((capability) => capability.verifierIds),
    ...PROJECT_POLICY.evidenceRequirements.flatMap((requirement) => requirement.verifierIds)
  ]);
  expect([...referenced].filter((id) => !verifierIds.has(id))).toEqual([]);
  expect(PROJECT_MANIFEST.protectedInvariants).toEqual(PROJECT_POLICY.protectedInvariants);
});

describe("schema rejection", () => {
  it("rejects an AgentRun without a termination-safe event sequence", () => {
    const validate = validator("agent-run.schema.json");
    expect(validate({ id: "bad" })).toBe(false);
  });

  it("rejects a KPR with an unknown top-level field", () => {
    const validate = validator("kpr.schema.json");
    expect(validate({ ...createInitialState(), unknown: true })).toBe(false);
  });
});
