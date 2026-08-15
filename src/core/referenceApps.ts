import { createId, nowIso } from "./time";
import { ACTORS, DEFAULT_USER_REQUEST } from "./constants";
import type {
  AgentRun,
  AgentDemoRealization,
  AppState,
  DailyNewsRealization,
  ModifiableReferenceAppId,
  ReferenceAppChangeKind,
  ReferenceAppChangeRecord,
  ReferenceAppExperience,
  ReferenceAppId,
  ReferenceAppKprDraft,
  RunMode
} from "./types";

export interface ReferenceAppActionDefinition {
  appId: ModifiableReferenceAppId;
  kind: ReferenceAppChangeKind;
  title: string;
  summary: string;
  problem: string;
  expectedBehavior: string[];
  acceptanceCriteria: string[];
}

export interface ReferenceAppConversationReply {
  message: string;
  action?: ReferenceAppChangeKind;
}

export type PresetReferenceAppId = Extract<ReferenceAppId, "research-brief" | "agent-demo" | "daily-news">;

export interface ReferenceAppPresetDefinition {
  appId: PresetReferenceAppId;
  title: string;
  request: string;
  steps: string[];
  changeKind?: ReferenceAppChangeKind;
}

export const REFERENCE_APP_PRESETS: ReferenceAppPresetDefinition[] = [
  {
    appId: "research-brief",
    title: "Conclusion-first Research Brief",
    request: DEFAULT_USER_REQUEST,
    steps: [
      "Ask the User-side Agent for a bounded overlay.",
      "Review and approve the reversible local realization.",
      "Verify source preservation, isolation, and rollback.",
      "Structure the verified knowledge as a KPR."
    ]
  },
  {
    appId: "agent-demo",
    title: "Interactive sidebar for Agent Demo",
    request: "Add an interactive right sidebar to Agent Demo while preserving the central conversation and keeping the change user-local and reversible.",
    steps: [
      "Ask the application-scoped XYZ Agent for the sidebar capability.",
      "Review and apply the user-local change.",
      "Verify that the sidebar is usable and the conversation remains visible.",
      "Form a bounded KPR draft, or roll back to the checkpoint."
    ],
    changeKind: "add-interactive-sidebar"
  },
  {
    appId: "daily-news",
    title: "Structured headlines for Daily News",
    request: "Reconstruct the Daily News headlines by actor, action, object, and consequence while preserving scores, authors, sources, timestamps, and rollback.",
    steps: [
      "Ask the application-scoped XYZ Agent for structured headline reconstruction.",
      "Review and apply the user-local change.",
      "Verify title consistency and metadata preservation.",
      "Form a bounded KPR draft, or roll back to the original headlines."
    ],
    changeKind: "rewrite-news-headlines"
  }
];

export function referenceAppPresetFor(appId: ReferenceAppId) {
  return REFERENCE_APP_PRESETS.find((preset) => preset.appId === appId);
}

export function isReferenceAppPresetRequest(value: string) {
  const normalized = value.trim();
  return REFERENCE_APP_PRESETS.some((preset) => preset.request === normalized);
}

export const REFERENCE_APP_DEFAULTS: ReferenceAppExperience = {
  agentDemo: {
    theme: "neutral",
    fontSize: 14,
    interactiveSidebar: false,
    clockWidget: false
  },
  dailyNews: {
    theme: "neutral",
    fontSize: 14,
    structuredHeadlines: false
  },
  changes: []
};

