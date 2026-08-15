# Human-reviewed credentialed replays

This directory contains credentialed Provider runs that passed the machine boundary and then received an explicit Human Review decision.

Each package keeps the original pending capture immutable under `capture/`, records the later human decision separately, includes the adopted Agent-prepared review brief, and binds every public artifact with SHA-256. Approval is scoped to the named Prototype reference path; it is not a production-readiness or general-outcome claim.

Run `npm run check:reviewed-replay` to verify the package, its privacy boundary, the original capture checksums, the reviewer decision, every resolved Claim/question, and the importable Recorded Replay state.
