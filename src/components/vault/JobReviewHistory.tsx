"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { ResumeDocument } from "@/lib/document";
import { accountRequest } from "@/lib/cloud-repository";
import {
  reviewSaveInput,
  storedJobReviewSchema,
  reviewSummarySchema,
  reviewDetailSchema,
  type ReviewSummary,
  type StoredJobReview,
} from "@/lib/job-review-history";
import {
  reviewSnapshot,
  type JobEvidenceReview,
} from "@/lib/vault/job-evidence";

type Props = {
  owner: string | null;
  doc: ResumeDocument;
  review: JobEvidenceReview | null;
  busy: boolean;
  prepare: () => Promise<ResumeDocument>;
  onRecheck: (report: StoredJobReview) => void;
};
export function JobReviewHistory({
  owner,
  doc,
  review,
  busy,
  prepare,
  onRecheck,
}: Props) {
  const [rows, setRows] = useState<ReviewSummary[]>([]),
    [selected, setSelected] = useState<{
      report: StoredJobReview;
      stale: boolean;
    } | null>(null);
  const [consent, setConsent] = useState(false),
    [working, setWorking] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [sourceHash, setSourceHash] = useState(""),
    [savedId, setSavedId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const pending = useRef<{ key: string; requestId: string } | null>(null),
    listVersion = useRef(0),
    lock = useRef(false),
    alive = useRef(true);
  const base = `/api/resumes/${encodeURIComponent(doc.id)}/job-reviews`;
  let snapshot = "";
  try {
    snapshot = reviewSnapshot(doc);
  } catch {}
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setSourceHash("");
    if (snapshot)
      void crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(snapshot))
        .then((buffer) => {
          if (active)
            setSourceHash(
              Array.from(new Uint8Array(buffer))
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join(""),
            );
        });
    return () => {
      active = false;
    };
  }, [snapshot]);
  useEffect(() => {
    setConsent(false);
    setSavedId("");
  }, [review]);
  async function refresh() {
    if (!owner) return;
    const version = ++listVersion.current;
    const value = await accountRequest(base, {}, owner);
    if (alive.current && version === listVersion.current) {
      setRows(z.array(reviewSummarySchema).max(20).parse(value));
      setLoaded(true);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    const version = ++listVersion.current;
    setLoaded(false);
    if (owner)
      void accountRequest(base, { signal: controller.signal }, owner)
        .then((value) => {
          if (!controller.signal.aborted && version === listVersion.current) {
            setRows(z.array(reviewSummarySchema).max(20).parse(value));
            setLoaded(true);
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted && version === listVersion.current)
            setError(error.message);
        });
    return () => controller.abort();
  }, [owner, base]);
  async function run(work: () => Promise<void>) {
    if (lock.current || busy) return;
    lock.current = true;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (error) {
      if (alive.current)
        setError(
          error instanceof Error
            ? error.message
            : "The history request failed. Your current CV and review are kept.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setWorking(false);
    }
  }
  async function save() {
    if (!owner || !review || !consent || savedId) return;
    await run(async () => {
      const current = await prepare();
      if (reviewSnapshot(current) !== review.sourceSnapshot)
        throw new Error(
          "The CV changed after this review. Analyze the current saved snapshot again.",
        );
      const key = JSON.stringify(
        reviewSaveInput(review, "00000000-0000-4000-8000-000000000000"),
      );
      if (pending.current?.key !== key)
        pending.current = { key, requestId: crypto.randomUUID() };
      const input = reviewSaveInput(review, pending.current.requestId);
      const report = storedJobReviewSchema.parse(
        await accountRequest(
          base,
          { method: "POST", body: JSON.stringify(input) },
          owner,
        ),
      );
      if (!alive.current) return;
      setSavedId(report.id);
      setMessage("Report saved to this account. Your CV was not changed.");
      await refresh();
    });
  }
  const locked = busy || working;
  const outdated = (row: { sourceHash: string; stale: boolean }) =>
    row.stale || (!!sourceHash && row.sourceHash !== sourceHash);
  return (
    <section className="job-review-history" aria-label="Saved job reviews">
      <h3>Saved job reviews</h3>
      {!owner ? (
        <p className="helper-text">
          History is available for account CVs. This device-only posting and
          report remain temporary. Open an account workspace to save reports;
          signing in alone does not upload this review.
        </p>
      ) : (
        <>
          <p className="helper-text">
            Reports retain the posting, reviewed priorities and cited CV
            excerpts in this account until you delete the report, its CV or the
            account. Saving rechecks the posting against your saved CV. No AI
            provider receives them. Up to 20 reports per CV and 100 per account;
            older reports are never removed automatically. Account-data export
            includes saved reports.
          </p>
          {error && (
            <p className="alert" role="alert">
              {error} Your open review and CV are kept. Retry this history
              action.
            </p>
          )}
          {message && <p role="status">{message}</p>}
          {review && (
            <div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={locked || !!savedId}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                Save this posting and cited CV excerpts in my account until I
                delete them
              </label>
              <button
                type="button"
                disabled={
                  locked ||
                  !consent ||
                  !!savedId ||
                  review.sourceSnapshot !== snapshot
                }
                onClick={save}
              >
                {savedId
                  ? "Report saved"
                  : working
                    ? "Saving report…"
                    : "Save job review"}
              </button>
            </div>
          )}
          <button type="button" disabled={locked} onClick={() => run(refresh)}>
            Refresh saved reviews
          </button>
          {!loaded && !error && <p role="status">Loading saved job reviews…</p>}
          {loaded && !rows.length && <p>No saved job reviews for this CV.</p>}
          <ul className="evidence-list">
            {rows.map((row) => (
              <li key={row.id} className="evidence-item">
                <h4>
                  {row.target.role}
                  {row.target.company ? ` at ${row.target.company}` : ""}
                </h4>
                <p>
                  Saved {new Date(row.savedAt).toLocaleString()} · CV revision{" "}
                  {row.sourceRevision}
                </p>
                <p>
                  {outdated(row)
                    ? "Stale — CV or review rules changed"
                    : sourceHash
                      ? "Matches current CV snapshot"
                      : "Checking CV snapshot…"}
                </p>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    run(async () => {
                      const detail = reviewDetailSchema.parse(
                        await accountRequest(
                          `${base}/${encodeURIComponent(row.id)}`,
                          {},
                          owner,
                        ),
                      );
                      if (alive.current) setSelected(detail);
                    })
                  }
                >
                  Open saved review for {row.target.role}
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <article className="evidence-item" aria-label="Saved review detail">
              <h4>Saved review · {selected.report.target.role}</h4>
              <p>
                {outdated({ ...selected.report, stale: selected.stale })
                  ? "Stale — this is historical evidence. Recheck the posting against the current CV."
                  : "Read-only historical report. Recheck before proposing any CV changes."}
              </p>
              <p>
                Rules {selected.report.version} · Terms{" "}
                {selected.report.termsVersion} · CV revision{" "}
                {selected.report.sourceRevision} ·{" "}
                {selected.report.target.seniority} ·{" "}
                {selected.report.target.language}
              </p>
              <p>
                Analyzed {new Date(selected.report.analyzedAt).toLocaleString()}{" "}
                · Saved {new Date(selected.report.savedAt).toLocaleString()}
              </p>
              <p>
                Posting SHA-256 <code>{selected.report.jobHash}</code>
              </p>
              <p>
                CV SHA-256 <code>{selected.report.sourceHash}</code>
              </p>
              <details>
                <summary>Saved posting</summary>
                <blockquote>{selected.report.jobText}</blockquote>
              </details>
              {(["required", "preferred", "uncertain"] as const).map(
                (priority) => {
                  const group = selected.report.groups[priority];
                  return (
                    <p key={priority}>
                      {priority}: {group.direct} direct · {group.partial}{" "}
                      partial · {group.absent} not found · {group.unknown}{" "}
                      manual ·{" "}
                      {group.scorable
                        ? `${group.supportUnits} support units across ${group.scorable} scorable criteria`
                        : "Not enough information"}
                    </p>
                  );
                },
              )}
              {selected.report.warnings.map((warning) => (
                <p key={warning} className="helper-text">
                  {warning}
                </p>
              ))}
              <ul className="evidence-list">
                {selected.report.matches.map((match) => (
                  <li className="evidence-item" key={match.criterion.id}>
                    <strong>
                      {match.status === "absent"
                        ? "Not found"
                        : match.status === "unknown"
                          ? "Manual review"
                          : match.status === "direct"
                            ? "Direct text support"
                            : "Partial / related"}{" "}
                      · {match.criterion.priority}
                    </strong>
                    <p>
                      {match.criterion.priorityOrigin === "candidate_review"
                        ? "Priority set by candidate review"
                        : "Priority from posting"}
                    </p>
                    {match.criterion.sources.map((source) => (
                      <blockquote key={source.start}>{source.quote}</blockquote>
                    ))}
                    <p>{match.reason}</p>
                    {match.evidence.map((ref) => (
                      <div key={ref.id}>
                        <p>{ref.label}</p>
                        <blockquote>{ref.quote}</blockquote>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
              <div className="button-row">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    onRecheck(selected.report);
                    setSelected(null);
                  }}
                >
                  Recheck this posting
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    run(async () => {
                      await accountRequest(
                        `${base}/${encodeURIComponent(selected.report.id)}`,
                        { method: "DELETE" },
                        owner,
                      );
                      if (alive.current) {
                        if (savedId === selected.report.id) {
                          setSavedId("");
                          setConsent(false);
                        }
                        setSelected(null);
                        setMessage("Saved report deleted. Your CV is kept.");
                      }
                      await refresh();
                    })
                  }
                >
                  Delete saved review
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => setSelected(null)}
                >
                  Close saved review
                </button>
              </div>
            </article>
          )}
        </>
      )}
    </section>
  );
}
