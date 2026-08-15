import { useEffect, useMemo, useRef, useState } from "react";

import type { AppAction } from "../core/reducer";
import { actionsForReferenceApp, activeReferenceAppChange } from "../core/referenceApps";
import type {
  AgentRole,
  AppState,
  ModifiableReferenceAppId,
  ReferenceAppChangeKind,
  ReferenceAppId,
  WorkspaceView
} from "../core/types";
import { type Language, useI18n } from "../i18n";
import { StatusBadge } from "./StatusBadge";

type GuideAction = "open_provider" | "show_next" | "go_user" | "go_kpr" | "go_developer" | "open_runtime" | "none";

interface GuideMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: GuideAction;
  source?: "provider" | "local";
  referenceAction?: { appId: ModifiableReferenceAppId; kind: ReferenceAppChangeKind };
}

interface StepGuide {
  view: WorkspaceView;
  target?: string;
  title: string;
  description: string;
}

interface PointerPosition {
  direction: "left" | "right" | "up" | "down";
  left: number;
  top: number;
}

function nextStep(state: AppState): StepGuide {
  if (!state.proposedOverlay) return { view: "user", target: "user-request", title: "Describe a local need", description: "Describe how the reference software should work differently for you, then ask the User-side Agent for a bounded proposal." };
  if (!state.activeOverlay) return { view: "user", target: "approve-overlay", title: "Inspect and approve the User Overlay", description: "Review the proposed scope, source guarantees, and rollback boundary. Only you can approve the local change." };
  if (state.userWorkspace.status !== "verified" && !state.kpr) return { view: "user", target: "verify-overlay", title: "Run independent local verifiers", description: "The Agent proposal is not completion. Verify behavior, sources, isolation, and rollback before creating contribution knowledge." };
  if (!state.kpr) return { view: "user", target: "create-kpr", title: "Create a KPR draft", description: "Package the verified need, intent, evidence, limits, and provenance as knowledge for project review." };
  if (!["accepted_for_synthesis", "maintainer_review", "project_agent_synthesis", "verification", "revision_required", "rolled_back", "verification_passed", "adopted"].includes(state.kpr.status)) {
    return { view: "kpr", target: "kpr-workspace", title: "Review and attest the KPR knowledge", description: "Review the Agent-extracted Claims, optionally correct wording, record human attestation, scan the package, and submit it to the Knowledge Gate." };
  }
  if (state.kpr.impactAnalysis.length === 0) return { view: "developer", target: "run-maintainer-agent", title: "Map knowledge impact", description: "Use the Maintainer-side Agent to separate known, inferred, and unknown effects. It may advise, but it cannot decide." };
  if (!state.contract) return { view: "developer", target: "generate-contract", title: "Approve the Knowledge Integration Contract", description: "Shape Claim decisions, implementation boundaries, rollout, and required proof before the Project Agent can act." };
  if (!state.projectCandidate) return { view: "developer", target: "run-project-agent", title: "Synthesize a project-owned candidate", description: "The Project Agent implements only the approved Contract, without reading or merging the contributor patch." };
  if (state.projectWorkspace.status !== "verified" && state.projectWorkspace.status !== "adopted") return { view: "developer", target: "verify-project", title: "Verify before adoption", description: "Run every Contract verifier. Final adoption remains a Maintainer decision after the evidence passes." };
  if (state.projectWorkspace.status === "verified") return { view: "developer", target: "adopt-project", title: "Adopt under human governance", description: "Independent proof has passed. A Maintainer must still make the final adoption decision." };
  return { view: "developer", target: "developer-workspace", title: "Human-governed adoption is complete", description: "Inspect the KPR, Contract, Runtime trace, verifier evidence, and final human decision as one auditable chain." };
}

