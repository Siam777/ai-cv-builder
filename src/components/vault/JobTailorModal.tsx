"use client";
import { useRef, useState } from "react";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { ResumeDocument } from "@/lib/document";
import { JobReviewHistory } from "./JobReviewHistory";
import { JobCriterionCoach } from "./JobCriterionCoach";
import { LockedFeature } from "../billing/LockedFeature";
import { type Proposal } from "@/lib/ai-proposals";
import {
  reviewJobEvidence,
  reviewSnapshot,
  calculateJobMatches,
  coverageGroups,
  proposeEvidenceOrder,
  createReviewedVariant,
  type JobEvidenceReview,
  type Priority,
} from "@/lib/vault/job-evidence";
import { Lock, X } from "lucide-react";
import { lockedCopy } from "@/lib/ai-access";

export interface JobTailorModalProps {
  doc: ResumeDocument;
  busy: boolean;
  owner: string | null;
  prepareHistory: () => Promise<ResumeDocument>;
  acceptCoaching: (proposal: Proposal) => Promise<void>;
  onApplyTailoredVariant: (
    tailored: ResumeDocument,
    sourceSnapshot: string,
  ) => Promise<boolean>;
  onClose: () => void;
  /** Render inside the AI Assistant panel instead of as a dialog. */
  embedded?: boolean;
  /** False on plans without tailored copies; the comparison stays available. */
  canCreateCopy?: boolean;
  /** AI coaching per requirement (Pro). */
  canCoach?: boolean;
  onSeePlans?: () => void;
}
const statusLabels = {
  direct: "Direct text support",
  partial: "Partial / related",
  unknown: "Manual review",
  absent: "Not found in this CV",
};
export function JobTailorModal({
  doc,
  busy,
  owner,
  prepareHistory,
  acceptCoaching,
  onApplyTailoredVariant,
  onClose,
  embedded = false,
  canCreateCopy = true,
  canCoach = true,
  onSeePlans,
}: JobTailorModalProps) {
  useBodyScrollLock(!embedded);
  const dialogRef = useModalFocus(onClose, !embedded);
  const [jobTitle, setJobTitle] = useState(""),
    [company, setCompany] = useState(""),
    [jobDescription, setJobDescription] = useState("");
  const [seniority, setSeniority] = useState("Not specified"),
    [language, setLanguage] = useState<"english" | "other">("english");
  const [targetConfirmed, setTargetConfirmed] = useState(false),
    [evidenceConfirmed, setEvidenceConfirmed] = useState(false);
  const [review, setReview] = useState<JobEvidenceReview | null>(null),
    [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false),
    [creating, setCreating] = useState(false);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [coachCriterionId, setCoachCriterionId] = useState<string | null>(null),
    [coachingWorking, setCoachingWorking] = useState(false);
  const submitLock = useRef(false);
  const pendingVariant = useRef<{
    key: string;
    document: ResumeDocument;
  } | null>(null);
  let stale = false;
  try {
    stale = !!review && review.sourceSnapshot !== reviewSnapshot(doc);
  } catch {
    stale = !!review;
  }
  const proposals = review && !stale ? proposeEvidenceOrder(doc, review) : [];
  const locked = busy || analyzing || creating || coachingWorking;
  async function analyze() {
    if (!targetConfirmed || locked) return;
    setAnalyzing(true);
    setError("");
    setAccepted([]);
    setEvidenceConfirmed(false);
    setCoachCriterionId(null);
    try {
      setReview(
        await reviewJobEvidence(doc, jobDescription, {
          role: jobTitle,
          company,
          seniority,
          language,
        }),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to review this job.",
      );
    } finally {
      setAnalyzing(false);
    }
  }
  function changePriority(id: string, priority: Priority) {
    if (!review || stale) return;
    const criteria = review.matches.map((match) =>
      match.criterion.id === id
        ? {
            ...match.criterion,
            priority,
            priorityOrigin: "candidate_review" as const,
          }
        : match.criterion,
    );
    const matches = calculateJobMatches(criteria, doc, language);
    setReview({ ...review, matches, groups: coverageGroups(matches) });
    setAccepted([]);
    setEvidenceConfirmed(false);
    setCoachCriterionId(null);
  }
  async function create() {
    if (
      !review ||
      stale ||
      !evidenceConfirmed ||
      !accepted.length ||
      locked ||
      submitLock.current
    )
      return;
    submitLock.current = true;
    setCreating(true);
    setError("");
    try {
      const key = JSON.stringify([
        review.sourceHash,
        review.jobHash,
        review.target,
        [...accepted].sort(),
        review.matches.map((match) => [
          match.criterion.id,
          match.criterion.priority,
        ]),
      ]);
      if (pendingVariant.current?.key !== key) {
        pendingVariant.current = {
          key,
          document: createReviewedVariant(doc, review, accepted),
        };
      }
      const variant = pendingVariant.current.document;
      if (!(await onApplyTailoredVariant(variant, review.sourceSnapshot)))
        setError(
          "Saving was not confirmed. Your review and original CV are kept. Retry to check the same variant, or resolve the workspace error.",
        );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save the reviewed variant.",
      );
    } finally {
      submitLock.current = false;
      setCreating(false);
    }
  }
  function chooseProposal(id: string, selected: boolean) {
    setAccepted((list) =>
      selected
        ? [...new Set([...list, id])]
        : list.filter((item) => item !== id),
    );
    setEvidenceConfirmed(false);
  }
  const content = (
    <>
        <div className="tailor-content">
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          {!review ? (
            <div className="tailor-input-stage">
              <ol className="review-steps">
                <li>Paste the job description and confirm the target.</li>
                <li>See what your CV supports and what needs more evidence.</li>
                <li>
                  Optionally reorder existing bullets in a separate CV copy.
                </li>
              </ol>
              <p className="helper-text">
                The first comparison runs on this device. Nothing is sent to AI.
                Optional AI coaching asks for your consent separately.
              </p>
              <div className="field-grid">
                <label>
                  Target Job Title
                  <input
                    value={jobTitle}
                    maxLength={200}
                    placeholder="e.g. Senior Software Engineer"
                    disabled={locked}
                    onChange={(event) => {
                      setJobTitle(event.target.value);
                      setTargetConfirmed(false);
                    }}
                  />
                </label>
                <label>
                  Company Name
                  <input
                    value={company}
                    maxLength={200}
                    placeholder="e.g. Stripe"
                    disabled={locked}
                    onChange={(event) => {
                      setCompany(event.target.value);
                      setTargetConfirmed(false);
                    }}
                  />
                </label>
                <label>
                  Target seniority
                  <select
                    value={seniority}
                    disabled={locked}
                    onChange={(event) => {
                      setSeniority(event.target.value);
                      setTargetConfirmed(false);
                    }}
                  >
                    {[
                      "Not specified",
                      "Entry level",
                      "Mid level",
                      "Senior",
                      "Lead / management",
                      "Other",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Analysis language
                  <select
                    value={language}
                    disabled={locked}
                    onChange={(event) => {
                      setLanguage(event.target.value as "english" | "other");
                      setTargetConfirmed(false);
                    }}
                  >
                    <option value="english">English</option>
                    <option value="other">Other — manual review</option>
                  </select>
                </label>
              </div>
              <label>
                Job Description
                <textarea
                  aria-label="Job Description"
                  rows={6}
                  value={jobDescription}
                  maxLength={20000}
                  disabled={locked}
                  placeholder="Paste the full job requirements and responsibilities here..."
                  onChange={(event) => setJobDescription(event.target.value)}
                />
              </label>
              <details>
                <summary>Limits of this comparison</summary>
                <p className="helper-text">
                  Up to 20,000 characters and 60 criteria. Use labeled
                  required/preferred sections or bullet lines. Years, complex
                  credentials and unclear alternatives need manual review.
                </p>
              </details>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={targetConfirmed}
                  disabled={locked}
                  onChange={(event) => setTargetConfirmed(event.target.checked)}
                />
                Use this target role, seniority and language
              </label>
            </div>
          ) : (
            <div className="tailor-results-stage">
              <p className="review-start-note">
                <strong>Read the evidence first.</strong> Direct means a clear
                match in your CV; partial means only part is supported; not
                found means this CV does not show it. A gap is a prompt to add
                real experience if you have it, not a skill to copy from the
                job.
              </p>
              <h3>
                {review.target.role}
                {review.target.company ? ` at ${review.target.company}` : ""}
              </h3>
              <p>
                {review.target.seniority} ·{" "}
                {review.target.language === "english"
                  ? "English text review"
                  : "Manual language review"}
              </p>
              {stale && (
                <p className="alert" role="status">
                  The CV changed after this review. Analyze the current snapshot
                  again before creating a variant.
                </p>
              )}
              {review.warnings.map((warning) => (
                <p key={warning} className="helper-text">
                  {warning}
                </p>
              ))}
              <section
                aria-label="Requirement coverage"
                className="job-coverage"
              >
                <h3>Evidence by posting priority</h3>
                {(["required", "preferred", "uncertain"] as const).map(
                  (priority) => {
                    const group = review.groups[priority];
                    return (
                      <div key={priority} className="job-coverage-group">
                        <h4>
                          {priority === "uncertain"
                            ? "Priority unclear"
                            : priority === "required"
                              ? "Required"
                              : "Preferred"}{" "}
                          ({group.total})
                        </h4>
                        <p>
                          {group.direct} direct · {group.partial} partial ·{" "}
                          {group.absent} not found · {group.unknown} manual
                          review
                        </p>
                        <p className="helper-text">
                          {group.scorable
                            ? `${group.supportUnits} support units across ${group.scorable} scorable criteria.`
                            : "Not enough information for a coverage calculation."}{" "}
                          Unknown criteria remain outside the denominator.
                        </p>
                      </div>
                    );
                  },
                )}
                <details>
                  <summary>Method and review record</summary>
                  <p>
                    Required weight 2; preferred weight 1; unclear priority
                    weight 0. Direct text support contributes 1 unit, partial
                    support 0.5 and not-found support 0. Unknown meaning is
                    excluded. Counts stay separate by priority so preferred
                    mentions cannot conceal a required gap. These are
                    provisional local rules; no ATS score, hiring probability or
                    benchmark validation is claimed.
                  </p>
                  <p>
                    Rules {review.version} · Terms {review.termsVersion} · CV
                    revision {review.sourceRevision}
                  </p>
                  <p>Checked {new Date(review.analyzedAt).toLocaleString()}</p>
                  <p>
                    Job SHA-256 <code>{review.jobHash}</code>
                  </p>
                  <p>
                    CV snapshot SHA-256 <code>{review.sourceHash}</code>
                  </p>
                  <p>
                    Priority changes are labeled as your review. The report
                    stays temporary unless you explicitly save it to account
                    history.
                  </p>
                </details>
              </section>
              <section aria-label="Job criteria and CV excerpts">
                <h3>Review the criteria and cited text</h3>
                <p className="helper-text">
                  A missing excerpt is not proof you lack an ability. Enter
                  genuine missing experience in the editor, then run a new
                  review. This check does not insert job requirements into your
                  CV.
                </p>
                <ul className="evidence-list">
                  {review.matches.map((match) => (
                    <li
                      className={`evidence-item job-status-${match.status}`}
                      key={match.criterion.id}
                    >
                      <div className="evidence-head">
                        <strong>{statusLabels[match.status]}</strong>
                        <span>{match.criterion.category}</span>
                      </div>
                      <blockquote>
                        {match.criterion.sources[0].quote}
                      </blockquote>
                      <label>
                        Posting priority
                        <select
                          aria-label={`Priority for ${match.criterion.description}`}
                          value={match.criterion.priority}
                          disabled={locked || stale}
                          onChange={(event) =>
                            changePriority(
                              match.criterion.id,
                              event.target.value as Priority,
                            )
                          }
                        >
                          <option value="required">Required</option>
                          <option value="preferred">Preferred</option>
                          <option value="uncertain">Unclear</option>
                        </select>
                      </label>
                      {match.criterion.priorityOrigin ===
                        "candidate_review" && (
                        <p className="helper-text">
                          Priority set by your review.
                        </p>
                      )}
                      {match.criterion.alternatives.length > 1 && (
                        <p>
                          Alternatives:{" "}
                          {match.criterion.alternatives
                            .map((group) => group.join(" + "))
                            .join(" OR ")}
                        </p>
                      )}
                      <p>{match.reason}</p>
                      <button
                        type="button"
                        disabled={locked || stale}
                        onClick={() => setCoachCriterionId(match.criterion.id)}
                      >
                        Coach criterion: {match.criterion.description}
                      </button>
                      {match.criterion.sources.length > 1 && (
                        <details>
                          <summary>
                            {match.criterion.sources.length} duplicate source
                            lines merged
                          </summary>
                          {match.criterion.sources.slice(1).map((source) => (
                            <blockquote key={source.start}>
                              {source.quote}
                            </blockquote>
                          ))}
                        </details>
                      )}
                      {match.evidence.map((ref) => (
                        <div key={ref.id} className="evidence-bullets">
                          <p className="role-chip">{ref.label}</p>
                          <blockquote>{ref.quote}</blockquote>
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-label="Proposed ordering changes">
                <h3>Proposed ordering changes</h3>
                <p>
                  Review up to three changes. They reorder existing bullets in
                  an independent variant; all wording and facts are preserved.
                </p>
                {!proposals.length && (
                  <p className="helper-text">
                    No supported ordering change is available for this snapshot.
                    Keep the current CV or add real evidence in the editor and
                    review again.
                  </p>
                )}
                {proposals.map((proposal) => {
                  const entry = doc.sections
                    .find((section) => section.id === proposal.sectionId)!
                    .entries.find((entry) => entry.id === proposal.entryId)!;
                  return (
                    <article className="evidence-item" key={proposal.id}>
                      <h4>{proposal.label}</h4>
                      <p>{proposal.reason}</p>
                      <p className="helper-text">
                        Supports{" "}
                        {proposal.requirementIds
                          .map(
                            (id) =>
                              review.matches.find(
                                (match) => match.criterion.id === id,
                              )!.criterion.description,
                          )
                          .join("; ")}
                      </p>
                      <div className="job-order-preview">
                        <div>
                          <h5>Current order</h5>
                          <ol>
                            {proposal.before.map((id) => (
                              <li key={id}>
                                {
                                  entry.bullets.find(
                                    (bullet) => bullet.id === id,
                                  )!.text
                                }
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <h5>Proposed order</h5>
                          <ol>
                            {proposal.after.map((id) => (
                              <li key={id}>
                                {
                                  entry.bullets.find(
                                    (bullet) => bullet.id === id,
                                  )!.text
                                }
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={accepted.includes(proposal.id)}
                          disabled={locked || stale}
                          onChange={(event) =>
                            chooseProposal(proposal.id, event.target.checked)
                          }
                        />
                        Accept ordering for {proposal.label}
                      </label>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => chooseProposal(proposal.id, false)}
                      >
                        Keep current order
                      </button>
                    </article>
                  );
                })}
                {!!proposals.length && (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={evidenceConfirmed}
                      disabled={locked || stale}
                      onChange={(event) =>
                        setEvidenceConfirmed(event.target.checked)
                      }
                    />
                    I reviewed the job priorities and CV excerpts supporting the
                    selected changes
                  </label>
                )}
              </section>
            </div>
          )}
          {review && coachCriterionId && !canCoach && (
            <LockedFeature feature="job-coaching" onSeePlans={onSeePlans} />
          )}
          {review && coachCriterionId && canCoach && (
            <JobCriterionCoach
              key={`${review.sourceHash}:${coachCriterionId}`}
              doc={doc}
              owner={owner}
              review={review}
              criterionId={coachCriterionId}
              busy={busy || analyzing || creating}
              prepare={prepareHistory}
              accept={acceptCoaching}
              onBusyChange={setCoachingWorking}
              onApplied={() => {
                setAccepted([]);
                setEvidenceConfirmed(false);
                pendingVariant.current = null;
              }}
              onClose={() => setCoachCriterionId(null)}
            />
          )}
          <JobReviewHistory
            owner={owner}
            doc={doc}
            review={review}
            busy={locked}
            prepare={prepareHistory}
            onRecheck={(saved) => {
              setCoachCriterionId(null);
              setJobTitle(saved.target.role);
              setCompany(saved.target.company);
              setSeniority(saved.target.seniority);
              setLanguage(saved.target.language);
              setJobDescription(saved.jobText);
              setTargetConfirmed(false);
              setReview(null);
              setAccepted([]);
              setEvidenceConfirmed(false);
              setError("");
            }}
          />
        </div>
        <div className="button-row">
          {!review && !analyzing && (
            <p className="action-requirement" role="status">
              {!jobTitle.trim()
                ? "Add the target job title to continue."
                : !jobDescription.trim()
                  ? "Paste the job description to continue."
                  : !targetConfirmed
                    ? "Check the target confirmation above to enable the comparison."
                    : "Ready to compare. Your original CV will be kept."}
            </p>
          )}
          {!review ? (
            <>
              <button
                type="button"
                className="primary"
                disabled={
                  locked ||
                  !jobTitle.trim() ||
                  !jobDescription.trim() ||
                  !targetConfirmed
                }
                onClick={analyze}
              >
                {analyzing ? "Reviewing…" : "Analyze & Match Evidence"}
              </button>
              {!embedded && (
                <button type="button" onClick={onClose} disabled={locked}>
                  Cancel
                </button>
              )}
            </>
          ) : (
            <>
              {canCreateCopy ? (
                <button
                  type="button"
                  className="primary"
                  disabled={
                    locked || stale || !evidenceConfirmed || !accepted.length
                  }
                  onClick={create}
                >
                  {creating ? "Saving variant…" : "Create reviewed variant"}
                </button>
              ) : (
                <div className="locked-feature" role="group" aria-label="Locked: tailored CV copies">
                  <Lock size={18} aria-hidden />
                  <div>
                    <strong>{lockedCopy("tailored-copy").title}</strong>
                    <p>{lockedCopy("tailored-copy").reason}</p>
                  </div>
                  <button type="button" className="primary" onClick={onSeePlans}>
                    See plans
                  </button>
                </div>
              )}
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  setReview(null);
                  setAccepted([]);
                  setEvidenceConfirmed(false);
                  setError("");
                }}
              >
                Edit Job Description
              </button>
              {!embedded && (
                <button type="button" onClick={onClose} disabled={locked}>
                  Done
                </button>
              )}
            </>
          )}
        </div>
    </>
  );

  if (embedded)
    return (
      <section
        className="embedded-tool tailor-modal job-evidence-modal"
        aria-label="Job Tailoring Engine"
      >
        <h3 className="embedded-tool-title">Compare your CV with a job</h3>
        {content}
      </section>
    );
  return (
    <div
      className="modal-backdrop no-print"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Job Tailoring Engine"
    >
      <div className="modal-card tailor-modal job-evidence-modal">
        <header className="modal-header">
          <div>
            <h2>Compare your CV with a job</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        {content}
      </div>
    </div>
  );
}
