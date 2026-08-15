import { useEffect, useState } from "react";

import { ReferenceApplications } from "./ReferenceApplications";
import { StatusBadge } from "./StatusBadge";
import type { ViewProps } from "./types";
import { useI18n } from "../i18n";
import type { ReferenceAppId } from "../core/types";
import { activeReferenceAppChange, referenceAppConversationReply, referenceAppPresetFor, type ReferenceAppConversationReply } from "../core/referenceApps";

export function UserWorkspace({
  state,
  dispatch,
  runAgent,
  loadingRole,
  activeReferenceApp,
  onSelectReferenceApp
}: ViewProps & { activeReferenceApp: ReferenceAppId; onSelectReferenceApp: (appId: ReferenceAppId) => void }) {
  const { t } = useI18n();
  const proposal = state.proposals["user-side"];
  const preset = referenceAppPresetFor(activeReferenceApp);
  const presetActive = Boolean(preset && state.userRequest.trim() === preset.request);
  const modifiableReferenceApp = activeReferenceApp === "agent-demo" || activeReferenceApp === "daily-news" ? activeReferenceApp : undefined;
  const referenceChange = modifiableReferenceApp ? activeReferenceAppChange(state, modifiableReferenceApp) : undefined;
  const referenceDraft = referenceChange && state.referenceApps.kprDraft?.sourceChangeId === referenceChange.id ? state.referenceApps.kprDraft : undefined;
  const canApprove = Boolean(state.proposedOverlay) && !state.activeOverlay;
  const canVerify = Boolean(state.activeOverlay) && state.userWorkspace.status !== "verified";
  const canCreateKpr = state.userWorkspace.status === "verified" && !state.kpr;
  const [applicationConversation, setApplicationConversation] = useState<ReferenceAppConversationReply>();

  useEffect(() => {
    setApplicationConversation(undefined);
  }, [activeReferenceApp]);

  useEffect(() => {
    if (!referenceChange && applicationConversation?.message === "The reversible user-local change is applied and checkpointed. Verify it before asking me to form a KPR draft.") {
      setApplicationConversation(undefined);
    }
  }, [applicationConversation?.message, referenceChange]);

  function askAboutActiveApplication(request = state.userRequest) {
    if (!modifiableReferenceApp) return false;
    setApplicationConversation(referenceAppConversationReply(request, modifiableReferenceApp));
    return true;
  }

  function usePresetInConversation() {
    if (!preset) return;
    dispatch({ type: "SET_USER_REQUEST", value: preset.request });
    if (!askAboutActiveApplication(preset.request) && presetActive) void runAgent("user-side");
  }

  function applyConversationAction() {
    if (!modifiableReferenceApp || !applicationConversation?.action) return;
    dispatch({ type: "APPLY_REFERENCE_APP_CHANGE", appId: modifiableReferenceApp, kind: applicationConversation.action });
    setApplicationConversation({ message: "The reversible user-local change is applied and checkpointed. Verify it before asking me to form a KPR draft." });
  }

  return (
    <main className="workspace user-workspace" data-testid="user-workspace">
      <header className="workspace-heading">
        <div>
          <div className="eyebrow">{t("Agentic Software")}</div>
          <h2>{t("Combine software knowledge with user knowledge.")}</h2>
          <p>{t("The User-side Agent may change your reversible local realization. It cannot change the public project.")}</p>
        </div>
        <div className="knowledge-layer-legend" aria-label={t("Software knowledge layers")}>
          <span><i className="layer-policy" /> {t("Developer intent")}</span>
          <span><i className="layer-core" /> {t("Reference core")}</span>
          <span><i className="layer-user" /> {t("User realization")}</span>
        </div>
      </header>

      <div className="workspace-grid user-grid">
        <ReferenceApplications
          brief={state.brief}
          overlay={state.activeOverlay}
          status={state.activeOverlay ? "local overlay active" : "reference behavior"}
          experience={state.referenceApps}
          activeApp={activeReferenceApp}
          onSelectApp={onSelectReferenceApp}
          state={state}
          dispatch={dispatch}
          runAgent={runAgent}
          loadingRole={loadingRole}
        />

        <aside className="agent-stage" aria-label={t("User-side Agent panel")}>
          <div className="agent-identity">
            <span className="agent-glyph" aria-hidden="true">A</span>
            <div>
              <span>{t("User-side Agent")}</span>
              <strong>{t("Local knowledge partner")}</strong>
            </div>
            <StatusBadge status="R1" label={t("R1 · reversible")} />
          </div>

          <details className="software-contract" data-testid="software-contract" data-principle="agent-first">
            <summary>{t("Agent-readable software contract")}</summary>
            <div className="contract-meta">
              <span>{state.manifest.capabilities.length} {t("capabilities")}</span>
              <span>{state.manifest.mutableSurfaces.length} {t("surfaces")}</span>
              <span>{state.manifest.protectedInvariants.length} {t("invariants")}</span>
            </div>
            <div className="surface-list">
              {state.manifest.mutableSurfaces.map((surface) => (
                <div className="surface-row" key={surface.id}>
                  <div><strong>{t(surface.label)}</strong><code>{t(surface.category)}</code></div>
                  <p>
                    {t(surface.protected ? "Protected" : surface.userLocal ? "User-local" : "Project-controlled")}
                    {` · ${t(surface.contributable ? "contributable" : "not contributed")}`}
                    {` · ${t(surface.reversible ? "reversible" : "irreversible")}`}
                  </p>
                </div>
              ))}
            </div>
          </details>

          {preset && (
            <section className="preset-workflow" data-testid="reference-app-preset">
              <header><div><span>{t("Preset workflow")}</span><strong>{t(preset.title)}</strong></div><StatusBadge status={presetActive ? "active" : "preserved"} label={t(presetActive ? "Preset active" : "Custom request preserved")} /></header>
              <ol>{preset.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{t(step)}</p></li>)}</ol>
              <footer>
                <p>{t(presetActive ? "This request still matches a system preset and may follow the selected application automatically." : "Your edited request was not overwritten when the application changed.")}</p>
                {modifiableReferenceApp
                  ? <button type="button" onClick={usePresetInConversation}>{t(presetActive ? "Use this preset with the XYZ Agent" : "Load and use this preset with the XYZ Agent")}</button>
                  : !presetActive && <button type="button" onClick={() => dispatch({ type: "SET_USER_REQUEST", value: preset.request })}>{t("Load this preset")}</button>}
              </footer>
            </section>
          )}

          <label className="request-field">
            <span>{t("Describe what should work differently for you")}</span>
            <textarea
              value={t(state.userRequest)}
              onChange={(event) => dispatch({ type: "SET_USER_REQUEST", value: event.target.value })}
              rows={6}
              data-testid="user-request"
            />
          </label>
          <button
            className="button button-primary button-full"
            disabled={loadingRole === "user-side" || !state.userRequest.trim()}
            onClick={() => {
              if (!askAboutActiveApplication()) void runAgent("user-side");
            }}
            data-testid="run-user-agent"
          >
            {t(loadingRole === "user-side" ? "Agent is preparing a bounded proposal…" : modifiableReferenceApp ? "Ask the XYZ Agent about this change" : "Ask User-side Agent")}
          </button>

          {modifiableReferenceApp && applicationConversation && (
            <section className="user-xyz-conversation" data-testid="user-xyz-conversation" aria-live="polite">
              <header><span>XYZ</span><div><strong>{t("XYZ Agent application conversation")}</strong><small>{t("Same governed capability as the Local XYZ Agent")}</small></div><StatusBadge status={applicationConversation.action ? "proposal" : "reply"} label={t(applicationConversation.action ? "not applied" : "in scope")} /></header>
              <div className="user-xyz-message"><span>XYZ</span><p>{t(applicationConversation.message)}</p></div>
              {applicationConversation.action && (
                <button
                  className="button button-accent button-full"
                  type="button"
                  disabled={referenceChange?.kind === applicationConversation.action && referenceChange.status !== "rolled_back"}
                  onClick={applyConversationAction}
                >
                  {t(referenceChange?.kind === applicationConversation.action && referenceChange.status !== "rolled_back" ? "Change already applied" : "Apply reversible change")}
                </button>
              )}
              <footer>{t("Send a request here or in the Local XYZ Agent. Both operate the same application capabilities and governed state.")}</footer>
            </section>
          )}

          {activeReferenceApp === "research-brief" && proposal && (
            <section className="proposal-card" data-testid="user-proposal">
              <div className="card-heading">
                <span>{t("Plan preview")}</span>
                <StatusBadge status="proposal" label={t("not applied")} />
              </div>
              <p>{t(proposal.summary)}</p>
              <ol>{proposal.plan.map((item) => <li key={item}>{t(item)}</li>)}</ol>
              <div className="change-preview">
                <div><span>{t("Presentation")}</span><strong>{t("Conclusion → context → evidence")}</strong></div>
                <div><span>{t("Sources")}</span><strong>{t("Preserved")}</strong></div>
                <div><span>{t("Public core")}</span><strong>{t("Unchanged")}</strong></div>
                <div><span>{t("Memory")}</span><strong>{t("Only after confirmation")}</strong></div>
              </div>
            </section>
          )}

          {activeReferenceApp === "research-brief" && <div className="human-gate">
            <div className="section-label">{t("Human gate")}</div>
            <div className="gate-actions">
              <button className="button" disabled={!canApprove} onClick={() => dispatch({ type: "APPROVE_OVERLAY" })} data-testid="approve-overlay">
                {t("Approve local overlay")}
              </button>
              <button className="button" disabled={!canVerify} onClick={() => dispatch({ type: "VERIFY_OVERLAY" })} data-testid="verify-overlay">
                {t("Run local verifiers")}
              </button>
              <button className="button" disabled={!state.activeOverlay} onClick={() => dispatch({ type: "ROLLBACK_OVERLAY" })} data-testid="rollback-overlay">
                {t("Restore reference behavior")}
              </button>
              <button className="button button-accent" disabled={!canCreateKpr} onClick={() => dispatch({ type: "CREATE_KPR" })} data-testid="create-kpr">
                {t("Create KPR draft")}
              </button>
            </div>
          </div>}

          {activeReferenceApp === "research-brief" && state.userWorkspace.verifierResults.length > 0 && (
            <section className="verifier-list" data-testid="user-verifiers">
              <div className="section-label">{t("Independent evidence")}</div>
              {state.userWorkspace.verifierResults.map((result) => (
                <div className="verifier-row" key={result.id}>
                  <StatusBadge status={result.result} />
                  <div><strong>{t(result.title)}</strong><p>{t(result.summary)}</p></div>
                </div>
              ))}
            </section>
          )}

          {modifiableReferenceApp && (
            <section className="preset-progress" data-testid="reference-preset-progress">
              <div className="section-label">{t("Application-local progress")}</div>
              {!referenceChange && <p>{t("Send the request here or from the Local XYZ Agent. The XYZ Agent will propose an allowlisted capability before any change is applied.")}</p>}
              {referenceChange && <><div className="preset-progress-state"><code>{referenceChange.checkpointId}</code><StatusBadge status={referenceChange.status} label={t(referenceChange.status)} /></div><p>{t(referenceChange.summary)}</p><div className="gate-actions">{referenceChange.status === "applied" && <button className="button button-primary" type="button" onClick={() => dispatch({ type: "VERIFY_REFERENCE_APP_CHANGE", changeId: referenceChange.id })}>{t("Verify local change")}</button>}{referenceChange.status === "verified" && !referenceDraft && <button className="button button-accent" type="button" onClick={() => dispatch({ type: "CREATE_REFERENCE_APP_KPR", changeId: referenceChange.id })}>{t("Form this application's KPR")}</button>}<button className="button button-danger" type="button" onClick={() => dispatch({ type: "ROLLBACK_REFERENCE_APP_CHANGE", appId: modifiableReferenceApp })}>{t("Roll back last change")}</button></div></>}
              {referenceDraft && <div className="preset-progress-draft"><strong>{t("KPR draft ready")}</strong><p>{t(referenceDraft.problem)}</p><small>{t("Human review is still required")}</small></div>}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
