import { useState } from "react";
import { downloadText, exportKprJson, exportKprMarkdown } from "../core/export";
import { StatusBadge } from "./StatusBadge";
import type { ViewProps } from "./types";
import { useI18n } from "../i18n";

type KprTab = "brief" | "knowledge" | "provenance" | "evidence" | "raw";
type ReferenceKprTab = "brief" | "knowledge" | "evidence" | "raw";

function ReferenceApplicationKpr({ state, dispatch }: Pick<ViewProps, "state" | "dispatch">) {
  const { t, language } = useI18n();
  const [tab, setTab] = useState<ReferenceKprTab>("brief");
  const draft = state.referenceApps.kprDraft!;
  const change = state.referenceApps.changes.find((item) => item.id === draft.sourceChangeId);
  const appName = draft.appId === "agent-demo" ? "Agent Demo" : "Daily News & Notes";
  const renderRealization = (realization: Record<string, unknown>) => Object.entries(realization).map(([key, value]) => (
    <div key={key}><span>{t(key)}</span><strong>{typeof value === "boolean" ? t(value ? "Enabled" : "Disabled") : t(String(value))}</strong></div>
  ));

  const rollback = () => {
    dispatch({ type: "ROLLBACK_REFERENCE_APP_CHANGE", appId: draft.appId });
    dispatch({ type: "SET_VIEW", view: "user" });
  };

  return (
    <main className="workspace kpr-workspace reference-kpr-workspace" data-testid="kpr-workspace" data-kpr-kind="reference-application">
      <header className="workspace-heading kpr-heading">
        <div>
          <div className="eyebrow">{t("Knowledge-based Pull Request")}</div>
          <h2>{t("Review the knowledge before deciding how the project should change.")}</h2>
          <p>{t("The verified local realization is evidence. The KPR carries human intent, expected behavior, and boundaries—not project-authoritative code.")}</p>
        </div>
        <div className="kpr-identity">
          <code>{draft.id.slice(0, 24)}</code>
          <StatusBadge status={draft.status} label={t("Agent structured · human review required")} />
          <span>Schema {draft.schemaVersion}</span>
        </div>
      </header>

      <div className="kpr-toolbar">
        <div className="tab-list" role="tablist" aria-label={t("KPR views")}>
          {(["brief", "knowledge", "evidence", "raw"] as ReferenceKprTab[]).map((item) => (
            <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{t(item)}</button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button onClick={() => downloadText(`${draft.id}.json`, JSON.stringify(draft, null, 2), "application/json")}>{t("Export JSON")}</button>
        </div>
      </div>

      <div className="kpr-layout">
        <section className="kpr-main">
          {tab === "brief" && (
            <div className="reference-kpr-brief" data-testid="reference-kpr-brief">
              <div className="section-heading-row"><h3>{t(appName)} · {t(change?.title ?? draft.title)}</h3><span>{t("Decision brief · knowledge before code")}</span></div>
              <p className="lead">{t(draft.problem)}</p>
              <div className="reference-kpr-summary-grid">
                <div><span>{t("Source application")}</span><strong>{t(appName)}</strong></div>
                <div><span>{t("Source state")}</span><strong>{t("Verified user-local change")}</strong></div>
                <div><span>{t("Knowledge package")}</span><strong>{draft.expectedBehavior.length} {t("expected behaviors")} · {draft.acceptanceCriteria.length} {t("acceptance criteria")}</strong></div>
                <div><span>{t("Current decision")}</span><strong>{t("Review intent and evidence; project implementation is undecided")}</strong></div>
              </div>

              {change && (
                <section className="reference-kpr-change" data-testid="reference-kpr-change">
                  <header>
                    <div><span className="section-label">{t("Local realization change")}</span><h4>{t(change.title)}</h4></div>
                    <StatusBadge status={change.status} label={t(change.status)} />
                  </header>
                  <p>{t(change.summary)}</p>
                  <div className="reference-change-diff">
                    <section><span>{t("Before")}</span>{renderRealization(change.before as unknown as Record<string, unknown>)}</section>
                    <i aria-hidden="true">→</i>
                    <section><span>{t("After")}</span>{renderRealization(change.after as unknown as Record<string, unknown>)}</section>
                  </div>
                  <footer>
                    <div><span>{t("Rollback checkpoint")}</span><code>{change.checkpointId}</code></div>
                    <button className="button button-danger" type="button" onClick={rollback} data-testid="reference-kpr-rollback">{t("Roll back this local change")}</button>
                  </footer>
                </section>
              )}
            </div>
          )}

          {tab === "knowledge" && (
            <div className="reference-kpr-section" data-testid="reference-kpr-knowledge">
              <div className="section-heading-row"><h3>{t("Knowledge to review")}</h3><span>{t("Human intent translated by the XYZ Agent")}</span></div>
              <section><span className="section-label">{t("Problem")}</span><p className="lead compact">{t(draft.problem)}</p></section>
              <section><span className="section-label">{t("Expected behavior")}</span><ol>{draft.expectedBehavior.map((item) => <li key={item}>{t(item)}</li>)}</ol></section>
              <section><span className="section-label">{t("Acceptance boundary")}</span><ol>{draft.acceptanceCriteria.map((item) => <li key={item}>{t(item)}</li>)}</ol></section>
              <section className="counterexample-box"><span className="section-label">{t("Explicit limitations")}</span>{draft.limitations.map((item) => <p key={item}>{t(item)}</p>)}</section>
            </div>
          )}

          {tab === "evidence" && (
            <div className="reference-kpr-section" data-testid="reference-kpr-evidence">
              <div className="section-heading-row"><h3>{t("Evidence and provenance")}</h3><span>{t("What was observed, and where it came from")}</span></div>
              <section><span className="section-label">{t("Verified evidence")}</span>{draft.evidence.map((item, index) => <article className="reference-evidence-row" key={item}><b>{String(index + 1).padStart(2, "0")}</b><p>{t(item)}</p><StatusBadge status="verified" label={t("verified")} /></article>)}</section>
              <section><span className="section-label">{t("Knowledge Provenance")}</span>{draft.provenance.map((item, index) => <article className="reference-provenance-row" key={item}><b>{String(index + 1).padStart(2, "0")}</b><p>{index === 2 && change ? `${t("Verified user-side checkpoint")} ${change.checkpointId}` : t(item)}</p></article>)}</section>
            </div>
          )}

          {tab === "raw" && <pre className="raw-json">{JSON.stringify(draft, null, 2)}</pre>}
        </section>

        <aside className="kpr-sidebar">
          <section data-principle="human-governed">
            <div className="section-label">{t("Human review boundary")}</div>
            <StatusBadge status="review" label={t("Human decision required")} />
            <p>{t("The XYZ Agent has structured the contribution. A person still decides what it means, whether it should proceed, and how the project may implement it.")}</p>
          </section>
          <section>
            <div className="section-label">{t("Contribution authority")}</div>
            <div className="gate-check"><span>{t("Local behavior")}</span><strong>{t("Verified")}</strong></div>
            <div className="gate-check"><span>{t("Project code")}</span><strong>{t("Not authorized")}</strong></div>
            <div className="gate-check"><span>{t("Merge / adoption")}</span><strong>{t("Human only")}</strong></div>
          </section>
          <section>
            <div className="section-label">{t("Structured by")}</div>
            <strong>{t(draft.structuredBy)}</strong>
            <p>{new Date(draft.createdAt).toLocaleString(language)}</p>
          </section>
          <section><button className="button button-primary button-full" type="button" onClick={() => dispatch({ type: "SET_VIEW", view: "user" })}>{t("Return to User Workspace")}</button></section>
        </aside>
      </div>
    </main>
  );
}

export function KprBridge({ state, dispatch }: ViewProps) {
  const { t, language } = useI18n();
  const [tab, setTab] = useState<KprTab>("brief");
  const [selectedClaimId, setSelectedClaimId] = useState<string>();
  const kpr = state.kpr;
  if (!kpr && state.referenceApps.kprDraft) {
    return <ReferenceApplicationKpr state={state} dispatch={dispatch} />;
  }
  if (!kpr) {
    return (
      <main className="workspace empty-state" data-testid="kpr-workspace">
        <div className="empty-index">02</div>
        <h2>{t("No Knowledge-based Pull Request yet.")}</h2>
        <p>{t("Verify a local User Overlay and let the contributor attest the extracted knowledge first.")}</p>
        <button className="button button-primary" onClick={() => dispatch({ type: "SET_VIEW", view: "user" })}>{t("Return to User Workspace")}</button>
      </main>
    );
  }

  const sourceLabel = (claim: (typeof kpr.knowledgeClaims)[number]) => {
    if (!claim.agentGenerated) return t("Human-authored");
    const corrected = kpr.decisionRecord.some((item) => item.id === `decision-contributor-correction-${claim.id}`);
    if (claim.humanAttestation) return t(corrected ? "Agent-extracted · Human-corrected · Human-attested" : "Agent-extracted · Human-attested");
    return t(corrected ? "Agent-extracted · Human-corrected" : "Agent-extracted · awaiting human review");
  };
  const contributorCorrections = kpr.decisionRecord.filter((item) => item.id.startsWith("decision-contributor-correction-"));
  const selectedClaim = kpr.knowledgeClaims.find((claim) => claim.id === selectedClaimId);
  const linkedEvidence = selectedClaimId
    ? kpr.evidence.filter((item) => item.supportsClaimIds.includes(selectedClaimId))
    : kpr.evidence;

  return (
    <main className="workspace kpr-workspace" data-testid="kpr-workspace">
      <header className="workspace-heading kpr-heading">
        <div>
          <div className="eyebrow">{t("Knowledge-based Pull Request")}</div>
          <h2>{t("Exchange knowledge, intent, and evidence—not just a patch.")}</h2>
          <p>{t("The local implementation is evidence. The project decides what knowledge to adopt and how to implement it.")}</p>
        </div>
        <div className="kpr-identity">
          <code>{kpr.id.slice(0, 20)}</code>
          <StatusBadge status={kpr.status} />
          <span>Schema {kpr.schemaVersion}</span>
        </div>
      </header>

      <div className="kpr-toolbar">
        <div className="tab-list" role="tablist" aria-label={t("KPR views")}>
          {(["brief", "knowledge", "provenance", "evidence", "raw"] as KprTab[]).map((item) => (
            <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
              {t(item)}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button onClick={() => downloadText(`${kpr.id}.md`, exportKprMarkdown(kpr), "text/markdown")}>{t("Export Markdown")}</button>
          <button onClick={() => downloadText(`${kpr.id}.json`, exportKprJson(kpr), "application/json")}>{t("Export JSON")}</button>
        </div>
      </div>

      <div className="kpr-layout">
        <section className="kpr-main">
          {tab === "brief" && (
            <div className="decision-brief" data-testid="decision-brief" data-principle="knowledge-before-code">
              <div className="brief-number">30<span>{t("sec")}</span></div>
              <div>
                <div className="section-label">{t("Decision brief")}</div>
                <h3>{t(kpr.title)}</h3>
                <p className="lead">{t(kpr.problem)}</p>
                <div className="decision-grid">
                  <div><span>{t("Decision")}</span><strong>{t("Worth exploring; narrow scope")}</strong></div>
                  <div><span>{t("Why now")}</span><strong>{t("Verified friction in a real local workflow")}</strong></div>
                  <div><span>{t("Value")}</span><strong>{t("Decision first without losing evidence")}</strong></div>
                  <div><span>{t("Scope")}</span><strong>{t("Research Brief; opt-in candidate")}</strong></div>
                  <div><span>{t("Risk")}</span><strong>{t("Source loss or silent default change")}</strong></div>
                  <div><span>{t("Evidence")}</span><strong>{kpr.evidence.length} {t("linked artifacts")}</strong></div>
                  <div><span>{t("Policy conflicts")}</span><strong>{t("1 default-stability tension")}</strong></div>
                  <div><span>{t("Open questions")}</span><strong>{kpr.openQuestions.length} {t("unresolved at submission")}</strong></div>
                  <div className="decision-current"><span>{t("Current human decision")}</span><strong>{t("Proceed to Knowledge Review, or request more knowledge?")}</strong></div>
                </div>
              </div>
              <aside className="decision-risk">
                <div className="section-label">{t("Primary tension")}</div>
                <p>{t("User asks to remember a preference. Project Policy forbids silently changing the public default.")}</p>
              </aside>
            </div>
          )}

          {tab === "knowledge" && (
            <div className="knowledge-diff" data-testid="knowledge-diff">
              <div className="section-heading-row"><h3>{t("Knowledge Diff")}</h3><span>{kpr.knowledgeClaims.length} {t("reviewable claims")}</span></div>
              {kpr.knowledgeClaims.map((claim) => (
                <article className="claim-card" key={claim.id}>
                  <div className="claim-meta">
                    <StatusBadge status={claim.type} />
                    <span>{sourceLabel(claim)}</span>
                    <span>{language === "zh-CN" ? "置信度" : "confidence"} · {t(claim.confidence)}</span>
                  </div>
                  {kpr.status === "contributor_review" && !kpr.humanAttestation ? (
                    <label className="claim-correction">
                      <span>{t("Contributor wording")}</span>
                      <textarea
                        aria-label={language === "zh-CN" ? `修正知识主张 ${claim.id}` : `Contributor correction for ${claim.id}`}
                        value={t(claim.statement)}
                        rows={3}
                        onChange={(event) => dispatch({ type: "EDIT_CONTRIBUTOR_CLAIM", claimId: claim.id, statement: event.target.value })}
                      />
                    </label>
                  ) : <p>{t(claim.statement)}</p>}
                  <footer>
                    <span>{t("Scope")}: {claim.scope.map((item) => t(item)).join(" · ")}</span>
                    <span>{t("Evidence")}: {claim.evidenceRefs.length}</span>
                    <button
                      className="link-button"
                      onClick={() => { setSelectedClaimId(claim.id); setTab("evidence"); }}
                      aria-label={language === "zh-CN" ? `查看知识主张 ${claim.id} 的证据` : `View evidence for ${claim.id}`}
                    >
                      {t("View linked evidence")}
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}

          {tab === "provenance" && (
            <div className="provenance-view">
              <div className="section-heading-row"><h3>{t("Knowledge Provenance")}</h3><span>{t("Origin is not authority")}</span></div>
              <div className="provenance-flow">
                <div><span>01</span><strong>{t("Human request")}</strong><p>{t("Original need and local context.")}</p></div>
                <i>→</i>
                <div><span>02</span><strong>{t("Agent extraction")}</strong><p>{t("Structured claims, explicitly marked as inferred.")}</p></div>
                <i>→</i>
                <div><span>03</span><strong>{t("Local proof")}</strong><p>{t("Verifier evidence and a reversible overlay.")}</p></div>
                <i>→</i>
                <div><span>04</span><strong>{t("Human attestation")}</strong><p>{t("Contributor confirms meaning and scope.")}</p></div>
              </div>
              <div className="provenance-records">
                {kpr.provenance.map((item) => (
                  <div key={item.id}><StatusBadge status={item.type} /><strong>{t(item.label)}</strong><time>{new Date(item.timestamp).toLocaleString(language)}</time></div>
                ))}
              </div>
            </div>
          )}

          {tab === "evidence" && (
            <div className="evidence-view" data-principle="evidence-before-adoption">
              <div className="section-heading-row"><h3>{t("Claim-linked Evidence")}</h3><span>{t("Evidence says what it supports—and what it cannot prove")}</span></div>
              <label className="evidence-filter">
                <span>{t("Evidence focus")}</span>
                <select value={selectedClaimId ?? "all"} onChange={(event) => setSelectedClaimId(event.target.value === "all" ? undefined : event.target.value)}>
                  <option value="all">{t("All KPR evidence")}</option>
                  {kpr.knowledgeClaims.map((claim) => <option key={claim.id} value={claim.id}>{claim.id} · {t(claim.type.replaceAll("_", " "))}</option>)}
                </select>
              </label>
              {selectedClaim && <p className="evidence-focus"><strong>{t("Focused Claim:")}</strong> {t(selectedClaim.statement)}</p>}
              {linkedEvidence.length === 0 && <div className="inline-empty">{t("No evidence is linked to this Claim. Request evidence before synthesis.")}</div>}
              {linkedEvidence.map((item) => (
                <article className="evidence-card" key={item.id}>
                  <StatusBadge status={item.result} />
                  <div>
                    <h4>{t(item.title)}</h4>
                    <p>{t(item.summary)}</p>
                    <dl className="evidence-facts">
                      <div><dt>{t("Produced by")}</dt><dd>{t(item.source.label)}</dd></div>
                      <div><dt>{t("Supports")}</dt><dd>{item.supportsClaimIds.join(", ")}</dd></div>
                      <div><dt>{t("Cannot prove")}</dt><dd>{item.cannotProve.map((text) => t(text)).join(" ")}</dd></div>
                      <div><dt>{t("Replay")}</dt><dd>{t(item.replayable ? "Replayable" : "Not replayable")}</dd></div>
                      <div><dt>{t("Human confirmation")}</dt><dd>{t(item.humanConfirmed ? "Confirmed" : "Verifier-produced; human review pending")}</dd></div>
                      <div><dt>{t("Privacy / license")}</dt><dd>{t(item.handling)}</dd></div>
                    </dl>
                  </div>
                </article>
              ))}
              <section className="counterexample-box">
                <div className="section-label">{t("Failed attempt retained")}</div>
                {kpr.failedAttempts.map((item) => <p key={item}>{t(item)}</p>)}
              </section>
            </div>
          )}

          {tab === "raw" && <pre className="raw-json">{exportKprJson(kpr)}</pre>}
        </section>

        <aside className="kpr-sidebar">
          <section data-principle="human-governed">
            <div className="section-label">{t("Human attestation")}</div>
            <StatusBadge status={kpr.humanAttestation ? "attested" : "missing"} />
            <p>{t(kpr.humanAttestation?.statement ?? "Required before submission.")}</p>
            {!kpr.humanAttestation && (
              <>
                <p>{contributorCorrections.length > 0 ? `${contributorCorrections.length} ${t("Optional contributor correction recorded.")}` : t("Review every relevant Claim. Edit wording only when it needs correction, then attest explicitly.")}</p>
                <button
                  className="button button-primary button-full"
                  onClick={() => dispatch({ type: "ATTEST_KPR" })}
                  data-testid="attest-kpr"
                >
                  {t("Attest reviewed knowledge")}
                </button>
              </>
            )}
          </section>
          <section>
            <div className="section-label">{t("Private implementation")}</div>
            <StatusBadge status="hidden" label={t("evidence, not authority")} />
            <p>{t(kpr.localImplementationReference?.summary ?? "")}</p>
            <strong>{t("Visible to Project Agent: no")}</strong>
          </section>
          <section>
            <div className="section-label">{t("Submission gate")}</div>
            <div className="gate-check"><span>{t("Attestation")}</span><strong>{kpr.humanAttestation ? "✓" : "—"}</strong></div>
            <div className="gate-check"><span>{t("Acceptance criteria")}</span><strong>✓</strong></div>
            <div className="gate-check"><span>{t("Invariants")}</span><strong>✓</strong></div>
            <div className="gate-check"><span>{t("Privacy scan")}</span><strong>{kpr.privacyAndLicense.privacyScan.status === "pass" ? "✓" : "—"}</strong></div>
            <button className="button button-full" onClick={() => dispatch({ type: "SCAN_KPR" })} data-testid="scan-kpr">{t("Run privacy scan")}</button>
            <button className="button button-accent button-full" disabled={!kpr.humanAttestation || kpr.privacyAndLicense.privacyScan.status !== "pass" || kpr.status !== "contributor_review"} onClick={() => dispatch({ type: "SUBMIT_KPR" })} data-testid="submit-kpr">{t("Submit KPR")}</button>
            <button className="button button-primary button-full" disabled={kpr.status !== "submitted"} onClick={() => dispatch({ type: "RUN_KNOWLEDGE_GATE" })} data-testid="knowledge-gate">{t("Run Knowledge Gate")}</button>
          </section>
        </aside>
      </div>
    </main>
  );
}
