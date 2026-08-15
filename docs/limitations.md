# Known limitations

1. **No empirical cognitive-load claim.** The knowledge-first view is a design hypothesis. No Maintainer study has established reduced review time or better decisions.
2. **One small reference domain.** Research Brief demonstrates knowledge, sources, preferences, and invariants; it does not establish generality.
3. **Structured virtual implementation.** The Project Agent proposes a typed capability object, not an arbitrary repository patch executed in a production sandbox.
4. **Single proposal turn.** A model turn ends at a structured proposal boundary. The state machine performs approvals, workspace operations, Verifiers, and governance visibly.
5. **One bounded human-reviewed Provider path.** Every Provider driver has deterministic Mock Contract tests. Only the selected DeepSeek V4 Flash/high path has a human-reviewed credentialed replay, and that decision is limited to Prototype reference support. OpenAI and Anthropic are not represented as Live-supported.
6. **Local single-user state.** There is no authentication, database, organization permission model, concurrency control, or durable server history.
7. **Non-cryptographic fixture checksum.** FNV-1a detects accidental drift; it is not a signature or adversarial integrity guarantee.
8. **Privacy scanner is illustrative.** Pattern-based redaction cannot guarantee removal of every personal or proprietary detail.
9. **No production deployment.** Static hosting supports Replay/Scripted only; Live Mode requires the localhost gateway.
10. **No autonomous merge.** The system intentionally has no Agent-accessible public merge or adoption tool.

Out of scope for Prototype 1: token revenue sharing, payment, reinforcement learning, post-training data pipelines, self-modifying Skills, multi-Provider comparison, enterprise identity, and a GitHub replacement.
