"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { useFieldAi } from "./FieldAiContext";
import { AiBlocked, AiConsent } from "./AiGate";
import { AiProgress } from "./AiProgress";
import { EntryAi } from "./EntryAi";
import { rewriteStatus } from "@/lib/ai-access";
import type { InterviewStepResult } from "@/lib/ai-contract";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";
import {
  addSkillToText,
} from "@/lib/skills-taxonomy";
import {
  labels,
  newEntry,
  uid,
  type ResumeDocument,
  type SectionType,
} from "@/lib/document";

type Step = "intro" | "role" | "job" | "education" | "extras" | "finish";
const NUMBERED: Step[] = ["role", "job", "education", "extras", "finish"];
const STEP_NAME: Record<Step, string> = {
  intro: "Build my CV with AI",
  role: "Target role",
  job: "Your jobs",
  education: "Education",
  extras: "Tools, languages and certificates",
  finish: "Your draft",
};

interface JobForm {
  title: string;
  organization: string;
  start: string;
  end: string;
  current: boolean;
}
const EMPTY_JOB: JobForm = { title: "", organization: "", start: "", end: "", current: false };

type Review =
  | { kind: "education"; result: InterviewStepResult; picked: boolean[] }
  | {
      kind: "extras";
      result: InterviewStepResult;
      skills: boolean[];
      languages: boolean[];
      certifications: boolean[];
    };

/** Returns the section of a type, creating it when the CV has none. */
function sectionOf(draft: ResumeDocument, type: SectionType) {
  let section = draft.sections.find((s) => s.type === type);
  if (!section) {
    section = { id: uid(), type, label: labels[type], visible: true, entries: [] };
    draft.sections.push(section);
  }
  return section;
}

/**
 * The AI interview: five short steps that fill a new account CV from the
 * person's own answers. Jobs use Write with AI (with examples for thin
 * answers); education and extras are structured from the answer's own words.
 * Every addition is reviewed first, the preview fills in live, and each step
 * can be skipped. There is no hidden memory between steps.
 */
