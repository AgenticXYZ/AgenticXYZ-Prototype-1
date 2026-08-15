import type { BriefDocument, UserOverlay } from "../core/types";
import { useI18n } from "../i18n";

function Conclusion({ brief }: { brief: BriefDocument }) {
  const { t } = useI18n();
  return (
    <section className="brief-conclusion" data-section="conclusion">
      <div className="section-label">{t("Conclusion")}</div>
      <p>{t(brief.conclusion)}</p>
    </section>
  );
}

function Evidence({ brief, preserveSources }: { brief: BriefDocument; preserveSources: boolean }) {
  const { t } = useI18n();
  return (
    <section data-section="evidence">
      <div className="section-label">{t("Evidence")}</div>
      <div className="evidence-list">
        {brief.evidence.map((item, index) => (
          <article key={item.id} className="evidence-row">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <p>{t(item.claim)}</p>
              {preserveSources && <a href={item.url}>{t(item.source)}</a>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function BriefPreview({ brief, overlay }: { brief: BriefDocument; overlay?: UserOverlay }) {
  const { t } = useI18n();
  const conclusionFirst = overlay?.conclusionFirst ?? false;
  const preserveSources = overlay?.preserveSources ?? true;
  return (
    <article className="brief-preview" aria-label={t("Research Brief preview")}>
      <header>
        <span>{t("Research Brief · 04 min")}</span>
        <h2>{t(brief.title)}</h2>
        <p className="brief-question">{t(brief.question)}</p>
      </header>
      {conclusionFirst && <Conclusion brief={brief} />}
      <section data-section="context">
        <div className="section-label">{t("Context")}</div>
        <p>{t(brief.context)}</p>
      </section>
      {!conclusionFirst && <Conclusion brief={brief} />}
      <Evidence brief={brief} preserveSources={preserveSources} />
      <section className="brief-limitations">
        <div className="section-label">{t("Limitations")}</div>
        <ul>{brief.limitations.map((item) => <li key={item}>{t(item)}</li>)}</ul>
      </section>
    </article>
  );
}
