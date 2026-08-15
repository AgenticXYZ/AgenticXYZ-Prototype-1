# Live Smoke Record — `<provider>`

- Date:
- Reviewer:
- Provider/model:
- Provider options (for DeepSeek: Thinking, reasoning effort, strict Tool Calls):
- Commit:
- Environment notes (no secrets):

| Check | Result | Redacted artifact |
|---|---|---|
| Connection | Pending | |
| User-side Claim Extraction | Pending | |
| Structured Tool Call | Pending | |
| Maintainer gate transition (automated harness) | Pending | |
| Project Agent Synthesis | Pending | |
| Verifier Result | Pending | |
| Export and Redaction | Pending | |

Confirm that no key, authorization header, personal path, private trajectory, or contributor patch entered the public artifact. A human-labeled actor produced by the harness proves the governance slot and state transition only; it is not a Human Review decision.

Classify every Project Agent open question as one of: blocking Contract gap, non-blocking implementation clarification, or future improvement. A verifier result must not silently answer a blocking knowledge question.

The recorder writes `live-smoke.json`, public `kpr.json` / `kpr.md`, an importable `replay-state.json`, `review.md`, and `checksums.json`. Before human review, run:

```bash
npm run verify:live-smoke -- live-smoke/<provider>/<timestamp>
```

Import `replay-state.json` from the Workbench project menu and confirm that it opens as **Recorded Replay**. Machine verification never changes the Human Review decision or Provider support matrix automatically.

After a person explicitly reviews the staged Claim decisions, every Maintainer-side and Project Agent question, the Verifier results, privacy boundary, and support scope, record that decision separately and freeze it without rewriting the original capture:

```bash
npm run freeze:reviewed-replay -- \
  live-smoke/<provider>/<timestamp> \
  live-smoke/<provider>/<timestamp>/human-review-decision.json
npm run check:reviewed-replay
```
