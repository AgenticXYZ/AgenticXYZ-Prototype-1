# Optional conclusion-first research briefs

**KPR:** kpr-5786219c-c2a8-4c0f-8e3c-4f5dd952ffed<br>
**Status:** verification_passed<br>
**Schema:** 0.1.0

## Decision brief

Research Brief readers may need the conclusion before the supporting context.

## Expected behavior

- Users can opt into a conclusion-first layout.
- Evidence and source links remain visible.
- The preference is saved only after explicit confirmation.

## Acceptance criteria

- Conclusion renders before evidence when the option is enabled.
- All source links remain attached.
- The existing public default remains unchanged.
- Removing the option restores reference behavior.

## Knowledge claims

- **problem** — In this Research Brief scenario, the current layout delays the decision-relevant conclusion until after the supporting context.
  - Source: Agent-extracted, human-corrected, human-attested
  - Evidence: evidence-layout-order
- **expected_behavior** — A reader can choose a conclusion-first layout with supporting evidence immediately after it.
  - Source: Agent-extracted, human-attested
  - Evidence: evidence-layout-order
- **constraint** — Changing the layout must not remove evidence or source links.
  - Source: Agent-extracted, human-attested
  - Evidence: evidence-source-preservation
- **intent** — Remember the conclusion-first layout after the user explicitly confirms it.
  - Source: Agent-extracted, human-attested
  - Evidence: evidence-reversible-overlay
- **decision** — Prove the behavior in a reversible User Overlay before proposing a public capability.
  - Source: Agent-extracted, human-attested
  - Evidence: evidence-public-core, evidence-reversible-overlay
- **invariant** — Every conclusion remains linked to visible supporting evidence and sources.
  - Source: Agent-extracted, human-attested
  - Evidence: evidence-source-preservation
- **open_question** — Should the project offer conclusion-first summaries as an optional public capability?
  - Source: Agent-extracted, human-attested
  - Evidence: evidence-layout-order, evidence-source-preservation

## Evidence

- **PASS** Conclusion appears before evidence: Rendered section order begins with the conclusion and keeps evidence after it.
  - Produced by: Verifier
  - Supports: claim-problem, claim-expected-order, claim-public-capability
  - Cannot prove: This bounded Verifier does not establish general user benefit, production safety, or lower Maintainer workload.
  - Replayable: yes
  - Human confirmed: no — Verifier-produced evidence remains subject to review
  - Handling: Reference-application evidence; eligible for public export only after the KPR privacy scan passes.
- **PASS** Sources are preserved: All 3 reference sources remain attached.
  - Produced by: Verifier
  - Supports: claim-preserve-sources, claim-invariant-sources, claim-public-capability
  - Cannot prove: This bounded Verifier does not establish general user benefit, production safety, or lower Maintainer workload.
  - Replayable: yes
  - Human confirmed: no — Verifier-produced evidence remains subject to review
  - Handling: Reference-application evidence; eligible for public export only after the KPR privacy scan passes.
- **PASS** Public core remains unchanged: The proposed change is isolated to the User Realization layer.
  - Produced by: Verifier
  - Supports: claim-local-first
  - Cannot prove: This bounded Verifier does not establish general user benefit, production safety, or lower Maintainer workload.
  - Replayable: yes
  - Human confirmed: no — Verifier-produced evidence remains subject to review
  - Handling: Reference-application evidence; eligible for public export only after the KPR privacy scan passes.
- **PASS** Overlay is reversible: A checkpoint exists and removing the overlay restores the reference behavior.
  - Produced by: Verifier
  - Supports: claim-local-first, claim-remember-preference
  - Cannot prove: This bounded Verifier does not establish general user benefit, production safety, or lower Maintainer workload.
  - Replayable: yes
  - Human confirmed: no — Verifier-produced evidence remains subject to review
  - Handling: Reference-application evidence; eligible for public export only after the KPR privacy scan passes.
- **PASS** Public default remains unchanged: The capability is opt-in.
  - Produced by: Verifier
  - Supports: claim-public-capability
  - Cannot prove: This bounded Verifier does not establish general user benefit, production safety, or lower Maintainer workload.
  - Replayable: yes
  - Human confirmed: no — Verifier-produced evidence remains subject to review
  - Handling: Reference-application evidence; eligible for public export only after the KPR privacy scan passes.
- **PASS** Source invariant: Sources remain visible in the candidate behavior.
  - Produced by: Verifier
  - Supports: claim-invariant-sources
  - Cannot prove: This bounded Verifier does not establish general user benefit, production safety, or lower Maintainer workload.
  - Replayable: yes
  - Human confirmed: no — Verifier-produced evidence remains subject to review
  - Handling: Reference-application evidence; eligible for public export only after the KPR privacy scan passes.
