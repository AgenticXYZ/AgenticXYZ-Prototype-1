import type { ChangeEvent } from "react";
import { exportProjectState, downloadText } from "../core/export";
import type { ViewProps } from "./types";
import { MODE_LABELS } from "../core/constants";
import { REPLAY_METADATA } from "../data/replay";
import { parseImportedState } from "../core/import";
import { type Language, useI18n } from "../i18n";
import { ProviderSettings } from "./ProviderSettings";

export function Header({
  state,
  dispatch,
  language,
  setLanguage,
  staticDemo
}: Omit<ViewProps, "runAgent" | "loadingRole"> & { language: Language; setLanguage: (language: Language) => void; staticDemo: boolean }) {
  const { t } = useI18n();
  const displayMode = staticDemo && state.mode === "live" ? "replay" : state.mode;
  function importState(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      dispatch({ type: "ADD_NOTIFICATION", kind: "error", message: "State file exceeds the 5 MB import limit." });
      event.target.value = "";
      return;
    }
    void file.text().then((contents) => {
      try {
        const parsed = parseImportedState(contents);
        dispatch({ type: "LOAD_STATE", state: parsed });
        dispatch({ type: "ADD_NOTIFICATION", kind: "success", message: "Project state imported. Credential availability was reset to the local gateway truth." });
      } catch (error) {
        dispatch({ type: "ADD_NOTIFICATION", kind: "error", message: error instanceof Error ? error.message : "Import failed." });
      } finally {
        event.target.value = "";
      }
    });
  }

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">X</div>
        <div>
          <div className="eyebrow">AgenticXYZ · Prototype 1</div>
          <h1>{t("Agents with People")}</h1>
        </div>
      </div>

      <div className="header-controls">
        <label className="compact-field">
          <span className="visually-hidden">{t("Run mode")}</span>
          <select
            aria-label={t("Run mode")}
            value={displayMode}
            onChange={(event) => dispatch({ type: "SET_MODE", mode: event.target.value as typeof state.mode })}
          >
            <option value="replay">{t("Recorded Replay")}</option>
            <option value="scripted">{t("Scripted Fallback")}</option>
            {!staticDemo && <option value="live">{t("Live Agent")}</option>}
          </select>
        </label>
        {!staticDemo && <ProviderSettings config={state.providerConfig} dispatch={dispatch} />}
        <div className="language-switch" role="group" aria-label={t("Choose language")}>
          <button type="button" className={language === "zh-CN" ? "active" : ""} aria-pressed={language === "zh-CN"} onClick={() => setLanguage("zh-CN")}>中</button>
          <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
        </div>
        <button className="button button-quiet header-action" onClick={() => dispatch({ type: "TOGGLE_RUNTIME" })}>
          {t("Runtime")}
        </button>
        <details className="header-menu">
          <summary aria-label={t("Project menu")}>•••</summary>
          <div className="menu-popover">
            <button onClick={() => downloadText("agenticxyz-state.json", exportProjectState(state), "application/json")}>{t("Export state")}</button>
            <label className="menu-file">
              {t("Import state")}
              <input type="file" accept="application/json" onChange={importState} />
            </label>
            <button onClick={() => dispatch({ type: "RESET" })}>{t("Reset guided demo")}</button>
          </div>
        </details>
      </div>
      <div className="mode-disclosure" role="status">
        <strong>{t(MODE_LABELS[displayMode])}</strong>
        <span>
          {displayMode === "live"
            ? t("Calls the selected provider through the local gateway.")
            : displayMode === "replay"
              ? language === "zh-CN"
                ? `参考记录 · ${REPLAY_METADATA.provider}/${REPLAY_METADATA.model} · ${REPLAY_METADATA.runDate.slice(0, 10)} · 脱敏审查已通过 · ${REPLAY_METADATA.checksum} · ${REPLAY_METADATA.evidenceLevel} · 不调用模型。`
                : `Reference fixture · ${REPLAY_METADATA.provider}/${REPLAY_METADATA.model} · ${REPLAY_METADATA.runDate.slice(0, 10)} · redaction ${REPLAY_METADATA.redactionStatus} · ${REPLAY_METADATA.checksum} · ${REPLAY_METADATA.evidenceLevel} · no provider call.`
              : t("Runs a deterministic fallback. No model call is occurring.")}
        </span>
      </div>
    </header>
  );
}
