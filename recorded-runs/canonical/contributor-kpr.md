# Optional conclusion-first research briefs

**KPR:** kpr-8230a484-b41b-4624-b5ca-cc7f67c55564<br>
**Status:** contributor_review<br>
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
- **PASS** Sources are preserved: All reference sources remain attached.
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

## Decision record

- **Approved reversible local overlay** — You / Contributor (2026-08-15T03:03:57.355Z)
  - Validate the need before asking the public project to change.
- **Corrected Agent-extracted claim claim-problem** — You / Contributor (2026-08-15T03:03:57.355Z)
  - Changed the Agent wording from “The current brief makes readers traverse context before they see the decision-relevant conclusion.” to “In this Research Brief scenario, the current layout delays the decision-relevant conclusion until after the supporting context.”.
- **Attested the reviewed KPR knowledge** — You / Contributor (2026-08-15T03:03:57.355Z)
  - The Contributor reviewed the Agent extraction, optionally corrected wording that needed revision, and confirmed the selected contribution scope.

## Failed attempts and counterexamples

- A conclusion-only layout was rejected because it hid evidence and violated the source invariant.

## Open questions

- Should the capability remain experimental until more document types are evaluated?

## Provenance

- **human_statement** — Contributor request (2026-08-15T03:03:57.355Z)
- **agent_extraction** — User-side Agent extraction (2026-08-15T03:03:57.355Z)
- **workspace** — Verified local overlay (2026-08-15T03:03:57.355Z)
- **policy** — Research Brief Project Policy (2026-08-15T03:03:57.355Z)

## Knowledge impact analysis

Not generated yet.

## Knowledge Integration Contract

Not approved yet.

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
- License: MIT contribution
- Contributor owns content: yes
