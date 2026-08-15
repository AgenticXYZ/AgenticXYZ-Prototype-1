import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { DeveloperControlPlane } from "./components/DeveloperControlPlane";
import { AgentAssistant } from "./components/AgentAssistant";
import { Header } from "./components/Header";
import { KprBridge } from "./components/KprBridge";
import { Navigation } from "./components/Navigation";
import { Notifications } from "./components/Notifications";
import { ProviderSettings } from "./components/ProviderSettings";
import { RuntimeInspector } from "./components/RuntimeInspector";
import { UserWorkspace } from "./components/UserWorkspace";
import { redactText } from "./core/privacy";
import { isReferenceAppPresetRequest, referenceAppPresetFor } from "./core/referenceApps";
import { appReducer } from "./core/reducer";
import { cancelledRun, fallbackResponse } from "./core/runs";
import type { AgentRole, AgentTurnResponse, AppState, ProviderId, ReferenceAppId } from "./core/types";
import { createInitialState, normalizeAppState } from "./data/initial";
import { LanguageProvider, type Language } from "./i18n";

const STORAGE_KEY = "agenticxyz-prototype-1-state";
const LANGUAGE_STORAGE_KEY = "agenticxyz-language";
const APPLICATION_ONLY_STORAGE_KEY = "agenticxyz-application-only";

