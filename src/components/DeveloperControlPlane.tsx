import { useMemo, useState } from "react";
import { evaluateFailureScenarios } from "../core/failures";
import type { ClaimDecision } from "../core/types";
import { StatusBadge } from "./StatusBadge";
import type { ViewProps } from "./types";
import { useI18n } from "../i18n";

type ReviewStage = "decision" | "knowledge" | "impact" | "integration" | "result";

const decisionOptions: Array<{ value: ClaimDecision; label: string }> = [
  { value: "accept", label: "Accept" },
  { value: "modify", label: "Modify" },
  { value: "narrow", label: "Narrow" },
  { value: "defer", label: "Defer" },
  { value: "reject", label: "Reject" },
  { value: "request_evidence", label: "Request evidence" }
];

const verifierLabels: Record<string, string> = {
  "project-default-stability": "Public default stays unchanged",
  "project-source-preservation": "Sources remain visible",
  "project-scope-boundary": "Scope stays within Research Brief",
  "project-confirmation": "Preference requires confirmation",
  "project-unsupported-conclusion": "Every conclusion retains evidence"
};

function DifferenceRow({ label, before, after, tone = "neutral" }: { label: string; before: string; after: string; tone?: string }) {
  const { t } = useI18n();
  return (
    <div className={`difference-row difference-${tone}`}>
      <span>{t(label)}</span>
      <div><small>{t("Before")}</small><p>{t(before)}</p></div>
      <i>→</i>
      <div><small>{t("After")}</small><p>{t(after)}</p></div>
    </div>
  );
}

