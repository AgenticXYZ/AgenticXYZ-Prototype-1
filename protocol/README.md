# AgenticXYZ KPR Protocol 0.1.0

The Knowledge-based Pull Request protocol describes a contribution as reviewable knowledge, intent, evidence, uncertainty, and human decisions. Code can be attached as evidence, but it is not the protocol's primary authority.

The normative experimental schema is [`../schemas/kpr.schema.json`](../schemas/kpr.schema.json).

## Required knowledge boundary

A KPR must state:

- the problem and affected scope;
- expected behavior and acceptance criteria;
- non-goals and protected invariants;
- typed Knowledge Claims;
- source and authorship for every Claim;
- Human Attestation for Agent-extracted user knowledge;
- claim-linked Evidence, failed attempts, and open questions;
- privacy, ownership, and license status;
- an append-only decision record.

Project review adds predicted impact, fine-grained Claim Resolutions, and a Maintainer-approved Knowledge Integration Contract. The Contract is nested inside the KPR; it is not a sixth top-level object.

## Authorship is not authority

The protocol distinguishes:

- Human-authored;
- Agent-extracted;
- Human-corrected;
- Human-attested;
- Verifier-supported;
- Project-inferred;
- Maintainer-decided.

An Agent-extracted statement does not become a user requirement until the Contributor explicitly corrects at least one extracted Claim and then performs a separate attestation. The correction retains before/after provenance. A contributor's local implementation does not become project code. A Project Agent candidate does not become complete until Verifiers pass, and it does not become public until a human adopts it.

## Claim decisions

Maintainers resolve each Claim as `accept`, `modify`, `narrow`, `defer`, `reject`, or `request_evidence`. `defer` and `request_evidence` remain unresolved and block Project synthesis. Accepted, modified, and narrowed knowledge becomes the Contract input; rejected knowledge remains visible.

Each resolution can bind the Claim to registered project Verifiers. Project Policy supplies the mandatory proof floor. An unknown Verifier ID remains an unresolved Contract question and blocks synthesis rather than being treated as executable proof.

## Blind Reconstruction

`localImplementationReference.visibleToProjectAgent` is `false` in the canonical flow. The Project Agent receives the approved Contract and project-owned context, not the contributor patch or private trajectory.

## Compatibility

Version `0.1.0` is experimental. Consumers must reject unsupported major/minor structures rather than silently dropping governance fields. Examples live in [`../recorded-runs/canonical/`](../recorded-runs/canonical/).
