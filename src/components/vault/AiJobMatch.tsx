"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleCheck, CircleDashed, Sparkles, X } from "lucide-react";
import { useFieldAi } from "../editor/FieldAiContext";
import { AiBlocked, AiConsent } from "../editor/AiGate";
import { AiProgress } from "../editor/AiProgress";
import { rewriteStatus } from "@/lib/ai-access";
import type {
  GapLineResult,
  JobMatchResult,
  TailorResult,
} from "@/lib/ai-contract";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";
import {
  duplicateDocument,
  labels,
  newEntry,
  uid,
  type ResumeDocument,
} from "@/lib/document";
import { addSkillToText } from "@/lib/skills-taxonomy";
import { reviewSnapshot } from "@/lib/vault/job-evidence";

interface Gap {
  /** no: the person does not have it (stays visible, nothing added). */
  answer: "open" | "yes" | "no";
  line: string;
  working: boolean;
  suggestion: GapLineResult | null;
  added: boolean;
}

type Stage =
  | { stage: "idle" }
  | { stage: "consent"; next: "match" | "tailor" }
  | { stage: "working"; what: string; steps: string[] }
  | { stage: "error"; message: string; plans?: boolean };

/**
 * Match with AI (Go and Pro): the post's requirements, which ones the CV
 * shows (quoting the bullet) and the gaps. A gap is filled only from the
 * person's own line. Tailor with AI (Pro) rewords the summary and up to 8
 * bullets into a separate tailored copy; the original is kept.
 */
