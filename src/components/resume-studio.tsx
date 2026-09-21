"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  createDocument,
  duplicateDocument,
  labels,
  newEntry,
  parseBackup,
  toPlainText,
  uid,
  documentSchema,
  type Entry,
  type ResumeDocument,
} from "@/lib/document";
import { createRepository } from "@/lib/repository";
import { ResumePreview, type PreviewHandle } from "./resume-preview";
import { DesignPanel } from "./design-panel";
import { templates } from "@/lib/presentation";
import { AccountPanel } from "./account-panel";
import { AIPanel } from "./ai-panel";
import type { Proposal } from "@/lib/ai-proposals";
import {
  accountRequest,
  createCloudRepository,
  transferLocalResumes,
} from "@/lib/cloud-repository";
import type { AccountUser } from "@/lib/cloud-contract";

type SaveState =
  | "Loading"
  | "Saved on this device"
  | "Unsaved changes"
  | "Saving…"
  | "Save failed";
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
  maxLength = 20000,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const labelId = useId();
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {multiline ? (
        <textarea
          aria-labelledby={labelId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={4}
        />
      ) : (
        <input
          aria-labelledby={labelId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
        />
      )}
    </label>
  );
}

export function ResumeStudio() {
  const [doc, setDoc] = useState<ResumeDocument | null>(null);
  const [documents, setDocuments] = useState<ResumeDocument[]>([]);
  const [sectionId, setSectionId] = useState("contact");
  const [status, setStatus] = useState<SaveState>("Loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDesign, setShowDesign] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [cloudUser, setCloudUser] = useState<AccountUser | null>(null);
  const preview = useRef<PreviewHandle>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [mobileTab, setMobileTab] = useState("editor");
  const [staged, setStaged] = useState<ResumeDocument | null>(null);
  const repository = useRef<ReturnType<typeof createRepository> | null>(null);
  const current = useRef<ResumeDocument | null>(null);
  const revisions = useRef(new Map<string, number>());
  const history = useRef<ResumeDocument[]>([]);
  const change = useRef(0);
  const savedChange = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  function select(next: ResumeDocument) {
    setShowAI(false);
    clearTimeout(timer.current);
    current.current = next;
    setDoc(next);
    history.current = [];
    setUndoCount(0);
    change.current = 0;
    savedChange.current = 0;
    setSectionId("contact");
    setError("");
    setStatus("Saved on this device");
  }
  useEffect(() => {
    let active = true;
    repository.current = createRepository();
    repository.current
      .list()
      .then((list) => {
        if (!active) return;
        list.forEach((d) => revisions.current.set(d.id, d.revision));
        setDocuments(list);
        if (list.length) select(list[0]);
        else setStatus("Saved on this device");
      })
      .catch((e) => {
        if (active) {
          setStatus("Save failed");
          setError(e.message);
        }
      });
    const warn = (event: BeforeUnloadEvent) => {
      if (change.current !== savedChange.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      active = false;
      clearTimeout(timer.current);
      window.removeEventListener("beforeunload", warn);
    };
  }, []);

  async function flush() {
    clearTimeout(timer.current);
    const task = chain.current
      .catch(() => {})
      .then(async () => {
        const snapshot = current.current;
        if (!snapshot || savedChange.current === change.current) return;
        const version = change.current;
        setStatus("Saving…");
        try {
          const saved = await repository.current!.save(
            snapshot,
            revisions.current.get(snapshot.id) ?? null,
          );
          revisions.current.set(saved.id, saved.revision);
          savedChange.current = version;
          setDocuments((list) => [
            saved,
            ...list.filter((d) => d.id !== saved.id),
          ]);
          setError("");
          setStatus(
            version === change.current
              ? "Saved on this device"
              : "Unsaved changes",
          );
        } catch (e) {
          setStatus("Save failed");
          setError((e as Error).message);
          throw e;
        }
      });
    chain.current = task;
    return task;
  }
  function update(mutator: (draft: ResumeDocument) => void, record = true) {
    if (!current.current) return;
    const before = current.current;
    const next = structuredClone(before);
    mutator(next);
    if (
      sectionId !== "contact" &&
      !next.sections.some((s) => s.id === sectionId)
    )
      setSectionId("contact");
    if (record) {
      history.current.push(before);
      if (history.current.length > 80) history.current.shift();
    }
    current.current = next;
    change.current++;
    setDoc(next);
    setUndoCount(history.current.length);
    setStatus("Unsaved changes");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush().catch(() => {});
    }, 450);
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await flush();
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addDocument(next: ResumeDocument) {
    const saved = await repository.current!.save(next, null);
    revisions.current.set(saved.id, saved.revision);
    setDocuments((list) => [saved, ...list]);
    select(saved);
  }
  async function switchWorkspace(user: AccountUser | null, save = true) {
    if (save) await flush();
    const next = user ? createCloudRepository(user.id) : createRepository();
    const list = await next.list();
    clearTimeout(timer.current);
    repository.current = next;
    setCloudUser(user);
    setShowAI(false);
    revisions.current = new Map(list.map((d) => [d.id, d.revision]));
    current.current = null;
    setDoc(null);
    history.current = [];
    setUndoCount(0);
    change.current = 0;
    savedChange.current = 0;
    setStaged(null);
    setDocuments(list);
    setError("");
    setStatus("Saved on this device");
    if (list.length) select(list[0]);
  }
  async function verifyExport() {
    if (cloudUser && current.current) {
      const saved = await createCloudRepository(cloudUser.id).get(
        current.current.id,
      );
      if (saved.revision !== revisions.current.get(saved.id))
        throw new Error(
          "This resume changed elsewhere. Download a recovery backup before reloading.",
        );
    }
  }
  async function prepareAI() {
    await flush();
    if (!current.current || !cloudUser)
      throw new Error("Open an account resume first.");
    return {
      ...current.current,
      revision:
        revisions.current.get(current.current.id) ?? current.current.revision,
    };
  }
  async function acceptAI(proposal: Proposal) {
    const before = await prepareAI();
    if (
      proposal.documentId !== before.id ||
      proposal.baseRevision !== before.revision
    )
      throw new Error("The resume changed. Generate a new suggestion.");
    const result = (await accountRequest(
      `/api/ai/${encodeURIComponent(proposal.id)}`,
      {
        method: "POST",
        body: JSON.stringify({ decision: "accept", confirmed: true }),
      },
      cloudUser!.id,
    )) as { document: unknown };
    const saved = documentSchema.parse(result.document);
    history.current.push(before);
    if (history.current.length > 80) history.current.shift();
    current.current = saved;
    revisions.current.set(saved.id, saved.revision);
    setDoc(saved);
    setUndoCount(history.current.length);
    setDocuments((list) => [saved, ...list.filter((d) => d.id !== saved.id)]);
    savedChange.current = change.current;
    setError("");
    setStatus("Saved on this device");
  }
  function checkedExport(format: "json" | "txt") {
    void action(async () => {
      await verifyExport();
      exportFile(format);
    });
  }
  function exportFile(format: "json" | "txt") {
    if (!current.current) return;
    const latest = {
      ...current.current,
      revision: revisions.current.get(current.current.id) ?? 0,
    };
    const name =
      latest.name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 100) || "resume";
    download(
      format === "json" ? JSON.stringify(latest, null, 2) : toPlainText(latest),
      `${name}.${format}`,
      format === "json" ? "application/json" : "text/plain;charset=utf-8",
    );
  }
  async function stageFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("Backup exceeds the 2 MB limit.");
      setStaged(parseBackup(await file.text()));
      setError("");
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "This file is not valid JSON. No resume was changed."
          : (e as Error).message,
      );
    }
  }
  function editEntry(entryId: string, values: Partial<Entry>) {
    update((d) => {
      const entry = d.sections
        .find((s) => s.id === sectionId)!
        .entries.find((e) => e.id === entryId)!;
      Object.assign(entry, values);
    });
  }
  const activeSection = doc?.sections.find((s) => s.id === sectionId);
  const ready = status !== "Loading";

  return (
    <div className="studio">
      <header className="app-header no-print">
        <a className="brand" href="/" aria-label="AI CV Builder home">
          <span className="brand-mark">
            cv<span>·</span>
          </span>
          <span>
            Resume studio<small>AI CV BUILDER</small>
          </span>
        </a>
        <div className="header-right">
          <button
            disabled={busy || !ready || showAccount || showAI}
            onClick={() => setShowAccount(true)}
          >
            Account
          </button>
          <span className="local-badge">
            <span /> {cloudUser ? "Account workspace" : "Local workspace"}
          </span>
          <span className="avatar" aria-hidden="true">
            {doc?.contact.name.charAt(0) || "Y"}
          </span>
        </div>
      </header>
      <div className="workspace-heading no-print">
        <div>
          <p className="eyebrow">YOUR NEXT CHAPTER</p>
          <h1>A little clarity. A stronger resume.</h1>
          <p>Bring your experience together, one detail at a time.</p>
        </div>
        <div className="save-status" role="status">
          <span className={status === "Save failed" ? "dot failed" : "dot"} />
          {cloudUser && status === "Saved on this device"
            ? "Saved to your account"
            : status}
        </div>
      </div>
      {showAccount && (
        <AccountPanel
          cloudOwner={cloudUser?.id ?? null}
          beforeChange={flush}
          onLocal={() => switchWorkspace(null)}
          onCloud={(user) => switchWorkspace(user)}
          onSignedOut={() => switchWorkspace(null, false)}
          onClose={() => setShowAccount(false)}
          loadLocal={async () => {
            await flush();
            return createRepository().list();
          }}
          onTransfer={async (owner, docs) => {
            await flush();
            const result = await transferLocalResumes(owner, docs);
            if (cloudUser?.id === owner)
              await switchWorkspace(cloudUser, false);
            return `${result.filter((r) => r.status === "imported").length} resumes copied. Local originals were kept.`;
          }}
          onExport={async (owner) => {
            await flush();
            const data = await accountRequest("/api/account/export", {}, owner);
            download(
              JSON.stringify(data, null, 2),
              "cv-builder-account.json",
              "application/json",
            );
          }}
        />
      )}
      {showAI && doc && (
        <AIPanel
          key={`${cloudUser?.id ?? "local"}:${doc.id}`}
          doc={doc}
          owner={cloudUser?.id ?? null}
          prepare={prepareAI}
          accept={acceptAI}
          onClose={() => setShowAI(false)}
        />
      )}
      <fieldset
        className="workspace-body"
        disabled={showAccount || showAI}
        inert={showAccount || showAI}
      >
        {error && (
          <div className="alert no-print" role="alert">
            {error}{" "}
            <button
              onClick={() => {
                void flush().catch(() => {});
              }}
            >
              Retry save
            </button>
            {doc && (
              <button onClick={() => exportFile("json")}>
                Download recovery backup
              </button>
            )}
          </div>
        )}
        {notice && (
          <p className="notice no-print" role="status">
            {notice}
          </p>
        )}
        <input
          type="file"
          accept=".json,application/json"
          ref={fileInput}
          hidden
          aria-label="Import JSON backup"
          onChange={(e) => {
            void stageFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {staged && (
          <section
            className="import-review no-print"
            aria-label="Review backup"
          >
            <div>
              <p className="eyebrow">REVIEW BACKUP</p>
              <h2>{staged.name}</h2>
              <p>
                {staged.sections.length} sections ·{" "}
                {staged.sections.reduce((n, s) => n + s.entries.length, 0)}{" "}
                entries. Restore as an independent resume, or replace the active
                resume with undo available.
              </p>
            </div>
            <div className="button-row">
              <button
                disabled={busy}
                className="primary"
                onClick={() => {
                  void action(async () => {
                    await addDocument(duplicateDocument(staged, staged.name));
                    setStaged(null);
                  });
                }}
              >
                Restore as new
              </button>
              {doc && (
                <button
                  disabled={busy}
                  onClick={() => {
                    void action(async () => {
                      const imported = structuredClone(staged);
                      update((d) => {
                        d.contact = imported.contact;
                        d.sections = imported.sections;
                        d.presentation = imported.presentation;
                      });
                      setStaged(null);
                      await flush();
                    });
                  }}
                >
                  Replace active content
                </button>
              )}
              <button onClick={() => setStaged(null)}>Cancel</button>
            </div>
          </section>
        )}
        {!doc ? (
          <main className="welcome no-print">
            <span className="welcome-symbol">✦</span>
            <p className="eyebrow">A FRESH START</p>
            <h2>
              Your experience deserves
              <br />a thoughtful introduction.
            </h2>
            <p>
              Start with a blank page or explore a fictional example.
              <br />
              {cloudUser
                ? "Your resumes are saved in your account."
                : "Your resumes stay in this browser, on this device."}
            </p>
            <div className="button-row">
              <button
                className="primary"
                disabled={!ready || busy || status === "Save failed"}
                onClick={() => {
                  void action(() => addDocument(createDocument()));
                }}
              >
                Create my resume <span>↗</span>
              </button>
              <button
                disabled={!ready || busy || status === "Save failed"}
                onClick={() => {
                  void action(() => addDocument(createDocument(true)));
                }}
              >
                Explore an example
              </button>
              <button
                disabled={!ready || busy}
                onClick={() => fileInput.current?.click()}
              >
                Restore a backup
              </button>
            </div>
            <p className="privacy-note">
              No account required. No resume data is sent to an AI provider.
              <br />
              Export a JSON backup regularly; clearing browser data removes
              local resumes.
            </p>
          </main>
        ) : (
          <>
            <div className="document-toolbar no-print">
              <div className="document-picker">
                <label htmlFor="resume-select">RESUME</label>
                <select
                  id="resume-select"
                  value={doc.id}
                  disabled={busy}
                  onChange={(e) => {
                    const id = e.target.value;
                    void action(async () => {
                      const list = await repository.current!.list();
                      const next = list.find((d) => d.id === id);
                      if (!next)
                        throw new Error(
                          "This resume is no longer available. Reload the workspace.",
                        );
                      list.forEach((d) =>
                        revisions.current.set(d.id, d.revision),
                      );
                      setDocuments(list);
                      select(next);
                    });
                  }}
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="button-row">
                <button
                  disabled={busy}
                  onClick={() => {
                    void action(() => addDocument(createDocument()));
                  }}
                >
                  + New
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    void action(() =>
                      addDocument(duplicateDocument(current.current!)),
                    );
                  }}
                >
                  Duplicate
                </button>
                <button
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  Import JSON
                </button>
                <button
                  disabled={busy || !undoCount}
                  onClick={() => {
                    const old = history.current.pop();
                    if (old) update((d) => Object.assign(d, old), false);
                  }}
                >
                  ↶ Undo
                </button>
                <button
                  aria-expanded={showDesign}
                  aria-controls="design-panel"
                  onClick={() => setShowDesign((value) => !value)}
                >
                  Design & templates
                </button>
                <button disabled={busy} onClick={() => setShowAI(true)}>
                  AI bullet assistant
                </button>
                <details
                  className="export-menu"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button"))
                      e.currentTarget.open = false;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.currentTarget.open = false;
                      e.currentTarget.querySelector("summary")?.focus();
                    }
                  }}
                >
                  <summary>
                    Export <span>↓</span>
                  </summary>
                  <div>
                    <button
                      onClick={() => {
                        void action(async () => {
                          await verifyExport();
                          await document.fonts.ready;
                          await preview.current?.prepare();
                          window.print();
                        });
                      }}
                    >
                      Print / Save as PDF
                    </button>
                    <button onClick={() => checkedExport("txt")}>
                      Plain text (.txt)
                    </button>
                    <button onClick={() => checkedExport("json")}>
                      Backup (.json)
                    </button>
                  </div>
                </details>
              </div>
            </div>
            {showDesign && (
              <div id="design-panel">
                <DesignPanel
                  doc={doc}
                  disabled={busy}
                  onChange={(settings) =>
                    update((d) => {
                      Object.assign(d.presentation, settings);
                    })
                  }
                />
              </div>
            )}
            <div className="mobile-tabs no-print">
              <button
                aria-pressed={mobileTab === "editor"}
                onClick={() => setMobileTab("editor")}
              >
                Edit details
              </button>
              <button
                aria-pressed={mobileTab === "preview"}
                onClick={() => setMobileTab("preview")}
              >
                Preview resume
              </button>
            </div>
            <main className={`editor-layout show-${mobileTab}`}>
              <aside className="section-nav no-print">
                <p className="eyebrow">BUILD YOUR RESUME</p>
                <button
                  className={sectionId === "contact" ? "selected" : ""}
                  onClick={() => setSectionId("contact")}
                >
                  <span>01</span> Personal details <span>↗</span>
                </button>
                {doc.sections.map((s, i) => (
                  <button
                    key={s.id}
                    className={sectionId === s.id ? "selected" : ""}
                    onClick={() => setSectionId(s.id)}
                  >
                    <span>{String(i + 2).padStart(2, "0")}</span>
                    <span className="nav-label">
                      {s.label || labels[s.type]}
                    </span>
                    {!s.visible && <span title="Hidden">○</span>}
                  </button>
                ))}
                <div className="sidebar-note">
                  <span>✧</span>
                  <strong>Make it yours.</strong>
                  <p>
                    Keep your story clear, specific, and true to your
                    experience.
                  </p>
                </div>
                <p className="local-note">
                  {cloudUser
                    ? "Saved in your account."
                    : "Saved in this browser."}
                  <br />
                  Back up before changing devices.
                </p>
              </aside>
              <section
                className="editor-panel no-print"
                aria-label="Resume editor"
              >
                <fieldset disabled={busy}>
                  {sectionId === "contact" ? (
                    <>
                      <div className="panel-heading">
                        <p className="eyebrow">THE INTRODUCTION</p>
                        <h2>Personal details</h2>
                        <p>Make it easy for your next team to find you.</p>
                      </div>
                      <Field
                        label="Resume name"
                        value={doc.name}
                        maxLength={200}
                        onChange={(v) =>
                          update((d) => {
                            d.name = v || "Untitled resume";
                          })
                        }
                      />
                      <div className="form-divider" />
                      <Field
                        label="Full name"
                        value={doc.contact.name}
                        placeholder="e.g. Alex Morgan"
                        onChange={(v) =>
                          update((d) => {
                            d.contact.name = v;
                          })
                        }
                      />
                      <Field
                        label="Professional headline"
                        value={doc.contact.headline}
                        placeholder="e.g. Product designer"
                        onChange={(v) =>
                          update((d) => {
                            d.contact.headline = v;
                          })
                        }
                      />
                      <div className="field-grid">
                        <Field
                          label="Email"
                          value={doc.contact.email}
                          placeholder="you@example.com"
                          onChange={(v) =>
                            update((d) => {
                              d.contact.email = v;
                            })
                          }
                        />
                        <Field
                          label="Phone"
                          value={doc.contact.phone}
                          placeholder="+1 (555) 000-0000"
                          onChange={(v) =>
                            update((d) => {
                              d.contact.phone = v;
                            })
                          }
                        />
                      </div>
                      <Field
                        label="Location"
                        value={doc.contact.location}
                        placeholder="City, Country"
                        onChange={(v) =>
                          update((d) => {
                            d.contact.location = v;
                          })
                        }
                      />
                      <Field
                        label="Website or portfolio"
                        value={doc.contact.website}
                        placeholder="yourwebsite.com"
                        onChange={(v) =>
                          update((d) => {
                            d.contact.website = v;
                          })
                        }
                      />
                      <div className="editor-tip">
                        <span>✦</span>
                        <p>
                          A city and country are usually enough. Include the
                          contact details you want to share.
                        </p>
                      </div>
                      <button
                        className="danger-link"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete “${doc.name}” from ${cloudUser ? "your account" : "this browser"}? Export a backup first if you need to keep it.`,
                            )
                          )
                            void action(async () => {
                              await repository.current!.remove(
                                doc.id,
                                revisions.current.get(doc.id)!,
                              );
                              const list = await repository.current!.list();
                              setDocuments(list);
                              if (list.length) select(list[0]);
                              else {
                                current.current = null;
                                setDoc(null);
                              }
                            });
                        }}
                      >
                        Delete this resume
                      </button>
                    </>
                  ) : (
                    activeSection && (
                      <>
                        <div className="panel-heading">
                          <p className="eyebrow">YOUR EXPERIENCE</p>
                          <h2>{labels[activeSection.type]}</h2>
                          <p>
                            {activeSection.type === "summary"
                              ? "A short introduction to the work you do best."
                              : "Add the details that tell your story."}
                          </p>
                        </div>
                        <Field
                          label="Section heading"
                          value={activeSection.label}
                          onChange={(v) =>
                            update((d) => {
                              d.sections.find(
                                (s) => s.id === sectionId,
                              )!.label = v;
                            })
                          }
                        />
                        <div className="section-controls">
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={activeSection.visible}
                              onChange={(e) =>
                                update((d) => {
                                  d.sections.find(
                                    (s) => s.id === sectionId,
                                  )!.visible = e.target.checked;
                                })
                              }
                            />
                            Show in resume
                          </label>
                          <div className="button-row">
                            {([-1, 1] as const).map((delta) => (
                              <button
                                key={delta}
                                aria-label={
                                  delta === -1
                                    ? "Move section up"
                                    : "Move section down"
                                }
                                disabled={
                                  doc.sections.indexOf(activeSection) + delta <
                                    0 ||
                                  doc.sections.indexOf(activeSection) + delta >=
                                    doc.sections.length
                                }
                                onClick={() =>
                                  update((d) => {
                                    const index = d.sections.findIndex(
                                      (s) => s.id === sectionId,
                                    );
                                    [
                                      d.sections[index],
                                      d.sections[index + delta],
                                    ] = [
                                      d.sections[index + delta],
                                      d.sections[index],
                                    ];
                                  })
                                }
                              >
                                {delta === -1 ? "↑" : "↓"}
                              </button>
                            ))}
                          </div>
                        </div>
                        {!activeSection.entries.length && (
                          <div className="empty-section">
                            <span>+</span>
                            <p>No entries yet. Start with one detail.</p>
                          </div>
                        )}
                        {activeSection.entries.map((entry, index) => (
                          <div className="entry-card" key={entry.id}>
                            <div className="entry-toolbar">
                              <strong>
                                {String(index + 1).padStart(2, "0")} /{" "}
                                {entry.title || "New entry"}
                              </strong>
                              <div className="button-row">
                                {([-1, 1] as const).map((delta) => (
                                  <button
                                    key={delta}
                                    aria-label={
                                      delta === -1
                                        ? "Move entry up"
                                        : "Move entry down"
                                    }
                                    disabled={
                                      index + delta < 0 ||
                                      index + delta >=
                                        activeSection.entries.length
                                    }
                                    onClick={() =>
                                      update((d) => {
                                        const entries = d.sections.find(
                                          (s) => s.id === sectionId,
                                        )!.entries;
                                        [
                                          entries[index],
                                          entries[index + delta],
                                        ] = [
                                          entries[index + delta],
                                          entries[index],
                                        ];
                                      })
                                    }
                                  >
                                    {delta === -1 ? "↑" : "↓"}
                                  </button>
                                ))}
                                <button
                                  aria-label="Remove entry"
                                  onClick={() =>
                                    update((d) => {
                                      const s = d.sections.find(
                                        (s) => s.id === sectionId,
                                      )!;
                                      s.entries = s.entries.filter(
                                        (e) => e.id !== entry.id,
                                      );
                                    })
                                  }
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                            {activeSection.type !== "summary" && (
                              <Field
                                label={
                                  activeSection.type === "experience"
                                    ? "Job title"
                                    : activeSection.type === "education"
                                      ? "Degree or qualification"
                                      : "Title"
                                }
                                value={entry.title}
                                onChange={(v) =>
                                  editEntry(entry.id, { title: v })
                                }
                              />
                            )}
                            {[
                              "experience",
                              "education",
                              "certifications",
                              "projects",
                            ].includes(activeSection.type) && (
                              <>
                                <Field
                                  label="Organization"
                                  value={entry.organization}
                                  onChange={(v) =>
                                    editEntry(entry.id, { organization: v })
                                  }
                                />
                                <Field
                                  label="Location"
                                  value={entry.location}
                                  onChange={(v) =>
                                    editEntry(entry.id, { location: v })
                                  }
                                />
                                <div className="field-grid">
                                  <Field
                                    label="Start date (YYYY or YYYY-MM)"
                                    value={entry.start}
                                    maxLength={7}
                                    placeholder="2022-03"
                                    onChange={(v) =>
                                      editEntry(entry.id, { start: v })
                                    }
                                  />
                                  <Field
                                    label="End date (YYYY or YYYY-MM)"
                                    value={entry.end}
                                    maxLength={7}
                                    placeholder="2024-06"
                                    onChange={(v) =>
                                      editEntry(entry.id, { end: v })
                                    }
                                  />
                                </div>
                                <label className="checkbox">
                                  <input
                                    type="checkbox"
                                    checked={entry.current}
                                    onChange={(e) =>
                                      editEntry(entry.id, {
                                        current: e.target.checked,
                                      })
                                    }
                                  />
                                  Currently here
                                </label>
                              </>
                            )}
                            <Field
                              label={
                                activeSection.type === "summary"
                                  ? "Professional summary"
                                  : "Description"
                              }
                              value={entry.description}
                              multiline
                              onChange={(v) =>
                                editEntry(entry.id, { description: v })
                              }
                            />
                            {entry.bullets.map((bullet, bi) => (
                              <div className="bullet-field" key={bullet.id}>
                                <Field
                                  label={`Bullet ${bi + 1}`}
                                  value={bullet.text}
                                  multiline
                                  onChange={(v) =>
                                    editEntry(entry.id, {
                                      bullets: entry.bullets.map((b) =>
                                        b.id === bullet.id
                                          ? { ...b, text: v }
                                          : b,
                                      ),
                                    })
                                  }
                                />
                                <button
                                  aria-label={`Remove bullet ${bi + 1}`}
                                  onClick={() =>
                                    editEntry(entry.id, {
                                      bullets: entry.bullets.filter(
                                        (b) => b.id !== bullet.id,
                                      ),
                                    })
                                  }
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              className="text-button"
                              disabled={entry.bullets.length >= 100}
                              onClick={() =>
                                editEntry(entry.id, {
                                  bullets: [
                                    ...entry.bullets,
                                    { id: uid(), text: "" },
                                  ],
                                })
                              }
                            >
                              + Add bullet
                            </button>
                          </div>
                        ))}
                        <button
                          className="add-entry"
                          disabled={activeSection.entries.length >= 100}
                          onClick={() =>
                            update((d) => {
                              d.sections
                                .find((s) => s.id === sectionId)!
                                .entries.push(newEntry());
                            })
                          }
                        >
                          + Add{" "}
                          {activeSection.type === "experience"
                            ? "experience"
                            : "entry"}
                        </button>
                      </>
                    )
                  )}
                </fieldset>
              </section>
              <section className="preview-panel" aria-label="Live preview">
                <div className="preview-toolbar no-print">
                  <div>
                    <span className="eyebrow">LIVE PREVIEW</span>
                    <span className="template-label">
                      {
                        templates.find(
                          (t) => t.id === doc.presentation.template,
                        )!.name
                      }{" "}
                      <span>✓</span>
                    </span>
                  </div>
                  <label>
                    Page size{" "}
                    <select
                      aria-label="Page size"
                      disabled={busy}
                      value={doc.presentation.pageSize}
                      onChange={(e) =>
                        update((d) => {
                          d.presentation.pageSize = e.target.value as
                            "A4" | "Letter";
                        })
                      }
                    >
                      <option>A4</option>
                      <option>Letter</option>
                    </select>
                  </label>
                </div>
                <div className="paper-stage">
                  <ResumePreview doc={doc} ref={preview} />
                </div>
                <p className="preview-footnote no-print">
                  {
                    templates.find((t) => t.id === doc.presentation.template)!
                      .name
                  }{" "}
                  · {doc.presentation.pageSize} · Selectable text
                  <br />
                  Print at 100% scale with browser headers and footers off.
                  Fonts and printer settings can affect output.
                </p>
              </section>
            </main>
            <footer className="app-footer no-print">
              <span>YOUR STORY, IN YOUR HANDS.</span>
              <span>
                {cloudUser ? "Account editor" : "Local editor"} · AI suggestions
                require your review
              </span>
            </footer>
            <style>{`@page { size: ${doc.presentation.pageSize}; margin: 0; }`}</style>
          </>
        )}
      </fieldset>
    </div>
  );
}
