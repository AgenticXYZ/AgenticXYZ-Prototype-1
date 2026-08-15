import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent, type PointerEvent } from "react";

import type { AppAction } from "../core/reducer";
import { activeReferenceAppChange, actionsForReferenceApp, referenceAppConversationReply } from "../core/referenceApps";
import type {
  AgentRole,
  AgentDemoRealization,
  AppState,
  BriefDocument,
  DailyNewsRealization,
  ModifiableReferenceAppId,
  ReferenceAppChangeKind,
  ReferenceAppExperience,
  ReferenceAppId,
  ReferenceAppKprDraft,
  UserOverlay
} from "../core/types";
import { useI18n } from "../i18n";
import { BriefPreview } from "./BriefPreview";
import { StatusBadge } from "./StatusBadge";

const apps: Array<{ id: ReferenceAppId; index: string; name: string; kind: string }> = [
  { id: "research-brief", index: "01", name: "Research Brief", kind: "Full KPR scenario" },
  { id: "agent-demo", index: "02", name: "Agent Demo", kind: "Interactive user-side sandbox" },
  { id: "daily-news", index: "03", name: "Daily News & Notes", kind: "Interactive user-side sandbox" },
  { id: "issue-triage", index: "04", name: "Issue Triage", kind: "Agent-targetable preview" },
  { id: "release-desk", index: "05", name: "Release Desk", kind: "Agent-targetable preview" }
];

function WindowChrome({ title, status = "Running reference application" }: { title: string; status?: string }) {
  const { t } = useI18n();
  return (
    <div className="reference-window-chrome">
      <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
      <strong>{t(title)}</strong>
      <span>{t(status)}</span>
    </div>
  );
}

function UserChangeStrip({ change, draft }: { change?: ReferenceAppExperience["changes"][number]; draft?: ReferenceAppKprDraft }) {
  const { t } = useI18n();
  return (
    <div className={`user-change-strip ${change ? `status-${change.status}` : "status-reference"}`} data-testid="reference-app-change-status">
      <div><span>{t("User realization")}</span><strong>{t(change?.title ?? "Reference behavior")}</strong></div>
      <div className="user-change-meta">
        {change ? <><code>{change.checkpointId}</code><StatusBadge status={change.status} label={t(change.status)} /></> : <StatusBadge status="clean" label={t("No local change")} />}
        {change && draft?.sourceChangeId === change.id && <StatusBadge status="captured" label={t("KPR draft ready")} />}
      </div>
    </div>
  );
}

const appNames: Record<ReferenceAppId, string> = {
  "research-brief": "Research Brief",
  "agent-demo": "Agent Demo",
  "daily-news": "Daily News & Notes",
  "issue-triage": "Issue Triage",
  "release-desk": "Release Desk"
};

interface LocalXyzPosition { x: number; y: number }
interface LocalXyzMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: ReferenceAppChangeKind;
}

const LOCAL_XYZ_POSITIONS_KEY = "agenticxyz-local-xyz-positions";

function readLocalXyzPositions(): Partial<Record<ReferenceAppId, LocalXyzPosition>> {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_XYZ_POSITIONS_KEY) ?? "{}") as Partial<Record<ReferenceAppId, LocalXyzPosition>>;
    return Object.fromEntries(Object.entries(value).filter(([, position]) => Number.isFinite(position?.x) && Number.isFinite(position?.y)));
  } catch {
    return {};
  }
}