function initializeState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createInitialState();
    const parsed = JSON.parse(stored) as AppState;
    return parsed.version === "0.1.0" && parsed.manifest?.projectId === "research-brief" ? normalizeAppState(parsed) : createInitialState();
  } catch {
    return createInitialState();
  }
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, initializeState);
  const [loadingRole, setLoadingRole] = useState<AgentRole>();
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem(LANGUAGE_STORAGE_KEY) === "zh-CN" ? "zh-CN" : "en");
  const [applicationOnly, setApplicationOnly] = useState(() => localStorage.getItem(APPLICATION_ONLY_STORAGE_KEY) === "true");
  const [activeReferenceApp, setActiveReferenceApp] = useState<ReferenceAppId>("research-brief");
  const abortRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const persisted = redactText(JSON.stringify({ ...state, notifications: [] }));
    localStorage.setItem(STORAGE_KEY, persisted);
  }, [state]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    localStorage.setItem(APPLICATION_ONLY_STORAGE_KEY, String(applicationOnly));
  }, [applicationOnly]);

  useEffect(() => {
    if (import.meta.env.VITE_STATIC_DEMO === "true") return;
    void fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) throw new Error("Gateway unavailable");
        return response.json() as Promise<{
          activeProvider: ProviderId;
          activeModel: string;
          providers: Array<{ provider: ProviderId; available: boolean; active: boolean; source: "environment" | "session" | "none" }>;
        }>;
      })
      .then((health) => {
        const active = health.providers.find((item) => item.active);
        dispatch({
          type: "SET_PROVIDER_CONFIG",
          config: {
            provider: health.activeProvider,
            model: health.activeModel,
            available: Boolean(active?.available),
            source: active?.source ?? "none"
          }
        });
      })
      .catch(() => {
        // Static deployments intentionally run without a live gateway.
      });
  }, []);

  const runAgent = useCallback(async (role: AgentRole) => {
    if (loadingRole) return;
    setLoadingRole(role);
    if (state.mode !== "live") {
      const result = fallbackResponse(state.mode, role, state.kpr);
      await new Promise((resolve) => setTimeout(resolve, 320));
      dispatch({ type: "APPLY_AGENT_RESPONSE", run: result.run, proposal: result.proposal });
      setLoadingRole(undefined);
      return;
    }
    if (!state.providerConfig.available) {
      dispatch({ type: "ADD_NOTIFICATION", kind: "error", message: "No key is configured for the active Provider. Open the model API settings, or use Replay or Scripted mode." });
      setLoadingRole(undefined);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/agent/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          role,
          provider: state.providerConfig.provider,
          model: state.providerConfig.model,
          language,
          userMessage:
            role === "user-side"
              ? state.userRequest
              : role === "maintainer-side"
                ? "Help me understand this KPR, map its impact, and propose claim resolutions without making decisions for me."
                : "Implement only the approved Integration Contract using Blind Reconstruction, then return a candidate for verification.",
          context: {
            manifest: state.manifest,
            policy: state.policy,
            brief: role === "user-side" ? state.brief : undefined,
            overlay: role === "user-side" ? state.activeOverlay : undefined,
            kpr: role === "maintainer-side" ? state.kpr : undefined,
            contract: role === "project" ? state.contract : undefined
          }
        })
      });
      const result = (await response.json()) as AgentTurnResponse & { error?: string };
      if (!result.run) throw new Error(result.error ?? "Gateway response did not include an Agent Run.");
      dispatch({ type: "APPLY_AGENT_RESPONSE", run: result.run, proposal: result.proposal });
      if (!response.ok) dispatch({ type: "ADD_NOTIFICATION", kind: "error", message: result.assistantMessage });
    } catch (error) {
      if (controller.signal.aborted) {
        dispatch({ type: "APPLY_AGENT_RESPONSE", run: cancelledRun(role, state.providerConfig) });
      } else {
        dispatch({ type: "ADD_NOTIFICATION", kind: "error", message: error instanceof Error ? error.message : "Live Agent request failed." });
      }
    } finally {
      abortRef.current = undefined;
      setLoadingRole(undefined);
    }
  }, [language, loadingRole, state]);

  const cancelRun = useCallback(() => abortRef.current?.abort(), []);
  const runAgentInApplicationView = useCallback(async (role: AgentRole) => runAgent(role), [runAgent]);
  const selectReferenceApp = useCallback((appId: ReferenceAppId) => {
    const preset = referenceAppPresetFor(appId);
    if (preset && isReferenceAppPresetRequest(state.userRequest) && state.userRequest !== preset.request) {
      dispatch({ type: "SET_USER_REQUEST", value: preset.request });
    }
    setActiveReferenceApp(appId);
  }, [state.userRequest]);
  const viewProps = { state, dispatch, runAgent, loadingRole };

  return (
    <LanguageProvider language={language}>
      <div
        className={`app-shell${applicationOnly ? " application-only" : ""}`}
        data-active-principle={state.activePrinciple}
        data-application-only={applicationOnly}
      >
        {applicationOnly
          ? <ProviderSettings config={state.providerConfig} dispatch={dispatch} showTrigger={false} />
          : <Header state={state} dispatch={dispatch} language={language} setLanguage={setLanguage} />}
        <div className={`app-body${state.showRuntime && !applicationOnly ? " runtime-open" : ""}`}>
          {!applicationOnly && <Navigation state={state} dispatch={dispatch} />}
          {(applicationOnly || state.activeView === "user") && (
            <UserWorkspace
              {...viewProps}
              activeReferenceApp={activeReferenceApp}
              onSelectReferenceApp={selectReferenceApp}
            />
          )}
          {!applicationOnly && state.activeView === "kpr" && <KprBridge {...viewProps} />}
          {!applicationOnly && state.activeView === "developer" && <DeveloperControlPlane {...viewProps} />}
          {!applicationOnly && <RuntimeInspector state={state} dispatch={dispatch} loadingRole={loadingRole} cancelRun={cancelRun} />}
        </div>
        <AgentAssistant
          state={state}
          dispatch={dispatch}
          language={language}
          runAgent={runAgentInApplicationView}
          loadingRole={loadingRole}
          applicationOnly={applicationOnly}
          setApplicationOnly={setApplicationOnly}
          activeReferenceApp={activeReferenceApp}
          onSelectReferenceApp={selectReferenceApp}
        />
        <Notifications state={state} dispatch={dispatch} />
      </div>
    </LanguageProvider>
  );
}