function FocusWorkflowControls({
  state,
  dispatch,
  runAgent,
  loadingRole,
  onSelectReferenceApp
}: {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  runAgent: (role: AgentRole) => Promise<void>;
  loadingRole?: AgentRole;
  onSelectReferenceApp: (appId: ReferenceAppId) => void;
}) {
  const { t } = useI18n();

  function showGovernedReferenceApp() {
    onSelectReferenceApp("research-brief");
  }

  function apply(action: AppAction) {
    showGovernedReferenceApp();
    dispatch(action);
  }

  function actionControl() {
    if (!state.proposedOverlay) {
      return (
        <>
          <label className="guide-workflow-field">
            <span>{t("Your local need")}</span>
            <textarea rows={3} value={t(state.userRequest)} onChange={(event) => dispatch({ type: "SET_USER_REQUEST", value: event.target.value })} />
          </label>
          <button
            className="button button-primary button-full"
            type="button"
            disabled={loadingRole === "user-side" || !state.userRequest.trim()}
            onClick={() => { showGovernedReferenceApp(); void runAgent("user-side"); }}
            data-testid="guide-current-action"
          >
            {t(loadingRole === "user-side" ? "Agent is preparing a bounded proposal…" : "Ask User-side Agent")}
          </button>
        </>
      );
    }
    if (!state.activeOverlay) {
      return <button className="button button-accent button-full" type="button" onClick={() => apply({ type: "APPROVE_OVERLAY" })} data-testid="guide-current-action">{t("Approve local overlay")}</button>;
    }
    if (state.userWorkspace.status !== "verified" && !state.kpr) {
      return <button className="button button-primary button-full" type="button" onClick={() => apply({ type: "VERIFY_OVERLAY" })} data-testid="guide-current-action">{t("Run local verifiers")}</button>;
    }
    if (!state.kpr) {
      return <button className="button button-primary button-full" type="button" onClick={() => apply({ type: "CREATE_KPR" })} data-testid="guide-current-action">{t("Create KPR draft")}</button>;
    }
    if (!state.kpr.humanAttestation) {
      return <button className="button button-accent button-full" type="button" onClick={() => dispatch({ type: "ATTEST_KPR" })} data-testid="guide-current-action">{t("Attest reviewed knowledge")}</button>;
    }
    if (state.kpr.privacyAndLicense.privacyScan.status !== "pass") {
      return <button className="button button-primary button-full" type="button" onClick={() => dispatch({ type: "SCAN_KPR" })} data-testid="guide-current-action">{t("Run privacy scan")}</button>;
    }
    if (state.kpr.status === "contributor_review") {
      return <button className="button button-accent button-full" type="button" onClick={() => dispatch({ type: "SUBMIT_KPR" })} data-testid="guide-current-action">{t("Submit KPR")}</button>;
    }
    if (state.kpr.status === "submitted" || state.kpr.status === "needs_more_knowledge") {
      return <button className="button button-primary button-full" type="button" onClick={() => dispatch({ type: "RUN_KNOWLEDGE_GATE" })} data-testid="guide-current-action">{t("Run Knowledge Gate")}</button>;
    }
    if (state.kpr.impactAnalysis.length === 0) {
      return <button className="button button-primary button-full" type="button" disabled={loadingRole === "maintainer-side"} onClick={() => void runAgent("maintainer-side")} data-testid="guide-current-action">{t(loadingRole === "maintainer-side" ? "Agent is mapping knowledge impact…" : "Ask Maintainer-side Agent")}</button>;
    }
    if (!state.contract) {
      return <button className="button button-accent button-full" type="button" onClick={() => dispatch({ type: "GENERATE_CONTRACT" })} data-testid="guide-current-action">{t("Approve decisions & generate Contract")}</button>;
    }
    if (!state.projectCandidate) {
      return <button className="button button-primary button-full" type="button" disabled={loadingRole === "project"} onClick={() => void runAgent("project")} data-testid="guide-current-action">{t(loadingRole === "project" ? "Project Agent is rebuilding from the Contract…" : "Start blind reconstruction")}</button>;
    }
    if (state.projectWorkspace.status !== "verified" && state.projectWorkspace.status !== "adopted") {
      return <button className="button button-primary button-full" type="button" onClick={() => dispatch({ type: "VERIFY_PROJECT_CANDIDATE" })} data-testid="guide-current-action">{t("Run Contract verifiers")}</button>;
    }
    if (state.projectWorkspace.status === "verified") {
      return <button className="button button-accent button-full" type="button" onClick={() => dispatch({ type: "ADOPT_PROJECT_CANDIDATE" })} data-testid="guide-current-action">{t("Maintainer adopts candidate")}</button>;
    }
    return <div className="guide-workflow-complete" data-testid="guide-workflow-complete"><span>✓</span><strong>{t("Human-governed adoption is complete")}</strong></div>;
  }

  return (
    <section className="guide-focus-controls" aria-label={t("Application workflow controls")}>
      <header>
        <div><span>{t("Application workflow")}</span><strong>{t("Operate the same governed state from the XYZ Agent")}</strong></div>
        <label>
          <span className="visually-hidden">{t("Run mode")}</span>
          <select aria-label={t("Run mode")} value={state.mode} onChange={(event) => dispatch({ type: "SET_MODE", mode: event.target.value as AppState["mode"] })}>
            <option value="replay">{t("Recorded Replay")}</option>
            <option value="scripted">{t("Scripted Fallback")}</option>
            <option value="live">{t("Live Agent")}</option>
          </select>
        </label>
      </header>
      <div className="guide-focus-action">{actionControl()}</div>
      <footer>{t("The XYZ Agent exposes the action here, but every human gate still requires your click.")}</footer>
    </section>
  );
}

