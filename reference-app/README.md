# Research Brief Agentic Software Contract

This directory is the provider-independent, machine-readable contract for the Prototype 1 reference application. The browser Workbench and Agent Runtime expose the same concepts as these files:

- `agentic.manifest.json` — project identity, knowledge layers, capabilities, risks, human gates, mutable surfaces, invariants, and Verifiers;
- `project-policy.yaml` — the Maintainer's product, safety, privacy, contribution, runtime, approval, and evidence rules;
- `capabilities.schema.json` — the schema for a declared capability;
- `state.schema.json` — the reference document and User Overlay state boundary;
- `mutable-surfaces.json` — the explicit write and contribution boundary for every surface;
- `verifiers/definitions.json` — independent checks used by the User and Project workspaces;
- `reference/research-brief.json` — the immutable Reference Capability Core example;
- `user-overlay/` — the local, reversible realization layer. No private user state is committed.

The contract is illustrative, not a universal Agent protocol. Changes to its public meaning must also update the typed objects, JSON Schemas, tests, and frozen replay.
