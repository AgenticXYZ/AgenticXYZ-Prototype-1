import type { ViewProps } from "./types";
import { useI18n } from "../i18n";

export function Notifications({ state, dispatch }: Omit<ViewProps, "runAgent" | "loadingRole">) {
  const { t } = useI18n();
  return (
    <div className="notifications" role="status" aria-live="polite" aria-label={t("System notifications")}>
      {state.notifications.slice(-4).map((item) => (
        <div key={item.id} className={`notification notification-${item.kind}`}>
          <span>{item.kind === "success" ? "✓" : item.kind === "error" ? "!" : item.kind === "warning" ? "△" : "i"}</span>
          <p>{t(item.message)}</p>
          <button aria-label={t("Dismiss notification")} onClick={() => dispatch({ type: "DISMISS_NOTIFICATION", id: item.id })}>×</button>
        </div>
      ))}
    </div>
  );
}