function writeLocalXyzPosition(appId: ReferenceAppId, position?: LocalXyzPosition) {
  try {
    const positions = readLocalXyzPositions();
    if (position) positions[appId] = position;
    else delete positions[appId];
    localStorage.setItem(LOCAL_XYZ_POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // Position memory is a non-critical presentation preference.
  }
}

function ScopedResearchBriefFlow({ state, dispatch, runAgent, loadingRole }: { state: AppState; dispatch: Dispatch<AppAction>; runAgent: (role: AgentRole) => Promise<void>; loadingRole?: AgentRole }) {
  const { t } = useI18n();
  if (!state.proposedOverlay) {
    return (
      <div className="local-xyz-flow">
        <label><span>{t("Describe a need inside this application")}</span><textarea rows={3} value={t(state.userRequest)} onChange={(event) => dispatch({ type: "SET_USER_REQUEST", value: event.target.value })} /></label>
        <button className="button button-primary" type="button" disabled={loadingRole === "user-side" || !state.userRequest.trim()} onClick={() => void runAgent("user-side")}>{t(loadingRole === "user-side" ? "Agent is preparing a bounded proposal…" : "Ask this application's Agent")}</button>
      </div>
    );
  }
  if (!state.activeOverlay) return <div className="local-xyz-flow"><p>{t("The proposal is ready. Inspect it, then explicitly approve this reversible local realization.")}</p><button className="button button-accent" type="button" onClick={() => dispatch({ type: "APPROVE_OVERLAY" })}>{t("Approve local overlay")}</button></div>;
  if (state.userWorkspace.status !== "verified" && !state.kpr) return <div className="local-xyz-flow"><p>{t("The local realization is applied and checkpointed. Verification must pass before contribution knowledge is created.")}</p><button className="button button-primary" type="button" onClick={() => dispatch({ type: "VERIFY_OVERLAY" })}>{t("Run local verifiers")}</button><button className="button button-danger" type="button" onClick={() => dispatch({ type: "ROLLBACK_OVERLAY" })}>{t("Restore reference behavior")}</button></div>;
  if (!state.kpr) return <div className="local-xyz-flow"><p>{t("The application change is verified. The XYZ Agent can now structure the need, evidence, and boundaries as a KPR draft.")}</p><button className="button button-accent" type="button" onClick={() => dispatch({ type: "CREATE_KPR" })}>{t("Create KPR draft")}</button><button className="button button-danger" type="button" onClick={() => dispatch({ type: "ROLLBACK_OVERLAY" })}>{t("Restore reference behavior")}</button></div>;
  return <div className="local-xyz-flow complete"><p>{t("This application's KPR exists. Human review and project governance continue in the KPR Bridge.")}</p><button className="button button-primary" type="button" onClick={() => dispatch({ type: "SET_VIEW", view: "kpr" })}>{t("Continue to this KPR")}</button></div>;
}

function ScopedXyzAssistant({ appId, state, dispatch, runAgent, loadingRole }: { appId: ReferenceAppId; state: AppState; dispatch: Dispatch<AppAction>; runAgent: (role: AgentRole) => Promise<void>; loadingRole?: AgentRole }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<LocalXyzMessage[]>([{
    id: "local-welcome",
    role: "assistant",
    text: "I can help with this application only. I cannot switch applications, configure the Provider, open the global Runtime, or make project decisions."
  }]);
  const [position, setPosition] = useState<LocalXyzPosition | undefined>(() => readLocalXyzPositions()[appId]);
  const [dragging, setDragging] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const messageSequenceRef = useRef(0);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: LocalXyzPosition; moved: boolean; latest: LocalXyzPosition } | undefined>(undefined);
  const modifiable = appId === "agent-demo" || appId === "daily-news" ? appId : undefined;
  const activeChange = modifiable ? activeReferenceAppChange(state, modifiable) : undefined;
  const draft = activeChange && state.referenceApps.kprDraft?.sourceChangeId === activeChange.id ? state.referenceApps.kprDraft : undefined;

  useEffect(() => {
    const openLocal = (event: Event) => {
      const detail = (event as CustomEvent<{ appId?: ReferenceAppId; prompt?: string }>).detail;
      if (!detail?.appId || detail.appId === appId) {
        setOpen(true);
        if (detail?.prompt) ask(detail.prompt);
      }
    };
    window.addEventListener("agenticxyz:open-local-guide", openLocal);
    return () => window.removeEventListener("agenticxyz:open-local-guide", openLocal);
  }, [appId]);

  useEffect(() => {
    if (open && threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    function clampRememberedPosition() {
      if (!position || !fabRef.current) return;
      const stage = fabRef.current.closest<HTMLElement>(".reference-app-scoped-stage");
      if (!stage) return;
      const next = clampLocalPosition(position, stage, fabRef.current);
      if (next.x !== position.x || next.y !== position.y) {
        setPosition(next);
        writeLocalXyzPosition(appId, next);
      }
    }
    clampRememberedPosition();
    window.addEventListener("resize", clampRememberedPosition);
    return () => window.removeEventListener("resize", clampRememberedPosition);
  }, [appId, position]);

  function clampLocalPosition(next: LocalXyzPosition, stage: HTMLElement, fab: HTMLElement) {
    const padding = 8;
    return {
      x: Math.max(padding, Math.min(next.x, stage.clientWidth - fab.offsetWidth - padding)),
      y: Math.max(padding, Math.min(next.y, stage.clientHeight - fab.offsetHeight - padding))
    };
  }

  function currentLocalPosition() {
    if (position) return position;
    const fab = fabRef.current;
    const stage = fab?.closest<HTMLElement>(".reference-app-scoped-stage");
    if (!fab || !stage) return { x: 8, y: 48 };
    const fabBox = fab.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    return { x: fabBox.left - stageBox.left, y: fabBox.top - stageBox.top };
  }

  function moveLocalIcon(next: LocalXyzPosition, persist = false) {
    const fab = fabRef.current;
    const stage = fab?.closest<HTMLElement>(".reference-app-scoped-stage");
    if (!fab || !stage) return;
    const clamped = clampLocalPosition(next, stage, fab);
    setPosition(clamped);
    if (persist) writeLocalXyzPosition(appId, clamped);
    return clamped;
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const origin = currentLocalPosition();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin, moved: false, latest: origin };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function continueDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    const next = moveLocalIcon({ x: drag.origin.x + dx, y: drag.origin.y + dy });
    if (next) drag.latest = next;
    event.preventDefault();
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.moved) {
      suppressClickRef.current = true;
      writeLocalXyzPosition(appId, drag.latest);
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    dragRef.current = undefined;
    setDragging(false);
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (event.key === "Home") {
      event.preventDefault();
      setPosition(undefined);
      writeLocalXyzPosition(appId);
      return;
    }
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 32 : 12;
    const current = currentLocalPosition();
    moveLocalIcon({ x: current.x + direction[0] * step, y: current.y + direction[1] * step }, true);
  }

  function resetIconPosition() {
    setPosition(undefined);
    writeLocalXyzPosition(appId);
  }

  function ask(value: string) {
    const trimmed = value.trim().slice(0, 500);
    if (!trimmed) return;
    setQuestion("");
    const reply = referenceAppConversationReply(trimmed, appId);
    const sequence = messageSequenceRef.current++;
    setMessages((items) => [...items,
      { id: `local-user-${sequence}`, role: "user", text: trimmed },
      { id: `local-assistant-${sequence}`, role: "assistant", text: reply.message, action: reply.action }
    ]);
  }

  function applyPending(messageId: string, action: ReferenceAppChangeKind) {
    if (!modifiable) return;
    dispatch({ type: "APPLY_REFERENCE_APP_CHANGE", appId: modifiable, kind: action });
    setMessages((items) => items.map((item) => item.id === messageId
      ? { ...item, text: "The reversible user-local change is applied and checkpointed. Verify it before asking me to form a KPR draft.", action: undefined }
      : item));
  }

  return (
    <div className="local-xyz" data-app-scope={appId}>
      {open && (
        <section className="local-xyz-panel" role="dialog" aria-modal="false" aria-label={`${t("Local XYZ Agent")} · ${t(appNames[appId])}`} data-testid={`local-xyz-panel-${appId}`}>
          <header><span>XYZ</span><div><strong>{t("Local XYZ Agent")}</strong><small>{t("Application scope")} · {t(appNames[appId])}</small></div><button type="button" onClick={() => setOpen(false)} aria-label={t("Close Local XYZ Agent")}>×</button></header>
          <div className="local-xyz-boundary"><b>{t("Only this application")}</b><span>{t("Global controls are intentionally unavailable here.")}</span></div>

          {appId === "research-brief" && <ScopedResearchBriefFlow state={state} dispatch={dispatch} runAgent={runAgent} loadingRole={loadingRole} />}
          {modifiable && (
            <div className="local-xyz-capabilities">
              <span>{t("Capabilities in this application")}</span>
              {actionsForReferenceApp(modifiable).map((action) => <button key={action.kind} type="button" onClick={() => ask(action.title)} disabled={activeChange?.kind === action.kind && activeChange.status !== "rolled_back"}><strong>{t(action.title)}</strong><small>{t("Send to conversation")}</small></button>)}
              {activeChange && <div className="local-xyz-checkpoint"><code>{activeChange.checkpointId}</code><StatusBadge status={activeChange.status} label={t(activeChange.status)} />{activeChange.status === "applied" && <button className="button button-primary" type="button" onClick={() => dispatch({ type: "VERIFY_REFERENCE_APP_CHANGE", changeId: activeChange.id })}>{t("Verify local change")}</button>}{activeChange.status === "verified" && !draft && <button className="button button-accent" type="button" onClick={() => dispatch({ type: "CREATE_REFERENCE_APP_KPR", changeId: activeChange.id })}>{t("Form this application's KPR")}</button>}<button className="button button-danger" type="button" onClick={() => dispatch({ type: "ROLLBACK_REFERENCE_APP_CHANGE", appId: modifiable })}>{t("Roll back last change")}</button></div>}
              {draft && <div className="local-xyz-draft"><strong>{t("KPR draft ready")}</strong><p>{t(draft.problem)}</p><small>{t("Stopped at the human-review boundary")}</small></div>}
            </div>
          )}

          <div className="local-xyz-suggestions"><button type="button" onClick={() => ask("What can you do here?")}>{t("What can you do here?")}</button>{modifiable && <button type="button" onClick={() => ask(modifiable === "agent-demo" ? "Add a sidebar" : "Reconstruct the news headlines")}>{t(modifiable === "agent-demo" ? "Add a sidebar" : "Reconstruct the headlines")}</button>}</div>
          <div className="local-xyz-thread" ref={threadRef} data-testid={`local-xyz-thread-${appId}`} aria-live="polite">
            {messages.map((message) => (
              <article className={`local-xyz-message ${message.role}`} key={message.id}>
                <span>{message.role === "assistant" ? "XYZ" : t("You")}</span>
                <div><p>{t(message.text)}</p>{message.action && <button className="button button-accent" type="button" onClick={() => applyPending(message.id, message.action!)}>{t("Apply reversible change")}</button>}</div>
              </article>
            ))}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); ask(question); }}><textarea rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t("Ask the XYZ Agent about this application…")} aria-label={t("Ask the Local XYZ Agent")} /><button type="submit" disabled={!question.trim()} aria-label={t("Send question")}>→</button></form>
          <footer><span>{t("This XYZ Agent cannot control another application or the outer workbench.")}</span><button type="button" onClick={resetIconPosition}>{t("Reset icon position")}</button></footer>
        </section>
      )}
      <span id={`local-xyz-drag-help-${appId}`} className="visually-hidden">{t("Drag within this application, or use the arrow keys to move. Press Home to restore the default position.")}</span>
      <button
        ref={fabRef}
        className={`local-xyz-fab${dragging ? " dragging" : ""}`}
        style={position ? { left: position.x, top: position.y, right: "auto" } : undefined}
        type="button"
        aria-label={`${t("Open Local XYZ Agent for")} ${t(appNames[appId])}`}
        aria-describedby={`local-xyz-drag-help-${appId}`}
        aria-expanded={open}
        data-testid={`local-xyz-fab-${appId}`}
        title={t("Drag to reposition the Local XYZ Agent")}
        onPointerDown={beginDrag}
        onPointerMove={continueDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={moveWithKeyboard}
        onClick={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            return;
          }
          setOpen((value) => !value);
        }}
      ><i aria-hidden="true">⠿</i><b>XYZ</b><small>{t("local")}</small></button>
    </div>
  );
}

