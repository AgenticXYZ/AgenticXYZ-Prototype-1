import { GUIDED_STEPS } from "../core/constants";
import type { ViewProps } from "./types";
import type { WorkspaceView } from "../core/types";
import type { PrincipleId } from "../core/types";
import { useI18n } from "../i18n";

const views: Array<{ id: WorkspaceView; code: string; title: string; subtitle: string }> = [
  { id: "user", code: "01", title: "User Workspace", subtitle: "Adapt locally" },
  { id: "kpr", code: "02", title: "KPR Bridge", subtitle: "Collaborate through knowledge" },
  { id: "developer", code: "03", title: "Developer Control Plane", subtitle: "Govern reliably" }
];

const principles: Array<{ id: PrincipleId; label: string; view: WorkspaceView }> = [
  { id: "agent-first", label: "Agent First", view: "user" },
  { id: "human-governed", label: "Human Governed", view: "kpr" },
  { id: "knowledge-before-code", label: "Knowledge before Code", view: "kpr" },
  { id: "evidence-before-adoption", label: "Evidence before Adoption", view: "developer" },
  { id: "project-owned-implementation", label: "Project-owned Implementation", view: "developer" }
];

export function Navigation({ state, dispatch }: Omit<ViewProps, "runAgent" | "loadingRole">) {
  const { t } = useI18n();
  return (
    <aside className="left-rail">
      <nav aria-label={t("Prototype workspaces")}>
        {views.map((view) => (
          <button
            key={view.id}
            className={`nav-item ${state.activeView === view.id ? "nav-active" : ""}`}
            onClick={() => dispatch({ type: "SET_VIEW", view: view.id })}
          >
            <span>{view.code}</span>
            <strong>{t(view.title)}</strong>
            <small>{t(view.subtitle)}</small>
          </button>
        ))}
      </nav>

      <section className="guided-progress" aria-labelledby="progress-title">
        <div className="section-label" id="progress-title">{t("Guided story")}</div>
        <ol>
          {GUIDED_STEPS.map((step, index) => (
            <li key={step} className={index < state.guidedStep ? "done" : index === state.guidedStep ? "current" : "pending"}>
              <span>{index < state.guidedStep ? "✓" : index + 1}</span>
              <p>{t(step)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="principle-note" aria-label={t("Principle lenses")}>
        <div className="section-label">{t("Principle lens")}</div>
        {principles.map((principle) => (
          <button
            key={principle.id}
            className={state.activePrinciple === principle.id ? "active" : ""}
            aria-pressed={state.activePrinciple === principle.id}
            onClick={() => {
              dispatch({ type: "SET_PRINCIPLE", principle: state.activePrinciple === principle.id ? undefined : principle.id });
              dispatch({ type: "SET_VIEW", view: principle.view });
            }}
          >
            {t(principle.label)}
          </button>
        ))}
        <p>{t("Click to reveal the object or human gate that embodies each principle.")}</p>
      </section>
    </aside>
  );
}