- **PASS** Scope is narrow: The feature applies only to Research Brief documents.
  - Produced by: Verifier
  - Supports: claim-public-capability
  - Cannot prove: This bounded Verifier does not establish general user benefit, production safety, or lower Maintainer workload.
  - Replayable: yes
  - Human confirmed: no — Verifier-produced evidence remains subject to review
  - Handling: Reference-application evidence; eligible for public export only after the KPR privacy scan passes.
- **PASS** Preference requires confirmation: Preference is saved only after user confirmation.
  - Produced by: Verifier
  - Supports: claim-remember-preference
  - Cannot prove: This bounded Verifier does not establish general user benefit, production safety, or lower Maintainer workload.
  - Replayable: yes
  - Human confirmed: no — Verifier-produced evidence remains subject to review
  - Handling: Reference-application evidence; eligible for public export only after the KPR privacy scan passes.
- **PASS** Unsupported conclusion guard: Every conclusion block must retain at least one linked evidence item.
  - Produced by: Verifier
  - Supports: claim-invariant-sources
  - Cannot prove: This bounded Verifier does not establish general user benefit, production safety, or lower Maintainer workload.
  - Replayable: yes
  - Human confirmed: no — Verifier-produced evidence remains subject to review
  - Handling: Reference-application evidence; eligible for public export only after the KPR privacy scan passes.

## Decision record

- **Approved reversible local overlay** — You / Contributor (2026-08-14T08:57:03.614Z)
  - Validate the need before asking the public project to change.
- **Corrected Agent-extracted claim claim-problem** — You / Contributor (2026-08-14T08:57:03.614Z)
  - Changed the Agent wording from “The current brief makes readers traverse context before they see the decision-relevant conclusion.” to “In this Research Brief scenario, the current layout delays the decision-relevant conclusion until after the supporting context.”.
- **Attested the reviewed KPR knowledge** — You / Contributor (2026-08-14T08:57:03.614Z)
  - The Contributor reviewed the Agent extraction, corrected its wording, and confirmed the selected contribution scope.
- **Approved claim resolutions and Knowledge Integration Contract** — Project Maintainer (2026-08-14T08:58:40.371Z)
  - The Maintainer reviewed Agent suggestions, set the public scope, and retained final synthesis authority.

## Failed attempts and counterexamples

- A conclusion-only layout was rejected because it hid evidence and violated the source invariant.

## Open questions

- Should the capability remain experimental until more document types are evaluated?

## Provenance

- **human_statement** — Contributor request (2026-08-14T08:57:03.614Z)
- **agent_extraction** — User-side Agent extraction (2026-08-14T08:57:03.614Z)
- **workspace** — Verified local overlay (2026-08-14T08:57:03.614Z)
- **policy** — Research Brief Project Policy (2026-08-14T08:57:03.614Z)

## Knowledge impact analysis

- **product_behavior / policy-required** — Public default remains unchanged: The contributor-attested expected behavior and the KPR nonGoals require conclusion-first to be an opt-in per-user choice; defaultBehavior.conclusionFirst stays false. No accepted claim proposes changing the public default. claim-public-capability is explicitly an open_question left to the Maintainer (R3).
  - Confidence: high; scopes: summary-layout, public-product, user-preference
  - Human decision: not required; additional evidence: not required
- **interface / explicit** — Change confined to the summary-layout surface: The reversible overlay reorders sections within summary-layout (mutable, userLocal, reversible). The protected theme surface and reference core are untouched; evidence-public-core confirms layer isolation (user_overlay, referenceChecksum fnv1a-76b6d301).
  - Confidence: high; scopes: summary-layout, theme
  - Human decision: not required; additional evidence: not required
- **permissions_privacy / policy-required** — Preference memory stays local and confirmation-gated: claim-remember-preference touches preference-memory (userLocal, contributable, reversible). Policy: private preferences are never submitted automatically (privacy-private-overlay); savePreference defaults to false; the configure_summary_layout contract requires Contributor approval before writing and lists 'preference saved without confirmation' as a failure mode. Privacy scan passed with no findings.
  - Confidence: high; scopes: preference-memory, user-preference
  - Human decision: not required; additional evidence: not required
- **data_provenance / explicit** — Evidence is machine-generated, replayable, and reference-scoped: All four verifier results pass but are humanConfirmed:false; each cannotProve note states it does not establish general user benefit, production safety, or lower Maintainer workload. claim-problem wording was corrected by the contributor, narrowing it to the Research Brief reference scenario. Evidence handling permits public export after the privacy scan, which has passed.
  - Confidence: high; scopes: research-brief, summary-layout
  - Human decision: not required; additional evidence: not required
- **verification / policy-required** — Knowledge gate satisfied; project-candidate gates remain outstanding: human-attestation and privacy-scan are satisfied for the knowledge gate. Any future public capability derived from this KPR must pass the project-candidate verifier set (project-default-stability, project-source-preservation, project-scope-boundary, project-confirmation, project-unsupported-conclusion) plus R3 Maintainer adoption.
  - Confidence: high; scopes: public-product, contribution, research-brief
  - Human decision: required; additional evidence: required