function ResearchBriefApp({ brief, overlay }: { brief: BriefDocument; overlay?: UserOverlay }) {
  const { t } = useI18n();
  return (
    <div className="reference-app-window research-brief-app">
      <WindowChrome title="Brief Studio" />
      <div className="reference-app-layout">
        <aside className="reference-app-sidebar" aria-label={t("Research Brief navigation")}>
          <div className="mini-app-mark">B</div><strong>{t("Brief Studio")}</strong>
          <nav><button className="active" type="button">{t("Current brief")}</button><button type="button">{t("Source library")}</button><button type="button">{t("Presentation settings")}</button></nav>
          <div className="mini-app-meta"><span>{t("Sources")}</span><b>3</b></div>
        </aside>
        <div className="reference-app-content"><div className="reference-app-toolbar"><span>{t("Knowledge document")}</span><span>{t(overlay ? "User Overlay active" : "Reference layout")}</span></div><BriefPreview brief={brief} overlay={overlay} /></div>
      </div>
    </div>
  );
}

function MiniClock({ compact = false }: { compact?: boolean }) {
  const { language } = useI18n();
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <div className={compact ? "mini-clock compact" : "mini-clock"} aria-label="Local clock"><span aria-hidden="true">◷</span><time>{time.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit", second: compact ? undefined : "2-digit" })}</time></div>;
}

function AgentDemoApp({ realization, change, draft }: { realization: AgentDemoRealization; change?: ReferenceAppExperience["changes"][number]; draft?: ReferenceAppKprDraft }) {
  const { t } = useI18n();
  const [command, setCommand] = useState("");
  const [terminalLines, setTerminalLines] = useState(["agentic-terminal v0.1", "Type help to inspect available capabilities."]);
  const submitCommand = () => {
    const value = command.trim();
    if (!value) return;
    const response = value === "help" ? "capabilities: chat · preferences · checkpoints · kpr" : value === "status" ? `user-realization: ${change?.status ?? "reference"}` : `observed command: ${value}`;
    setTerminalLines((items) => [...items.slice(-4), `› ${value}`, response]);
    setCommand("");
  };
  return (
    <div className={`reference-app-window legacy-agent-demo theme-${realization.theme}`} style={{ "--legacy-font-size": `${realization.fontSize}px` } as CSSProperties} data-testid="legacy-app-change-surface">
      <WindowChrome title="Agent Demo" status="Agent-readable software" />
      <UserChangeStrip change={change} draft={draft} />
      <div className={`agent-demo-canvas${realization.interactiveSidebar ? " has-terminal" : ""}`}>
        <main className="agent-demo-chat">
          <header><div className="legacy-app-brand">AI</div><strong>{t("Agentic Assistant")}</strong><span>{t("User-local realization")}</span></header>
          {realization.clockWidget && <MiniClock compact />}
          <section className="agent-demo-conversation">
            <div className="agent-demo-intro"><span>{t("Agents with People")}</span><h4>{t("What can I help you build?")}</h4><p>{t("This minimal software exposes its capabilities, mutable surfaces, checkpoints, and evidence boundary to the XYZ Agent.")}</p></div>
            <article className="legacy-message user"><span>{t("You")}</span><p>{t("Can you help this software fit the way I work?")}</p></article>
            <article className="legacy-message agent"><span>AI</span><p>{t("Yes. I can invoke bounded user-side capabilities, and every local change remains inspectable and reversible.")}</p></article>
          </section>
          <div className="agent-demo-composer"><span>{t("Message Agentic Assistant…")}</span><button type="button" aria-label={t("Send message")}>→</button></div>
        </main>
        {realization.interactiveSidebar && (
          <aside className="agent-demo-terminal" aria-label={t("Interactive terminal sidebar")}>
            <header><span className="terminal-lights"><i /><i /><i /></span><strong>agentic-terminal</strong><small>{t("user-local")}</small></header>
            <div className="terminal-output" aria-live="polite">{terminalLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>
            <form onSubmit={(event) => { event.preventDefault(); submitCommand(); }}><span>›</span><input value={command} onChange={(event) => setCommand(event.target.value)} placeholder={t("Try help or status")} aria-label={t("Terminal command")} /></form>
          </aside>
        )}
      </div>
    </div>
  );
}

const newsItems = [
  ["Open-source agents move from chat to governed software actions", "Agent projects expose governed software actions beyond chat"],
  ["Developers debate how user preferences should travel across apps", "Developers evaluate portable user preferences across applications"],
  ["Evidence-first releases gain traction in AI tooling", "AI tool maintainers adopt evidence-first release gates"],
  ["New interface patterns keep humans in control", "Product teams design Agent interfaces with explicit human control"]
] as const;

function DailyNewsApp({ realization, change, draft }: { realization: DailyNewsRealization; change?: ReferenceAppExperience["changes"][number]; draft?: ReferenceAppKprDraft }) {
  const { t, language } = useI18n();
  const today = new Date();
  return (
    <div className={`reference-app-window legacy-daily-news theme-${realization.theme}`} style={{ "--legacy-font-size": `${realization.fontSize}px` } as CSSProperties} data-testid="legacy-app-change-surface">
      <WindowChrome title="Daily News & Notes" status="Agent-readable software" />
      <UserChangeStrip change={change} draft={draft} />
      <div className="daily-news-canvas">
        <main>
          <header><div><span>{t("Daily News")}</span><h4>{t("Today in Agentic Software")}</h4><p>{today.toLocaleDateString(language, { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p></div><StatusBadge status={realization.structuredHeadlines ? "verified" : "reference"} label={t(realization.structuredHeadlines ? "News-element titles" : "Original titles")} /></header>
          <section className="daily-news-list">{newsItems.map(([original, structured], index) => <article key={original}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{t(realization.structuredHeadlines ? structured : original)}</strong><p><b>{90 - index * 7} {t("points")}</b> · {t("by project-maintainer")} · {index + 2} {t("hours ago")}</p></div></article>)}</section>
        </main>
        <aside className="daily-news-side"><MiniClock /><section><span>{t("Quick notes")}</span><p>{t("Compare capability boundaries before treating a local preference as project knowledge.")}</p><button type="button">+ {t("Add note")}</button></section></aside>
      </div>
    </div>
  );
}

function IssueTriageApp() {
  const { t } = useI18n();
  const issues = [
    { id: "#184", title: "Source links disappear in compact view", meta: "P0 · evidence invariant", tone: "danger" },
    { id: "#183", title: "Remember my preferred summary order", meta: "P1 · user-local preference", tone: "blue" },
    { id: "#179", title: "Clarify what the Knowledge Gate checks", meta: "P2 · documentation", tone: "neutral" }
  ];
  return (
    <div className="reference-app-window issue-triage-app"><WindowChrome title="Issue Triage" /><div className="triage-layout"><aside><div className="mini-app-mark">T</div><strong>{t("Triage queue")}</strong><button className="active" type="button">{t("Needs review")} <b>12</b></button><button type="button">{t("Needs evidence")} <b>5</b></button><button type="button">{t("Ready for decision")} <b>3</b></button></aside><main><header><div><span>{t("Reference application 04")}</span><h4>{t("Issue Triage")}</h4></div><button type="button">{t("Sort by policy risk")}</button></header><section className="triage-list">{issues.map((issue) => <article key={issue.id}><span className={`triage-priority ${issue.tone}`} /><div><small>{issue.id}</small><strong>{t(issue.title)}</strong><p>{t(issue.meta)}</p></div><b>→</b></article>)}</section><footer><span>{t("Agent-targetable surfaces")}</span><b>{t("priority · grouping · evidence request")}</b></footer></main><aside className="triage-policy"><span>{t("Project Policy")}</span><strong>{t("Evidence before prioritization")}</strong><p>{t("The Agent may organize the queue and surface missing knowledge. It cannot close, assign, or accept an issue.")}</p><div><i /> {t("Human decision required")}</div></aside></div></div>
  );
}

function ReleaseDeskApp() {
  const { t } = useI18n();
  const checks = [["Behavior contract", "passed"], ["Source invariant", "passed"], ["Rollback path", "passed"], ["Maintainer adoption", "waiting"]] as const;
  return (
    <div className="reference-app-window release-desk-app"><WindowChrome title="Release Desk" /><header className="release-hero"><div><span>{t("Candidate release")}</span><h4>v1.0.0-rc.1</h4><p>{t("A compact operational surface for evidence-gated release decisions.")}</p></div><div className="release-score"><strong>3/4</strong><span>{t("checks ready")}</span></div></header><div className="release-grid"><section><div className="mini-section-heading"><span>{t("Release evidence")}</span><b>{t("Live status")}</b></div>{checks.map(([label, status], index) => <article className="release-check" key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{t(label)}</strong><StatusBadge status={status} label={t(status)} /></article>)}</section><aside><span>{t("Agent target map")}</span><div><b>{t("Readable")}</b><p>{t("Contract, verifier output, release policy")}</p></div><div><b>{t("Proposable")}</b><p>{t("Release notes, risk summary, rollback plan")}</p></div><div><b>{t("Human only")}</b><p>{t("Approve and publish")}</p></div></aside></div></div>
  );
}

export function ReferenceApplications({ brief, overlay, status, experience, activeApp, onSelectApp, state, dispatch, runAgent, loadingRole }: { brief: BriefDocument; overlay?: UserOverlay; status: string; experience: ReferenceAppExperience; activeApp: ReferenceAppId; onSelectApp: (appId: ReferenceAppId) => void; state: AppState; dispatch: Dispatch<AppAction>; runAgent: (role: AgentRole) => Promise<void>; loadingRole?: AgentRole }) {
  const { t } = useI18n();
  const selected = apps.find((app) => app.id === activeApp)!;
  const modifiable = activeApp === "agent-demo" || activeApp === "daily-news" ? activeApp : undefined;
  const change = modifiable ? activeReferenceAppChange({ referenceApps: experience }, modifiable) : undefined;
  const appStatus = activeApp === "research-brief" ? status : modifiable ? change?.status ?? "reference behavior" : "illustrative preview";

  return (
    <section className="product-stage reference-gallery" data-testid="reference-app-gallery">
      <div className="panel-header reference-gallery-header"><div><span className="panel-kicker">{t("Reference application gallery")}</span><h3>{t(selected.name)}</h3></div><StatusBadge status={appStatus} label={t(appStatus)} /></div>
      <div className="reference-app-tabs" role="tablist" aria-label={t("Choose a reference application")}>{apps.map((app) => <button key={app.id} type="button" role="tab" aria-selected={activeApp === app.id} className={activeApp === app.id ? "active" : ""} onClick={() => onSelectApp(app.id)}><span>{app.index}</span><strong>{t(app.name)}</strong><small>{t(app.kind)}</small></button>)}</div>
      <div className="reference-app-sandbox">
        {modifiable && <div className="reference-preview-disclosure interactive"><strong>{t("Interactive user-side sandbox")}</strong><span>{t("Use this application's Local XYZ Agent for bounded capabilities, checkpoints, verification, KPR structuring, and rollback. Use the Global XYZ Agent only when you need to control another application or the outer workbench.")}</span><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("agenticxyz:open-local-guide", { detail: { appId: activeApp } }))}>{t("Open this application's XYZ Agent")}</button></div>}
        {!modifiable && activeApp !== "research-brief" && <div className="reference-preview-disclosure"><strong>{t("Inspectable reference surface")}</strong><span>{t("This app shows another Agent-targetable software surface. Prototype 1 keeps the complete governed KPR path scoped to Research Brief so the evidence boundary stays honest.")}</span><button type="button" onClick={() => onSelectApp("research-brief")}>{t("Return to full KPR scenario")}</button></div>}
        <div className="reference-app-scoped-stage" data-testid={`reference-app-scope-${activeApp}`}>
          {activeApp === "research-brief" && <ResearchBriefApp brief={brief} overlay={overlay} />}
          {activeApp === "agent-demo" && <AgentDemoApp realization={experience.agentDemo} change={change} draft={experience.kprDraft} />}
          {activeApp === "daily-news" && <DailyNewsApp realization={experience.dailyNews} change={change} draft={experience.kprDraft} />}
          {activeApp === "issue-triage" && <IssueTriageApp />}
          {activeApp === "release-desk" && <ReleaseDeskApp />}
          <ScopedXyzAssistant key={activeApp} appId={activeApp} state={state} dispatch={dispatch} runAgent={runAgent} loadingRole={loadingRole} />
        </div>
      </div>
    </section>
  );
}