export const REFERENCE_APP_ACTIONS: ReferenceAppActionDefinition[] = [
  {
    appId: "agent-demo",
    kind: "add-interactive-sidebar",
    title: "Add an interactive right sidebar",
    summary: "Adds a user-local terminal sidebar while preserving the central conversation and public reference behavior.",
    problem: "The minimal Agent Demo has no dedicated surface for inspecting and invoking software capabilities.",
    expectedBehavior: [
      "A terminal-style sidebar appears on the right.",
      "The central conversation remains usable.",
      "Restoring the checkpoint removes the sidebar."
    ],
    acceptanceCriteria: ["Sidebar is visible and interactive.", "Conversation content is not covered.", "One-step rollback restores the previous realization."]
  },
  {
    appId: "agent-demo",
    kind: "apply-visual-preferences",
    title: "Apply 16px and blue theme",
    summary: "Applies the user's local 16px typography and blue visual preference without changing the project default.",
    problem: "The reference typography and neutral accent are less readable and less aligned with this user's preference.",
    expectedBehavior: ["Application text uses a 16px base size.", "The local accent becomes blue.", "The project reference remains neutral and 14px."],
    acceptanceCriteria: ["The active realization reports 16px.", "Blue theme tokens are visible.", "Reset restores the reference presentation."]
  },
  {
    appId: "agent-demo",
    kind: "add-clock-widget",
    title: "Reuse the Daily News clock",
    summary: "Adds a small clock learned from the Daily News reference surface to the Agent Demo user realization.",
    problem: "The Agent Demo user wants a lightweight time reference already available in another application surface.",
    expectedBehavior: ["A clock widget appears in Agent Demo.", "The capability is reused without coupling the two applications.", "Rollback removes only the clock change."],
    acceptanceCriteria: ["Clock is visible.", "Conversation and sidebar remain intact.", "Checkpoint rollback restores the prior realization."]
  },
  {
    appId: "daily-news",
    kind: "apply-visual-preferences",
    title: "Apply my cross-application preferences",
    summary: "Applies the same user-local 16px and blue presentation preference to Daily News & Notes.",
    problem: "A known user preference should remain consistent when the user enters another Agentic Software application.",
    expectedBehavior: ["Daily News uses a 16px base size.", "Its accent becomes blue.", "The reference default remains unchanged."],
    acceptanceCriteria: ["Preference is visible in Daily News.", "News data and notes are unchanged.", "Reset restores the reference presentation."]
  },
  {
    appId: "daily-news",
    kind: "rewrite-news-headlines",
    title: "Reconstruct headlines by news elements",
    summary: "Rewrites visible headlines into actor, action, object, and consequence structure while retaining the original item metadata.",
    problem: "Raw feed headlines are inconsistent and make rapid comparison difficult.",
    expectedBehavior: ["Each visible title follows a consistent news-element structure.", "Scores, authors, sources, and timestamps remain visible.", "The original titles remain recoverable."],
    acceptanceCriteria: ["Structured titles are visible.", "Metadata is preserved.", "Rollback restores the original headlines."]
  }
];

export function actionsForReferenceApp(appId: ModifiableReferenceAppId) {
  return REFERENCE_APP_ACTIONS.filter((action) => action.appId === appId);
}

export function findReferenceAppAction(appId: ModifiableReferenceAppId, kind: ReferenceAppChangeKind) {
  return REFERENCE_APP_ACTIONS.find((action) => action.appId === appId && action.kind === kind);
}

export function referenceAppConversationReply(question: string, appId: ReferenceAppId): ReferenceAppConversationReply {
  const normalized = question.trim().slice(0, 500).toLowerCase();
  const modifiable = appId === "agent-demo" || appId === "daily-news" ? appId : undefined;

  if (
    (appId !== "agent-demo" && /sidebar|terminal|clock|侧边栏|终端|时钟/.test(normalized))
    || (appId !== "daily-news" && /headline|news title|新闻要素|重构新闻/.test(normalized))
    || /switch app|change app|切换应用|provider|api key|模型设置|运行时|runtime/.test(normalized)
  ) {
    return { message: "That request is outside this application's scope. Use the Global XYZ Agent to switch applications or control workbench-level settings." };
  }

  let kind: ReferenceAppChangeKind | undefined;
  if (modifiable === "agent-demo") {
    if (/sidebar|terminal|侧边栏|终端/.test(normalized)) kind = "add-interactive-sidebar";
    else if (/clock|时钟/.test(normalized)) kind = "add-clock-widget";
    else if (/16\s*px|font|blue|字号|字体|蓝色|偏好/.test(normalized)) kind = "apply-visual-preferences";
  }
  if (modifiable === "daily-news") {
    if (/headline|news title|title structure|标题|新闻要素|重构新闻/.test(normalized)) kind = "rewrite-news-headlines";
    else if (/16\s*px|font|blue|字号|字体|蓝色|偏好/.test(normalized)) kind = "apply-visual-preferences";
  }

  if (modifiable && kind) {
    const definition = findReferenceAppAction(modifiable, kind);
    return {
      message: definition?.summary ?? "I found an allowlisted, reversible capability in this application.",
      action: kind
    };
  }

  if (appId === "research-brief") {
    return { message: "I can help describe a need, request a bounded proposal, checkpoint and verify the local realization, then form this application's KPR." };
  }
  if (appId === "issue-triage") {
    return { message: "Within Issue Triage I may explain priority, grouping, and evidence-request surfaces. Closing, assigning, or accepting an Issue remains human-only." };
  }
  if (appId === "release-desk") {
    return { message: "Within Release Desk I may explain the Contract, verifier output, release notes, risk summary, and rollback plan. Approval and publishing remain human-only." };
  }
  return { message: "I can apply an allowlisted user-local change, record a checkpoint, verify it, form a bounded KPR draft, and roll it back." };
}

