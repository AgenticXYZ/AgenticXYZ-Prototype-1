# Security model

## Scope

This is a conceptual prototype, not a production security boundary. It demonstrates controls that a Human–Agent-Native system should expose; it does not provide a hardened multi-tenant sandbox.

## Secret handling

- Provider keys may be read from environment variables or sent once from the settings form to the localhost Node process for connection verification.
- A key entered in the page remains only in the password field until submission. After a successful check it is cleared from the page and retained only in Gateway process memory; restarting the Gateway clears it.
- The browser receives Provider availability, never the key value.
- Browser persistence is redacted before writing.
- KPR, project-state, replay, trace, and article exports pass secret and personal-path redaction.
- CI scans the repository for key-like material, private-key markers, bearer values, and personal absolute paths.

## Authority controls

- A Provider result is accepted only when it contains exactly one role-specific JSON Schema proposal call.
- Unknown and cross-role tools are denied.
- There is no arbitrary shell or unrestricted filesystem tool.
- User Overlay and Project Candidate live in separate structured workspaces.
- R3 public-state behavior requires explicit human approval.
- Project adoption is a human reducer action and is not exposed to a Provider tool.

## Blind Reconstruction

The Project Agent request includes only the approved Contract, Manifest, Policy, and project-owned reference context. The contributor patch and private trajectory are not serialized into that request. Security tests assert the boundary and export redaction.

## Network and browser

- Gateway binds to `127.0.0.1`.
- CORS accepts only the local workbench origins.
- Provider configuration is accepted only by that localhost Gateway. Static hosting has no configuration endpoint and cannot accept a key.
- Request bodies are limited to 1 MB.
- Responses set no-store, no-sniff, no-referrer, and restrictive browser permissions.
- Browser cancellation propagates to the Provider request.
- Provider/tool call counts and token ceilings remain bounded. The default local wait has no automatic deadline and terminates when the Provider returns or the person cancels; a non-zero optional timeout is supported.
- Authorized input is redacted before a Provider request. Provider assistant text is redacted on return, and every structured proposal must pass the same privacy scan before it can enter application state.
- Public exporters cover API keys, private keys, authorization and cookie headers, environment-secret assignments, bearer values, email addresses, phone numbers, and personal absolute paths.
- Imported state is limited to 5 MB, privacy-scanned, structurally checked, and forced to the local gateway's no-credential state before entering the reducer.
- The Guide Agent sends only a bounded question and a minimal workflow-status summary. It does not serialize KPR contents, contributor patches, private trajectories, credentials, or arbitrary browser state.
- Global Guide actions are limited to explanation, navigation, and allowlisted workflow entry points. Provider settings still require a person to enter and test a key, and the Guide has no reducer action for attestation, merge, or adoption.
- Every Local XYZ Agent is bound to one `ReferenceAppId`. It cannot switch applications, configure Provider, open the global Runtime, or mutate project-governance state. Read-only Reference Applications expose explanation only; interactive applications expose only their existing reversible reducer actions.

## Reporting

Do not place a credential or sensitive trajectory in a public repository, KPR, screenshot, replay, or issue.
