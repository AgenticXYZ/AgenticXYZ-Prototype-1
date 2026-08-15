import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function requireFile(relative: string, nonEmpty = true) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) throw new Error(`Missing acceptance artifact: ${relative}`);
  if (nonEmpty && fs.statSync(target).size === 0) throw new Error(`Empty acceptance artifact: ${relative}`);
}

const requiredArtifacts = [
  "README.md",
  "README.zh-CN.md",
  "LICENSE",
  "CITATION.cff",
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  "article/prototype-1.md",
  "article/prototype-1.zh-CN.md",
  "demo/agenticxyz-prototype-1.webm",
  "docs/architecture.md",
  "docs/decisions.md",
  "docs/development-specification.md",
  "docs/limitations.md",
  "docs/live-smoke-template.md",
  "docs/provider-support.md",
  "docs/release-audit.md",
  "docs/security.md",
  "docs/walkthrough.md",
  "protocol/README.md",
  "protocol/examples/README.md",
  "schemas/project-manifest.schema.json",
  "schemas/project-policy.schema.json",
  "schemas/agent-run.schema.json",
  "schemas/change-workspace.schema.json",
  "schemas/kpr.schema.json",
  "reference-app/agentic.manifest.json",
  "reference-app/README.md",
  "reference-app/project-policy.yaml",
  "reference-app/capabilities.schema.json",
  "reference-app/mutable-surfaces.json",
  "reference-app/reference/research-brief.json",
  "reference-app/state.schema.json",
  "reference-app/user-overlay/README.md",
  "reference-app/verifiers/definitions.json",
  "recorded-runs/canonical/README.md",
  "recorded-runs/canonical/checksums.json",
  "recorded-runs/machine-verification/README.md",
  "recorded-runs/machine-verification/deepseek-v4-flash-2026-08-14.json",
  "recorded-runs/reviewed/README.md",
  "recorded-runs/reviewed/deepseek-v4-flash-2026-08-14/manifest.json",
  "recorded-runs/reviewed/deepseek-v4-flash-2026-08-14/review-decision.json",
  "recorded-runs/reviewed/deepseek-v4-flash-2026-08-14/review.md",
  "recorded-runs/reviewed/deepseek-v4-flash-2026-08-14/checksums.json",
  "screenshots/canonical/checksums.json",
  "screenshots/canonical/zh-CN/checksums.json"
];
for (const artifact of requiredArtifacts) requireFile(artifact);

const packageManifest = JSON.parse(read("package.json")) as { version?: string; license?: string };
const packageLock = JSON.parse(read("package-lock.json")) as { version?: string; packages?: Record<string, { version?: string; license?: string }> };
if (
  packageManifest.version !== "1.0.0-rc.1"
  || packageLock.version !== "1.0.0-rc.1"
  || packageLock.packages?.[""]?.version !== "1.0.0-rc.1"
  || !read("CITATION.cff").includes("version: 1.0.0-rc.1")
) throw new Error("Release package, lockfile, and citation versions must agree on 1.0.0-rc.1.");
if (
  packageManifest.license !== "MIT"
  || packageLock.packages?.[""]?.license !== "MIT"
  || !read("CITATION.cff").includes("license: MIT")
  || !read("LICENSE").startsWith("MIT License")
) throw new Error("Release package, lockfile, citation, and license text must agree on MIT.");

for (const removedCommunityArtifact of [
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  ".github/ISSUE_TEMPLATE/knowledge-contribution.yml",
  ".github/pull_request_template.md"
]) {
  if (fs.existsSync(path.join(root, removedCommunityArtifact))) throw new Error(`Showcase-only release must not include ${removedCommunityArtifact}.`);
}

const allowedRootMarkdown = new Set(["README.md", "README.zh-CN.md"]);
for (const entry of fs.readdirSync(root)) {
  if (entry.endsWith(".md") && !allowedRootMarkdown.has(entry)) {
    throw new Error(`Repository root must stay focused; move or remove ${entry}.`);
  }
}

