import fs from "node:fs";
import path from "node:path";

import { exportKprMarkdown } from "../src/core/export";
import { checksum } from "../src/core/hash";
import { CANONICAL_CONTRIBUTOR_CORRECTION } from "../src/core/kpr";
import { appReducer } from "../src/core/reducer";
import type { AppState } from "../src/core/types";
import { createInitialState } from "../src/data/initial";
import { RECORDED_RUNS, REPLAY_METADATA, recordedResponse } from "../src/data/replay";

const directory = path.resolve(process.cwd(), "recorded-runs/canonical");
fs.mkdirSync(directory, { recursive: true });

function write(name: string, contents: string) {
  fs.writeFileSync(path.join(directory, name), contents.endsWith("\n") ? contents : `${contents}\n`, "utf8");
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

let state: AppState = createInitialState();
const user = recordedResponse("user-side");
state = appReducer(state, { type: "APPLY_AGENT_RESPONSE", run: user.run, proposal: user.proposal });
state = appReducer(state, { type: "APPROVE_OVERLAY" });
state = appReducer(state, { type: "VERIFY_OVERLAY" });
state = appReducer(state, { type: "CREATE_KPR" });
state = appReducer(state, { type: "EDIT_CONTRIBUTOR_CLAIM", claimId: "claim-problem", statement: CANONICAL_CONTRIBUTOR_CORRECTION });
state = appReducer(state, { type: "ATTEST_KPR" });
state = appReducer(state, { type: "SCAN_KPR" });
const contributorKpr = structuredClone(state.kpr!);
state = appReducer(state, { type: "SUBMIT_KPR" });
state = appReducer(state, { type: "RUN_KNOWLEDGE_GATE" });
const maintainer = recordedResponse("maintainer-side", state.kpr);
state = appReducer(state, { type: "APPLY_AGENT_RESPONSE", run: maintainer.run, proposal: maintainer.proposal });
state = appReducer(state, { type: "GENERATE_CONTRACT" });
const project = recordedResponse("project", state.kpr);
state = appReducer(state, { type: "APPLY_AGENT_RESPONSE", run: project.run, proposal: project.proposal });
state = appReducer(state, { type: "VERIFY_PROJECT_CANDIDATE" });

write("manifest.json", json({
  assetId: "AXP-001",
  title: "AgenticXYZ Prototype 1 canonical reference fixture",
  northStar: "Agents with People. Human in the Loop.",
  metadata: REPLAY_METADATA,
  warning: "This E1 reference fixture is deterministic and provider-shaped, but is not a credentialed live-provider validation record."
}));
write("events.jsonl", Object.values(RECORDED_RUNS).flatMap((run) => run.events.map((event) => JSON.stringify({ runId: run.id, role: run.role, ...event }))).join("\n"));
write("contributor-kpr.json", json(contributorKpr));
write("contributor-kpr.md", exportKprMarkdown(contributorKpr));
write("integration-contract.json", json(state.contract));
write("project-implementation.patch", `--- /dev/null
+++ b/capabilities/conclusion-first.json
@@ governed structured candidate @@
+${JSON.stringify(state.projectCandidate)}
`);
write("verification.json", json({ status: state.projectWorkspace.status, evidence: state.projectWorkspace.verifierResults }));
write("decisions.json", json(state.kpr?.decisionRecord ?? []));

const artifactNames = fs.readdirSync(directory).filter((name) => name !== "checksums.json" && name !== "README.md").sort();
const checksums = Object.fromEntries(artifactNames.map((name) => [name, checksum(fs.readFileSync(path.join(directory, name), "utf8"))]));
write("checksums.json", json({ algorithm: "FNV-1a 32-bit (artifact integrity, not cryptographic signing)", artifacts: checksums }));