export function DeveloperControlPlane({ state, dispatch, runAgent, loadingRole }: ViewProps) {
  const { t, language } = useI18n();
  const [stage, setStage] = useState<ReviewStage>("decision");
  const [showFailures, setShowFailures] = useState(false);
  const kpr = state.kpr;
  const failures = useMemo(() => (kpr ? evaluateFailureScenarios(kpr) : []), [kpr]);
  if (!kpr || !["accepted_for_synthesis", "maintainer_review", "project_agent_synthesis", "verification", "revision_required", "rolled_back", "verification_passed", "adopted"].includes(kpr.status)) {
    return (
      <main className="workspace empty-state" data-testid="developer-workspace">
        <div className="empty-index">03</div>
        <h2>{t("No KPR has passed the Knowledge Gate.")}</h2>
        <p>{t("The Developer Control Plane begins with reviewable, human-attested knowledge—not an unsolicited code diff.")}</p>
        <button className="button button-primary" onClick={() => dispatch({ type: "SET_VIEW", view: state.kpr ? "kpr" : "user" })}>
          {t(state.kpr ? "Review KPR gate" : "Start guided story")}
        </button>
      </main>
    );
  }

  const reviewReady = kpr.impactAnalysis.length > 0;
  const contractReady = Boolean(state.contract && state.contract.unresolvedQuestions.length === 0);
  const verificationPassed = state.projectWorkspace.status === "verified";
  const projectVerifierIds = state.policy.evidenceRequirements.find((item) => item.appliesTo === "project_candidate")?.verifierIds ?? [];

  return (
    <main className="workspace developer-workspace" data-testid="developer-workspace">
      <header className="workspace-heading developer-heading">
        <div>
          <div className="eyebrow">{t("KPR Developer Workspace")}</div>
          <h2>{t("Decide knowledge before reviewing implementation.")}</h2>
          <p>{t("Review order: Decision → Knowledge → Impact → Evidence → Trace → Code.")}</p>
        </div>
        <div className="authority-strip">
          <div><span>{t("Maintainer-side Agent")}</span><strong>{t("understand · no write authority")}</strong></div>
          <div><span>{t("Project Agent")}</span><strong>{t("implement · no merge authority")}</strong></div>
          <div><span>{t("Maintainer")}</span><strong>{t("decide · approve · adopt")}</strong></div>
        </div>
      </header>

      <div className="developer-shell">
        <aside className="kpr-inbox">
          <div className="section-label">{t("KPR Inbox")} · 1</div>
          <article className="inbox-item active">
            <StatusBadge status={kpr.status} />
            <strong>{t(kpr.title)}</strong>
            <p>{t(kpr.problem)}</p>
            <footer>
              <span>{kpr.knowledgeClaims.length} {t("claims")}</span>
              <span>{language === "zh-CN" ? `${kpr.evidence.length} 项证据` : `${kpr.evidence.length} ${t("evidence")}`}</span>
            </footer>
          </article>
          <div className="review-sequence">
            {(["decision", "knowledge", "impact", "integration", "result"] as ReviewStage[]).map((item, index) => (
              <button key={item} className={stage === item ? "active" : ""} onClick={() => setStage(item)}>
                <span>{String(index + 1).padStart(2, "0")}</span>{t(item)}
              </button>
            ))}
          </div>
          <button className="button button-quiet button-full" onClick={() => setShowFailures((value) => !value)}>
            {t(showFailures ? "Hide failure laboratory" : "Open failure laboratory")}
          </button>
        </aside>

        <section className="review-canvas">
          {showFailures ? (
            <div className="failure-lab" data-testid="failure-lab">
              <div className="section-heading-row"><h3>{t("Failure Laboratory")}</h3><span>{t("Expected failure is a system feature")}</span></div>
              <p className="lead">{t("These checks run on isolated copies. They do not damage the active KPR.")}</p>
              {failures.map((failure) => (
                <article key={failure.id}>
                  <StatusBadge status={failure.passed ? "pass" : "fail"} />
                  <div><h4>{t(failure.title)}</h4><p><strong>{t("Expected:")}</strong> {t(failure.expected)}</p><p><strong>{t("Observed:")}</strong> {t(failure.observed)}</p></div>
                </article>
              ))}
              <div className="failure-conclusion"><strong>{failures.filter((item) => item.passed).length}/{failures.length}</strong><span>{t("failure controls behaved as specified")}</span></div>
            </div>
          ) : stage === "decision" ? (
            <div className="developer-decision" data-testid="developer-decision">
              <div className="decision-hero">
                <div><div className="section-label">{t("30-second decision")}</div><h3>{t("Worth solving; scope must be narrowed.")}</h3></div>
                <StatusBadge status="human-decision-needed" label={t("human decision needed")} />
              </div>
              <p className="lead">{t("The contributor proved a local need and preserved sources. The evidence does not justify changing the public default or generalizing beyond Research Brief.")}</p>
              <div className="decision-columns">
                <section><div className="section-label">{t("Know")}</div><ul><li>{t("Conclusion-first helps this workflow.")}</li><li>{t("Sources remain visible.")}</li><li>{t("The overlay is reversible.")}</li></ul></section>
                <section><div className="section-label">{t("Infer")}</div><ul><li>{t("An optional public feature may help others.")}</li><li>{t("Preference persistence needs a confirmation gate.")}</li></ul></section>
                <section><div className="section-label">{t("Unknown")}</div><ul><li>{t("Behavior on other document types.")}</li><li>{t("Stable-release demand.")}</li><li>{t("Long-term maintenance cost.")}</li></ul></section>
              </div>
              <button
                className="button button-primary"
                disabled={loadingRole === "maintainer-side"}
                onClick={() => void runAgent("maintainer-side")}
                data-testid="run-maintainer-agent"
              >
                {t(loadingRole === "maintainer-side" ? "Agent is mapping knowledge impact…" : reviewReady ? "Re-run Maintainer-side Agent" : "Ask Maintainer-side Agent")}
              </button>
              <p className="authority-note">{t("The Agent produces an analysis. It cannot accept knowledge or approve a Contract.")}</p>
            </div>
          ) : stage === "knowledge" ? (
            <div className="claim-resolution" data-testid="claim-resolution">
              <div className="section-heading-row"><h3>{t("Maintainer Claim Resolution")}</h3><span>{kpr.claimResolutions.length}/{kpr.knowledgeClaims.length} {t("decisions drafted")}</span></div>
              {!reviewReady && <div className="inline-empty">{t("Run the Maintainer-side Agent to prepare impact-aware suggestions.")}</div>}
              {kpr.knowledgeClaims.map((claim) => {
                const resolution = kpr.claimResolutions.find((item) => item.claimId === claim.id);
                return (
                  <article key={claim.id} className="resolution-card">
                    <header><StatusBadge status={claim.type} /><span>{t(claim.agentGenerated ? "Agent-extracted · Human-attested" : "Human-authored")}</span></header>
                    <p>{t(claim.statement)}</p>
                    <div className="resolution-controls">
                      <label><span>{t("Maintainer decision")}</span><select value={resolution?.decision ?? "defer"} onChange={(event) => dispatch({ type: "SET_CLAIM_DECISION", claimId: claim.id, decision: event.target.value as ClaimDecision })}>
                        {decisionOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
                      </select></label>
                      <label><span>{t("Project wording")}</span><input value={t(resolution?.finalStatement ?? claim.statement)} onChange={(event) => dispatch({ type: "SET_CLAIM_DECISION", claimId: claim.id, decision: resolution?.decision ?? "modify", finalStatement: event.target.value })} /></label>
                    </div>
                    {resolution && (
                      <details className="resolution-advanced">
                        <summary>{t("Shape scope, rollout, proof, and rationale")}</summary>
                        <div>
                          <label>
                            <span>{t("Target scopes · comma separated")}</span>
                            <input
                              aria-label={language === "zh-CN" ? `设置 ${claim.id} 的目标范围` : `Target scopes for ${claim.id}`}
                              value={resolution.targetScopes.join(", ")}
                              onChange={(event) => dispatch({
                                type: "SET_CLAIM_DECISION",
                                claimId: claim.id,
                                targetScopes: event.target.value.split(",").map((item) => item.trim()).filter(Boolean)
                              })}
                            />
                          </label>
                          <label>
                            <span>{t("Rollout")}</span>
                            <select
                              aria-label={language === "zh-CN" ? `设置 ${claim.id} 的发布阶段` : `Rollout for ${claim.id}`}
                              value={resolution.rollout ?? "not-applicable"}
                              onChange={(event) => dispatch({ type: "SET_CLAIM_DECISION", claimId: claim.id, rollout: event.target.value })}
                            >
                              <option value="not-applicable">{t("Not applicable")}</option>
                              <option value="experimental">{t("Experimental")}</option>
                              <option value="stable">{t("Stable")}</option>
                            </select>
                          </label>
                          <fieldset className="resolution-verifiers">
                            <legend>{t("Claim-linked proof")}</legend>
                            {projectVerifierIds.map((verifierId) => (
                              <label key={verifierId}>
                                <input
                                  type="checkbox"
                                  aria-label={language === "zh-CN"
                                    ? `${t(verifierLabels[verifierId] ?? verifierId)}，用于 ${claim.id}`
                                    : `${verifierLabels[verifierId] ?? verifierId} for ${claim.id}`}
                                  checked={resolution.requiredVerifierIds.includes(verifierId)}
                                  onChange={(event) => dispatch({
                                    type: "SET_CLAIM_DECISION",
                                    claimId: claim.id,
                                    requiredVerifierIds: event.target.checked
                                      ? [...new Set([...resolution.requiredVerifierIds, verifierId])]
                                      : resolution.requiredVerifierIds.filter((item) => item !== verifierId)
                                  })}
                                />
                                <span><strong>{t(verifierLabels[verifierId] ?? verifierId)}</strong><code>{verifierId}</code></span>
                              </label>
                            ))}
                            {resolution.requiredVerifierIds.some((id) => !projectVerifierIds.includes(id)) && (
                              <p>{t("Unknown Verifier IDs block Contract synthesis until removed.")}</p>
                            )}
                          </fieldset>
                          <label className="resolution-rationale">
                            <span>{t("Maintainer rationale")}</span>
                            <textarea
                              aria-label={language === "zh-CN" ? `填写 ${claim.id} 的维护者理由` : `Maintainer rationale for ${claim.id}`}
                              rows={2}
                              value={resolution.rationale}
                              onChange={(event) => dispatch({ type: "SET_CLAIM_DECISION", claimId: claim.id, rationale: event.target.value })}
                            />
                          </label>
                        </div>
                      </details>
                    )}
                    {resolution && <footer><span>{t("Rationale:")} {t(resolution.rationale)}</span><span>{t("Targets:")} {resolution.targetScopes.map((item) => t(item)).join(" · ")}</span></footer>}
                  </article>
                );
              })}
            </div>
          ) : stage === "impact" ? (
            <div className="impact-review" data-testid="impact-map">
              <div className="section-heading-row"><h3>{t("Knowledge Impact Map")}</h3><span>{t("Impact is predicted, not proven")}</span></div>
              {!reviewReady && <div className="inline-empty">{t("Run the Maintainer-side Agent to map impact before code.")}</div>}
              <div className="impact-map">
                <div className="impact-center">KPR<span>{t("optional conclusion-first")}</span></div>
                {kpr.impactAnalysis.map((impact, index) => (
                  <article key={impact.id} className={`impact-node impact-${index + 1}`}>
                    <header><StatusBadge status={impact.source} /><span>{t(impact.confidence)}</span></header>
                    <strong>{t(impact.title)}</strong><p>{t(impact.description)}</p>
                    <footer>{t(impact.humanDecisionRequired ? "Human decision" : "Policy determined")}{impact.evidenceRequired ? ` · ${t("evidence required")}` : ""}</footer>
                  </article>
                ))}
              </div>
            </div>
          ) : stage === "integration" ? (
            <div className="integration-review" data-testid="integration-contract">
              <div className="section-heading-row"><h3>{t("Knowledge Integration Contract")}</h3><span>{t("Derived from human decisions")}</span></div>
              {!state.contract ? (
                <div className="contract-draft">
                  <p>{t("The Contract is not a sixth core object. It is the governed project-side resolution nested inside this KPR.")}</p>
                  <button className="button button-primary" disabled={!reviewReady} onClick={() => dispatch({ type: "GENERATE_CONTRACT" })} data-testid="generate-contract">{t("Approve decisions & generate Contract")}</button>
                </div>
              ) : (
                <div className="contract-sheet" data-principle="project-owned-implementation">
                  <header><div><span>{t("Contract for")}</span><strong>{state.contract.kprId}</strong></div><StatusBadge status={contractReady ? "approved" : "blocked"} /></header>
                  <section>
                    <div className="section-label">{t("Accepted knowledge")}</div>
                    <div className="contract-knowledge-list">
                      {state.contract.acceptedKnowledge.map((item) => (
                        <details key={item.claimId} className="contract-knowledge-item">
                          <summary><StatusBadge status={item.decision} /><span>{t(item.finalStatement ?? "")}</span><code>{item.claimId}</code></summary>
                          <div className="contract-knowledge-meta">
                            <span>{t("Scope")} · {item.targetScopes.map((scope) => t(scope)).join(" · ") || t("not set")}</span>
                            {item.rollout && <span>{t("Rollout")} · {t(item.rollout)}</span>}
                            <span>{t("Proof")} · {item.requiredVerifierIds.join(" · ") || t("Project Policy baseline")}</span>
                          </div>
                          <small>{t(item.rationale)}</small>
                        </details>
                      ))}
                    </div>
                  </section>
                  {state.contract.rejectedKnowledge.length > 0 && (
                    <section>
                      <div className="section-label">{t("Rejected knowledge")}</div>
                      <div className="contract-knowledge-list">
                        {state.contract.rejectedKnowledge.map((item) => (
                          <details key={item.claimId} className="contract-knowledge-item contract-knowledge-rejected">
                            <summary><StatusBadge status={item.decision} /><span>{t(item.finalStatement ?? "")}</span><code>{item.claimId}</code></summary>
                            <small>{t(item.rationale)}</small>
                          </details>
                        ))}
                      </div>
                    </section>
                  )}
                  <section><div className="section-label">{t("Implementation boundary")}</div><ul>{state.contract.implementationBoundary.map((item) => <li key={item}>{t(item)}</li>)}</ul></section>
                  <section><div className="section-label">{t("Required proof")}</div><div className="contract-verifiers">{state.contract.requiredVerifiers.map((item) => <code key={item}>{item}</code>)}</div></section>
                  <section><div className="section-label">{t("Context boundary")}</div><p>{language === "zh-CN" ? <>贡献者补丁：<strong>隐藏</strong> · 私有轨迹：<strong>隐藏</strong> · 合并权限：<strong>仅维护者</strong></> : <>Contributor patch: <strong>hidden</strong> · Private trajectory: <strong>hidden</strong> · Merge authority: <strong>Maintainer only</strong></>}</p></section>
                  {state.contract.unresolvedQuestions.length > 0 && <section className="contract-block"><strong>{t("Synthesis blocked")}</strong><p>{state.contract.unresolvedQuestions.map((item) => t(item)).join(", ")}</p></section>}
                  <button className="button button-accent" disabled={!contractReady || loadingRole === "project"} onClick={() => void runAgent("project")} data-testid="run-project-agent">
                    {t(loadingRole === "project" ? "Project Agent is rebuilding from the Contract…" : "Start blind reconstruction")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="result-review" data-testid="result-review">
              <div className="section-heading-row"><h3>{t("Behavior, Knowledge, and Evidence Diff")}</h3><StatusBadge status={state.projectWorkspace.status} /></div>
              {!state.projectCandidate ? (
                <div className="inline-empty">{t("Approve a Contract and ask the Project Agent to synthesize a candidate.")}</div>
              ) : (
                <>
                  <DifferenceRow label="Behavior" before="Context first; one public behavior" after="Optional conclusion-first mode for Research Brief" tone="blue" />
                  <DifferenceRow label="Knowledge" before="One local user preference" after="Narrow experimental capability; public default unchanged" tone="violet" />
                  <DifferenceRow label="Evidence" before="4 local overlay verifiers" after="5 project Contract verifiers" tone="green" />
                  <details className="code-diff">
                    <summary>{t("Optional code-oriented representation")}</summary>
                    <pre>{JSON.stringify(state.projectCandidate, null, 2)}</pre>
                  </details>
                  <div className="result-actions">
                    <button className="button button-primary" onClick={() => dispatch({ type: "VERIFY_PROJECT_CANDIDATE" })} data-testid="verify-project">{t("Run Contract verifiers")}</button>
                    <button className="button" disabled={state.projectWorkspace.status === "adopted"} onClick={() => dispatch({ type: "ROLLBACK_PROJECT_CANDIDATE" })} data-testid="rollback-project">{t("Rollback candidate")}</button>
                    <button className="button button-accent" disabled={!verificationPassed} onClick={() => dispatch({ type: "ADOPT_PROJECT_CANDIDATE" })} data-testid="adopt-project">{t("Maintainer adopts candidate")}</button>
                  </div>
                  {state.projectWorkspace.verifierResults.length > 0 && <div className="project-verifiers" data-principle="evidence-before-adoption">{state.projectWorkspace.verifierResults.map((item) => <div key={item.id}><StatusBadge status={item.result} /><strong>{t(item.title)}</strong><p>{t(item.summary)}</p></div>)}</div>}
                </>
              )}
            </div>
          )}
        </section>

        <aside className="developer-context">
          <section><div className="section-label">{t("Project policy")}</div><ul>{state.policy.productPrinciples.map((rule) => <li key={rule.id}>{t(rule.title)}</li>)}</ul></section>
          <section><div className="section-label">{t("Evidence posture")}</div><div className="evidence-level"><strong>E2</strong><span>{t("Prototype evidence")}</span></div><p>{t("Shows a bounded system behavior. Does not prove lower Maintainer workload.")}</p></section>
          <section><div className="section-label">{t("Authority")}</div><div className="authority-row"><span>{t("Goal")}</span><strong>{t("Human")}</strong></div><div className="authority-row"><span>{t("Knowledge decision")}</span><strong>{t("Human")}</strong></div><div className="authority-row"><span>{t("Implementation")}</span><strong>{t("Project Agent")}</strong></div><div className="authority-row"><span>{t("Completion")}</span><strong>{t("Verifier")}</strong></div><div className="authority-row"><span>{t("Adoption")}</span><strong>{t("Human")}</strong></div></section>
        </aside>
      </div>
    </main>
  );
}
