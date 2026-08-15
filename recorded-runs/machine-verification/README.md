# Credentialed machine-verification attestations

This directory contains metadata-only attestations for credentialed Provider runs. An attestation records the selected Provider/model/options, clean source revision, bounded run metadata, independent Verifier results, and cryptographic checksums of the local redacted artifact bundle.

It deliberately excludes proposal text, KPR contents, private trajectories, credentials, authorization headers, and any unreviewed replay payload. The Live Smoke harness may exercise a human-labeled gate transition to test the complete state machine, but that transition remains recorded as `automated_test_harness`. When a person later reviews the bound capture, the attestation links to a separate immutable Human Review decision and reviewed replay rather than rewriting the original machine evidence.

The deterministic E1 fixture remains in [`../canonical`](../canonical). Run `npm run check:acceptance` to validate the tracked attestation boundary.