const specification = read("docs/development-specification.md");
const checklist = [...specification.matchAll(/^- \[([ xX])\] (.+)$/gm)].map((match) => ({ checked: match[1].toLowerCase() === "x", label: match[2] }));
if (checklist.length < 39) throw new Error(`Acceptance checklist is unexpectedly incomplete (${checklist.length} items).`);
const unchecked = checklist.filter((item) => !item.checked);
if (unchecked.length !== 0) throw new Error(`Final acceptance has open checklist items: ${unchecked.map((item) => item.label).join(" | ")}`);

for (const relativeRoot of ["screenshots/canonical", "screenshots/canonical/zh-CN"]) {
  const screenshotManifest = JSON.parse(read(path.join(relativeRoot, "checksums.json"))) as {
    algorithm?: string;
    viewport?: string;
    artifacts?: Record<string, string>;
  };
  if (screenshotManifest.algorithm !== "SHA-256") throw new Error(`${relativeRoot} screenshot manifest must use SHA-256.`);
  if (screenshotManifest.viewport !== "1920x1080") throw new Error(`${relativeRoot} screenshot manifest must record the 1920x1080 viewport.`);
  const screenshotEntries = Object.entries(screenshotManifest.artifacts ?? {});
  if (screenshotEntries.length !== 10) throw new Error(`Expected 10 screenshots in ${relativeRoot}, found ${screenshotEntries.length}.`);
  for (const [name, expected] of screenshotEntries) {
    const target = path.join(root, relativeRoot, name);
    requireFile(path.join(relativeRoot, name));
    const actual = crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
    if (actual !== expected) throw new Error(`Screenshot checksum mismatch: ${path.join(relativeRoot, name)}`);
  }
}