export function AiInterview({
  doc,
  onFinish,
}: {
  doc: ResumeDocument;
  /** Leaves the interview; optionally starts the summary or skills help. */
  onFinish: (next: "summary" | "skills" | null) => void;
}) {
  const ai = useFieldAi();
  const [step, setStep] = useState<Step>("intro");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<{ message: string; plans?: boolean } | null>(null);
  const [name, setName] = useState(doc.contact.name);
  const [role, setRole] = useState(doc.contact.headline);
  const [job, setJob] = useState<JobForm>(EMPTY_JOB);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobsAdded, setJobsAdded] = useState(0);
  const [answer, setAnswer] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [announce, setAnnounce] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  if (!ai) return null;
  const services = ai;
  const status = rewriteStatus(services.owner, services.availability, services.signedIn);
  const savedJob = jobId
    ? doc.sections.flatMap((s) => s.entries).find((e) => e.id === jobId)
    : undefined;
  const experienceId = doc.sections.find((s) => s.type === "experience")?.id;

  function go(next: Step) {
    setError(null);
    setReview(null);
    setAnswer("");
    setStep(next);
    setAnnounce(`${STEP_NAME[next]}.`);
  }

  function failed(e: unknown) {
    if (e instanceof CloudRequestError && e.code === "AI_CONSENT_REQUIRED") {
      setConsented(false);
      setStep("intro");
      return;
    }
    setError({
      message:
        e instanceof CloudRequestError && e.code === "NETWORK_ERROR"
          ? "The assistant could not finish in time or lost its connection. Your CV was kept."
          : (e as Error).message,
      plans:
        e instanceof CloudRequestError &&
        (e.code === "AI_LIMIT" || e.code === "PLAN_REQUIRED"),
    });
  }

  async function start() {
    setWorking(true);
    setError(null);
    try {
      const snapshot = await services.prepare();
      const result = (await accountRequest(
        "/api/ai/interview",
        { method: "POST", body: JSON.stringify({ documentId: snapshot.id }) },
        services.owner ?? undefined,
      )) as { interviewId: string };
      setInterviewId(result.interviewId);
      go("role");
    } catch (e) {
      failed(e);
    } finally {
      setWorking(false);
    }
  }

  function saveRole() {
    services.updateDocument((draft) => {
      if (name.trim()) draft.contact.name = name.trim();
      draft.contact.headline = role.trim();
    });
    go("job");
  }

  function saveJob() {
    const id = uid();
    services.updateDocument((draft) => {
      const section = sectionOf(draft, "experience");
      section.entries.push({
        ...newEntry(),
        id,
        title: job.title.trim(),
        organization: job.organization.trim(),
        start: /^\d{4}(-(0[1-9]|1[0-2]))?$/.test(job.start.trim()) ? job.start.trim() : "",
        end:
          !job.current && /^\d{4}(-(0[1-9]|1[0-2]))?$/.test(job.end.trim())
            ? job.end.trim()
            : "",
        current: job.current,
      });
    });
    setJobId(id);
    setJobsAdded((n) => n + 1);
    setAnnounce(`Saved ${job.title.trim()}. Now tell us what you did there.`);
  }

  async function structure(kind: "education" | "extras") {
    if (!interviewId || !answer.trim()) return;
    setWorking(true);
    setError(null);
    try {
      const result = (await accountRequest(
        "/api/ai/interview-step",
        {
          method: "POST",
          signal: AbortSignal.timeout(65000),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            interviewId,
            step: kind,
            answer: answer.trim(),
          }),
        },
        services.owner ?? undefined,
      )) as InterviewStepResult;
      setReview(
        kind === "education"
          ? { kind, result, picked: result.education.map(() => true) }
          : {
              kind,
              result,
              skills: result.skills.map(() => true),
              languages: result.languages.map(() => true),
              certifications: result.certifications.map(() => true),
            },
      );
      setAnnounce("Check what was found, then add it.");
    } catch (e) {
      failed(e);
    } finally {
      setWorking(false);
    }
  }

  function addReviewed() {
    if (!review) return;
    if (review.kind === "education") {
      const items = review.result.education.filter((_, i) => review.picked[i]);
      services.updateDocument((draft) => {
        const section = sectionOf(draft, "education");
        for (const item of items)
          section.entries.push({
            ...newEntry(),
            title: item.qualification,
            organization: item.institution,
            end: item.year,
          });
      });
      return go("extras");
    }
    const skills = review.result.skills.filter((_, i) => review.skills[i]);
    const languages = review.result.languages.filter((_, i) => review.languages[i]);
    const certifications = review.result.certifications.filter(
      (_, i) => review.certifications[i],
    );
    services.updateDocument((draft) => {
      if (skills.length) {
        const section = sectionOf(draft, "skills");
        let entry = section.entries[0];
        if (!entry) {
          entry = { ...newEntry(), title: "Skills" };
          section.entries.push(entry);
        }
        entry.description = skills.reduce(
          (all, skill) => addSkillToText(all, skill),
          entry.description,
        );
      }
      if (languages.length) {
        const section = sectionOf(draft, "languages");
        for (const item of languages)
          section.entries.push({ ...newEntry(), title: item.language, description: item.level });
      }
      if (certifications.length) {
        const section = sectionOf(draft, "certifications");
        for (const item of certifications)
          section.entries.push({
            ...newEntry(),
            title: item.name,
            organization: item.issuer,
            end: item.year,
          });
      }
    });
    go("finish");
  }

  const number = NUMBERED.indexOf(step);
  const toggle = (list: boolean[], index: number, value: boolean) =>
    list.map((item, i) => (i === index ? value : item));

  return (
    <section className="editor-panel ai-interview" aria-labelledby="ai-interview-heading">
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
      <div className="panel-heading">
        <p className="library-kind">
          <Sparkles size={14} aria-hidden /> Build my CV with AI
          {number >= 0 ? ` · Step ${number + 1} of ${NUMBERED.length}` : ""}
        </p>
        <h2 id="ai-interview-heading" tabIndex={-1} ref={heading}>
          {STEP_NAME[step]}
        </h2>
      </div>

      {error && (
        <div className="field-ai-note">
          <p className="field-ai-error" role="alert">
            {error.message}
          </p>
          {error.plans && (
            <button type="button" className="primary" onClick={services.onSeePlans}>
              See plans
            </button>
          )}
        </div>
      )}

      {step === "intro" &&
        (status !== "ready" ? (
          <AiBlocked status={status} services={services} />
        ) : !services.aiConsent && !consented ? (
          <AiConsent
            services={services}
            sends="The interview sends your answers about your jobs, education, tools and languages. Your name and contact details are not sent."
            onAgreed={() => setConsented(true)}
            onCancel={() => onFinish(null)}
          />
        ) : (
          <div className="field-ai-form">
            <p>
              Five short questions: the job you want, your jobs, education, and
              your tools and languages. AI turns your answers into a draft. Only
              what you tell us is used, and you check everything before it is
              added. Skip any step.
            </p>
            <div className="field-ai-actions">
              <button type="button" className="primary" disabled={working} onClick={() => void start()}>
                {working ? "Starting…" : "Start the interview"}
              </button>
              <button type="button" onClick={() => onFinish(null)}>
                Not now
              </button>
            </div>
          </div>
        ))}

      {step === "role" && (
        <form
          className="field-ai-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (role.trim()) saveRole();
          }}
        >
          <label>
            Your name (optional, not sent to AI)
            <input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            What job are you aiming for?
            <input
              value={role}
              maxLength={120}
              placeholder="e.g. Customer support lead"
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
          <p className="field-ai-help">This becomes the headline under your name. No AI is used for this step.</p>
          <div className="field-ai-actions">
            <button type="submit" className="primary" disabled={!role.trim()}>
              Next <ArrowRight size={16} aria-hidden />
            </button>
            <button type="button" onClick={() => go("job")}>
              Skip
            </button>
          </div>
        </form>
      )}

      {step === "job" && (
        <div className="field-ai-form">
          {!savedJob ? (
            <form
              className="field-ai-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (job.title.trim()) saveJob();
              }}
            >
              <p>
                {jobsAdded
                  ? "Add an earlier job, or skip to education."
                  : "Start with your latest job, internship or volunteer role."}
              </p>
              <label>
                Job title
                <input
                  value={job.title}
                  maxLength={200}
                  onChange={(e) => setJob({ ...job, title: e.target.value })}
                />
              </label>
              <label>
                Organization
                <input
                  value={job.organization}
                  maxLength={200}
                  onChange={(e) => setJob({ ...job, organization: e.target.value })}
                />
              </label>
              <div className="field-grid">
                <label>
                  Start (YYYY or YYYY-MM)
                  <input
                    value={job.start}
                    maxLength={7}
                    placeholder="2022-03"
                    onChange={(e) => setJob({ ...job, start: e.target.value })}
                  />
                </label>
                <label>
                  End (YYYY or YYYY-MM)
                  <input
                    value={job.end}
                    maxLength={7}
                    placeholder="2024-06"
                    disabled={job.current}
                    onChange={(e) => setJob({ ...job, end: e.target.value })}
                  />
                </label>
              </div>
              <label className="field-ai-check">
                <input
                  type="checkbox"
                  checked={job.current}
                  onChange={(e) => setJob({ ...job, current: e.target.checked })}
                />
                I work here now
              </label>
              <div className="field-ai-actions">
                <button type="submit" className="primary" disabled={!job.title.trim()}>
                  Save this job
                </button>
                <button type="button" onClick={() => go("education")}>
                  {jobsAdded ? "Next: education" : "Skip"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <p>
                <Check size={16} aria-hidden /> Saved{" "}
                <strong>{savedJob.title}</strong>
                {savedJob.organization ? ` at ${savedJob.organization}` : ""}. Now
                tell us what you did there. Short on ideas? Show examples for the
                title, then write what you actually did.
              </p>
              {experienceId && (
                <EntryAi
                  sectionId={doc.sections.find((s) => s.entries.some((e) => e.id === savedJob.id))?.id ?? experienceId}
                  entry={savedJob}
                  noun="job"
                  autoOpen
                  onAdd={(texts, title) =>
                    services.updateDocument((draft) => {
                      const target = draft.sections
                        .flatMap((s) => s.entries)
                        .find((e) => e.id === savedJob.id);
                      if (!target) return;
                      if (title && !target.title.trim()) target.title = title;
                      target.bullets = target.bullets
                        .filter((b) => b.text.trim())
                        .concat(texts.map((text) => ({ id: uid(), text })))
                        .slice(0, 100);
                    })
                  }
                />
              )}
              <div className="field-ai-actions">
                <button
                  type="button"
                  onClick={() => {
                    setJobId(null);
                    setJob(EMPTY_JOB);
                  }}
                >
                  Add an earlier job
                </button>
                <button type="button" className="primary" onClick={() => go("education")}>
                  Next: education <ArrowRight size={16} aria-hidden />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {(step === "education" || step === "extras") && !review && (
        <form
          className="field-ai-form"
          onSubmit={(event) => {
            event.preventDefault();
            void structure(step);
          }}
        >
          <label>
            {step === "education"
              ? "Your education: degree or course, school and year"
              : "Tools and skills you use, languages you speak, and certificates"}
            <textarea
              rows={4}
              maxLength={2000}
              value={answer}
              placeholder={
                step === "education"
                  ? "e.g. BSc Business, University of Leeds, 2019"
                  : "e.g. Excel, SQL, Zendesk. Spanish (fluent). PRINCE2 Foundation 2022"
              }
              onChange={(e) => setAnswer(e.target.value)}
            />
          </label>
          <p className="field-ai-help">
            Sends this answer to OpenAI to sort it into CV items, using your
            words only. Contact details are not sent.
          </p>
          {working && (
            <AiProgress
              title="Sorting your answer into CV items"
              steps={["Reading your answer", "Sorting it into CV items", "Keeping only your words"]}
            />
          )}
          <div className="field-ai-actions">
            <button type="submit" className="primary" disabled={working || !answer.trim()}>
              {working ? "Sorting your answer…" : "Next"}
            </button>
            <button type="button" onClick={() => go(step === "education" ? "extras" : "finish")}>
              Skip
            </button>
          </div>
        </form>
      )}

      {review && (
        <div className="field-ai-form entry-ai-review">
          <fieldset>
            <legend>Found in your answer. Untick anything that is wrong.</legend>
            {review.kind === "education"
              ? review.result.education.map((item, i) => (
                  <label key={i} className="field-ai-check">
                    <input
                      type="checkbox"
                      checked={review.picked[i]}
                      onChange={(e) =>
                        setReview({ ...review, picked: toggle(review.picked, i, e.target.checked) })
                      }
                    />
                    {[item.qualification, item.institution, item.year].filter(Boolean).join(", ")}
                  </label>
                ))
              : (
                  <>
                    {review.result.skills.map((skill, i) => (
                      <label key={`s${i}`} className="field-ai-check">
                        <input
                          type="checkbox"
                          checked={review.skills[i]}
                          onChange={(e) =>
                            setReview({ ...review, skills: toggle(review.skills, i, e.target.checked) })
                          }
                        />
                        Skill: {skill}
                      </label>
                    ))}
                    {review.result.languages.map((item, i) => (
                      <label key={`l${i}`} className="field-ai-check">
                        <input
                          type="checkbox"
                          checked={review.languages[i]}
                          onChange={(e) =>
                            setReview({
                              ...review,
                              languages: toggle(review.languages, i, e.target.checked),
                            })
                          }
                        />
                        Language: {[item.language, item.level].filter(Boolean).join(", ")}
                      </label>
                    ))}
                    {review.result.certifications.map((item, i) => (
                      <label key={`c${i}`} className="field-ai-check">
                        <input
                          type="checkbox"
                          checked={review.certifications[i]}
                          onChange={(e) =>
                            setReview({
                              ...review,
                              certifications: toggle(review.certifications, i, e.target.checked),
                            })
                          }
                        />
                        Certificate: {[item.name, item.issuer, item.year].filter(Boolean).join(", ")}
                      </label>
                    ))}
                  </>
                )}
          </fieldset>
          {review.result.dropped > 0 && (
            <p className="field-ai-help">
              {review.result.dropped} item{review.result.dropped === 1 ? " was" : "s were"} left
              out because {review.result.dropped === 1 ? "it was" : "they were"} not in your words.
            </p>
          )}
          <div className="field-ai-actions">
            <button type="button" className="primary" onClick={addReviewed}>
              <Check size={16} aria-hidden /> Add ticked and continue
            </button>
            <button type="button" onClick={() => setReview(null)}>
              Change my answer
            </button>
          </div>
        </div>
      )}

      {step === "finish" && (
        <div className="field-ai-form">
          <p>
            Your draft is in the preview. Everything in it came from your
            answers or the bullets you ticked. Two more things help:
          </p>
          <div className="field-ai-actions">
            <button type="button" className="primary" onClick={() => onFinish("summary")}>
              {services.summaryDrafts ? "Write my summary with AI" : "Write my summary"}
            </button>
            <button type="button" onClick={() => onFinish("skills")}>
              {services.skillsAi ? "Suggest skills with AI" : "Add skills from my CV"}
            </button>
            <button type="button" onClick={() => onFinish(null)}>
              <X size={16} aria-hidden /> Open the editor
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