- **rollout_rollback / explicit** — Local-first reversible rollout with R1→R2→R3 gates: claim-local-first prescribes proving behavior in a reversible User Overlay before any public proposal. A rollback checkpoint (checkpoint-user-before-overlay) exists and evidence-reversible-overlay passes. Approval rules: R1 contributor overlay, R2 Maintainer integration contract, R3 Maintainer public adoption. Blind reconstruction keeps local code out of the project.
  - Confidence: high; scopes: user-realization, contribution, public-product
  - Human decision: not required; additional evidence: not required
- **verification / agent-inferred** — Explicit-confirmation-before-save gate has no dedicated verifier: Agent-inferred observation: claim-remember-preference requires the preference to be saved only after explicit confirmation, and the capability failure mode names 'preference saved without confirmation' — but no verifierId in the manifest specifically proves the confirmation-before-save flow. evidence-reversible-overlay demonstrates reversibility, not the confirmation gate. The Maintainer may wish to require a dedicated verifier or a manual confirmation step at implementation.
  - Confidence: medium; scopes: preference-memory, user-preference
  - Human decision: required; additional evidence: required
- **data_provenance / agent-inferred** — Problem claim rests on indirect evidence: Agent-inferred observation: evidence-layout-order demonstrates the overlay renders the conclusion first (conclusionFirst: true), which supports claim-expected-order; it does not directly measure default-layout reader impact. The problem claim is safe because the contributor narrowed it to 'In this Research Brief scenario'. No additional evidence is strictly required for the scenario-scoped claim, but the contract should preserve that scoping.
  - Confidence: medium; scopes: research-brief, summary-layout
  - Human decision: not required; additional evidence: not required
- **compatibility / explicit** — Non-Research-Brief applications are out of scope: KPR nonGoals state no changes to non-Research-Brief applications; claim-problem and claim-expected-order are scoped to research-brief/summary-layout. A project-scope-boundary verification should enforce this boundary in any candidate derived from this KPR.
  - Confidence: high; scopes: research-brief, summary-layout
  - Human decision: not required; additional evidence: not required
- **user_preference / agent-inferred** — Preference persistence: Persists only after explicit confirmation and remains removable.
  - Confidence: medium; scopes: preference-memory
  - Human decision: required; additional evidence: required
- **performance_cost / agent-inferred** — Rendering and Agent-call cost: The local layout change is bounded; any Live Agent analysis remains within the configured call and token budgets.
  - Confidence: medium; scopes: render-brief, agent-runtime-budget
  - Human decision: not required; additional evidence: not required
- **documentation / policy-required** — Explain opt-in behavior and reset: User and maintainer documentation must state the default, confirmation boundary, and rollback path.
  - Confidence: high; scopes: settings-help, contribution-guide
  - Human decision: not required; additional evidence: required

## Knowledge Integration Contract

- Approved by: Project Maintainer at 2026-08-14T08:58:40.371Z
- Accepted knowledge:
  - **accept** In this Research Brief scenario, the current layout delays the decision-relevant conclusion until after the supporting context. — scopes: research-brief, summary-layout
  - **accept** A reader can choose a conclusion-first layout with supporting evidence immediately after it. — scopes: research-brief, summary-layout
  - **accept** Changing the layout must not remove evidence or source links. — scopes: research-brief, sources
  - **accept** Remember the conclusion-first layout after the user explicitly confirms it. — scopes: user-preference
  - **accept** Prove the behavior in a reversible User Overlay before proposing a public capability. — scopes: user-realization, contribution
  - **accept** Every conclusion remains linked to visible supporting evidence and sources. — scopes: public-core, sources
  - **narrow** Offer conclusion-first summaries as an experimental, opt-in capability for Research Brief documents only. — scopes: research-brief, experimental-settings
- Rejected knowledge:
  - None
- Implementation boundary:
  - Research Brief documents only
  - Opt-in setting; public default unchanged
  - Preference saved only after confirmation
  - Contributor patch remains hidden from Project Agent
- Required Verifiers: project-default-stability, project-source-preservation, project-scope-boundary, project-confirmation, project-unsupported-conclusion
- Unresolved questions: none

## Protected invariants

- Source links remain visible and attached to evidence.
- The public default does not change without Maintainer approval.
- Private preferences are not submitted automatically.
- Project Agent completion requires verifier evidence.
- Final public adoption belongs to the Maintainer.

## Non-goals

- Do not make conclusion-first the public default.
- Do not change non-Research-Brief applications.
- Do not adopt the contributor's local code directly.

## Human attestation

I confirm that these claims accurately represent my request and local verification. I reviewed the submission scope and excluded private information.

## Contributor implementation boundary

The local implementation reference is intentionally omitted from this Markdown export. It remains evidence, not Project Agent authority.

## Privacy and license

- Scan: pass
- License: Apache-2.0 contribution
- Contributor owns content: yes
