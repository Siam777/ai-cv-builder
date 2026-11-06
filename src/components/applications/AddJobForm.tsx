"use client";
import { useRef, useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";
import type { JobReadResponse } from "@/lib/ai-contract";
import {
  EMPLOYMENT_TYPE_LABELS,
  FIELD_MAX,
  JOB_FIELD_LABELS,
  JOB_POST_MAX,
  WORK_TYPE_LABELS,
  charCount,
  type JobField,
} from "@/lib/job-read";
import { readJobPostLocally } from "@/lib/job-read-local";
import {
  applyRead,
  draftProblems,
  postTooLong,
  type JobDraft,
} from "@/lib/job-draft";
import { RequirementsEditor } from "./RequirementsEditor";

export type AiAccess =
  { kind: "guest" } | { kind: "no-consent" } | { kind: "ready"; owner: string };

const TEXT_FIELDS: JobField[] = ["role", "company", "location", "salary"];

/**
 * "Add a job" (job capture §4.1): paste a post, read it locally for free or
 * with AI (one request, signed in with consent), review every field and the
 * requirement lists, then save a Saved application. Values read from the
 * post show the words they came from; nothing is guessed.
 */
export function AddJobForm({
  initial,
  ai,
  busy,
  saveLabel,
  onSave,
  onCancel,
}: {
  initial: JobDraft;
  ai: AiAccess;
  busy: boolean;
  saveLabel: string;
  onSave: (draft: JobDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [tried, setTried] = useState(false);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const count = charCount(draft.post);
  const tooLong = postTooLong(draft.post);
  const problems = draftProblems(draft);

  function readLocally() {
    setError("");
    const result = readJobPostLocally(draft.post, draft.url);
    setDraft((current) => applyRead(current, result));
    const fields = Object.keys(result.fields).length;
    setStatus(
      `Read the post: ${fields} field${fields === 1 ? "" : "s"} and ${result.requirements.length} requirement${result.requirements.length === 1 ? "" : "s"} found. Nothing was sent. Check each one below.`,
    );
    fieldsRef.current?.focus();
  }
  async function readWithAi() {
    if (ai.kind !== "ready") return;
    setReading(true);
    setError("");
    setStatus("Reading the post with AI…");
    try {
      const result = (await accountRequest(
        "/api/ai/job-read",
        {
          method: "POST",
          signal: AbortSignal.timeout(65000),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            post: draft.post,
            ...(draft.url.trim() ? { url: draft.url.trim() } : {}),
          }),
        },
        ai.owner,
      )) as JobReadResponse;
      setDraft((current) => applyRead(current, result));
      const fields = Object.keys(result.fields).length;
      setStatus(
        `Read with AI: ${fields} field${fields === 1 ? "" : "s"} and ${result.requirements.length} requirement${result.requirements.length === 1 ? "" : "s"}, each with the words it came from.` +
          (result.withheld
            ? ` ${result.withheld} value${result.withheld === 1 ? " was" : "s were"} left out because the post did not support ${result.withheld === 1 ? "it" : "them"}.`
            : ""),
      );
      fieldsRef.current?.focus();
    } catch (reason) {
      setStatus("");
      setError(
        reason instanceof CloudRequestError && reason.code === "NETWORK_ERROR"
          ? "Read with AI could not finish. Read the post still works without AI."
          : (reason as Error).message,
      );
    } finally {
      setReading(false);
    }
  }
  const setField = (key: JobField, value: string) =>
    setDraft((current) => ({
      ...current,
      fields: { ...current.fields, [key]: value },
    }));
  const quote = (key: JobField) => {
    const read = draft.read[key];
    return read && read.value === draft.fields[key] ? read.quote : null;
  };
  const fieldNote = (key: JobField) => {
    const words = quote(key);
    return words ? (
      <small className="field-quote" id={`job-${key}-quote`}>
        From the post: “{words}”
      </small>
    ) : null;
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (problems.length) return;
    onSave(draft);
  }

  return (
    <form
      className="tracker-form add-job-form"
      onSubmit={submit}
      aria-label="Add a job"
    >
      <div className="tracker-field wide">
        <label htmlFor="job-post">Job post</label>
        <textarea
          id="job-post"
          rows={8}
          value={draft.post}
          disabled={busy}
          aria-describedby="job-post-count"
          aria-invalid={tooLong || undefined}
          placeholder="Paste the whole job post here."
          onChange={(event) => setDraft({ ...draft, post: event.target.value })}
        />
        <small
          id="job-post-count"
          className={tooLong ? "count-over" : undefined}
        >
          {count.toLocaleString("en-US")} /{" "}
          {JOB_POST_MAX.toLocaleString("en-US")} characters
          {tooLong ? ". Shorten the post to read or save it." : ""}
        </small>
      </div>
      <label className="tracker-field wide">
        Link to the post (optional)
        <input
          type="url"
          value={draft.url}
          maxLength={2000}
          disabled={busy}
          placeholder="https://"
          onChange={(event) => setDraft({ ...draft, url: event.target.value })}
        />
      </label>
      <div className="read-actions">
        <button
          type="button"
          onClick={readLocally}
          disabled={busy || reading || !draft.post.trim() || tooLong}
        >
          Read the post
        </button>
        {ai.kind !== "guest" && (
          <button
            type="button"
            onClick={() => void readWithAi()}
            disabled={
              busy ||
              reading ||
              ai.kind !== "ready" ||
              !draft.post.trim() ||
              tooLong
            }
            aria-describedby="read-ai-note"
          >
            <Sparkles size={16} aria-hidden />{" "}
            {reading ? "Reading…" : "Read with AI"}
          </button>
        )}
        <small id="read-ai-note" className="tracker-muted">
          {ai.kind === "guest"
            ? "Read the post runs in your browser and sends nothing. Sign in to use Read with AI."
            : ai.kind === "no-consent"
              ? "Read the post sends nothing. To use Read with AI (uses 1 AI request), turn on AI writing help in Account settings."
              : "Read the post runs in your browser and sends nothing. Read with AI uses 1 AI request and sends only the post and the link to OpenAI, never your CV."}
        </small>
      </div>
      <p className="tracker-status" role="status">
        {status}
      </p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div
        className="job-review"
        ref={fieldsRef}
        tabIndex={-1}
        aria-label="Review the job"
      >
        <h3>Review the job</h3>
        <p className="tracker-muted">
          Check every value against the post and correct anything wrong. A field
          the post does not support stays empty.
        </p>
        <div className="tracker-fields">
          {TEXT_FIELDS.map((key) => (
            <div className="tracker-field" key={key}>
              <label htmlFor={`job-${key}`}>{JOB_FIELD_LABELS[key]}</label>
              <input
                id={`job-${key}`}
                value={draft.fields[key]}
                maxLength={FIELD_MAX[key]}
                disabled={busy}
                required={key === "role" || key === "company"}
                aria-describedby={quote(key) ? `job-${key}-quote` : undefined}
                onChange={(event) => setField(key, event.target.value)}
              />
              {fieldNote(key)}
            </div>
          ))}
          <div className="tracker-field">
            <label htmlFor="job-workType">{JOB_FIELD_LABELS.workType}</label>
            <select
              id="job-workType"
              value={draft.fields.workType}
              disabled={busy}
              aria-describedby={
                quote("workType") ? "job-workType-quote" : undefined
              }
              onChange={(event) => setField("workType", event.target.value)}
            >
              <option value="">Not stated</option>
              {Object.entries(WORK_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {fieldNote("workType")}
          </div>
          <div className="tracker-field">
            <label htmlFor="job-employmentType">
              {JOB_FIELD_LABELS.employmentType}
            </label>
            <select
              id="job-employmentType"
              value={draft.fields.employmentType}
              disabled={busy}
              aria-describedby={
                quote("employmentType") ? "job-employmentType-quote" : undefined
              }
              onChange={(event) =>
                setField("employmentType", event.target.value)
              }
            >
              <option value="">Not stated</option>
              {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {fieldNote("employmentType")}
          </div>
          <div className="tracker-field">
            <label htmlFor="job-deadline">{JOB_FIELD_LABELS.deadline}</label>
            <input
              id="job-deadline"
              type="date"
              value={draft.fields.deadline}
              disabled={busy}
              aria-describedby={
                quote("deadline") ? "job-deadline-quote" : undefined
              }
              onChange={(event) => setField("deadline", event.target.value)}
            />
            {fieldNote("deadline")}
          </div>
          <div className="tracker-field">
            <label htmlFor="job-applyLink">{JOB_FIELD_LABELS.applyLink}</label>
            <input
              id="job-applyLink"
              type="url"
              value={draft.fields.applyLink}
              maxLength={2000}
              disabled={busy}
              placeholder="https://"
              aria-describedby={
                quote("applyLink") ? "job-applyLink-quote" : undefined
              }
              onChange={(event) => setField("applyLink", event.target.value)}
            />
            {fieldNote("applyLink")}
          </div>
        </div>
        <h3>Requirements</h3>
        <RequirementsEditor
          idPrefix="job-requirements"
          items={draft.requirements}
          disabled={busy}
          onChange={(requirements) =>
            setDraft((current) => ({ ...current, requirements }))
          }
        />
      </div>
      {tried && problems.length > 0 && (
        <ul className="alert" role="alert">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <div className="button-row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Saving…" : saveLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
