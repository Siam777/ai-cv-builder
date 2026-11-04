"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import {
  CLOSED_STAGES,
  STAGES,
  STAGE_GROUPS,
  STAGE_LABELS,
  dueState,
  localDay,
  noReplyYet,
  type ApplicationDetail,
  type ApplicationSummary,
  type FrozenDocument,
  type Stage,
} from "@/lib/applications";
import type { AccountUser } from "@/lib/cloud-contract";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";
import {
  stashHandoff,
  takeHandoff,
  trackerApi,
  type Handoff,
} from "@/lib/applications-client";
import {
  ApplicationForm,
  emptyFields,
  fieldsToInput,
  type ApplicationFields,
} from "./ApplicationForm";
import { ApplicationDetailPanel, sentAtFor } from "./ApplicationDetailPanel";
import { AddJobForm, type AiAccess } from "./AddJobForm";
import { draftToApplication, emptyDraft, matchRequirements, type JobDraft } from "@/lib/job-draft";
import { emptyDraftFields } from "@/lib/job-draft";
import { TrackerDialog } from "./TrackerDialog";

type CreateState = {
  title: string;
  initial: ApplicationFields;
  attachment?: string;
  snapshotId?: string;
  letter?: { text: string; name: string; resumeId?: string };
  /** Reused on retry so a lost response never creates a second application or copy. */
  requestId: string;
  freezeRequestId: string;
};
type SentState = {
  app: ApplicationDetail;
  document: FrozenDocument;
  cvDocumentId: string | null;
  letterDocumentId: string | null;
  requestId: string;
  day: string;
};
const date = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
/** Only this page may be the return target of the sign-in page. */
export const RETURN_PATTERN = /^\/applications(\?[A-Za-z0-9=&%_.-]*)?$/;

