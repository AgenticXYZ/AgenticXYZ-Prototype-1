import { useEffect, useState } from "react";
import type { AgentRole, AgentRunEvent } from "../core/types";
import { StatusBadge } from "./StatusBadge";
import type { ViewProps } from "./types";
import { REPLAY_METADATA } from "../data/replay";
import { useI18n } from "../i18n";

const roles: Array<{ id: AgentRole; label: string }> = [
  { id: "user-side", label: "User-side" },
  { id: "maintainer-side", label: "Maintainer-side" },
  { id: "project", label: "Project" }
];
const planes: Array<{ id: AgentRunEvent["plane"]; label: string; question: string }> = [
  { id: "context", label: "Context", question: "What could the Agent see?" },
  { id: "policy", label: "Policy", question: "What was allowed or blocked?" },
  { id: "action", label: "Action", question: "What did it actually propose or call?" },
  { id: "proof", label: "Proof", question: "What supports success or failure?" },
  { id: "memory", label: "Memory", question: "What governed state persists?" }
];

export function RuntimeInspector({ state, dispatch, loadingRole, cancelRun }: Omit<ViewProps, "runAgent"> & { cancelRun: () => void }) {
  const { t, language } = useI18n();
  const availableRole = state.runs.at(-1)?.role ?? "user-side";
  const [role, setRole] = useState<AgentRole>(availableRole);
  const [plane, setPlane] = useState<AgentRunEvent["plane"]>("action");
  useEffect(() => {
    if (state.showRuntime) setRole(availableRole);
  }, [availableRole, state.showRuntime]);
  if (!state.showRuntime) return null;
  const roleRuns = state.runs.filter((item) => item.role === role);
  const run = roleRuns.at(-1);
  const events = run?.events.filter((item) => item.plane === plane) ?? [];
  return (
      <aside className="runtime-inspector" role="dialog" aria-modal="false" aria-labelledby="runtime-title" data-testid="runtime-sidebar">
        <header>
          <div><div className="eyebrow">{t("Agentic Runtime")}</div><h2 id="runtime-title">{t("Inspectable execution, not hidden magic.")}</h2></div>
          <button className="icon-button" aria-label={t("Close Runtime Inspector")} onClick={() => dispatch({ type: "TOGGLE_RUNTIME", value: false })}>×</button>
        </header>
        <div className="runtime-disclosure"><StatusBadge status={state.mode} /><p>{state.mode === "live" ? t("Live events returned by the local Provider Gateway.") : state.mode === "replay" ? language === "zh-CN" ? `已冻结并脱敏审查的参考记录（${REPLAY_METADATA.checksum}，${REPLAY_METADATA.evidenceLevel}）；与 Provider 支持证据相互独立。` : `Frozen, redacted reference fixture (${REPLAY_METADATA.checksum}, ${REPLAY_METADATA.evidenceLevel}); ${REPLAY_METADATA.liveValidation}.` : t("Deterministic fallback events. No model request.")}</p></div>
        <div className="runtime-role-tabs">
          {roles.map((item) => {
            const count = state.runs.filter((runItem) => runItem.role === item.id).length;
            return <button key={item.id} className={role === item.id ? "active" : ""} onClick={() => setRole(item.id)}>{t(item.label)}<span>{count > 0 ? `● ${count}` : "○"}</span></button>;
          })}
        </div>
        {run ? (
          <>
            <div className="run-summary">
              <div><span>{t("Status")}</span><StatusBadge status={run.status} /></div>
              <div><span>{t("Provider")}</span><strong>{run.provider ?? "none"}</strong></div>
              <div><span>{t("Model")}</span><strong>{run.model ?? "deterministic"}</strong></div>
              <div><span>{t("Skill")}</span><strong title={run.skillId}>{run.skillId}</strong></div>
              <div><span>{t("Provider calls")}</span><strong>{run.budget.providerCallsUsed}/{run.budget.maxProviderCalls}</strong></div>
              <div><span>{t("Tool budget")}</span><strong>{run.budget.toolCallsUsed}/{run.budget.maxToolCalls}</strong></div>
              <div><span>{t("Tokens / cap")}</span><strong>{(run.usage?.inputTokens ?? 0) + (run.usage?.outputTokens ?? 0) || "n/a"} / {run.budget.maxInputTokens + run.budget.maxOutputTokens}</strong></div>
            </div>
            <div className="plane-tabs" aria-label={t("Runtime planes")}>
              {planes.map((item) => <button key={item.id} className={plane === item.id ? "active" : ""} onClick={() => setPlane(item.id)}><strong>{t(item.label)}</strong><span>{t(item.question)}</span></button>)}
            </div>
            <div className="event-timeline">
              {events.length === 0 ? <p className="inline-empty">{language === "zh-CN" ? `本次运行没有${t(planes.find((item) => item.id === plane)?.label ?? plane)}事件。` : `No ${plane} events in this run.`}</p> : events.map((item) => <article key={item.id}><span className="event-sequence">{String(item.sequence).padStart(2, "0")}</span><div><header><strong>{t(item.title)}</strong><StatusBadge status={item.type} /></header><p>{t(item.summary)}</p><time>{new Date(item.timestamp).toLocaleTimeString(language)}</time></div></article>)}
            </div>
            <footer className="runtime-footer"><p><strong>{t("Termination:")}</strong> {t(run.terminationReason ?? "")}</p>{loadingRole && <button className="button button-danger" onClick={cancelRun}>{t("Cancel live request")}</button>}</footer>
          </>
        ) : <div className="runtime-empty"><strong>{language === "zh-CN" ? `${t(roles.find((item) => item.id === role)?.label ?? role)}智能体尚无运行记录。` : `No ${role} run yet.`}</strong><p>{t("Run the corresponding Agent in its workspace. Runtime events will appear here.")}</p></div>}
      </aside>
  );
}
