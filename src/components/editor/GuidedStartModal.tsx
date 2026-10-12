"use client";

import { useState } from "react";
import {
  createDocument,
  newEntry,
  uid,
  type ResumeDocument,
} from "@/lib/document";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export function GuidedStartModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (doc: ResumeDocument) => Promise<boolean>;
}) {
  useBodyScrollLock();
  const dialog = useModalFocus(onClose);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState("experience");
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [facts, setFacts] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const factCount = facts.split(/\r?\n/).filter((text) => text.trim()).length;

  async function create() {
    setSaving(true);
    setError("");
    try {
      const draft = createDocument();
      draft.name = `${name.trim()} · Resume`;
      draft.contact = {
        ...draft.contact,
        name: name.trim(),
        headline: headline.trim(),
        email: email.trim(),
      };
      const section = draft.sections.find((s) => s.type === type)!;
      section.entries = [
        {
          ...newEntry(),
          title: title.trim(),
          organization: organization.trim(),
          bullets: facts
            .split(/\r?\n/)
            .map((text) => text.trim())
            .filter(Boolean)
            .slice(0, 20)
            .map((text) => ({ id: uid(), text })),
        },
      ];
      if (!(await onCreate(draft)))
        setError(
          "Your draft was not saved. The details are still here; retry when storage is available.",
        );
    } catch {
      setError(
        "Your draft was not saved. Your details are kept here; please retry.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop no-print"
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Start a CV with guidance"
    >
      <section className="modal-card guided-start-modal">
        <header className="modal-header">
          <div>
            <h2>Let’s build your first draft</h2>
            <p>
              Step {step + 1} of 3 ·{" "}
              {
                ["Your introduction", "Your experience", "Review your facts"][
                  step
                ]
              }
            </p>
          </div>
          <button
            type="button"
            aria-label="Close guided start"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </header>
        <div className="modal-body">
          <p className="helper-text">
            Start with your own facts. This guide saves to your current
            workspace without sending anything to AI. AI rewriting is available
            for account CVs.
          </p>
          {step === 0 && (
            <div className="guided-fields">
              <label>
                Full name
                <input
                  maxLength={150}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Your role or professional headline
                <input
                  maxLength={200}
                  placeholder="Your own description, or leave blank"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                />
              </label>
              <label>
                Email (optional)
                <input
                  type="email"
                  maxLength={200}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>
          )}
          {step === 1 && (
            <div className="guided-fields">
              <p>
                Start with one job, project or course. You can add more in the
                editor.
              </p>
              <label>
                What would you like to add?
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="experience">Work experience</option>
                  <option value="projects">A project</option>
                  <option value="education">Education</option>
                </select>
              </label>
              <label>
                {type === "experience"
                  ? "Your job title"
                  : type === "projects"
                    ? "Project name"
                    : "Course or degree"}
                <input
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                {type === "education"
                  ? "School or institution (optional)"
                  : "Organization (optional)"}
                <input
                  maxLength={200}
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
              </label>
              <label>
                What did you do or learn?
                <textarea
                  rows={5}
                  maxLength={4000}
                  value={facts}
                  onChange={(e) => setFacts(e.target.value)}
                  placeholder="Write one fact per line. Include tools or results only if they belong to your experience."
                />
              </label>
              <p className="helper-text">
                Simple notes are enough. Each line becomes a bullet you can
                edit. Use up to 20 fact lines. Dates, location, photo and other
                sections can be added later.
              </p>
            </div>
          )}
          {step === 1 && factCount > 20 && (
            <p role="alert">
              Use up to 20 fact lines for this first entry. Add more in the
              editor.
            </p>
          )}
          {step === 2 && (
            <div>
              <h3>{name}</h3>
              <p>{headline}</p>
              <p>{email}</p>
              <h4>
                {title}
                {organization && ` · ${organization}`}
              </h4>
              <ul>
                {facts
                  .split(/\r?\n/)
                  .filter((text) => text.trim())
                  .slice(0, 20)
                  .map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
              </ul>
              <label className="ai-check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                These details describe my own experience.
              </label>
              <p>
                Next: check the preview, add more sections, or choose Writing
                help to improve a bullet or prepare a summary. No AI request has
                been made.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="account-error">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-footer">
          <button
            type="button"
            disabled={saving}
            onClick={() => (step ? setStep(step - 1) : onClose())}
          >
            {step ? "Back" : "Cancel"}
          </button>
          {step < 2 ? (
            <button
              type="button"
              className="primary"
              disabled={
                step === 0
                  ? !name.trim()
                  : !title.trim() || !facts.trim() || factCount > 20
              }
              onClick={() => {
                setConfirmed(false);
                setStep(step + 1);
              }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="primary"
              disabled={saving || !confirmed}
              onClick={() => void create()}
            >
              {saving ? "Saving your draft…" : "Create my draft"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