export function ApplicationsApp() {
  const [user, setUser] = useState<AccountUser | null | undefined>(undefined);
  const [apps, setApps] = useState<ApplicationSummary[] | null>(null);
  const [today, setToday] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState<CreateState | null>(null);
  const [sent, setSent] = useState<SentState | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState("/applications");
  const [aiConsent, setAiConsent] = useState(false);
  // "Add a job" (job capture phase B); requestId is reused on retry.
  const [addJob, setAddJob] = useState<{ title: string; draft: JobDraft; requestId: string } | null>(null);
  const started = useRef(false);

  const api = useMemo(() => (user ? trackerApi(user.id) : null), [user]);
  const refresh = useCallback(async () => {
    if (!api) return;
    setApps(await api.list());
  }, [api]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setToday(localDay());
    setReturnTo(window.location.pathname + window.location.search);
    void accountRequest("/api/account")
      .then((value) => {
        const account = value as { user?: AccountUser | null; aiWritingHelp?: boolean };
        setAiConsent(Boolean(account.aiWritingHelp));
        setUser(account.user ?? null);
      })
      .catch(() => setUser(null));
  }, []);

  // Once signed in: load the list and pick up a hand-off from the editor.
  useEffect(() => {
    if (!user || !api) return;
    let active = true;
    void (async () => {
      try {
        const list = await api.list();
        if (!active) return;
        setApps(list);
        const params = new URLSearchParams(window.location.search);
        const snapshotId = params.get("snapshot");
        if (snapshotId) {
          window.history.replaceState(null, "", "/applications");
          try {
            const snapshot = await api.snapshot(snapshotId);
            setCreate({
              title: "Record this as an application",
              initial: emptyFields(),
              attachment: `${snapshot.kind === "cv" ? "CV" : "Cover letter"} “${snapshot.name}”, exported ${new Date(snapshot.createdAt).toLocaleString()}`,
              snapshotId,
              requestId: crypto.randomUUID(),
              freezeRequestId: crypto.randomUUID(),
            });
          } catch (reason) {
            setError((reason as Error).message);
          }
          return;
        }
        const handoff = takeHandoff("job", "letter");
        if (params.has("from"))
          window.history.replaceState(null, "", "/applications");
        if (handoff?.kind === "job")
          setAddJob({ title: "Save this job", draft: draftFromHandoff(handoff), requestId: crypto.randomUUID() });
        else if (handoff?.kind === "letter")
          setCreate({
            title: "Attach this cover letter",
            initial: {
              ...emptyFields(),
              company: handoff.company,
              role: handoff.role,
            },
            attachment: `Cover letter “${handoff.name}”, as edited`,
            letter: {
              text: handoff.text,
              name: handoff.name,
              resumeId: handoff.resumeId,
            },
            requestId: crypto.randomUUID(),
            freezeRequestId: crypto.randomUUID(),
          });
      } catch (reason) {
        if (active) setError((reason as Error).message);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, api]);

  async function work(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (reason) {
      if (
        reason instanceof CloudRequestError &&
        reason.code === "APPLICATION_CHANGED"
      )
        await refresh().catch(() => {});
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function replace(next: ApplicationSummary) {
    setApps((list) =>
      (list ?? []).map((item) =>
        item.id === next.id ? { ...item, ...next } : item,
      ),
    );
  }
  const changeStage = (app: ApplicationSummary, stage: Stage) =>
    work(async () => {
      const next = await api!.update(app.id, {
        updatedAt: app.updatedAt,
        stage,
        ...(stage === "applied" && !app.appliedAt
          ? { appliedAt: localDay() }
          : {}),
      });
      replace(next);
      setNotice(
        `${app.role} at ${app.company} moved to ${STAGE_LABELS[stage]}.`,
      );
    });

  const submitCreate = (
    choice: { existingId: string } | { fields: ApplicationFields },
  ) =>
    work(async () => {
      if (!create || !api) return;
      const app =
        "existingId" in choice
          ? await api.get(choice.existingId)
          : await api.create({
              requestId: create.requestId,
              ...fieldsToInput(choice.fields),
              contacts: [],
            });
      let document: FrozenDocument | null = null;
      if (create.snapshotId)
        document = await api.freeze(app.id, {
          requestId: create.freezeRequestId,
          source: "snapshot",
          snapshotId: create.snapshotId,
        });
      else if (create.letter)
        document = await api.freeze(app.id, {
          requestId: create.freezeRequestId,
          source: "letter",
          text: create.letter.text,
          name: create.letter.name,
          ...(create.letter.resumeId
            ? { resumeId: create.letter.resumeId }
            : {}),
        });
      await refresh();
      setCreate(null);
      if (document) {
        const latest = await api.get(app.id);
        const cv =
          document.kind === "cv"
            ? document.id
            : ([...latest.documents].reverse().find((doc) => doc.kind === "cv")
                ?.id ?? null);
        setSent({
          app: latest,
          document,
          cvDocumentId: cv,
          letterDocumentId:
            document.kind === "cover_letter" ? document.id : null,
          requestId: crypto.randomUUID(),
          day: localDay(),
        });
      } else setNotice(`${app.role} at ${app.company} was saved.`);
    });

  const saveJob = (draft: JobDraft) =>
    work(async () => {
      if (!addJob || !api) return;
      const app = await api.create(draftToApplication(draft, addJob.requestId));
      await refresh();
      setAddJob(null);
      setNotice(`${app.role} at ${app.company} was saved to Saved.`);
    });

  const cancelCreate = () =>
    work(async () => {
      // Closing "Record this as an application?" discards the export receipt at once.
      if (create?.snapshotId && api)
        await api.dismissSnapshot(create.snapshotId).catch(() => {});
      setCreate(null);
    });

  const confirmSent = () =>
    work(async () => {
      if (!sent || !api || !sent.cvDocumentId) return;
      await api.submit(sent.app.id, {
        requestId: sent.requestId,
        sentAt: sentAtFor(sent.day),
        cvDocumentId: sent.cvDocumentId,
        letterDocumentId: sent.letterDocumentId,
      });
      await refresh();
      setNotice(`${sent.app.role} at ${sent.app.company}: marked as sent.`);
      setSent(null);
    });

  if (user === undefined)
    return (
      <Shell>
        <p role="status">Loading…</p>
      </Shell>
    );
  if (user === null)
    return (
      <Shell>
        <section
          className="tracker-signin"
          aria-labelledby="tracker-signin-title"
        >
          <h2 id="tracker-signin-title">Sign in to track applications</h2>
          <p>
            The tracker keeps the jobs you apply for, their stage, notes,
            contacts, reminders and a frozen copy of the CV and letter you sent.
            It needs an account so this information is stored safely and only
            you can see it. It is free on every plan.
          </p>
          <Link
            className="button-link primary"
            href={`/profile?return=${encodeURIComponent(returnTo)}`}
          >
            Sign in
          </Link>
        </section>
        <section className="tracker-group guest-reader" aria-labelledby="guest-reader-title">
          <h2 id="guest-reader-title">Try reading a job post</h2>
          <p className="tracker-muted">
            Paste a post to see its role, company and requirements. This runs in your browser and sends nothing. Sign
            in to save it; what you reviewed is kept.
          </p>
          <AddJobForm
            initial={emptyDraft()}
            ai={{ kind: "guest" }}
            busy={false}
            saveLabel="Sign in to save"
            onCancel={() => window.location.assign("/builder")}
            onSave={(draft) => {
              stashHandoff(draftHandoff(draft));
              window.location.assign(`/profile?return=${encodeURIComponent("/applications?from=job")}`);
            }}
          />
        </section>
      </Shell>
    );

  const list = apps ?? [];
  const due = list
    .filter(
      (app) =>
        !CLOSED_STAGES.includes(app.stage) && dueState(app.nextActionAt, today),
    )
    .sort((a, b) => (a.nextActionAt ?? "").localeCompare(b.nextActionAt ?? ""));
  return (
    <Shell>
      <div className="tracker-toolbar">
        <p className="tracker-muted">
          {list.length} of 500 applications. Nothing is sent to employers or job
          boards: the app never applies or contacts anyone for you.
        </p>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => setAddJob({ title: "Add a job", draft: emptyDraft(), requestId: crypto.randomUUID() })}
        >
          <Plus size={16} aria-hidden /> Add a job
        </button>
      </div>
      {error && !create && !sent && !addJob && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <p className="tracker-status" role="status">
        {notice}
      </p>

      <section className="due-strip" aria-labelledby="due-title">
        <h2 id="due-title">
          Due <span className="tracker-count">{due.length}</span>
        </h2>
        {due.length === 0 ? (
          <p className="tracker-muted">
            Nothing is due today. Set a reminder date on an application to see
            it here.
          </p>
        ) : (
          <ul>
            {due.map((app) => {
              const state = dueState(app.nextActionAt, today);
              return (
                <li key={app.id}>
                  <button
                    type="button"
                    className="due-item"
                    onClick={() => setOpenId(app.id)}
                  >
                    <span
                      className={
                        state === "overdue" ? "due-badge overdue" : "due-badge"
                      }
                    >
                      {state === "overdue" ? "Overdue" : "Due today"}
                    </span>
                    <span>
                      {app.nextAction || "Next action"} · {app.role} at{" "}
                      {app.company}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {apps === null ? (
        <p role="status">Loading applications…</p>
      ) : list.length === 0 ? (
        <section className="tracker-empty">
          <h2>No applications yet</h2>
          <p>
            Add a job you are applying for, or export a CV from the editor and
            choose “Record this as an application”.
          </p>
        </section>
      ) : (
        STAGE_GROUPS.map((group) => {
          const rows = list.filter((app) => group.stages.includes(app.stage));
          if (!rows.length) return null;
          return (
            <section
              key={group.id}
              className="tracker-group"
              aria-labelledby={`group-${group.id}`}
            >
              <h2 id={`group-${group.id}`}>
                {group.label}{" "}
                <span className="tracker-count">{rows.length}</span>
              </h2>
              <table className="tracker-table">
                <thead>
                  <tr>
                    <th scope="col">Job</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Applied</th>
                    <th scope="col">Next action</th>
                    <th scope="col">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((app) => {
                    const state = dueState(app.nextActionAt, today);
                    return (
                      <tr key={app.id}>
                        <td data-label="Job">
                          <button
                            type="button"
                            className="tracker-open"
                            onClick={() => setOpenId(app.id)}
                            aria-label={`Open ${app.role} at ${app.company}`}
                          >
                            <strong>{app.company}</strong>
                            <span>{app.role}</span>
                          </button>
                          {noReplyYet(app) && (
                            <span className="tracker-muted no-reply">
                              No reply yet
                            </span>
                          )}
                        </td>
                        <td data-label="Stage">
                          <select
                            aria-label={`Stage for ${app.role} at ${app.company}`}
                            value={app.stage}
                            disabled={busy}
                            onChange={(event) =>
                              void changeStage(app, event.target.value as Stage)
                            }
                          >
                            {STAGES.map((stage) => (
                              <option key={stage} value={stage}>
                                {STAGE_LABELS[stage]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td data-label="Applied">
                          {app.appliedAt ? date(app.appliedAt) : "—"}
                        </td>
                        <td data-label="Next action">
                          {app.nextActionAt ? (
                            <>
                              {app.nextAction || "Reminder"} ·{" "}
                              {date(app.nextActionAt)}
                              {state && (
                                <span
                                  className={
                                    state === "overdue"
                                      ? "due-badge overdue"
                                      : "due-badge"
                                  }
                                >
                                  {state === "overdue" ? "Overdue" : "Due"}
                                </span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td data-label="Sent">
                          {app.sentCount === 1
                            ? "1 time"
                            : `${app.sentCount} times`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })
      )}

      {create && (
        <TrackerDialog
          title={create.title}
          onClose={() => void cancelCreate()}
          wide
        >
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <ApplicationForm
            initial={create.initial}
            attachment={create.attachment}
            existing={create.attachment ? list : undefined}
            busy={busy}
            onSubmit={(choice) => void submitCreate(choice)}
            onCancel={() => void cancelCreate()}
          />
        </TrackerDialog>
      )}
      {addJob && user && (
        <TrackerDialog title={addJob.title} onClose={() => setAddJob(null)} wide>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <AddJobForm
            initial={addJob.draft}
            ai={aiAccess(user, aiConsent)}
            busy={busy}
            saveLabel="Save to applications"
            onSave={(draft) => void saveJob(draft)}
            onCancel={() => setAddJob(null)}
          />
        </TrackerDialog>
      )}
      {sent && (
        <TrackerDialog
          title="Did you send it?"
          onClose={() => setSent(null)}
          footer={
            <>
              {sent.cvDocumentId && (
                <button
                  type="button"
                  className="primary"
                  disabled={busy || !sent.day}
                  onClick={() => void confirmSent()}
                >
                  Yes, I sent it
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setNotice(
                    `${sent.app.role} at ${sent.app.company}: copy kept. Mark it as sent from the application when you send it.`,
                  );
                  setSent(null);
                }}
              >
                Not yet
              </button>
            </>
          }
        >
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <p>
            “{sent.document.name}” is kept with {sent.app.role} at{" "}
            {sent.app.company}. Saving a copy is not the same as sending it:
            confirm only once you have sent it.
          </p>
          {sent.cvDocumentId ? (
            <label className="tracker-field">
              Sent on
              <input
                type="date"
                value={sent.day}
                max={localDay()}
                onChange={(event) =>
                  setSent({ ...sent, day: event.target.value })
                }
              />
            </label>
          ) : (
            <p className="tracker-muted">
              Attach the CV you sent to this application to mark it as sent.
            </p>
          )}
        </TrackerDialog>
      )}
      {openId && user && (
        <ApplicationDetailPanel
          owner={user.id}
          applicationId={openId}
          onChanged={replace}
          onDeleted={(id) => {
            setApps((list) => (list ?? []).filter((item) => item.id !== id));
            setOpenId(null);
            setNotice("Application deleted.");
          }}
          onMatch={(app, mode) => {
            const requirements = matchRequirements(app.requirements);
            stashHandoff({
              kind: "match",
              company: app.company,
              role: app.role,
              post: app.jobPost ?? "",
              applicationId: app.id,
              mode,
              ...(requirements.length ? { requirements } : {}),
              ...(app.resumeId ? { resumeId: app.resumeId } : {}),
            });
            window.location.assign(app.resumeId ? `/builder?cv=${encodeURIComponent(app.resumeId)}` : "/builder");
          }}
          onClose={() => {
            setOpenId(null);
            void refresh().catch(() => {});
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="profile-page-container tracker-page">
      <header className="app-header no-print">
        <Link href="/" className="brand" aria-label="AI CV Builder home">
          <span className="brand-mark">
            cv<span>·</span>
          </span>
          <span>
            Applications<small>AI CV Builder</small>
          </span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/builder" className="header-nav-link">
            My CVs
          </Link>
          <Link
            href="/applications"
            className="header-nav-link"
            aria-current="page"
          >
            Applications
          </Link>
          <Link href="/help#applications" className="header-nav-link">
            Help
          </Link>
        </nav>
        <div className="header-right">
          <Link href="/builder" className="back-to-studio-btn">
            <ArrowLeft size={16} aria-hidden /> Back to My CVs
          </Link>
        </div>
      </header>
      <main className="tracker-main">
        <h1>Applications</h1>
        {children}
      </main>
    </div>
  );
}

function aiAccess(user: AccountUser, consent: boolean): AiAccess {
  return consent ? { kind: "ready", owner: user.id } : { kind: "no-consent" };
}
/** A job from the editor (Save this job) or a guest's reviewed draft, back in the form. */
function draftFromHandoff(handoff: Extract<Handoff, { kind: "job" }>): JobDraft {
  const draft = emptyDraft({ post: handoff.post, url: handoff.url ?? "" });
  const fields = { ...emptyDraftFields(), ...(handoff.fields ?? {}) };
  if (!fields.role) fields.role = handoff.role;
  if (!fields.company) fields.company = handoff.company;
  return { ...draft, fields, requirements: handoff.requirements ?? [] };
}
function draftHandoff(draft: JobDraft): Handoff {
  return {
    kind: "job",
    company: draft.fields.company.slice(0, 200),
    role: draft.fields.role.slice(0, 200),
    post: draft.post,
    url: draft.url.slice(0, 2000),
    fields: Object.fromEntries(Object.entries(draft.fields).map(([key, value]) => [key, value.slice(0, 2000)])),
    requirements: draft.requirements.slice(0, 40).map((r) => ({
      id: r.id.slice(0, 100),
      text: r.text.slice(0, 300),
      kind: r.kind,
      quote: r.quote.slice(0, 300),
      paraphrased: r.paraphrased,
    })),
  };
}
