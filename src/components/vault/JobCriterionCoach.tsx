"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { type ResumeDocument } from "@/lib/document";
import {
  bulletEvidence,
  proposalSchema,
  reviewProposal,
  type Proposal,
} from "@/lib/ai-proposals";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";
import { rewriteContext } from "@/lib/ai-contract";
import { coachingInput } from "@/lib/job-coach";
import {
  reviewSnapshot,
  type JobEvidenceReview,
} from "@/lib/vault/job-evidence";
type Props = {
  doc: ResumeDocument;
  owner: string | null;
  review: JobEvidenceReview;
  criterionId: string;
  busy: boolean;
  prepare: () => Promise<ResumeDocument>;
  accept: (proposal: Proposal) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onApplied: () => void;
  onClose: () => void;
};
const availabilitySchema = z.object({
  configured: z.boolean(),
  signedIn: z.boolean(),
  jobCoaching: z.boolean().default(false),
});
export function JobCriterionCoach({
  doc,
  owner,
  review,
  criterionId,
  busy,
  prepare,
  accept,
  onBusyChange,
  onApplied,
  onClose,
}: Props) {
  const bullets = bulletEvidence(doc).filter(
    (bullet) =>
      doc.sections.find((section) => section.id === bullet.sectionId)?.visible,
  );
  const criterion = review.matches.find(
    (match) => match.criterion.id === criterionId,
  )!.criterion;
  const [bulletId, setBulletId] = useState(bullets[0]?.id ?? "");
  const [instruction, setInstruction] = useState(
    "Explain this entry's relevance and suggest clearer wording only if supported by my original evidence.",
  );
  const [consent, setConsent] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [availability, setAvailability] = useState<z.infer<
    typeof availabilitySchema
  > | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const alive = useRef(true),
    lock = useRef(false),
    request = useRef<{ key: string; id: string } | null>(null);
  let stale = true;
  try {
    stale = reviewSnapshot(doc) !== review.sourceSnapshot;
  } catch {}
  let context: ReturnType<typeof rewriteContext> | null = null,
    contextError = "";
  try {
    if (bulletId) context = rewriteContext(doc, bulletId);
  } catch (error) {
    contextError = (error as Error).message;
  }
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void accountRequest("/api/ai", { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted)
          setAvailability(availabilitySchema.parse(value));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, []);
  async function run(work: () => Promise<void>) {
    if (lock.current || busy) return;
    lock.current = true;
    setWorking(true);
    onBusyChange(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (error) {
      if (alive.current) setError((error as Error).message);
      if (
        error instanceof CloudRequestError &&
        [
          "AI_FINISHED",
          "AI_INVALID_RESPONSE",
          "AI_INVALID_EVIDENCE",
          "AI_UNAVAILABLE",
          "AI_REFUSED",
          "AI_REQUEST_CHANGED",
        ].includes(error.code)
      )
        request.current = null;
    } finally {
      lock.current = false;
      onBusyChange(false);
      if (alive.current) setWorking(false);
    }
  }
  const locked = busy || working;
  return (
    <section aria-label="Job criterion coaching" className="evidence-item">
      <h3>Coach this criterion with your evidence</h3>
      <blockquote>{criterion.description}</blockquote>
      <p>
        This interpretation concerns one entry. It does not verify
        qualifications or change the local coverage counts. Model and support
        checks can make mistakes.
      </p>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {stale && (
        <p role="alert">
          The CV changed. Analyze the current saved snapshot before requesting
          or accepting coaching.
        </p>
      )}
      {!owner ? (
        <p>
          Job coaching requires an account CV. Device reviews are not uploaded
          automatically.
        </p>
      ) : !availability ? (
        <p role="status">Checking coaching availability…</p>
      ) : !availability.jobCoaching || !availability.configured ? (
        <p>
          Live job coaching is not enabled on this installation. Your local
          review remains available.
        </p>
      ) : (
        <>
          <label>
            Bullet for job coaching
            <select
              value={bulletId}
              disabled={locked || !!proposal}
              onChange={(event) => {
                setBulletId(event.target.value);
                setConsent(false);
                setConfirmed(false);
              }}
            >
              {bullets.map((bullet, index) => (
                <option value={bullet.id} key={bullet.id}>
                  {index + 1}. {bullet.text.slice(0, 100)}
                </option>
              ))}
            </select>
          </label>
          {!bullets.length && (
            <p>Add a bullet in a visible section before requesting coaching.</p>
          )}
          {contextError && <p role="alert">{contextError}</p>}
          <label>
            Coaching instruction
            <textarea
              rows={3}
              maxLength={1000}
              value={instruction}
              disabled={locked || !!proposal}
              onChange={(event) => {
                setInstruction(event.target.value);
                setConsent(false);
              }}
            />
          </label>
          <details>
            <summary>Review evidence and context to be processed</summary>
            <p>
              Target: {review.target.role} · {review.target.seniority} ·{" "}
              {review.target.language} ·{" "}
              {review.target.company || "No company specified"}. Criterion:{" "}
              {criterion.description}
            </p>
            <ul>
              {context?.sources.map((source) => (
                <li key={source.id}>{source.text}</li>
              ))}
            </ul>
          </details>
          <p>
            The posting goes to the app server to validate this criterion
            against your saved CV. Only this criterion, target context, selected
            entry's bullets and writing instruction go to OpenAI for coaching
            and separate support checks. Contact fields, other entries and the
            full posting are excluded from provider requests. Suggestions,
            selected criterion and source references remain in your account
            until rejected or the CV/account is deleted, and appear in
            account-data export. Provider retention depends on deployment
            settings.
          </p>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={consent}
              disabled={locked || !!proposal}
              onChange={(event) => setConsent(event.target.checked)}
            />
            Send this criterion, target context, entry bullets and instruction
            to OpenAI.
          </label>
          <button
            type="button"
            disabled={
              locked ||
              stale ||
              !consent ||
              !context ||
              !!contextError ||
              !instruction.trim() ||
              !!proposal ||
              review.target.language !== "english"
            }
            onClick={() =>
              run(async () => {
                const current = await prepare();
                if (reviewSnapshot(current) !== review.sourceSnapshot)
                  throw new Error(
                    "The saved CV changed. Analyze it again before coaching.",
                  );
                const input = {
                  documentId: current.id,
                  revision: current.revision,
                  bulletId,
                  instruction,
                  consent: true,
                  job: coachingInput(review, criterionId),
                };
                const key = JSON.stringify(input);
                if (request.current?.key !== key)
                  request.current = { key, id: crypto.randomUUID() };
                const value = await accountRequest(
                  "/api/ai",
                  {
                    method: "POST",
                    signal: AbortSignal.timeout(65000),
                    body: JSON.stringify({
                      ...input,
                      requestId: request.current.id,
                    }),
                  },
                  owner,
                );
                const result = reviewProposal(
                  current,
                  proposalSchema.parse(value),
                ).proposal;
                if (
                  !result.coaching ||
                  JSON.stringify(result.coaching.criterion) !==
                    JSON.stringify(criterion) ||
                  result.coaching.selectedBulletId !== bulletId ||
                  result.coaching.sourceHash !== review.sourceHash ||
                  result.coaching.jobHash !== review.jobHash ||
                  JSON.stringify(result.coaching.target) !==
                    JSON.stringify(review.target) ||
                  result.coaching.rulesVersion !== review.version ||
                  result.coaching.termsVersion !== review.termsVersion
                )
                  throw new Error(
                    "The coaching response does not match this reviewed criterion. Nothing was applied.",
                  );
                if (alive.current) {
                  setProposal(result);
                  setConfirmed(false);
                }
              })
            }
          >
            {working ? "Working…" : "Request criterion coaching"}
          </button>
          {review.target.language !== "english" && (
            <p>
              This coaching slice supports English only. Keep this criterion in
              manual review.
            </p>
          )}
        </>
      )}
      {proposal?.coaching && (
        <article aria-label="Coaching proposal">
          <h4>
            {proposal.coaching.assessment.status === "relevant"
              ? "Possible relevance — inspect the evidence"
              : proposal.coaching.assessment.status === "uncertain"
                ? "Needs manual review"
                : "Not demonstrated in this entry"}
          </h4>
          <p>{proposal.coaching.assessment.explanation}</p>
          <p>{proposal.message}</p>
          <p>
            Prompt {proposal.coaching.promptVersion} · Model{" "}
            {proposal.coaching.model} ·{" "}
            {new Date(proposal.coaching.analyzedAt).toLocaleString()}
          </p>
          <ul>
            {proposal.coaching.assessment.evidenceIds.map((id) => (
              <li key={id}>
                <blockquote>
                  {
                    proposal.coaching!.sources.find(
                      (source) => source.id === id,
                    )?.text
                  }
                </blockquote>
              </li>
            ))}
          </ul>
          <ul>
            {proposal.questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
          {proposal.operations.map((operation) => (
            <div key={operation.bulletId} className="ai-comparison">
              <div>
                <h4>Before</h4>
                <p>{operation.before}</p>
              </div>
              <div>
                <h4>Suggested</h4>
                <p>{operation.text}</p>
              </div>
              <details>
                <summary>Candidate evidence for this wording</summary>
                <ul>
                  {operation.evidenceIds.map((id) => (
                    <li key={id}>
                      {
                        proposal.coaching!.sources.find(
                          (source) => source.id === id,
                        )?.text
                      }
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
          {!!proposal.operations.length && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={locked || stale}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I checked every claim against my original evidence.
            </label>
          )}
          <div className="button-row">
            {!!proposal.operations.length && (
              <button
                type="button"
                disabled={locked || stale || !confirmed}
                onClick={() =>
                  run(async () => {
                    await accept(proposal);
                    if (alive.current) {
                      setProposal(null);
                      setConfirmed(false);
                      request.current = null;
                      setMessage(
                        "Coaching edit saved. Close this dialog and use Undo to restore the previous wording.",
                      );
                      onApplied();
                    }
                  })
                }
              >
                Accept coaching edit
              </button>
            )}
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                run(async () => {
                  await accountRequest(
                    `/api/ai/${encodeURIComponent(proposal.id)}`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        decision: "reject",
                        confirmed: true,
                      }),
                    },
                    owner ?? undefined,
                  );
                  if (alive.current) {
                    setProposal(null);
                    setConfirmed(false);
                    request.current = null;
                    setMessage("Coaching dismissed. Your CV is unchanged.");
                  }
                })
              }
            >
              {proposal.operations.length
                ? "Reject coaching"
                : "Dismiss coaching questions"}
            </button>
          </div>
        </article>
      )}
      <button type="button" disabled={locked} onClick={onClose}>
        Close criterion coaching
      </button>
    </section>
  );
}