export function activeReferenceAppChange(state: Pick<AppState, "referenceApps">, appId: ModifiableReferenceAppId) {
  return [...state.referenceApps.changes].reverse().find((change) => change.appId === appId && change.status !== "rolled_back");
}

function realizationFor(experience: ReferenceAppExperience, appId: ModifiableReferenceAppId) {
  return appId === "agent-demo" ? experience.agentDemo : experience.dailyNews;
}

function updateRealization(
  experience: ReferenceAppExperience,
  appId: ModifiableReferenceAppId,
  realization: AgentDemoRealization | DailyNewsRealization
): ReferenceAppExperience {
  return appId === "agent-demo"
    ? { ...experience, agentDemo: realization as AgentDemoRealization }
    : { ...experience, dailyNews: realization as DailyNewsRealization };
}

function changedRealization(
  appId: ModifiableReferenceAppId,
  current: AgentDemoRealization | DailyNewsRealization,
  kind: ReferenceAppChangeKind
) {
  if (appId === "agent-demo") {
    const value = current as AgentDemoRealization;
    if (kind === "add-interactive-sidebar") return { ...value, interactiveSidebar: true };
    if (kind === "add-clock-widget") return { ...value, clockWidget: true };
    if (kind === "apply-visual-preferences") return { ...value, theme: "blue" as const, fontSize: 16 as const };
    return value;
  }
  const value = current as DailyNewsRealization;
  if (kind === "apply-visual-preferences") return { ...value, theme: "blue" as const, fontSize: 16 as const };
  if (kind === "rewrite-news-headlines") return { ...value, structuredHeadlines: true };
  return value;
}

export function applyReferenceAppChange(
  experience: ReferenceAppExperience,
  appId: ModifiableReferenceAppId,
  kind: ReferenceAppChangeKind
): { experience: ReferenceAppExperience; record?: ReferenceAppChangeRecord } {
  const definition = findReferenceAppAction(appId, kind);
  if (!definition) return { experience };
  const before = structuredClone(realizationFor(experience, appId));
  const after = changedRealization(appId, before, kind);
  if (JSON.stringify(before) === JSON.stringify(after)) return { experience };
  const appliedAt = nowIso();
  const record: ReferenceAppChangeRecord = {
    id: createId("reference-change"),
    appId,
    kind,
    title: definition.title,
    summary: definition.summary,
    before,
    after: structuredClone(after),
    status: "applied",
    checkpointId: createId("reference-checkpoint"),
    appliedAt,
    evidence: []
  };
  const updated = updateRealization(experience, appId, after);
  return {
    record,
    experience: { ...updated, changes: [...experience.changes, record], kprDraft: undefined }
  };
}

export function verifyReferenceAppChange(experience: ReferenceAppExperience, changeId: string): ReferenceAppExperience {
  const change = experience.changes.find((item) => item.id === changeId && item.status === "applied");
  if (!change) return experience;
  const definition = findReferenceAppAction(change.appId, change.kind);
  const evidence = [
    ...(definition?.acceptanceCriteria ?? []),
    "The user-local checkpoint can restore the exact prior realization.",
    "The public reference configuration remains unchanged."
  ];
  return {
    ...experience,
    changes: experience.changes.map((item) => item.id === changeId
      ? { ...item, status: "verified", verifiedAt: nowIso(), evidence }
      : item)
  };
}

export function rollbackReferenceAppChange(experience: ReferenceAppExperience, appId: ModifiableReferenceAppId): ReferenceAppExperience {
  const change = [...experience.changes].reverse().find((item) => item.appId === appId && item.status !== "rolled_back");
  if (!change) return experience;
  const restored = updateRealization(experience, appId, structuredClone(change.before));
  return {
    ...restored,
    changes: experience.changes.map((item) => item.id === change.id ? { ...item, status: "rolled_back" } : item),
    kprDraft: experience.kprDraft?.sourceChangeId === change.id ? undefined : experience.kprDraft
  };
}

