import { useEffect, useRef, useState } from "react";

import type { AppAction } from "../core/reducer";
import type { ProviderConfig, ProviderId } from "../core/types";
import { useI18n } from "../i18n";
import { StatusBadge } from "./StatusBadge";

const defaultModels: Record<ProviderId, string> = {
  openai: "gpt-5.6-terra",
  anthropic: "claude-sonnet-4-6",
  deepseek: "deepseek-v4-flash"
};

export function ProviderSettings({
  config,
  dispatch,
  showTrigger = true
}: {
  config: ProviderConfig;
  dispatch: React.Dispatch<AppAction>;
  showTrigger?: boolean;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [provider, setProvider] = useState<ProviderId>(config.provider);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setProvider(config.provider);
    setModel(config.model);
  }, [config.model, config.provider]);

  useEffect(() => {
    const handleOpen = () => open();
    window.addEventListener("agenticxyz:open-provider-settings", handleOpen);
    return () => window.removeEventListener("agenticxyz:open-provider-settings", handleOpen);
  }, [config.model, config.provider]);

  function open() {
    setProvider(config.provider);
    setModel(config.model);
    setApiKey("");
    setError("");
    dialogRef.current?.showModal();
  }

  function close() {
    if (checking) return;
    setApiKey("");
    setError("");
    dialogRef.current?.close();
  }

  async function verifyAndUse() {
    if (!apiKey.trim() && !(provider === config.provider && config.available)) {
      setError(t("Enter an API key or reuse an existing Gateway key."));
      return;
    }
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/provider/configure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, model, apiKey: apiKey.trim() || undefined })
      });
      const result = await response.json() as ProviderConfig & { error?: string };
      if (!response.ok || !result.available) throw new Error(result.error ?? "Connection check failed.");
      dispatch({ type: "SET_PROVIDER_CONFIG", config: result });
      dispatch({ type: "SET_MODE", mode: "live" });
      dispatch({ type: "ADD_NOTIFICATION", kind: "success", message: "Connection verified. Live Agent mode is ready." });
      setApiKey("");
      dialogRef.current?.close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection check failed.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      {showTrigger && (
        <button className="provider-readout" type="button" onClick={open} aria-label={t("Configure model API")}>
          <span className="provider-label">{config.provider}</span>
          <strong>{config.model}</strong>
          <StatusBadge
            status={config.available ? "available" : "not_configured"}
            label={config.available ? (config.source === "session" ? t("session key") : t("key ready")) : t("no server key")}
          />
        </button>
      )}

      <dialog className="provider-dialog" ref={dialogRef} aria-label={t("Model API settings")} onCancel={(event) => { event.preventDefault(); close(); }}>
        <form method="dialog" onSubmit={(event) => event.preventDefault()}>
          <header>
            <div>
              <div className="eyebrow">{t("Model API settings")}</div>
              <h2>{t("Configure model API")}</h2>
              <p>{t("Use one Provider and model for every Agent role in this run.")}</p>
            </div>
            <button type="button" className="icon-button" onClick={close} aria-label={t("Close model API settings")}>×</button>
          </header>

          <div className="provider-form-grid">
            <label>
              <span>{t("Provider")}</span>
              <select
                value={provider}
                disabled={checking}
                onChange={(event) => {
                  const next = event.target.value as ProviderId;
                  setProvider(next);
                  setModel(next === config.provider ? config.model : defaultModels[next]);
                  setApiKey("");
                  setError("");
                }}
              >
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </label>
            <label>
              <span>{t("Model")}</span>
              <input value={model} disabled={checking} onChange={(event) => setModel(event.target.value)} autoComplete="off" />
            </label>
            <label className="provider-key-field">
              <span>{t("API key")}</span>
              <input
                type="password"
                value={apiKey}
                disabled={checking}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-…"
              />
              <small>{t("Leave blank to reuse the key already available to the local Gateway.")}</small>
            </label>
          </div>

          <div className="provider-security-note">
            <span aria-hidden="true">◎</span>
            <p>{t("The key is sent only to the local Gateway for verification. It is never written to browser storage, exports, or project files.")}</p>
          </div>
          {error && <p className="provider-error" role="alert">{error}</p>}
          <footer>
            <button type="button" className="button" disabled={checking} onClick={close}>{t("Cancel")}</button>
            <button type="button" className="button button-primary" disabled={checking || !model.trim()} onClick={() => void verifyAndUse()}>
              {checking ? t("Checking connection…") : t("Test connection & use")}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
