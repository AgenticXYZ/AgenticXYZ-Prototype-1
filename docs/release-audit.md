# AgenticXYZ Prototype 1 Release Audit

Audit date: 2026-08-14 UTC / PDT\
Specification: `docs/development-specification.md`\
Package version: `1.0.0-rc.1`

## Release classification

| Release boundary | Status | Meaning |
|---|---|---|
| Open-source implementation baseline | **Ready** | Replay and Scripted modes, the complete governed flow, failure branches, documentation, article assets, and local Provider gateway are implemented and independently verified. |
| Formal `v1.0.0-rc.1` gate | **Satisfied** | The selected DeepSeek V4 Flash/high path passed the machine boundary and received explicit Human Review. The immutable capture, adopted review brief, Claim decisions, question resolutions, and evidence limits are frozen as a reviewed credentialed replay. OpenAI and Anthropic remain accurately labeled Mock-only. No credential is committed. |

This Provider distinction is intentional. A complete interface and passing Mock contracts do not constitute Live-support evidence for OpenAI or Anthropic, and the reviewed DeepSeek record does not imply production readiness.

### Supplemental Codex channel check

On 2026-08-14 PDT, the locally installed Codex CLI (`0.147.0`) reported **Logged in using ChatGPT** and an ephemeral, read-only call using `gpt-5.6-terra` returned the exact requested sentinel. This establishes that the user's ChatGPT-authenticated Codex channel is usable. It is deliberately outside the Provider validation matrix: no API-platform key was supplied, the prototype's Responses API driver was not exercised, and no Live Agent artifact was created.

## Evidence levels

- **E1 — System Hypothesis:** Agent-centered software may strengthen knowledge collaboration between people while humans retain intent, judgment, responsibility, and final governance.
- **E2 — Prototype Evidence:** this implementation demonstrates bounded role-specific proposals, human gates, policy enforcement, reversible workspaces, Knowledge-based Pull Requests, Contract-based Blind Reconstruction, verifier-driven completion, audit events, export, and deterministic replay.
- **Not established:** lower Maintainer cognitive load, better contribution quality in real projects, production security, generality across software domains, or improved organizational outcomes.

The bundled canonical replay is an E1 reference fixture shaped like a Provider run. It remains separate from the human-reviewed DeepSeek credentialed replay.

## Specification acceptance matrix

### Concept

| Requirement | Result | Evidence |
|---|---|---|
| X / Crossing, Agents with People, Human in the Loop remain consistent | Pass | Header, README, both articles, and Decision Record use the locked language. |
| Three system parts and five core objects are legible | Pass | README, Architecture, Workbench navigation, Runtime Inspector, and JSON Schemas. |
| User-side, Maintainer-side, and Project Agent authority remains separate | Pass | Role-scoped prompts, tool schemas, context assembly, UI copy, and Runtime tests. |
| Agent First does not imply Agent governance | Pass | Public adoption remains an explicit Maintainer action; Agents produce proposals only. |

### Run

| Requirement | Result | Evidence |
|---|---|---|
| No key required for Replay or Scripted | Pass | Both modes execute the complete flow in browser tests and the static build. |
| Live mode with a server-side key | Pass for reviewed DeepSeek reference path | Local gateway, health endpoint, cancellation, three drivers, and a machine-verified `deepseek-v4-flash` Thinking/high three-role record bound to an explicit Human Review decision. |
| One active Provider and model | Pass | Environment configuration and Runtime precondition enforce an exact match. |
| Provider validation records | Pass for selected release scope | All three drivers pass Mock Contracts. The selected DeepSeek reference path has a dated, redacted, checksummed, human-reviewed credentialed replay. OpenAI and Anthropic are accurately marked Mock-only. |
| One-command local start | Pass | `npm run dev` starts gateway and web application together. |
| Guided Flow fits the intended short walkthrough | Pass for the bounded demo | The canonical journey is automated end to end and the recorded overview is about 17 seconds; no external usability or cognitive-load claim is made. |

### Agentic Software

| Requirement | Result | Evidence |
|---|---|---|
| Manifest, Policy, Capabilities, and Mutable Surfaces are readable by Agents | Pass | Typed core objects, JSON Schemas, role-scoped request context, and Agent-friendly contract UI. |
| User Overlay is separate from the public core | Pass | Structured virtual workspaces and protected-core checks. |
| Change can be previewed, verified, undone, and restored | Pass | Local preview, checkpoint, four Verifiers, rollback, and Restore Default flow. |
| Private knowledge is not automatically contributed | Pass | Contributable scope, Human Attestation, privacy scan, and Knowledge Gate. |

### Knowledge-based Pull Request

| Requirement | Result | Evidence |
|---|---|---|
| JSON and Markdown export | Pass | Redacted exporters and canonical artifacts. |
| Human-authored, Agent-extracted, Human-corrected, and Human-attested knowledge are distinct | Pass | Claim source, explicit Contributor correction, before/after provenance, and separate per-claim attestation. |
| Developer Workspace is knowledge-first | Pass | Decision Brief, Claim cards, provenance, evidence, and impact precede implementation detail. |
| Knowledge Diff, Provenance, Evidence, and Impact are visible | Pass | KPR Bridge and Developer Control Plane. |
| Maintainer can shape each Claim | Pass | Decision, wording, scope, rollout, rationale, and Claim-linked registered Verifiers; unknown proof IDs block synthesis. |
| Integration Contract is readable and executable | Pass | Human-approved Contract feeds the Project role and its Verifiers. |
| Blind Reconstruction is the default | Pass | Project request excludes contributor patch and private trajectory; tests assert the boundary. |