export function resetReferenceApp(experience: ReferenceAppExperience, appId: ModifiableReferenceAppId): ReferenceAppExperience {
  const defaults = appId === "agent-demo" ? REFERENCE_APP_DEFAULTS.agentDemo : REFERENCE_APP_DEFAULTS.dailyNews;
  const restored = updateRealization(experience, appId, structuredClone(defaults));
  return {
    ...restored,
    changes: experience.changes.map((item) => item.appId === appId && item.status !== "rolled_back" ? { ...item, status: "rolled_back" } : item),
    kprDraft: experience.kprDraft?.appId === appId ? undefined : experience.kprDraft
  };
}

export function buildReferenceAppKprDraft(change: ReferenceAppChangeRecord, mode: RunMode): ReferenceAppKprDraft {
  const definition = findReferenceAppAction(change.appId, change.kind);
  if (!definition || change.status !== "verified") throw new Error("A verified reference application change is required.");
  return {
    schemaVersion: "0.1.0",
    id: createId("reference-kpr"),
    sourceChangeId: change.id,
    appId: change.appId,
    title: `${change.appId === "agent-demo" ? "Agent Demo" : "Daily News & Notes"}: ${definition.title}`,
    problem: definition.problem,
    expectedBehavior: definition.expectedBehavior,
    acceptanceCriteria: definition.acceptanceCriteria,
    evidence: change.evidence,
    provenance: [
      "Human request issued through the XYZ Agent",
      "Agent-structured intent and acceptance boundary",
      `Verified user-side checkpoint ${change.checkpointId}`
    ],
    limitations: [
      "Evidence covers this local reference-application scenario only.",
      "This KPR draft transfers knowledge; it does not authorize project code, merge, or adoption."
    ],
    status: "agent_structured",
    structuredBy: mode === "live" ? "XYZ Agent · bounded local capability" : mode === "replay" ? "XYZ Agent · Recorded Replay" : "XYZ Agent · Scripted Fallback",
    createdAt: nowIso()
  };
}

export function buildReferenceAppKprRun(change: ReferenceAppChangeRecord, draft: ReferenceAppKprDraft, mode: RunMode): AgentRun {
  const startedAt = nowIso();
  const event = (
    sequence: number,
    type: AgentRun["events"][number]["type"],
    plane: AgentRun["events"][number]["plane"],
    title: string,
    summary: string
  ): AgentRun["events"][number] => ({
    id: createId("reference-kpr-event"), sequence, timestamp: startedAt, type, plane, title, summary, actor: ACTORS.userAgent
  });
  return {
    id: createId("run-reference-kpr"),
    mode,
    role: "user-side",
    skillId: "skill-user-local-kpr-draft@0.1.0",
    status: "completed",
    startedAt,
    completedAt: startedAt,
    events: [
      event(1, "run_started", "action", "XYZ Agent KPR structuring started", "A human requested a KPR draft from one verified user-local application change."),
      event(2, "context_assembled", "context", "Verified local context assembled", "The verified change, its checkpoint, and bounded evidence statements were included."),
      event(3, "policy_check", "policy", "Contribution boundary enforced", "The local implementation remains evidence only; no project code, merge, or adoption authority was granted."),
      event(4, "tool_call", "action", "Structured KPR knowledge package", "Created a KPR draft from the allowlisted user-side capability and verified checkpoint."),
      event(5, "verifier_result", "proof", "KPR source boundary passed", "The draft contains the problem, expected behavior, acceptance criteria, evidence, provenance, and explicit limitations."),
      event(6, "checkpoint_created", "memory", "KPR draft linked to rollback state", "The draft is linked to the source checkpoint; rolling back the source change invalidates this draft."),
      event(7, "run_completed", "memory", "Stopped at human review boundary", "The XYZ Agent completed knowledge structuring. Human review remains required before any contribution or project decision.")
    ],
    budget: {
      maxProviderCalls: mode === "live" ? 1 : 0,
      providerCallsUsed: 0,
      maxToolCalls: 1,
      toolCallsUsed: 1,
      maxDurationMs: 0,
      maxInputTokens: 0,
      maxOutputTokens: 0,
      maxRetries: 0,
      retriesUsed: 0
    },
    terminationReason: "Structured draft completed at the human-review boundary; no project mutation occurred."
  };
}

export function normalizeReferenceApps(value?: Partial<ReferenceAppExperience>): ReferenceAppExperience {
  return {
    agentDemo: { ...REFERENCE_APP_DEFAULTS.agentDemo, ...(value?.agentDemo ?? {}) },
    dailyNews: { ...REFERENCE_APP_DEFAULTS.dailyNews, ...(value?.dailyNews ?? {}) },
    changes: Array.isArray(value?.changes) ? value.changes : [],
    ...(value?.kprDraft ? { kprDraft: value.kprDraft } : {})
  };
}
