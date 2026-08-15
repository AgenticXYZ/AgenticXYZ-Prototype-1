# Provider support and validation status

| Provider | Driver | Mock contract | Machine Live Smoke | Human-reviewed support | Export/redaction |
|---|---|---:|---:|---:|---:|
| OpenAI | Responses API + function tool | Pass | Pending API-platform credential | Pending | Pass (local fixture only) |
| Anthropic | Messages API + tool use | Pass | Deferred; pending credential | Pending | Pass (local fixture only) |
| DeepSeek | V4 Flash Chat Completions · Thinking/high · strict tool call | Pass | Pass · 2026-08-14 | **Pass · Prototype reference scope** | Pass · reviewed credentialed replay |

Contract tests validate endpoints, server-only authorization headers, assistant text, exactly-one proposal acceptance, arguments, refusal, malformed arguments, rate limits, optional timeout, cancellation, and normalized usage without consuming API credits. OpenAI and Anthropic use Provider-native forced tool selection. DeepSeek Thinking/high exposes one strict role tool without `tool_choice`, as required by the Provider, and the Runtime rejects missing or multiple calls.

The DeepSeek driver projects the canonical role schema into the Provider's documented strict subset at the transport boundary, using `https://api.deepseek.com/beta`. The original application schema is compiled independently and remains authoritative after the response returns. See the official [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/) and [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/) documentation.

Machine Live Smoke means a dated, redacted record covers connection, User-side extraction, all three role-scoped tool calls, an automated exercise of the Maintainer gate state, Project synthesis, Verifier results, and export/redaction. The human-labeled gate actor in the original capture represents the governance slot; it is not itself evidence of a real-person decision. The Project Maintainer subsequently reviewed and approved the bounded record, including one staged Claim-decision divergence, six Maintainer-side questions, two Project Agent questions, and explicit evidence limits. The [machine attestation](../recorded-runs/machine-verification/deepseek-v4-flash-2026-08-14.json) links that decision to the immutable [reviewed credentialed replay](../recorded-runs/reviewed/deepseek-v4-flash-2026-08-14/). This supports the named Prototype reference path only.

Use [`live-smoke-template.md`](live-smoke-template.md) for each Provider.

`npm run smoke:live` creates a redacted, checksummed, importable replay package. `npm run verify:live-smoke -- <directory>` verifies its machine-checkable boundary; a human must still review `review.md` before the support decision changes.

Prototype 1's selected reference path is DeepSeek V4 Flash/high. OpenAI and Anthropic remain Mock-covered configurable drivers; their pending Live rows are future support-expansion gates, not blockers for the selected reference implementation.

## Authentication boundary

A ChatGPT subscription and a Codex CLI login do not provide an API-platform key to this prototype. A successful Codex CLI check may establish that the Codex product channel works, but it does not exercise the OpenAI Responses API driver and does not change any Live column above. Configure a separate server-side `OPENAI_API_KEY` to validate that driver.
