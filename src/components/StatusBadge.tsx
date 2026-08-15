import { useI18n } from "../i18n";

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const { t } = useI18n();
  const normalized = status.toLowerCase().replaceAll("_", "-");
  const tone =
    /pass|verified|adopted|success|accepted|completed|approved/.test(normalized)
      ? "positive"
      : /fail|reject|error|blocked/.test(normalized)
        ? "negative"
        : /warning|needs|revision|defer|rollback/.test(normalized)
          ? "warning"
          : "neutral";
  return <span className={`status-badge status-${tone}`}>{t(label ?? status.replaceAll("_", " "))}</span>;
}