function ReferenceAppControls({
  state,
  dispatch,
  appId,
  onApplied,
  onPointToChange
}: {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  appId: ModifiableReferenceAppId;
  onApplied: (kind: ReferenceAppChangeKind) => void;
  onPointToChange: () => void;
}) {
  const { t } = useI18n();
  const actions = actionsForReferenceApp(appId);
  const activeChange = activeReferenceAppChange(state, appId);
  const draft = state.referenceApps.kprDraft?.sourceChangeId === activeChange?.id ? state.referenceApps.kprDraft : undefined;

  return (
    <section className="guide-reference-controls" aria-label={t("User-side application controls")} data-testid="guide-reference-controls">
      <header><div><span>{t("User-side capabilities")}</span><strong>{t(appId === "agent-demo" ? "Operate Agent Demo" : "Operate Daily News & Notes")}</strong></div><StatusBadge status={activeChange?.status ?? "clean"} label={t(activeChange?.status ?? "reference")} /></header>
      <div className="guide-reference-actions">
        {actions.map((action) => (
          <button key={action.kind} type="button" onClick={() => onApplied(action.kind)} disabled={activeChange?.kind === action.kind && activeChange.status !== "rolled_back"}>
            <strong>{t(action.title)}</strong><span>{t(action.summary)}</span>
          </button>
        ))}
      </div>
      {activeChange && (
        <div className="guide-reference-gate">
          <div><span>{t("Latest checkpoint")}</span><code>{activeChange.checkpointId}</code></div>
          {activeChange.status === "applied" && <button className="button button-primary" type="button" onClick={() => dispatch({ type: "VERIFY_REFERENCE_APP_CHANGE", changeId: activeChange.id })}>{t("Verify local change")}</button>}
          {activeChange.status === "verified" && !draft && <button className="button button-accent" type="button" onClick={() => dispatch({ type: "CREATE_REFERENCE_APP_KPR", changeId: activeChange.id })}>{t("Ask the XYZ Agent to form a KPR draft")}</button>}
          <button className="button button-quiet" type="button" onClick={onPointToChange}>{t("Point to changed surface")}</button>
          <button className="button button-danger" type="button" onClick={() => dispatch({ type: "ROLLBACK_REFERENCE_APP_CHANGE", appId })}>{t("Roll back last change")}</button>
          <button className="button button-quiet" type="button" onClick={() => dispatch({ type: "RESET_REFERENCE_APP", appId })}>{t("Restore reference defaults")}</button>
        </div>
      )}
      {draft && (
        <article className="guide-reference-kpr" data-testid="reference-app-kpr-draft">
          <span>{t("KPR draft · Agent structured")}</span><strong>{t(draft.title)}</strong><p>{t(draft.problem)}</p>
          <div><b>{draft.evidence.length}</b> {t("evidence statements")} · <b>{draft.acceptanceCriteria.length}</b> {t("acceptance criteria")}</div>
          <small>{t(draft.structuredBy)} · {t("Human review is still required")}</small>
        </article>
      )}
      <footer>{t("Application action → checkpoint → verification → KPR. Local code never becomes project authority.")}</footer>
    </section>
  );
}