const liveAttestation = JSON.parse(read("recorded-runs/machine-verification/deepseek-v4-flash-2026-08-14.json")) as {
  attestationType?: string;
  reviewStatus?: string;
  supportDecision?: string;
  provider?: string;
  model?: string;
  providerOptions?: { thinking?: string; reasoningEffort?: string; strictToolCalls?: boolean };
  source?: { revision?: string; worktreeDirty?: boolean };
  checks?: Record<string, string>;
  humanGovernance?: {
    gateExecution?: string;
    decisionStatus?: string;
    representedActor?: string;
    stagedDecisionDivergenceCount?: number;
    maintainerOpenQuestionCount?: number;
    projectOpenQuestionCount?: number;
  };
  humanReview?: {
    reviewer?: { id?: string; type?: string; label?: string };
    reviewedAt?: string;
    statement?: string;
    adoptedBriefSha256?: string;
    reviewedReplay?: string;
  };
  runs?: Array<{ role?: string; status?: string; providerCallsUsed?: number; toolCallsUsed?: number; toolCallEvents?: number; maxDurationMs?: number }>;
  verifiers?: Array<{ id?: string; result?: string }>;
  fullArtifactBundle?: { bundled?: boolean; trackedRelativePath?: string; checksumAlgorithm?: string; artifacts?: Record<string, string> };
  proposal?: unknown;
  assistantMessage?: unknown;
};
if (
  liveAttestation.attestationType !== "credentialed-live-smoke-machine-verification"
  || liveAttestation.reviewStatus !== "approved"
  || liveAttestation.supportDecision !== "approved_for_prototype_reference"
  || liveAttestation.provider !== "deepseek"
  || liveAttestation.model !== "deepseek-v4-flash"
  || liveAttestation.providerOptions?.thinking !== "enabled"
  || liveAttestation.providerOptions.reasoningEffort !== "high"
  || liveAttestation.providerOptions.strictToolCalls !== true
) throw new Error("DeepSeek attestation does not preserve the selected approved Prototype-reference boundary.");
if (liveAttestation.source?.worktreeDirty !== false || !/^[a-f0-9]{40}$/.test(liveAttestation.source.revision ?? "")) {
  throw new Error("DeepSeek machine attestation must identify a clean source revision.");
}
if (Object.values(liveAttestation.checks ?? {}).length !== 7 || Object.values(liveAttestation.checks ?? {}).some((result) => result !== "pass")) {
  throw new Error("DeepSeek machine attestation checks are incomplete.");
}
if (
  liveAttestation.humanGovernance?.gateExecution !== "automated_test_harness"
  || liveAttestation.humanGovernance.decisionStatus !== "ratified_by_human"
  || liveAttestation.humanGovernance.representedActor !== "Project Maintainer"
  || liveAttestation.humanGovernance.stagedDecisionDivergenceCount !== 1
  || liveAttestation.humanGovernance.maintainerOpenQuestionCount !== 6
  || liveAttestation.humanGovernance.projectOpenQuestionCount !== 2
) {
  throw new Error("DeepSeek attestation must distinguish the automated gate transition from the later Human Review and retain every reviewed divergence and question count.");
}
if (
  liveAttestation.humanReview?.reviewer?.type !== "human"
  || liveAttestation.humanReview.reviewer.id !== "project-maintainer"
  || !liveAttestation.humanReview.reviewedAt
  || !liveAttestation.humanReview.statement?.startsWith("批准 DeepSeek 支持记录")
  || !/^[a-f0-9]{64}$/.test(liveAttestation.humanReview.adoptedBriefSha256 ?? "")
  || liveAttestation.humanReview.reviewedReplay !== "recorded-runs/reviewed/deepseek-v4-flash-2026-08-14"
) throw new Error("DeepSeek attestation does not link the explicit Human Review decision and adopted brief.");
const expectedRoles = ["user-side", "maintainer-side", "project"];
if (liveAttestation.runs?.length !== expectedRoles.length || liveAttestation.runs.some((run, index) =>
  run.role !== expectedRoles[index]
  || run.status !== "completed"
  || run.providerCallsUsed !== 1
  || run.toolCallsUsed !== 1
  || run.toolCallEvents !== 1
  || run.maxDurationMs !== 0
)) throw new Error("DeepSeek machine attestation does not prove three complete one-call, no-timeout role runs.");
if (liveAttestation.verifiers?.length !== 5 || liveAttestation.verifiers.some((verifier) => verifier.result !== "pass")) {
  throw new Error("DeepSeek machine attestation must record all five passing Project Verifiers.");
}
const liveChecksums = Object.values(liveAttestation.fullArtifactBundle?.artifacts ?? {});
if (
  liveAttestation.fullArtifactBundle?.bundled !== true
  || liveAttestation.fullArtifactBundle.trackedRelativePath !== "recorded-runs/reviewed/deepseek-v4-flash-2026-08-14/capture"
  || liveAttestation.fullArtifactBundle.checksumAlgorithm !== "SHA-256"
  || liveChecksums.length !== 5
  || liveChecksums.some((value) => !/^[a-f0-9]{64}$/.test(value))
) throw new Error("DeepSeek attestation must bind the five reviewed capture artifacts by SHA-256.");
if (liveAttestation.proposal !== undefined || liveAttestation.assistantMessage !== undefined) {
  throw new Error("Machine attestation must not bundle unreviewed proposal content.");
}

const markdownFiles = [
  "README.md",
  "README.zh-CN.md",
  "article/prototype-1.md",
  "article/prototype-1.zh-CN.md",
  "docs/architecture.md",
  "docs/decisions.md",
  "docs/development-specification.md",
  "docs/limitations.md",
  "docs/live-smoke-template.md",
  "docs/provider-support.md",
  "docs/release-audit.md",
  "docs/security.md",
  "docs/walkthrough.md"
];
for (const relative of markdownFiles) {
  const directory = path.dirname(path.join(root, relative));
  for (const match of read(relative).matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1].trim().replace(/^<|>$/g, "").split("#", 1)[0];
    if (!link || /^(https?:|mailto:)/.test(link)) continue;
    const target = path.resolve(directory, decodeURIComponent(link));
    if (!fs.existsSync(target)) throw new Error(`Broken local Markdown link in ${relative}: ${match[1]}`);
  }
}

process.stdout.write(`Final acceptance evidence verified: all ${checklist.length} checklist items are closed, including Human Review.\n`);
