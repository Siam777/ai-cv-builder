"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { documentSchema } from "@/lib/document";
import {
  APPLICATION_LIMITS,
  STAGE_LABELS,
  localDay,
  type ApplicationDetail,
  type ApplicationEvent,
  type Contact,
} from "@/lib/applications";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";
import { trackerApi } from "@/lib/applications-client";
import {
  ApplicationFieldset,
  fieldsToInput,
  type ApplicationFields,
} from "./ApplicationForm";
import { FrozenDocumentDialog } from "./FrozenDocumentDialog";
import { TrackerDialog } from "./TrackerDialog";

const toFields = (app: ApplicationDetail): ApplicationFields => ({
  company: app.company,
  role: app.role,
  stage: app.stage,
  jobUrl: app.jobUrl ?? "",
  location: app.location ?? "",
  source: app.source ?? "",
  appliedAt: app.appliedAt ?? "",
  nextActionAt: app.nextActionAt ?? "",
  nextAction: app.nextAction ?? "",
  notes: app.notes,
  jobPost: app.jobPost ?? "",
});
const date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
function describe(event: ApplicationEvent) {
  if (event.kind === "created")
    return `Added as ${STAGE_LABELS[event.toStage ?? "saved"]}`;
  if (event.kind === "sent") return "Marked as sent";
  return `${STAGE_LABELS[event.fromStage ?? "saved"]} → ${STAGE_LABELS[event.toStage ?? "saved"]}`;
}
/** A sent date chosen in the form: now for today, otherwise midday on that day. */
export function sentAtFor(day: string) {
  return day === localDay()
    ? new Date().toISOString()
    : new Date(`${day}T12:00:00`).toISOString();
}