function inferReferenceAction(question: string, activeApp: ReferenceAppId): { appId: ModifiableReferenceAppId; kind: ReferenceAppChangeKind } | undefined {
  const normalized = question.toLowerCase();
  if (/sidebar|terminal|侧边栏|终端/.test(normalized)) return { appId: "agent-demo", kind: "add-interactive-sidebar" };
  if (/clock|时钟/.test(normalized)) return { appId: "agent-demo", kind: "add-clock-widget" };
  if (/headline|news title|标题|新闻要素|重构新闻/.test(normalized)) return { appId: "daily-news", kind: "rewrite-news-headlines" };
  if (/16\s*px|font|blue|字号|字体|蓝色|偏好/.test(normalized)) {
    return { appId: activeApp === "daily-news" ? "daily-news" : "agent-demo", kind: "apply-visual-preferences" };
  }
  return undefined;
}

function localAnswer(question: string): { text: string; action: GuideAction } {
  const normalized = question.toLowerCase();
  if (/api|key|provider|模型|密钥|连接/.test(normalized)) {
    return { text: "Open Model API Settings to choose one Provider and model, enter an API key, and verify the connection. The key stays in local Gateway memory and is not written to browser storage or project files.", action: "open_provider" };
  }
  if (/kpr|pull request|知识协作|知识包/.test(normalized)) {
    return { text: "A KPR is a governed knowledge package: human need, Agent-extracted Claims, evidence, provenance, constraints, unknowns, and human attestation. The contributor's local code is evidence, not implementation authority.", action: "go_kpr" };
  }
  if (/runtime|运行时|记录|审计|回滚/.test(normalized)) {
    return { text: "The Agentic Runtime makes probabilistic work inspectable through scoped context, policy checks, structured proposals, human gates, verifier evidence, checkpoints, and rollback.", action: "open_runtime" };
  }
  if (/agent first|agent-first|智能体优先|中心/.test(normalized)) {
    return { text: "Agent First is an architecture principle, not a transfer of authority. The software exposes Agent-readable capabilities and state, while people retain goals, judgment, responsibility, approval, and final governance.", action: "show_next" };
  }
  if (/下一步|怎么操作|如何操作|guide|next|help|引导/.test(normalized)) {
    return { text: "I can take you to the current guided step and point out the next human decision without clicking approval on your behalf.", action: "show_next" };
  }
  return { text: "I can explain Agentic Software, KPR, Runtime reliability, and human governance; configure the active Provider; or guide you to the next step. In Live Agent mode, I can use the configured Provider for a contextual answer.", action: "show_next" };
}

