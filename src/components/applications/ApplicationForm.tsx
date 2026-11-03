"use client";
import { useState, type FormEvent } from "react";
import {
  APPLICATION_LIMITS,
  STAGES,
  STAGE_LABELS,
  type ApplicationSummary,
  type Stage,
} from "@/lib/applications";

export interface ApplicationFields {
  company: string;
  role: string;
  stage: Stage;
  jobUrl: string;
  location: string;
  source: string;
  appliedAt: string;
  nextActionAt: string;
  nextAction: string;
  notes: string;
  jobPost: string;
}
export const emptyFields = (): ApplicationFields => ({
  company: "",
  role: "",
  stage: "saved",
  jobUrl: "",
  location: "",
  source: "",
  appliedAt: "",
  nextActionAt: "",
  nextAction: "",
  notes: "",
  jobPost: "",
});
/** Optional fields go to the server as null when empty. */
export function fieldsToInput(fields: ApplicationFields) {
  const optional = (value: string) => (value.trim() ? value.trim() : null);
  return {
    company: fields.company.trim(),
    role: fields.role.trim(),
    stage: fields.stage,
    jobUrl: optional(fields.jobUrl),
    location: optional(fields.location),
    source: optional(fields.source),
    appliedAt: optional(fields.appliedAt),
    nextActionAt: optional(fields.nextActionAt),
    nextAction: optional(fields.nextAction),
    notes: fields.notes,
    jobPost: optional(fields.jobPost) ? fields.jobPost : null,
  };
}

/** The editable fields of an application, shared by the create form and the detail panel. */
export function ApplicationFieldset({
  fields,
  onChange,
  idPrefix,
  disabled,
  showStage = true,
}: {
  fields: ApplicationFields;
  onChange: (next: ApplicationFields) => void;
  idPrefix: string;
  disabled?: boolean;
  showStage?: boolean;
}) {
  const set = (key: keyof ApplicationFields) => (value: string) => onChange({ ...fields, [key]: value });
  const input = (key: keyof ApplicationFields, label: string, props: Record<string, unknown> = {}) => (
    <label className="tracker-field">
      {label}
      <input
        id={`${idPrefix}-${key}`}
        value={fields[key]}
        disabled={disabled}
        onChange={(event) => set(key)(event.target.value)}
        {...props}
      />
    </label>
  );
  return (
    <div className="tracker-fields">
      {input("company", "Company", { required: true, maxLength: APPLICATION_LIMITS.company, autoComplete: "organization" })}
      {input("role", "Role", { required: true, maxLength: APPLICATION_LIMITS.role })}
      {showStage && (
        <label className="tracker-field">
          Stage
          <select
            id={`${idPrefix}-stage`}
            value={fields.stage}
            disabled={disabled}
            onChange={(event) => set("stage")(event.target.value)}
          >
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </label>
      )}
      {input("location", "Location", { maxLength: APPLICATION_LIMITS.location })}
      {input("jobUrl", "Link to the job post", { type: "url", maxLength: APPLICATION_LIMITS.url, placeholder: "https://" })}
      {input("source", "Where you found it", { maxLength: APPLICATION_LIMITS.source, placeholder: "LinkedIn, a referral, the company site…" })}
      {input("appliedAt", "Date applied", { type: "date" })}
      {input("nextActionAt", "Reminder date", { type: "date" })}
      {input("nextAction", "Next action", { maxLength: APPLICATION_LIMITS.nextAction, placeholder: "Follow up with the recruiter" })}
      <div className="tracker-field wide">
        <label htmlFor={`${idPrefix}-notes`}>Notes</label>
        <textarea
          id={`${idPrefix}-notes`}
          rows={4}
          maxLength={APPLICATION_LIMITS.notes}
          value={fields.notes}
          disabled={disabled}
          onChange={(event) => set("notes")(event.target.value)}
          aria-describedby={`${idPrefix}-notes-count`}
        />
        <small id={`${idPrefix}-notes-count`}>
          {fields.notes.length.toLocaleString()} / {APPLICATION_LIMITS.notes.toLocaleString()} characters
        </small>
      </div>
      <div className="tracker-field wide">
        <label htmlFor={`${idPrefix}-jobPost`}>Job post</label>
        <textarea
          id={`${idPrefix}-jobPost`}
          rows={6}
          maxLength={APPLICATION_LIMITS.jobPost}
          value={fields.jobPost}
          disabled={disabled}
          onChange={(event) => set("jobPost")(event.target.value)}
          aria-describedby={`${idPrefix}-jobPost-count`}
          placeholder="Paste the job post to keep it with this application."
        />
        <small id={`${idPrefix}-jobPost-count`}>
          {fields.jobPost.length.toLocaleString()} / {APPLICATION_LIMITS.jobPost.toLocaleString()} characters
        </small>
      </div>
    </div>
  );
}

/**
 * Create form. With an attachment (an export snapshot or a cover letter) it
 * can also attach to an existing application instead of creating one.
 */
export function ApplicationForm({
  initial,
  attachment,
  existing,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: ApplicationFields;
  attachment?: string;
  existing?: ApplicationSummary[];
  busy: boolean;
  onSubmit: (choice: { existingId: string } | { fields: ApplicationFields }) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState(initial);
  const [target, setTarget] = useState("new");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (target !== "new") onSubmit({ existingId: target });
    else onSubmit({ fields });
  }
  return (
    <form className="tracker-form" onSubmit={submit} aria-label="Application details">
      {attachment && (
        <p className="tracker-attachment">
          <strong>Attaching:</strong> {attachment}
          <br />
          The copy you sent is kept as it was. If you change your CV later, this copy does not change.
        </p>
      )}
      {attachment && existing && existing.length > 0 && (
        <label className="tracker-field">
          Attach to
          <select value={target} onChange={(event) => setTarget(event.target.value)} disabled={busy}>
            <option value="new">A new application</option>
            {existing.map((app) => (
              <option key={app.id} value={app.id}>
                {app.role} at {app.company}
              </option>
            ))}
          </select>
        </label>
      )}
      {target === "new" && (
        <ApplicationFieldset fields={fields} onChange={setFields} idPrefix="new-application" disabled={busy} />
      )}
      <div className="button-row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Saving…" : target === "new" ? "Save application" : "Attach"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