### Agentic Runtime

| Requirement | Result | Evidence |
|---|---|---|
| Model behavior is restricted to controlled tools | Pass | A result is accepted only with exactly one role-specific structured proposal call; OpenAI/Anthropic force selection natively, while DeepSeek Thinking/high exposes one strict tool and Runtime-rejects zero/multiple calls. The active Skill, canonical schema, privacy scan, gates, Verifiers, and budgets remain authoritative. |
| Policy and permissions change behavior | Pass | Role allowlists, R0–R3 policy, human-approval checks, input/call/tool/time budgets, and conflict paths. |
| Verifiers determine completion | Pass | Generation alone never marks local or project work verified. |
| Budget, optional timeout, cancel, checkpoint, and rollback work | Pass | Call/token limits, a tested non-zero optional timeout, default human-cancelled wait, propagated AbortSignal, state checkpoints, and both rollback paths. |
| Failure, refusal, escalation, rejection, and rollback are visible | Pass | Runtime events, explicit status, notifications, failure lab, and governed state transitions. |
| AgentRun excludes secrets and hidden reasoning | Pass | Server-only keys, scoped events, redacted exports, security scan, and no reasoning field. |

### Evidence

| Requirement | Result | Evidence |
|---|---|---|
| Run records can be redacted, frozen, and replayed | Pass | The DeepSeek Machine Live Smoke produced privacy-scanned artifacts, checksums, a clean source revision, and an importable Replay state with contributor implementation and credential state removed. The original pending capture remains immutable. A separate Human Review layer records the Maintainer's approval, the adopted brief, seven Claim decisions, six Maintainer-side question resolutions, two Project question resolutions, and bounded support scope. Package-level SHA-256 binds the complete reviewed replay. |
| Canonical Run has checksums | Pass | Eight frozen artifacts are checked deterministically. |
| Article screenshots are generated automatically | Pass | Ten deterministic canonical screenshots with checksums. |
| Critical claims distinguish E1 and E2 | Pass | README and both articles state the evidence boundary. |
| Limitations and non-goals are explicit | Pass | README and `docs/limitations.md`. |

### Quality

| Requirement | Result | Evidence |
|---|---|---|
| Unit, Provider Contract, E2E, Visual, and Security tests | Pass | `npm run release:audit`. |
| No browser console errors | Pass | Automated browser assertion and manual static-build inspection. |
| No material clipping at required viewports | Pass | 1440, 1280, 390, and 320 pixel browser checks. |
| Keyboard can enter and operate the main journey | Pass | Keyboard entry and semantic control test. |
| State is not expressed by color alone | Pass | Text labels, status badges, headings, and ARIA semantics. |
| Repository contains no key, personal path, or unlicensed borrowed material | Pass in automated scan and source review | Repository scanner, server-only secret design, original assets, MIT License. |

## Verified test record

The current local release audit covers:

- 71 Unit, Runtime, prompt-boundary, evidence-boundary, reviewed-replay, artifact-verification, Schema, and Provider Contract tests;
- 29 browser tests across success, failure, import security, accessibility, keyboard operation, responsive paths, nested XYZ Agent flows, localization, and deterministic bilingual screenshot generation;
- twenty generated 1920 × 1080 canonical screenshots—ten English and ten Simplified Chinese—and their checksums;
- three consecutive canonical screenshot generations with identical SHA-256 values after deterministic raster controls;
- eight canonical replay artifacts and their checksums;
- one human-reviewed credentialed replay containing an immutable six-file capture plus a separate decision record, approved review sheet, adopted brief, manifest, and SHA-256 package checksums;
- TypeScript checking for browser and server code;
- a production build;
- a dependency vulnerability audit;
- secret and personal-path scanning;
- installation and the full audit from a fresh directory using `npm ci`.

## Public archive boundary

The public source archive is built from the audited working tree and deliberately excludes `.git`, local environment files, `node_modules`, production build output, Playwright traces and reports, logs, raw `live-smoke` output, and other machine-local artifacts. `.env.example` remains as the credential-free configuration template.

The deterministic canonical replay and the human-reviewed DeepSeek replay remain included because their privacy scans and checksums pass. Their evidence boundary remains `approved_for_prototype_reference`; the archive contains no unreviewed raw Provider response, API key, authorization header, hidden reasoning, browser storage, or local absolute path.

## Formal release gate closure

Every Prototype 1 release gate is closed for `v1.0.0-rc.1`:

1. The DeepSeek V4 Flash/high capture passed machine verification from a clean source revision.
2. The Project Maintainer explicitly approved the support record and adopted the review brief's Claim decisions, question classifications, and evidence boundaries.
3. The original pending capture and the later Human Review decision are frozen as separate, checksummed layers in the reviewed credentialed replay.
4. The deterministic E1 fixture remains available for no-key use and CI.

OpenAI and Anthropic Live Smokes are optional future support-expansion gates. Neither may be presented as Live-supported without its own reviewed record.

Never commit `.env.local`, a key, an authorization header, or unreviewed raw Provider output.

## Release decision

**Publishable and taggable now:** source repository, article companion, deterministic E1 replay, and bounded human-reviewed DeepSeek evidence as AgenticXYZ Prototype 1 `v1.0.0-rc.1`.

**Still do not claim:** production readiness, validated Live support for OpenAI or Anthropic, reduced cognitive load, or real-project outcome improvement.