export function AgentAssistant({
  state,
  dispatch,
  language,
  runAgent,
  loadingRole,
  applicationOnly,
  setApplicationOnly,
  activeReferenceApp,
  onSelectReferenceApp
}: {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  language: Language;
  runAgent: (role: AgentRole) => Promise<void>;
  loadingRole?: AgentRole;
  applicationOnly: boolean;
  setApplicationOnly: (value: boolean) => void;
  activeReferenceApp: ReferenceAppId;
  onSelectReferenceApp: (appId: ReferenceAppId) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [pointerTarget, setPointerTarget] = useState<string>();
  const [pointerPosition, setPointerPosition] = useState<PointerPosition>();
  const [messages, setMessages] = useState<GuideMessage[]>([
    { id: "guide-welcome", role: "assistant", text: "I am the AgenticXYZ Guide. This software is also an Agent target: I can configure its Provider, explain its knowledge model, and guide you without taking human decisions." }
  ]);
  const logRef = useRef<HTMLDivElement>(null);
  const step = useMemo(() => nextStep(state), [state]);
  const modifiableReferenceApp = activeReferenceApp === "agent-demo" || activeReferenceApp === "daily-news" ? activeReferenceApp : undefined;

  useEffect(() => {
    const openGuide = () => setOpen(true);
    window.addEventListener("agenticxyz:open-guide", openGuide);
    return () => window.removeEventListener("agenticxyz:open-guide", openGuide);
  }, []);

  useEffect(() => {
    setPointerTarget(undefined);
    setPointerPosition(undefined);
  }, [applicationOnly, state.guidedStep]);

  useEffect(() => {
    if (!open || !pointerTarget) return;
    let frame = 0;
    let attempts = 0;

    function locate() {
      const target = document.querySelector<HTMLElement>(`[data-testid="${pointerTarget}"]`);
      if (!target) {
        if (attempts++ < 20) frame = window.requestAnimationFrame(locate);
        return;
      }
      const rect = target.getBoundingClientRect();
      const panelRect = document.querySelector<HTMLElement>(".guide-panel")?.getBoundingClientRect();
      const size = 44;
      const gap = 14;
      const candidates: PointerPosition[] = [
        { direction: "left", left: rect.right + gap, top: rect.top + rect.height / 2 - size / 2 },
        { direction: "right", left: rect.left - size - gap, top: rect.top + rect.height / 2 - size / 2 },
        { direction: "down", left: rect.left + rect.width / 2 - size / 2, top: rect.top - size - gap },
        { direction: "up", left: rect.left + rect.width / 2 - size / 2, top: rect.bottom + gap }
      ];
      const overlaps = (candidate: PointerPosition, forbidden?: DOMRect) => {
        if (!forbidden) return false;
        return candidate.left < forbidden.right + 6 && candidate.left + size > forbidden.left - 6 && candidate.top < forbidden.bottom + 6 && candidate.top + size > forbidden.top - 6;
      };
      const position = candidates.find((candidate) => (
        candidate.left >= 6 && candidate.top >= 6 && candidate.left + size <= window.innerWidth - 6 && candidate.top + size <= window.innerHeight - 6 && !overlaps(candidate, panelRect)
      )) ?? candidates[1];
      setPointerPosition({
        ...position,
        left: Math.max(6, Math.min(position.left, window.innerWidth - size - 6)),
        top: Math.max(6, Math.min(position.top, window.innerHeight - size - 6))
      });
    }

    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(locate);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const interval = window.setInterval(update, 400);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, pointerTarget, state.activeView]);

  function openProvider() {
    window.dispatchEvent(new Event("agenticxyz:open-provider-settings"));
  }

  function focusTarget(target?: string) {
    if (!target) return;
    window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(`[data-testid="${target}"]`);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: window.innerWidth <= 600 ? "start" : "center" });
      element?.focus({ preventScroll: true });
      setPointerTarget(target);
    }, 80);
  }

  function showNext() {
    const target = applicationOnly ? "guide-current-action" : step.target;
    if (!applicationOnly) dispatch({ type: "SET_VIEW", view: step.view });
    setPointerTarget(undefined);
    setPointerPosition(undefined);
    focusTarget(target);
    setMessages((items) => [...items, { id: `guide-step-${Date.now()}`, role: "assistant", text: `${t(step.title)}${language === "zh-CN" ? "：" : ": "}${t(step.description)}`, action: "show_next", source: "local" }]);
  }

  function closeGuide() {
    setPointerTarget(undefined);
    setPointerPosition(undefined);
    setOpen(false);
  }

  function toggleApplicationView() {
    setPointerTarget(undefined);
    setPointerPosition(undefined);
    setApplicationOnly(!applicationOnly);
  }

  function runAction(action: GuideAction | undefined) {
    if (action === "open_provider") return openProvider();
    if (action === "open_runtime") return dispatch({ type: "TOGGLE_RUNTIME", value: true });
    if (action === "show_next") return showNext();
    if (action === "go_user" || action === "go_kpr" || action === "go_developer") {
      dispatch({ type: "SET_VIEW", view: action.replace("go_", "") as WorkspaceView });
    }
  }

  function applyReferenceAction(appId: ModifiableReferenceAppId, kind: ReferenceAppChangeKind) {
    onSelectReferenceApp(appId);
    dispatch({ type: "SET_VIEW", view: "user" });
    dispatch({ type: "APPLY_REFERENCE_APP_CHANGE", appId, kind });
    const definition = actionsForReferenceApp(appId).find((item) => item.kind === kind);
    setMessages((items) => [...items, {
      id: `guide-applied-${Date.now()}`,
      role: "assistant",
      text: `Applied “${definition?.title ?? kind}” to the user-local realization. A checkpoint was recorded; verify it before asking me to structure a KPR draft.`,
      source: "local"
    }]);
    window.setTimeout(() => focusTarget("legacy-app-change-surface"), 120);
  }

  async function ask(text: string) {
    const trimmed = text.trim().slice(0, 1200);
    if (!trimmed || busy) return;
    setQuestion("");
    setBusy(true);
    setMessages((items) => [...items, { id: `guide-user-${Date.now()}`, role: "user", text: trimmed }]);
    try {
      const referenceAction = inferReferenceAction(trimmed, activeReferenceApp);
      if (referenceAction) {
        onSelectReferenceApp(referenceAction.appId);
        const definition = actionsForReferenceApp(referenceAction.appId).find((item) => item.kind === referenceAction.kind);
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        setMessages((items) => [...items, {
          id: `guide-reference-proposal-${Date.now()}`,
          role: "assistant",
          text: `${definition?.summary ?? "I found a bounded user-side application capability."} This affects only your local realization and records a rollback checkpoint.`,
          referenceAction,
          source: "local"
        }]);
        return;
      }
      if (state.mode === "live" && state.providerConfig.available) {
        const response = await fetch("/api/guide/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            language,
            context: {
              activeView: state.activeView,
              guidedStep: state.guidedStep,
              overlayStatus: state.userWorkspace.status,
              kprStatus: state.kpr?.status ?? "not_created",
              contractReady: Boolean(state.contract),
              candidateStatus: state.projectWorkspace.status
            }
          })
        });
        const result = await response.json() as { answer?: string; action?: GuideAction; error?: string };
        if (!response.ok || !result.answer) throw new Error(result.error ?? "The Guide Agent could not answer.");
        setMessages((items) => [...items, { id: `guide-agent-${Date.now()}`, role: "assistant", text: result.answer!, action: result.action, source: "provider" }]);
      } else {
        const result = localAnswer(trimmed);
        await new Promise((resolve) => window.setTimeout(resolve, 160));
        setMessages((items) => [...items, { id: `guide-local-${Date.now()}`, role: "assistant", text: result.text, action: result.action, source: "local" }]);
      }
    } catch (error) {
      const fallback = localAnswer(trimmed);
      setMessages((items) => [...items, {
        id: `guide-fallback-${Date.now()}`,
        role: "assistant",
        text: `${t("The Live Guide answer was unavailable, so I used the local guide.")} ${t(fallback.text)}`,
        action: fallback.action,
        source: "local"
      }]);
    } finally {
      setBusy(false);
      window.setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 40);
    }
  }

  return (
    <div className="guide-assistant">
      {open && (
        <section className="guide-panel" id="agenticxyz-guide" role="dialog" aria-label={t("AgenticXYZ Guide Agent")} aria-modal="false">
          <header className="guide-header">
            <span className="guide-logo" aria-hidden="true"><b>XYZ</b></span>
            <div>
              <strong>{t("AgenticXYZ Global Guide")}</strong>
              <span>{t("Global scope · all applications and the workbench")}</span>
            </div>
            <button type="button" onClick={closeGuide} aria-label={t("Close Guide Agent")}>×</button>
          </header>

          <div className="guide-status">
            <span className={state.providerConfig.available ? "connected" : ""} aria-hidden="true" />
            <p><strong>{t(state.providerConfig.available ? "Provider ready" : "Provider not configured")}</strong><small>{state.providerConfig.provider} · {state.providerConfig.model}</small></p>
            <button type="button" onClick={openProvider}>{t("Set up Provider")}</button>
          </div>

          <div className="guide-view-switch">
            <div><span>{t("View")}</span><strong>{t(applicationOnly ? "Application only" : "Full workbench")}</strong></div>
            <button type="button" onClick={toggleApplicationView} data-testid="toggle-application-view">
              {t(applicationOnly ? "Return to full workbench" : "Show only the reference application")}
            </button>
          </div>

          {modifiableReferenceApp ? (
            <ReferenceAppControls
              state={state}
              dispatch={dispatch}
              appId={modifiableReferenceApp}
              onApplied={(kind) => applyReferenceAction(modifiableReferenceApp, kind)}
              onPointToChange={() => focusTarget("legacy-app-change-surface")}
            />
          ) : (
            <section className="guide-next-card">
              <span>{t("Current guided step")} · {Math.min(state.guidedStep + 1, 9)}/9</span>
              <strong>{t(step.title)}</strong>
              <p>{t(step.description)}</p>
              <button type="button" onClick={showNext}><i className="guide-help-dot" aria-hidden="true" />{t("Show me where")}</button>
            </section>
          )}

          {applicationOnly && !modifiableReferenceApp && <FocusWorkflowControls state={state} dispatch={dispatch} runAgent={runAgent} loadingRole={loadingRole} onSelectReferenceApp={onSelectReferenceApp} />}

          <div className="guide-messages" ref={logRef} aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={`guide-message ${message.role}`}>
                <span>{message.role === "assistant" ? "A" : t("You")}</span>
                <div>
                  <p>{message.role === "assistant" ? t(message.text) : message.text}</p>
                  {message.source && <small>{t(message.source === "provider" ? "Live Provider answer" : "Local guide answer")}</small>}
                  {message.role === "assistant" && message.action && message.action !== "none" && (
                    <button type="button" onClick={() => runAction(message.action)}>{t(message.action === "open_provider" ? "Open settings" : message.action === "open_runtime" ? "Open Runtime" : message.action === "show_next" ? "Show next step" : "Open workspace")}</button>
                  )}
                  {message.role === "assistant" && message.referenceAction && (
                    <button type="button" onClick={() => applyReferenceAction(message.referenceAction!.appId, message.referenceAction!.kind)}>{t("Apply reversible change")}</button>
                  )}
                </div>
              </article>
            ))}
            {busy && <article className="guide-message assistant"><span>A</span><div><p>{t("Guide Agent is thinking…")}</p></div></article>}
          </div>

          <div className="guide-suggestions" aria-label={t("Suggested questions")}>
            <button type="button" onClick={() => void ask(t("What is a KPR?"))}>{t("What is a KPR?")}</button>
            <button type="button" onClick={() => void ask(t("Why is this Agent First?"))}>{t("Why Agent First?")}</button>
          </div>

          <form className="guide-compose" onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
            <textarea rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t("Ask about this software or its workflow…")} aria-label={t("Ask the Guide Agent")} />
            <button type="submit" disabled={busy || !question.trim()} aria-label={t("Send question")}>→</button>
          </form>
          <footer>{t("Guide boundary: it may explain and navigate, but never approve, attest, merge, or adopt for a person.")}</footer>
        </section>
      )}
      <button
        type="button"
        className="guide-fab"
        aria-label={t("Open AgenticXYZ Guide Agent")}
        aria-controls="agenticxyz-guide"
        aria-expanded={open}
        onClick={() => {
          if (open) closeGuide();
          else setOpen(true);
        }}
      >
        <span aria-hidden="true"><b>XYZ</b></span>
        <em className={state.providerConfig.available ? "connected" : ""} aria-hidden="true" />
      </button>
      {open && pointerTarget && pointerPosition && (
        <div
          className={`guide-attention-pointer direction-${pointerPosition.direction}`}
          style={{ left: pointerPosition.left, top: pointerPosition.top }}
          aria-hidden="true"
          data-testid="guide-attention-pointer"
        >
          <span>➜</span>
        </div>
      )}
    </div>
  );
}
