import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { verifyLiveSmoke } from "./verify-live-smoke";
import { scanText } from "../src/core/privacy";

type JsonRecord = Record<string, unknown>;

function readJson(file: string): JsonRecord {
  return JSON.parse(fs.readFileSync(file, "utf8")) as JsonRecord;
}

function sha256(contents: string | Buffer): string {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

function filesUnder(directory: string, prefix = ""): string[] {
  return fs.readdirSync(path.join(directory, prefix), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".DS_Store") return [];
    const relative = path.join(prefix, entry.name);
    return entry.isDirectory() ? filesUnder(directory, relative) : [relative];
  }).sort();
}

export function checkReviewedReplay(input: string): string {
  const directory = path.resolve(process.cwd(), input);
  const required = [
    "manifest.json", "review-decision.json", "review.md", "agent-review-brief.zh-CN.md", "checksums.json",
    "capture/live-smoke.json", "capture/kpr.json", "capture/kpr.md", "capture/replay-state.json", "capture/review.md", "capture/checksums.json"
  ];
  for (const relative of required) {
    if (!fs.existsSync(path.join(directory, relative))) throw new Error(`Missing reviewed replay artifact: ${relative}`);
  }

  const checksumManifest = readJson(path.join(directory, "checksums.json"));
  const expectedChecksums = checksumManifest.artifacts as Record<string, string> | undefined;
  if (checksumManifest.algorithm !== "SHA-256") throw new Error("Reviewed replay must use SHA-256.");
  const artifacts = filesUnder(directory).filter((name) => name !== "checksums.json");
  if (Object.keys(expectedChecksums ?? {}).length !== artifacts.length) throw new Error("Reviewed replay checksum set is incomplete.");
  for (const relative of artifacts) {
    const target = path.join(directory, relative);
    const contents = fs.readFileSync(target);
    if (expectedChecksums?.[relative] !== sha256(contents)) throw new Error(`Reviewed replay checksum mismatch: ${relative}`);
    if (scanText(contents.toString("utf8")).status !== "pass") throw new Error(`Reviewed replay privacy scan failed: ${relative}`);
  }

  verifyLiveSmoke(path.join(directory, "capture"));
  const manifest = readJson(path.join(directory, "manifest.json"));
  const decision = readJson(path.join(directory, "review-decision.json"));
  const review = manifest.review as JsonRecord | undefined;
  const reviewer = decision.reviewer as JsonRecord | undefined;
  if (
    manifest.recordType !== "human-reviewed-credentialed-replay"
    || manifest.reviewStatus !== "approved"
    || manifest.supportDecision !== "approved_for_prototype_reference"
    || manifest.provider !== "deepseek"
    || manifest.model !== "deepseek-v4-flash"
    || decision.decision !== "approved"
    || reviewer?.type !== "human"
    || review?.statement !== decision.statement
  ) throw new Error("Reviewed replay does not preserve an attributable, bounded Human Review decision.");

  const brief = decision.adoptedBrief as JsonRecord | undefined;
  const briefName = String(brief?.file ?? "");
  if (!briefName || brief?.sha256 !== sha256(fs.readFileSync(path.join(directory, briefName)))) {
    throw new Error("Reviewed replay does not bind the Human-adopted Agent review brief.");
  }
  const claims = decision.claimDecisions as Array<{ claimId?: string; decision?: string }> | undefined;
  const maintainerQuestions = decision.maintainerQuestionResolutions as Array<{ index?: number; classification?: string }> | undefined;
  const projectQuestions = decision.projectQuestionResolutions as Array<{ index?: number; classification?: string }> | undefined;
  if (claims?.length !== 7 || maintainerQuestions?.length !== 6 || projectQuestions?.length !== 2) {
    throw new Error("Reviewed replay does not resolve every staged Claim decision and open question.");
  }
  const expectedClaims = [
    ["claim-problem", "accept"], ["claim-expected-order", "accept"], ["claim-preserve-sources", "accept"],
    ["claim-remember-preference", "accept"], ["claim-local-first", "accept"], ["claim-invariant-sources", "accept"],
    ["claim-public-capability", "narrow"]
  ];
  if (claims.some((claim, index) => claim.claimId !== expectedClaims[index][0] || claim.decision !== expectedClaims[index][1])) {
    throw new Error("Reviewed replay Claim decisions differ from the Human-adopted review brief.");
  }
  const expectedMaintainerClassifications = [
    "resolved_by_contract_and_verifier", "ratified_narrow", "accepted_for_prototype_e2_only", "required_and_passed",
    "machine_reexecuted_human_reviewed_not_human_executed", "non_blocking_documentation_clarification"
  ];
  if (maintainerQuestions.some((question, index) => question.index !== index + 1 || question.classification !== expectedMaintainerClassifications[index])) {
    throw new Error("Reviewed replay Maintainer-side question resolutions differ from the Human decision.");
  }
  const expectedProjectClassifications = ["non_blocking_implementation_clarification", "non_blocking_governance_reminder"];
  if (projectQuestions.some((question, index) => question.index !== index + 1 || question.classification !== expectedProjectClassifications[index])) {
    throw new Error("Reviewed replay Project question resolutions differ from the Human decision.");
  }
  const reviewMarkdown = fs.readFileSync(path.join(directory, "review.md"), "utf8");
  if (!reviewMarkdown.includes("Decision: **Approved") || reviewMarkdown.includes("- [ ]")) {
    throw new Error("Reviewed replay Markdown does not record a completed approval checklist.");
  }
  return "Human-reviewed DeepSeek credentialed replay verified.";
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
  const input = process.argv[2] ?? "recorded-runs/reviewed/deepseek-v4-flash-2026-08-14";
  process.stdout.write(`${checkReviewedReplay(input)}\n`);
}