export function AiJobMatch({
  job,
}: {
  job: { title: string; company: string; post: string };
}) {
  const ai = useFieldAi();
  const [state, setState] = useState<Stage>({ stage: "idle" });
  const [match, setMatch] = useState<JobMatchResult | null>(null);
  const [gaps, setGaps] = useState<Record<string, Gap>>({});
  const [tailor, setTailor] = useState<{
    result: TailorResult;
    source: ResumeDocument;
    useSummary: boolean;
    picked: string[];
    confirmed: boolean;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!ai) return null;
  const services = ai;
  const status = rewriteStatus(services.owner, services.availability, services.signedIn);
  const ready = job.title.trim().length > 0 && job.post.trim().length >= 50;
  const jobBody = {
    title: job.title.trim().slice(0, 120),
    ...(job.company.trim() ? { company: job.company.trim().slice(0, 120) } : {}),
    post: job.post.trim().slice(0, 12000),
  };

  function failed(error: unknown, next: "match" | "tailor") {
    if (error instanceof CloudRequestError && error.code === "AI_CONSENT_REQUIRED")
      return setState({ stage: "consent", next });
    setState({
      stage: "error",
      message:
        error instanceof CloudRequestError && error.code === "NETWORK_ERROR"
          ? "The assistant could not finish in time or lost its connection. Your CV was kept."
          : (error as Error).message,
      plans:
        error instanceof CloudRequestError &&
        (error.code === "AI_LIMIT" || error.code === "PLAN_REQUIRED"),
    });
  }

  async function runMatch() {
    setState({
      stage: "working",
      what: "Matching the job post with your CV",
      steps: ["Reading the job post", "Finding where your CV shows each requirement", "Checking every quote against your CV"],
    });
    setTailor(null);
    try {
      const snapshot = await services.prepare();
      const result = (await accountRequest(
        "/api/ai/job-match",
        {
          method: "POST",
          signal: AbortSignal.timeout(65000),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            documentId: snapshot.id,
            revision: snapshot.revision,
            job: jobBody,
          }),
        },
        services.owner ?? undefined,
      )) as JobMatchResult;
      if (!mounted.current) return;
      setMatch(result);
      setGaps(
        Object.fromEntries(
          result.requirements
            .filter((r) => r.status === "gap")
            .map((r) => [r.id, { answer: "open", line: "", working: false, suggestion: null, added: false }]),
        ),
      );
      setState({ stage: "idle" });
      setNotice(
        `${result.requirements.filter((r) => r.status === "shown").length} shown, ${result.requirements.filter((r) => r.status === "gap").length} gaps.`,
      );
    } catch (error) {
      if (mounted.current) failed(error, "match");
    }
  }

  async function suggestPlace(id: string, requirement: string) {
    const gap = gaps[id];
    setGaps({ ...gaps, [id]: { ...gap, working: true, suggestion: null } });
    try {
      const snapshot = await services.prepare();
      const suggestion = (await accountRequest(
        "/api/ai/gap-line",
        {
          method: "POST",
          signal: AbortSignal.timeout(65000),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            documentId: snapshot.id,
            revision: snapshot.revision,
            requirement,
            line: gap.line.trim(),
          }),
        },
        services.owner ?? undefined,
      )) as GapLineResult;
      if (!mounted.current) return;
      setGaps((all) => ({ ...all, [id]: { ...all[id], working: false, suggestion } }));
    } catch (error) {
      if (!mounted.current) return;
      setGaps((all) => ({ ...all, [id]: { ...all[id], working: false } }));
      failed(error, "match");
    }
  }

  function addSuggestion(id: string) {
    const suggestion = gaps[id]?.suggestion;
    if (!suggestion || suggestion.placement === "none") return;
    services.updateDocument((draft) => {
      if (suggestion.placement === "entry") {
        const entry = draft.sections
          .find((s) => s.id === suggestion.sectionId)
          ?.entries.find((e) => e.id === suggestion.entryId);
        if (entry) entry.bullets = [...entry.bullets.filter((b) => b.text.trim()), { id: uid(), text: suggestion.text }];
      } else {
        let section = draft.sections.find((s) => s.type === "skills");
        if (!section) {
          section = { id: uid(), type: "skills", label: labels.skills, visible: true, entries: [] };
          draft.sections.push(section);
        }
        let entry = section.entries[0];
        if (!entry) {
          entry = { ...newEntry(), title: "Skills" };
          section.entries.push(entry);
        }
        entry.description = addSkillToText(entry.description, suggestion.text);
      }
    });
    setGaps((all) => ({ ...all, [id]: { ...all[id], added: true } }));
    setNotice("Added to your CV. Undo removes it.");
  }

  async function runTailor() {
    if (!match) return;
    setState({
      stage: "working",
      what: "Tailoring your summary and bullets",
      steps: ["Reading the job post and your CV", "Rewording for this job", "Checking nothing new was added"],
    });
    try {
      const snapshot = await services.prepare();
      const result = (await accountRequest(
        "/api/ai/tailor",
        {
          method: "POST",
          signal: AbortSignal.timeout(65000),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            documentId: snapshot.id,
            revision: snapshot.revision,
            job: jobBody,
            requirements: match.requirements.filter((r) => r.status === "shown").map((r) => r.text),
          }),
        },
        services.owner ?? undefined,
      )) as TailorResult;
      if (!mounted.current) return;
      setState({ stage: "idle" });
      if (!result.summary && !result.rewrites.length) {
        setNotice(
          result.withheld
            ? "The tailored wording could not be backed up by your CV, so it was withheld."
            : "No tailored wording to suggest for this job.",
        );
        return;
      }
      setTailor({ result, source: snapshot, useSummary: false, picked: [], confirmed: false });
    } catch (error) {
      if (mounted.current) failed(error, "tailor");
    }
  }

  async function saveTailored() {
    if (!tailor) return;
    const copy = duplicateDocument(
      tailor.source,
      `${tailor.source.name} — ${job.title.trim()}${job.company.trim() ? ` at ${job.company.trim()}` : ""} (Tailored with AI)`,
    );
    if (tailor.useSummary && tailor.result.summary) {
      let section = copy.sections.find((s) => s.type === "summary");
      if (!section) {
        section = { id: uid(), type: "summary", label: labels.summary, visible: true, entries: [] };
        copy.sections.unshift(section);
      }
      if (!section.entries[0]) section.entries.push({ ...newEntry(), title: "Summary" });
      section.entries[0].description = tailor.result.summary.text;
    }
    for (const rewrite of tailor.result.rewrites.filter((r) => tailor.picked.includes(r.bulletId))) {
      const bullet = copy.sections
        .find((s) => s.id === rewrite.sectionId)
        ?.entries.find((e) => e.id === rewrite.entryId)
        ?.bullets.find((b) => b.id === rewrite.bulletId);
      if (bullet && bullet.text === rewrite.before) bullet.text = rewrite.text;
    }
    if (await services.saveTailoredCopy(copy, reviewSnapshot(tailor.source))) {
      setTailor(null);
      setNotice("Saved as a tailored copy. Your original CV is unchanged.");
    }
  }

  const shown = match?.requirements.filter((r) => r.status === "shown") ?? [];
  const missing = match?.requirements.filter((r) => r.status === "gap") ?? [];

  return (
    <section className="ai-job-match" aria-labelledby="ai-job-match-heading">
      <h4 id="ai-job-match-heading">
        <Sparkles size={16} aria-hidden /> Match with AI
      </h4>
      <div role="status" aria-live="polite" className="sr-only">
        {notice}
      </div>
      {!services.jobMatch ? (
        <div className="field-ai-note">
          <p>
            Matching a job post with AI is part of Go and Pro. The built-in
            comparison below works on every plan.
          </p>
          <button type="button" className="primary" onClick={services.onSeePlans}>
            See plans
          </button>
        </div>
      ) : status !== "ready" ? (
        <AiBlocked status={status} services={services} />
      ) : state.stage === "consent" ? (
        <AiConsent
          services={services}
          sends="Sends the job post, your headline, jobs, bullets, education and skills to OpenAI. Contact details are not sent."
          onAgreed={() => void (state.next === "tailor" ? runTailor() : runMatch())}
          onCancel={() => setState({ stage: "idle" })}
        />
      ) : (
        <>
          <p className="field-ai-help">
            AI lists what the post asks for, quotes where your CV already shows
            it, and lists the gaps. Nothing is added unless you write it.
            Sends the job post and your CV text, not your contact details.
          </p>
          <button
            type="button"
            className="primary"
            disabled={!ready || state.stage === "working"}
            onClick={() => (services.aiConsent ? void runMatch() : setState({ stage: "consent", next: "match" }))}
          >
            {match ? "Match again" : "Match with AI"}
          </button>
          {!ready && (
            <p className="field-ai-help">Add the job title and paste the job post (at least 50 characters) first.</p>
          )}
          {state.stage === "working" && (
            <AiProgress
              title={state.what}
              steps={state.steps}
            />
          )}
          {state.stage === "error" && (
            <div className="field-ai-note">
              <p className="field-ai-error" role="alert">{state.message}</p>
              {state.plans && (
                <button type="button" className="primary" onClick={services.onSeePlans}>
                  See plans
                </button>
              )}
            </div>
          )}
          {match && (
            <div className="ai-job-match-results">
              <h5>Your CV shows ({shown.length})</h5>
              {shown.length ? (
                <ul className="ai-job-match-list">
                  {shown.map((r) => (
                    <li key={r.id}>
                      <CircleCheck size={16} aria-hidden /> <strong>{r.text}</strong>{" "}
                      <span className="ai-job-match-priority">{r.priority}</span>
                      <p className="entry-ai-source">
                        From your CV: {r.evidence.map((e) => `“${e.text}”`).join(" ")}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="field-ai-help">None of the requirements are clearly shown yet.</p>
              )}
              {match.withheld > 0 && (
                <p className="field-ai-help">
                  {match.withheld} possible match{match.withheld === 1 ? " was" : "es were"} not clear
                  enough in your CV, so {match.withheld === 1 ? "it is" : "they are"} listed as a gap.
                </p>
              )}
              <h5>Gaps ({missing.length})</h5>
              <ul className="ai-job-match-list">
                {missing.map((r) => {
                  const gap = gaps[r.id];
                  return (
                    <li key={r.id} data-gap={r.text}>
                      <CircleDashed size={16} aria-hidden /> <strong>{r.text}</strong>{" "}
                      <span className="ai-job-match-priority">{r.priority}</span>
                      {gap?.added ? (
                        <p className="field-ai-note">
                          <Check size={16} aria-hidden /> Added from your own words.
                        </p>
                      ) : gap?.answer === "no" ? (
                        <p className="field-ai-help">You said you do not have this. Nothing was added.</p>
                      ) : gap?.answer === "yes" ? (
                        <div className="field-ai-form">
                          <label>
                            In one line, what did you do? Name the job or project.
                            <input
                              value={gap.line}
                              maxLength={300}
                              onChange={(e) =>
                                setGaps({ ...gaps, [r.id]: { ...gap, line: e.target.value, suggestion: null } })
                              }
                            />
                          </label>
                          <div className="field-ai-actions">
                            <button
                              type="button"
                              disabled={gap.line.trim().length < 3 || gap.working}
                              onClick={() => void suggestPlace(r.id, r.text)}
                            >
                              {gap.working ? "Finding where it goes…" : "Suggest where it goes"}
                            </button>
                            <button type="button" onClick={() => setGaps({ ...gaps, [r.id]: { ...gap, answer: "open" } })}>
                              Cancel
                            </button>
                          </div>
                          {gap.suggestion &&
                            (gap.suggestion.placement === "none" ? (
                              <p className="field-ai-help" role="status">{gap.suggestion.message}</p>
                            ) : (
                              <div className="ai-job-match-suggestion">
                                <p>
                                  {gap.suggestion.placement === "entry" ? (
                                    <>
                                      Add to <strong>{gap.suggestion.entryLabel}</strong>: “{gap.suggestion.text}”
                                    </>
                                  ) : (
                                    <>
                                      Add skill: <strong>{gap.suggestion.text}</strong>
                                    </>
                                  )}
                                </p>
                                <div className="field-ai-actions">
                                  <button type="button" className="primary" onClick={() => addSuggestion(r.id)}>
                                    <Check size={16} aria-hidden /> Add it
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setGaps({ ...gaps, [r.id]: { ...gap, suggestion: null } })}
                                  >
                                    <X size={16} aria-hidden /> Keep mine
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="field-ai-actions">
                          <span>Do you have this?</span>
                          <button
                            type="button"
                            aria-label={`Yes, I have: ${r.text}`}
                            onClick={() => setGaps({ ...gaps, [r.id]: { ...gap, answer: "yes" } })}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            aria-label={`No, I do not have: ${r.text}`}
                            onClick={() => setGaps({ ...gaps, [r.id]: { ...gap, answer: "no" } })}
                          >
                            No
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="ai-job-match-tailor">
                <h5>Tailor with AI</h5>
                {!services.tailor ? (
                  <div className="field-ai-note">
                    <p>Tailoring your summary and bullets to this job with AI is part of Pro.</p>
                    <button type="button" onClick={services.onSeePlans}>See plans</button>
                  </div>
                ) : !tailor ? (
                  <>
                    <p className="field-ai-help">
                      A reworded summary and up to 8 bullets that bring forward what this job values,
                      saved as a separate tailored copy. Your original CV is kept.
                    </p>
                    <button
                      type="button"
                      disabled={state.stage === "working" || !shown.length}
                      onClick={() => void runTailor()}
                    >
                      Tailor with AI
                    </button>
                  </>
                ) : (
                  <div className="field-ai-form entry-ai-review">
                    {tailor.result.summary && (
                      <label className="field-ai-check">
                        <input
                          type="checkbox"
                          checked={tailor.useSummary}
                          onChange={(e) => setTailor({ ...tailor, useSummary: e.target.checked })}
                        />
                        <span>
                          Use the tailored summary: “{tailor.result.summary.text}”
                        </span>
                      </label>
                    )}
                    <ul className="entry-ai-list">
                      {tailor.result.rewrites.map((rewrite, index) => (
                        <li key={rewrite.bulletId}>
                          <label className="field-ai-check">
                            <input
                              type="checkbox"
                              checked={tailor.picked.includes(rewrite.bulletId)}
                              onChange={(e) =>
                                setTailor({
                                  ...tailor,
                                  picked: e.target.checked
                                    ? [...tailor.picked, rewrite.bulletId]
                                    : tailor.picked.filter((id) => id !== rewrite.bulletId),
                                })
                              }
                            />
                            Use tailored bullet {index + 1} ({rewrite.entryLabel})
                          </label>
                          <p className="entry-ai-source">Was: “{rewrite.before}”</p>
                          <p>“{rewrite.text}”</p>
                        </li>
                      ))}
                    </ul>
                    {tailor.result.withheld > 0 && (
                      <p className="field-ai-help">
                        {tailor.result.withheld} suggestion{tailor.result.withheld === 1 ? " was" : "s were"} withheld
                        because your CV does not support {tailor.result.withheld === 1 ? "it" : "them"}.
                      </p>
                    )}
                    <label className="field-ai-check">
                      <input
                        type="checkbox"
                        checked={tailor.confirmed}
                        onChange={(e) => setTailor({ ...tailor, confirmed: e.target.checked })}
                      />
                      I checked the ticked wording and it accurately describes my experience.
                    </label>
                    <div className="field-ai-actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={!tailor.confirmed || (!tailor.useSummary && !tailor.picked.length)}
                        onClick={() => void saveTailored()}
                      >
                        <Check size={16} aria-hidden /> Save as tailored copy
                      </button>
                      <button type="button" onClick={() => setTailor(null)}>
                        <X size={16} aria-hidden /> Keep mine
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