export function ApplicationDetailPanel({
  owner,
  applicationId,
  onChanged,
  onDeleted,
  onMatch,
  onClose,
}: {
  owner: string;
  applicationId: string;
  onChanged: (app: ApplicationDetail) => void;
  onDeleted: (id: string) => void;
  onMatch: (app: ApplicationDetail) => void;
  onClose: () => void;
}) {
  const api = trackerApi(owner);
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [fields, setFields] = useState<ApplicationFields | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cvs, setCvs] = useState<
    { id: string; name: string; revision: number }[] | null
  >(null);
  const [attachCv, setAttachCv] = useState("");
  const [sentCv, setSentCv] = useState("");
  const [sentLetter, setSentLetter] = useState("");
  const [sentDay, setSentDay] = useState(localDay);
  // Stable request IDs: a retry after a lost response reuses them (no duplicates).
  const attachRequest = useRef(crypto.randomUUID());
  const sentRequest = useRef(crypto.randomUUID());

  function load(next: ApplicationDetail) {
    setApp(next);
    setFields(toFields(next));
    setContacts(next.contacts);
    const cv = [...next.documents].reverse().find((doc) => doc.kind === "cv");
    setSentCv((value) =>
      value && next.documents.some((doc) => doc.id === value)
        ? value
        : (cv?.id ?? ""),
    );
  }
  useEffect(() => {
    let active = true;
    api
      .get(applicationId)
      .then((value) => active && load(value))
      .catch((reason: Error) => active && setError(reason.message));
    accountRequest("/api/resumes", {}, owner)
      .then((value) => {
        if (!active) return;
        const list = z.array(documentSchema).parse(value);
        setCvs(
          list.map((doc) => ({
            id: doc.id,
            name: doc.name,
            revision: doc.revision,
          })),
        );
        setAttachCv(list[0]?.id ?? "");
      })
      .catch(() => active && setCvs([]));
    return () => {
      active = false;
    };
  }, [owner, applicationId]);

  async function run(work: () => Promise<void>) {
    setWorking(true);
    setError("");
    setStatus("");
    try {
      await work();
    } catch (reason) {
      if (
        reason instanceof CloudRequestError &&
        reason.code === "APPLICATION_CHANGED" &&
        app
      ) {
        const latest = await api.get(app.id).catch(() => null);
        if (latest) load(latest);
      }
      setError((reason as Error).message);
    } finally {
      setWorking(false);
    }
  }
  const save = () =>
    run(async () => {
      if (!app || !fields) return;
      const input = fieldsToInput(fields);
      const next = await api.update(app.id, {
        updatedAt: app.updatedAt,
        ...input,
        appliedAt:
          input.stage === "applied" &&
          !input.appliedAt &&
          app.stage !== "applied"
            ? localDay()
            : input.appliedAt,
        contacts: contacts
          .map((contact) => ({ ...contact, name: contact.name.trim() }))
          .filter((contact) => contact.name),
      });
      load(next);
      onChanged(next);
      setStatus("Changes saved.");
    });
  const attach = () =>
    run(async () => {
      if (!app) return;
      const cv = cvs?.find((item) => item.id === attachCv);
      if (!cv) return;
      await api.freeze(app.id, {
        requestId: attachRequest.current,
        source: "account",
        resumeId: cv.id,
        revision: cv.revision,
      });
      attachRequest.current = crypto.randomUUID();
      const next = await api.get(app.id);
      load(next);
      onChanged(next);
      setStatus(`A frozen copy of “${cv.name}” was attached.`);
    });
  const markSent = () =>
    run(async () => {
      if (!app || !sentCv) return;
      const result = await api.submit(app.id, {
        requestId: sentRequest.current,
        sentAt: sentAtFor(sentDay),
        cvDocumentId: sentCv,
        letterDocumentId: sentLetter || null,
      });
      sentRequest.current = crypto.randomUUID();
      load(result.application);
      onChanged(result.application);
      setStatus("Marked as sent.");
    });
  const remove = () =>
    run(async () => {
      if (!app) return;
      await api.remove(app.id);
      onDeleted(app.id);
    });

  const title = app ? `${app.role} at ${app.company}` : "Application";
  const documentName = (id: string | null) =>
    app?.documents.find((doc) => doc.id === id)?.name ?? "";
  const cvDocs = app?.documents.filter((doc) => doc.kind === "cv") ?? [];
  const letterDocs =
    app?.documents.filter((doc) => doc.kind === "cover_letter") ?? [];
  const full =
    (app?.documents.length ?? 0) >= APPLICATION_LIMITS.documentsPerApplication;
  return (
    <>
      <TrackerDialog
        title={title}
        onClose={onClose}
        wide
        footer={
          app && (
            <>
              <button
                type="button"
                className="primary"
                onClick={() => void save()}
                disabled={working || !fields}
              >
                Save changes
              </button>
              {app.jobPost && (
                <button
                  type="button"
                  onClick={() => onMatch(app)}
                  disabled={working}
                >
                  Match this job
                </button>
              )}
              {confirmDelete ? (
                <span
                  className="tracker-confirm"
                  role="group"
                  aria-label="Confirm deletion"
                >
                  <span>
                    Delete this application, its notes, contacts and frozen
                    copies?
                  </span>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => void remove()}
                    disabled={working}
                  >
                    Delete permanently
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={working}
                  >
                    Keep it
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={working}
                >
                  Delete application
                </button>
              )}
            </>
          )
        }
      >
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <p className="tracker-status" role="status">
          {status}
        </p>
        {!app && !error && <p role="status">Loading…</p>}
        {app && fields && (
          <div className="tracker-detail">
            <section aria-labelledby="detail-fields">
              <h3 id="detail-fields">Details</h3>
              <ApplicationFieldset
                fields={fields}
                onChange={setFields}
                idPrefix="detail"
                disabled={working}
              />
            </section>

            <section aria-labelledby="detail-contacts">
              <h3 id="detail-contacts">Contacts</h3>
              <p className="tracker-muted">
                People you are in touch with about this job. Only you see them;
                they are never sent to AI or messaged by the app.
              </p>
              {contacts.map((contact, index) => {
                const set = (key: keyof Contact) => (value: string) =>
                  setContacts((list) =>
                    list.map((item, i) =>
                      i === index ? { ...item, [key]: value } : item,
                    ),
                  );
                const label = contact.name.trim() || `Contact ${index + 1}`;
                return (
                  <fieldset key={contact.id} className="tracker-contact">
                    <legend>{label}</legend>
                    <div className="tracker-fields">
                      <label className="tracker-field">
                        Name
                        <input
                          value={contact.name}
                          maxLength={200}
                          onChange={(e) => set("name")(e.target.value)}
                        />
                      </label>
                      <label className="tracker-field">
                        Their role
                        <input
                          value={contact.role}
                          maxLength={200}
                          onChange={(e) => set("role")(e.target.value)}
                        />
                      </label>
                      <label className="tracker-field">
                        Email
                        <input
                          type="email"
                          value={contact.email}
                          maxLength={320}
                          onChange={(e) => set("email")(e.target.value)}
                        />
                      </label>
                      <label className="tracker-field">
                        Phone
                        <input
                          type="tel"
                          value={contact.phone}
                          maxLength={50}
                          onChange={(e) => set("phone")(e.target.value)}
                        />
                      </label>
                      <label className="tracker-field">
                        Profile link
                        <input
                          type="url"
                          value={contact.profileUrl}
                          maxLength={2000}
                          onChange={(e) => set("profileUrl")(e.target.value)}
                        />
                      </label>
                      <label className="tracker-field wide">
                        Notes about this contact
                        <textarea
                          rows={2}
                          value={contact.notes}
                          maxLength={APPLICATION_LIMITS.contactNotes}
                          onChange={(e) => set("notes")(e.target.value)}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setContacts((list) =>
                          list.filter((_, i) => i !== index),
                        )
                      }
                      aria-label={`Remove ${label}`}
                    >
                      Remove contact
                    </button>
                  </fieldset>
                );
              })}
              <button
                type="button"
                disabled={contacts.length >= APPLICATION_LIMITS.contacts}
                onClick={() =>
                  setContacts((list) => [
                    ...list,
                    {
                      id: crypto.randomUUID(),
                      name: "",
                      role: "",
                      email: "",
                      phone: "",
                      profileUrl: "",
                      notes: "",
                    },
                  ])
                }
              >
                Add contact
              </button>
              <p className="tracker-muted">
                Save changes to keep contact edits.
              </p>
            </section>

            <section aria-labelledby="detail-documents">
              <h3 id="detail-documents">Frozen copies</h3>
              <p className="tracker-muted">
                The copy you sent is kept as it was. If you change your CV
                later, this copy does not change.
              </p>
              {app.documents.length === 0 ? (
                <p>No CV or letter is attached yet.</p>
              ) : (
                <ul className="tracker-documents">
                  {app.documents.map((doc) => (
                    <li key={doc.id}>
                      <span>
                        <strong>
                          {doc.kind === "cv" ? "CV" : "Cover letter"}:
                        </strong>{" "}
                        {doc.name}{" "}
                        <span className="tracker-muted">
                          · kept {date(doc.createdAt)}
                        </span>
                        {doc.photoOmitted && doc.kind === "cv" && (
                          <span className="tracker-muted">
                            {" "}
                            · photo left out
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewing(doc.id)}
                        aria-label={`View frozen copy ${doc.name}`}
                      >
                        View
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {cvs && cvs.length > 0 && (
                <div className="tracker-inline-form">
                  <label className="tracker-field">
                    Attach a CV from my account
                    <select
                      value={attachCv}
                      onChange={(e) => setAttachCv(e.target.value)}
                      disabled={working || full}
                    >
                      {cvs.map((cv) => (
                        <option key={cv.id} value={cv.id}>
                          {cv.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void attach()}
                    disabled={working || full || !attachCv}
                  >
                    Attach frozen copy
                  </button>
                </div>
              )}
              {full && (
                <p className="tracker-muted">
                  This application has the maximum of 5 documents.
                </p>
              )}
            </section>

            <section aria-labelledby="detail-sent">
              <h3 id="detail-sent">Sent</h3>
              {app.submissions.length === 0 ? (
                <p>Not marked as sent yet.</p>
              ) : (
                <ul className="tracker-documents">
                  {app.submissions.map((submission) => (
                    <li key={submission.id}>
                      Sent {date(submission.sentAt)}:{" "}
                      {documentName(submission.cvDocumentId)}
                      {submission.letterDocumentId
                        ? ` with ${documentName(submission.letterDocumentId)}`
                        : ""}
                    </li>
                  ))}
                </ul>
              )}
              {cvDocs.length > 0 ? (
                <div className="tracker-inline-form">
                  <label className="tracker-field">
                    CV sent
                    <select
                      value={sentCv}
                      onChange={(e) => setSentCv(e.target.value)}
                      disabled={working}
                    >
                      {cvDocs.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name} ({date(doc.createdAt)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="tracker-field">
                    Letter sent
                    <select
                      value={sentLetter}
                      onChange={(e) => setSentLetter(e.target.value)}
                      disabled={working}
                    >
                      <option value="">No letter</option>
                      {letterDocs.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name} ({date(doc.createdAt)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="tracker-field">
                    Sent on
                    <input
                      type="date"
                      value={sentDay}
                      max={localDay()}
                      onChange={(e) => setSentDay(e.target.value)}
                      disabled={working}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void markSent()}
                    disabled={working || !sentCv || !sentDay}
                  >
                    Mark as sent
                  </button>
                </div>
              ) : (
                <p className="tracker-muted">
                  Attach the CV you sent to mark this application as sent.
                </p>
              )}
            </section>

            <section aria-labelledby="detail-timeline">
              <h3 id="detail-timeline">Timeline</h3>
              <ol className="tracker-timeline">
                {app.events.map((event) => (
                  <li key={event.id}>
                    <time dateTime={event.at}>{date(event.at)}</time>{" "}
                    {describe(event)}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </TrackerDialog>
      {viewing && app && (
        <FrozenDocumentDialog
          owner={owner}
          applicationId={app.id}
          documentId={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
