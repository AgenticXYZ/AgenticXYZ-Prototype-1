# Architecture

## System boundary

Prototype 1 is one reference system with three continuous workspaces:

```text
User Workspace
  software knowledge + user knowledge
        ↓ human-attested KPR
KPR Bridge
  person-to-person knowledge collaboration
        ↓ Maintainer-approved Contract
Developer Control Plane
  Project Agent candidate + Verifiers + human adoption
```

The browser contains no long-term Provider secret and no general-purpose execution environment. Live requests go through a localhost Node gateway.

## Components

| Component | Responsibility | Authority boundary |
|---|---|---|
| React Workbench | Progressive disclosure and human gates | Can dispatch only typed state actions |
| Collaboration reducer | Formal KPR and workspace state transitions | Rejects invalid transition preconditions |
| Core objects | Manifest, Policy, Run, Workspace, KPR | Validated against versioned schemas |
| Agentic Software Contract | Published Manifest, Policy, capabilities, state, mutable surfaces, reference data, and Verifier registry | `reference-app/` stays synchronized with the typed runtime through tests |
| Policy module | Role allowlist, R0–R3 risk, approval and budget checks | Agents cannot expand their own tools |
| Provider Gateway | One Provider/model, server-only key, normalized result | Returns proposals, never adopts public state |
| Verifiers | Behavior, scope, sources, defaults, confirmation | Determine completion independently of Agent prose |
| Recorder/Redactor | Export, privacy scan, frozen fixture, checksums | No key, personal path, or private patch in public artifacts |

For the DeepSeek reference path, the Gateway sends `deepseek-v4-flash` with Thinking enabled and `reasoning_effort=high`. It translates the canonical proposal schema into DeepSeek's strict Tool Calls subset for generation, then validates the returned arguments again against the untouched canonical schema. The default wait has no automatic deadline; the visible human cancel action still propagates to the Provider request.

## Role separation

### User-side Agent

Reads the Manifest, Policy, reference document, mutable surfaces, and user request. It can propose a User Overlay. Human approval applies the overlay, and local Verifiers establish evidence.

The KPR draft preserves the Agent extraction as a proposal. The Contributor reviews the relevant Claims and may correct wording when needed before performing a separate Human Attestation; a correction is optional, while the Agent can never attest for the person.

### Maintainer-side Agent

Reads the submitted KPR, Evidence, and Project Policy. It can propose an impact analysis and Claim Resolutions. It cannot approve claims or write a project candidate.

The Maintainer can shape wording, scope, rollout, rationale, and Claim-linked Verifiers. Project Policy still supplies mandatory proof. Unknown Verifier IDs keep the Contract unresolved, so prose cannot create an unimplemented proof mechanism.

### Project Agent

Reads the Project Policy and Maintainer-approved Integration Contract. Blind Reconstruction excludes the contributor patch and private trajectory. It can propose a Project Candidate. It cannot mark the candidate verified or adopt it.

## Runtime sequence

```text
Context Assembly
→ Role and One-Provider Policy
→ Budget Check
→ Provider Structured Proposal
→ JSON Schema Validation
→ Risk and Human Gate
→ Isolated Workspace Candidate
→ Independent Verifiers
→ Human Rollback or Adoption
```

The reference implementation terminates each model turn at a single structured proposal boundary. Human approvals, application tool execution, and Verifiers are explicit state-machine actions rather than hidden autonomous continuation.

### XYZ application interaction layer

The Global XYZ Agent can switch the Workbench into an application-only presentation where the Reference Application stays visible and the surrounding navigation, explanatory header, and side Agent panel are removed. The XYZ Agent then exposes the next canonical reducer action inside its own panel. This is not a second workflow: it reads and changes the same Workspace, KPR, Contract, Run, Verifier, and adoption state used by the full Workbench.

The Guide may expose a human-gate button, but it cannot click that button, infer consent, or continue across it. Its opt-in attention pointer is rendered outside the target with `pointer-events: none`; it is removed when the Guide closes, the governed step changes, or the view mode changes.

### Role-bound Skills

`SkillDefinition` is a versioned workflow boundary rather than an additional core object. The registry includes `adapt_software_locally`, `describe_to_kpr`, `understand_kpr`, `analyze_knowledge_impact`, `draft_integration_contract`, `implement_from_contract`, and `verify_candidate`. Each definition declares its role, purpose, structured input/output boundary, allowed tools, required human gates, required Verifiers, and budget. Every `AgentRun` records the active Skill ID, and the Runtime rejects a proposal tool that the active Skill does not allow.

The Live model turns use one default orchestration Skill per role. Other registered Skills describe explicit application-mediated stages of the same governed journey; they do not create hidden autonomous loops or enlarge an Agent's authority.

## Context / Policy / Action / Proof / Memory

Every `AgentRun` can be inspected through five projections:

- **Context:** what the role could see and what was excluded.
- **Policy:** allow, deny, approval, risk, and budget outcomes.
- **Action:** the structured proposal and workspace operation.
- **Proof:** schema, policy, usage, and Verifier evidence.
- **Memory:** checkpoints and governed decisions that persist.

Memory excludes hidden model reasoning. Only scoped, sourced, governed state persists.

## Static and local deployment

The production Vite build is a static Replay/Scripted workbench suitable for GitHub Pages. `npm run dev` or `npm start` adds the local gateway required for Live Mode. Static hosting never accepts API keys.
