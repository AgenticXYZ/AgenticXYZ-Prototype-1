# Canonical reference fixture

This directory is a frozen, redacted, deterministic **E1 reference fixture** for the article, static demo, and CI. It exercises the same five core objects, role boundaries, KPR state machine, Contract, Project candidate, and Verifiers as Live Mode.

It is not represented as a credentialed live-provider result. The selected DeepSeek reference path has a separate [machine-verification attestation](../machine-verification/deepseek-v4-flash-2026-08-14.json) and [human-reviewed credentialed replay](../reviewed/deepseek-v4-flash-2026-08-14/). This deterministic fixture remains available for article rendering, no-key use, and CI without being confused with the credentialed evidence track.

Run `npm run check:replay` to verify artifact integrity and redaction. The FNV checksum detects accidental fixture drift; it is not a cryptographic signature.
