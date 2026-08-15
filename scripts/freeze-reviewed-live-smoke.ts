import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { verifyLiveSmoke } from "./verify-live-smoke";
import { scanText } from "../src/core/privacy";

type JsonRecord = Record<string, unknown>;

function readJson(file: string): JsonRecord {
  return JSON.parse(fs.readFileSync(file, "utf8")) as JsonRecord;
}

function sha256(contents: string | Buffer): string {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

function write(file: string, contents: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents.endsWith("\n") ? contents : `${contents}\n`, "utf8");
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function filesUnder(directory: string, prefix = ""): string[] {
  return fs.readdirSync(path.join(directory, prefix), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    return entry.isDirectory() ? filesUnder(directory, relative) : [relative];
  }).sort();
}

const sourceInput = process.argv[2];
const decisionInput = process.argv[3];
if (!sourceInput || !decisionInput) {
  throw new Error("Usage: npm run freeze:reviewed-replay -- live-smoke/<provider>/<timestamp> <human-review-decision.json>");
}

const root = process.cwd();
const source = path.resolve(root, sourceInput);
const decisionPath = path.resolve(root, decisionInput);
verifyLiveSmoke(source);

const summary = readJson(path.join(source, "live-smoke.json"));
const decision = readJson(decisionPath);
const provider = String(summary.provider ?? "");
const model = String(summary.model ?? "");
const capturedAt = String(summary.date ?? "");
const captureDate = capturedAt.slice(0, 10);
if (!provider || !model || !/^\d{4}-\d{2}-\d{2}$/.test(captureDate)) throw new Error("Live Smoke identity is incomplete.");
if (decision.decision !== "approved") throw new Error("Only an explicit approved Human Review can be frozen.");
const reviewer = decision.reviewer as JsonRecord | undefined;
if (reviewer?.type !== "human" || !reviewer.label || !decision.reviewedAt || !decision.statement) {
  throw new Error("Human Review decision has no attributable reviewer, timestamp, or statement.");
}

const attestationPath = path.join(root, "recorded-runs/machine-verification/deepseek-v4-flash-2026-08-14.json");
const attestation = readJson(attestationPath);
const bundle = attestation.fullArtifactBundle as JsonRecord | undefined;
const attestedArtifacts = bundle?.artifacts as Record<string, string> | undefined;
const captureNames = ["live-smoke.json", "kpr.json", "kpr.md", "replay-state.json", "review.md"];
for (const name of captureNames) {
  const actual = sha256(fs.readFileSync(path.join(source, name)));
  if (attestedArtifacts?.[name] !== actual) throw new Error(`Human Review source does not match the machine attestation: ${name}`);
}

const adoptedBrief = decision.adoptedBrief as JsonRecord | undefined;
const briefName = String(adoptedBrief?.file ?? "");
const briefPath = path.join(source, briefName);
if (!briefName || !fs.existsSync(briefPath) || adoptedBrief?.sha256 !== sha256(fs.readFileSync(briefPath))) {
  throw new Error("Adopted Agent review brief is missing or does not match the Human Review decision.");
}

const destination = path.join(root, "recorded-runs/reviewed", `${model}-${captureDate}`);
const captureDestination = path.join(destination, "capture");
fs.mkdirSync(captureDestination, { recursive: true });
for (const name of [...captureNames, "checksums.json"]) {
  fs.copyFileSync(path.join(source, name), path.join(captureDestination, name));
}
fs.copyFileSync(briefPath, path.join(destination, briefName));
write(path.join(destination, "review-decision.json"), json(decision));

const claimDecisions = decision.claimDecisions as Array<{ claimId: string; decision: string }>;
const maintainerQuestions = decision.maintainerQuestionResolutions as Array<{ index: number; classification: string; decision: string }>;
const projectQuestions = decision.projectQuestionResolutions as Array<{ index: number; classification: string; decision: string }>;
const reviewMarkdown = `# Human Review — ${provider}/${model}

- Reviewer: ${reviewer.label}
- Reviewed at: ${decision.reviewedAt}
- Decision: **Approved for AgenticXYZ Prototype 1 reference support**
- Exact statement: ${decision.statement}
- Capture source revision: ${(summary.source as JsonRecord)?.revision}
- Capture worktree dirty: ${(summary.source as JsonRecord)?.worktreeDirty ? "yes" : "no"}

## Human review checklist

- [x] Provider, model, Thinking/high, and strict Tool Calls identity reviewed.
- [x] User-side extraction is meaningful and bounded.
- [x] Each Agent role used exactly one allowlisted structured proposal call.
- [x] The automated harness gate is understood as a governance slot, not a prior human decision.
- [x] All staged Claim decisions and the Agent divergence were reviewed and ratified as recorded below.
- [x] Project synthesis stays within the resulting Contract.
- [x] All Maintainer-side and Project Agent questions were resolved without hiding a blocking gap.
- [x] Five independent machine Verifiers passed; they remain machine-executed evidence.
- [x] Public artifacts contain no credential, authorization header, personal path, private trajectory, or contributor patch.
- [x] The replay imports as Recorded Replay with credential availability removed.
- [x] The support decision remains bounded to Prototype 1 and DeepSeek.

## Ratified Claim decisions

${claimDecisions.map((item) => `- \`${item.claimId}\`: **${item.decision}**`).join("\n")}

## Maintainer-side questions

${maintainerQuestions.map((item) => `${item.index}. **${item.classification}** — ${item.decision}`).join("\n")}

## Project Agent questions

${projectQuestions.map((item) => `${item.index}. **${item.classification}** — ${item.decision}`).join("\n")}

## Evidence boundaries

${(decision.evidenceBoundaries as string[]).map((item) => `- ${item}`).join("\n")}
`;
write(path.join(destination, "review.md"), reviewMarkdown);

const manifest = {
  artifactFormatVersion: "0.1.0",
  recordType: "human-reviewed-credentialed-replay",
  reviewStatus: "approved",
  supportDecision: "approved_for_prototype_reference",
  provider,
  model,
  providerOptions: summary.providerOptions,
  capture: {
    date: capturedAt,
    source: summary.source,
    machineChecks: summary.checks,
    machineAttestation: "../../machine-verification/deepseek-v4-flash-2026-08-14.json"
  },
  review: {
    reviewer,
    reviewedAt: decision.reviewedAt,
    statement: decision.statement,
    adoptedBrief: { file: briefName, sha256: adoptedBrief.sha256 }
  },
  evidenceBoundaries: decision.evidenceBoundaries
};
write(path.join(destination, "manifest.json"), json(manifest));

for (const relative of filesUnder(destination)) {
  if (relative === "checksums.json") continue;
  const contents = fs.readFileSync(path.join(destination, relative), "utf8");
  const privacy = scanText(contents);
  if (privacy.status !== "pass") throw new Error(`Reviewed replay blocked by privacy scan: ${relative}`);
}
const artifactNames = filesUnder(destination).filter((name) => name !== "checksums.json");
const checksums = Object.fromEntries(artifactNames.map((name) => [name, sha256(fs.readFileSync(path.join(destination, name)))]));
write(path.join(destination, "checksums.json"), json({ algorithm: "SHA-256", artifacts: checksums }));

process.stdout.write(`Reviewed credentialed replay frozen at ${path.relative(root, destination)}\n`);
