import type { ActorRef } from "./types";

export const ACTORS: Record<string, ActorRef> = {
  contributor: { id: "human-contributor", type: "human", label: "You / Contributor", role: "contributor" },
  maintainer: { id: "human-maintainer", type: "human", label: "Project Maintainer", role: "maintainer" },
  userAgent: { id: "agent-user-side", type: "agent", label: "User-side Agent", role: "user-side" },
  maintainerAgent: { id: "agent-maintainer-side", type: "agent", label: "Maintainer-side Agent", role: "maintainer-side" },
  projectAgent: { id: "agent-project", type: "agent", label: "Project Agent", role: "project" },
  runtime: { id: "system-runtime", type: "system", label: "Agentic Runtime" },
  verifier: { id: "system-verifier", type: "verifier", label: "Verifier" }
};

export const DEFAULT_USER_REQUEST =
  "Put the conclusion first, keep the supporting evidence and sources visible, preserve the light and simple interface, and remember this as my preference.";

export const GUIDED_STEPS = [
  "Describe a local need",
  "Inspect the Agent plan",
  "Approve the User Overlay",
  "Verify and attest knowledge",
  "Create and submit the KPR",
  "Understand knowledge impact",
  "Shape the Integration Contract",
  "Synthesize and verify",
  "Adopt under human governance"
] as const;

export const MODE_LABELS = {
  replay: "Recorded Replay",
  scripted: "Scripted Fallback",
  live: "Live Agent"
} as const;
