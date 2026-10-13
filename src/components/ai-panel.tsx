"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { type ResumeDocument, uid } from "@/lib/document";
import {
  bulletEvidence,
  proposalSchema,
  type Proposal,
} from "@/lib/ai-proposals";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";
import {
  generateExecutiveSummaries,
  generateInterviewClarifications,
  applyInterviewAnswer,
  discoverDemonstratedSkills,
  type SummaryDraftOption,
  type InterviewClarification,
  type DiscoveredSkill,
} from "@/lib/vault/ai-assistant";
import { addSkillToText } from "@/lib/skills-taxonomy";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { Bot, Check, Plus, X } from "lucide-react";

export type AiPanelMode = "bullet" | "summary" | "interview" | "skills";

export interface AIPanelProps {
  doc: ResumeDocument;
  owner: string | null;
  prepare: () => Promise<ResumeDocument>;
  accept: (proposal: Proposal) => Promise<void>;
  onClose: () => void;
  onUpdateDocument?: (updater: (doc: ResumeDocument) => void) => void;
  initialMode?: AiPanelMode;
  initialBulletId?: string;
  initialInstruction?: string;
  onOpenAccount?: () => void;
  onEditSection?: (id: string) => void;
}

export function AIPanel({
  doc,
  owner,
  prepare,
  accept,
  onClose,
  onUpdateDocument,
  initialMode = "bullet",
  initialBulletId,
  initialInstruction,
  onOpenAccount,
  onEditSection,
}: AIPanelProps) {
  useBodyScrollLock();
  const generation = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  function close() {
    generation.current?.abort();
    onClose();
  }
  const dialogRef = useModalFocus(close);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current?.abort();
    };
  }, []);
  const bullets = bulletEvidence(doc);
  const [mode, setMode] = useState<AiPanelMode>(initialMode);

  // Bullet Assistant State
  const [bulletId, setBulletId] = useState(
    initialBulletId || bullets[0]?.id || "",
  );
  const [instruction, setInstruction] = useState(
    initialInstruction ||
      "Make this bullet clearer and more concise, without adding facts.",
  );
  const [consent, setConsent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [availability, setAvailability] = useState<{
    configured: boolean;
    signedIn: boolean;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null);

  // Interview State
  const [interviewAnswers, setInterviewAnswers] = useState<
    Record<string, string>
  >({});
  const [synthesizedBullets, setSynthesizedBullets] = useState<
    Record<string, string>
  >({});

  // Summary State
  const summaryDrafts = useMemo(() => generateExecutiveSummaries(doc), [doc]);
  const [selectedSummaryOption, setSelectedSummaryOption] =
    useState<SummaryDraftOption | null>(null);
  const [summaryText, setSummaryText] = useState("");
  const [summaryConfirmed, setSummaryConfirmed] = useState(false);
  const [impactConfirmed, setImpactConfirmed] = useState<
    Record<string, boolean>
  >({});
  const [impactBulletId, setImpactBulletId] = useState(initialBulletId || "");

  // Skill Discovery State
  const discoveredSkills = useMemo(
    () => discoverDemonstratedSkills(doc),
    [doc],
  );
  const [addedSkills, setAddedSkills] = useState<Set<string>>(new Set());

  // Interview Questions
  const interviewQuestions = useMemo(
    () => generateInterviewClarifications(doc, 100, initialBulletId),
    [doc, initialBulletId],
  );

  useEffect(() => {
    let active = true;
    void accountRequest("/api/ai")
      .then((value) => {
        if (active)
          setAvailability(value as { configured: boolean; signedIn: boolean });
      })
      .catch(() => {
        if (active)
          setError(
            "Could not check assistant availability. Close and reopen to retry.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  async function run(work: () => Promise<void>) {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof CloudRequestError && e.code === "NETWORK_ERROR"
          ? "The assistant could not finish in time or lost its connection. Your CV was kept. Retry to check the same request."
          : (e as Error).message,
      );
      if (
        e instanceof CloudRequestError &&
        [
          "AI_FINISHED",
          "AI_REQUEST_CHANGED",
          "AI_INVALID_RESPONSE",
          "AI_INVALID_EVIDENCE",
          "AI_UNAVAILABLE",
          "AI_REFUSED",
        ].includes(e.code)
      )
        request.current = null;
    } finally {
      setWorking(false);
    }
  }

  const selected = bullets.find((b) => b.id === bulletId);
  const sources = bullets.filter(
    (b) =>
      b.entryId === selected?.entryId && b.sectionId === selected?.sectionId,
  );

  function applySummaryToDoc(summaryText: string) {
    if (!onUpdateDocument) return;
    onUpdateDocument((d) => {
      let summarySec = d.sections.find((s) => s.type === "summary");
      if (!summarySec) {
        const newSec = {
          id: uid(),
          type: "summary" as const,
          label: "Professional Summary",
          visible: true,
          entries: [],
        };
        d.sections.unshift(newSec);
        summarySec = newSec;
      }
      if (summarySec.entries.length === 0) {
        summarySec.entries.push({
          id: uid(),
          title: "Summary",
          organization: "",
          location: "",
          start: "",
          end: "",
          current: false,
          description: summaryText,
          bullets: [],
        });
      } else {
        summarySec.entries[0].description = summaryText;
      }
    });
    setSelectedSummaryOption(null);
    setMessage(
      "Summary added to Profile. Close this dialog to see it; Undo restores the previous summary.",
    );
  }

  function handleSynthesizeInterview(item: InterviewClarification) {
    const answer = interviewAnswers[item.id]?.trim();
    if (!answer) return;
    const synthesized = applyInterviewAnswer(item.originalBullet, answer);
    setSynthesizedBullets((prev) => ({ ...prev, [item.id]: synthesized }));
  }

  function handleAcceptInterviewBullet(item: InterviewClarification) {
    const newBulletText = synthesizedBullets[item.id];
    if (!newBulletText || !onUpdateDocument) return;

    onUpdateDocument((d) => {
      const sec = d.sections.find((s) => s.id === item.sectionId);
      const entry = sec?.entries.find((e) => e.id === item.entryId);
      const bullet = entry?.bullets.find((b) => b.id === item.bulletId);
      if (bullet) {
        bullet.text = newBulletText;
      }
    });
    setMessage(
      `Your result was added to the bullet in ${item.entryTitle}. Close to see it, or use Undo to restore it.`,
    );
    setSynthesizedBullets((prev) => {
      const copy = { ...prev };
      delete copy[item.id];
      return copy;
    });
  }

  function handleAddSkill(skillName: string) {
    if (!onUpdateDocument) return;
    onUpdateDocument((d) => {
      let skillsSec = d.sections.find((s) => s.type === "skills");
      if (!skillsSec) {
        const newSec = {
          id: uid(),
          type: "skills" as const,
          label: "Technical Skills",
          visible: true,
          entries: [],
        };
        d.sections.push(newSec);
        skillsSec = newSec;
      }
      if (skillsSec.entries.length === 0) {
        skillsSec.entries.push({
          id: uid(),
          title: "Skills",
          organization: "",
          location: "",
          start: "",
          end: "",
          current: false,
          description: skillName,
          bullets: [],
        });
      } else {
        const first = skillsSec.entries[0];
        first.description = addSkillToText(first.description, skillName);
      }
    });
    setAddedSkills((prev) => new Set([...prev, skillName]));
    setMessage(`Added "${skillName}" to your Skills section.`);
  }

  function handleAddAllSkills() {
    if (!onUpdateDocument || discoveredSkills.length === 0) return;
    onUpdateDocument((d) => {
      let skillsSec = d.sections.find((s) => s.type === "skills");
      if (!skillsSec) {
        const newSec = {
          id: uid(),
          type: "skills" as const,
          label: "Technical Skills",
          visible: true,
          entries: [],
        };
        d.sections.push(newSec);
        skillsSec = newSec;
      }
      if (skillsSec.entries.length === 0) {
        skillsSec.entries.push({
          id: uid(),
          title: "Skills",
          organization: "",
          location: "",
          start: "",
          end: "",
          current: false,
          description: discoveredSkills.map((s) => s.skill).join(" · "),
          bullets: [],
        });
      } else {
        const first = skillsSec.entries[0];
        let desc = first.description;
        for (const item of discoveredSkills) {
          desc = addSkillToText(desc, item.skill);
        }
        first.description = desc;
      }
    });
    setAddedSkills(new Set(discoveredSkills.map((s) => s.skill)));
    setMessage(
      `Added all ${discoveredSkills.length} discovered skills to your Skills section.`,
    );
  }

  return (
    <div
      className="modal-backdrop no-print"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Writing assistant"
    >
      <section
        className="account-panel ai-panel no-print"
        aria-label="AI bullet assistant"
      >
        <div className="account-heading modal-header">
          <div>
            <h2>Help with your wording</h2>
            <p>
              Choose what to work on. Preview each change before adding it to
              your CV.
            </p>
          </div>
          <button onClick={close} aria-label="Close AI assistant">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="ai-panel-body">
          <div
            className="ai-tabs"
            role="tablist"
            aria-label="Writing tools"
            onKeyDown={(event) => {
              const modes: AiPanelMode[] = [
                "bullet",
                "summary",
                "interview",
                "skills",
              ];
              if (
                working ||
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const i = modes.indexOf(mode);
              const next =
                event.key === "Home"
                  ? modes[0]
                  : event.key === "End"
                    ? modes[3]
                    : modes[(i + (event.key === "ArrowRight" ? 1 : 3)) % 4];
              setMode(next);
              setError("");
              setMessage("");
              document.getElementById("writing-tab-" + next)?.focus();
            }}
          >
            {(
              [
                ["bullet", "Rewrite a bullet"],
                ["summary", "Write a summary"],
                ["interview", "Add a real result"],
                ["skills", "Find skills"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                id={"writing-tab-" + id}
                type="button"
                role="tab"
                tabIndex={mode === id ? 0 : -1}
                disabled={working}
                aria-selected={mode === id}
                aria-controls="writing-content"
                className={"ai-tab-btn " + (mode === id ? "active" : "")}
                onClick={() => {
                  setMode(id);
                  setError("");
                  setMessage("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="writing-content"
            aria-labelledby={"writing-tab-" + mode}
          >
            <p className="assistant-mode-note">
              {mode === "bullet"
                ? "AI rewrite: choose an existing bullet, request clearer wording, then review and save. Requires an account CV."
                : mode === "summary"
                  ? "Local summary helper: arranges details already in your CV. No AI request is made."
                  : mode === "interview"
                    ? "Local result helper: add an outcome you can document, preview the combined bullet, then confirm it."
                    : "Local skill search: finds terms in your bullets. Read the source before deciding whether to list a skill."}
            </p>
            {working && (
              <p role="status" className="assistant-progress">
                Checking your saved CV and suggestion. AI generation can take up
                to a minute; you can close this dialog. No change is applied
                automatically.
              </p>
            )}

            {error && (
              <p className="account-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="account-message" role="status">
                {message}
              </p>
            )}

            {/* --- TAB 1: BULLET ASSISTANT (Preserves 100% existing contract) --- */}
            {mode === "bullet" && (
              <>
                {selected && (
                  <blockquote className="selected-bullet">
                    {selected.text}
                  </blockquote>
                )}
                {!owner && (
                  <div className="assistant-next-step">
                    <p>
                      Local resumes are never uploaded automatically; choose
                      what to copy in Account settings.
                    </p>
                    <p>
                      To use AI, sign in, explicitly copy this draft to your
                      account, then reopen the account CV. Summary and result
                      helpers work on this device.
                    </p>
                    <button type="button" onClick={onOpenAccount}>
                      Sign in / Open account
                    </button>
                  </div>
                )}
                {availability && !availability.configured && (
                  <p>
                    OpenAI is not configured on this installation yet. Your
                    editor and exports remain available.
                  </p>
                )}
                {!availability && !error && <p>Checking availability…</p>}
                {owner && availability && !availability.signedIn && (
                  <div className="assistant-next-step">
                    <p>
                      Restore your account session to request a rewrite. Your
                      draft is kept.
                    </p>
                    <button type="button" onClick={onOpenAccount}>
                      Sign in again
                    </button>
                  </div>
                )}
                {owner && availability?.configured && availability.signedIn && (
                  <>
                    {!bullets.length ? (
                      <div className="assistant-next-step">
                        <p>
                          Add a bullet to Experience or Projects first. Write
                          what you actually did; AI can help make it clearer.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const section = doc.sections.find(
                              (s) => s.type === "experience",
                            );
                            if (section) onEditSection?.(section.id);
                          }}
                        >
                          Add experience bullets
                        </button>
                      </div>
                    ) : (
                      <form
                        className="account-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void run(async () => {
                            const snapshot = await prepare();
                            if (!mounted.current) return;
                            const key = JSON.stringify([
                              snapshot.id,
                              snapshot.revision,
                              bulletId,
                              instruction,
                            ]);
                            if (request.current?.key !== key)
                              request.current = {
                                key,
                                id: crypto.randomUUID(),
                              };
                            generation.current = new AbortController();
                            const result = await accountRequest(
                              "/api/ai",
                              {
                                method: "POST",
                                signal: AbortSignal.any([
                                  generation.current.signal,
                                  AbortSignal.timeout(65000),
                                ]),
                                body: JSON.stringify({
                                  requestId: request.current.id,
                                  documentId: snapshot.id,
                                  revision: snapshot.revision,
                                  bulletId,
                                  instruction,
                                  consent: true,
                                }),
                              },
                              owner,
                            );
                            setProposal(proposalSchema.parse(result));
                            setConfirmed(false);
                          });
                        }}
                      >
                        <label>
                          Bullet to improve
                          <select
                            disabled={working || Boolean(proposal)}
                            value={bulletId}
                            onChange={(event) => {
                              setBulletId(event.target.value);
                              setConsent(false);
                            }}
                          >
                            {bullets.map((bullet, index) => (
                              <option key={bullet.id} value={bullet.id}>
                                {index + 1}. {bullet.text.slice(0, 100)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="button-row assistant-presets">
                          {[
                            [
                              "Clearer wording",
                              "Make this bullet clearer without adding or strengthening facts.",
                            ],
                            [
                              "Shorter wording",
                              "Shorten this bullet while preserving every responsibility and fact.",
                            ],
                          ].map(([label, value]) => (
                            <button
                              key={label}
                              type="button"
                              disabled={working || Boolean(proposal)}
                              onClick={() => setInstruction(value)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <label>
                          Writing instruction
                          <textarea
                            disabled={working || Boolean(proposal)}
                            maxLength={1000}
                            required
                            rows={3}
                            value={instruction}
                            onChange={(event) =>
                              setInstruction(event.target.value)
                            }
                          />
                        </label>
                        <details>
                          <summary>
                            Evidence sent with this request ({sources.length}{" "}
                            bullets)
                          </summary>
                          <ul>
                            {sources.map((source) => (
                              <li key={source.id}>{source.text}</li>
                            ))}
                          </ul>
                        </details>
                        <details>
                          <summary>What is sent and saved?</summary>
                          <p>
                            Only the selected entry’s bullets and your
                            instruction are sent to OpenAI for drafting and a
                            separate support check. Contact fields and other
                            entries are excluded. Requests use no response
                            storage; provider retention still depends on your
                            deployment’s OpenAI settings. Suggestions and source
                            references are stored in your account until rejected
                            or the resume/account is deleted.
                          </p>
                        </details>
                        <label className="ai-check">
                          <input
                            type="checkbox"
                            checked={consent}
                            disabled={working || Boolean(proposal)}
                            onChange={(event) =>
                              setConsent(event.target.checked)
                            }
                          />
                          Send this evidence and instruction to OpenAI.
                        </label>
                        <button
                          className="primary"
                          disabled={working || !consent || Boolean(proposal)}
                        >
                          {working
                            ? "Preparing suggestion…"
                            : "Suggest a rewrite"}
                        </button>
                      </form>
                    )}
                    {proposal && (
                      <div className="ai-review">
                        <h3>Review the suggestion</h3>
                        <p>{proposal.message}</p>
                        {proposal.questions.length > 0 && (
                          <ul>
                            {proposal.questions.map((question, index) => (
                              <li key={index}>{question}</li>
                            ))}
                          </ul>
                        )}
                        {proposal.operations.map((operation) => (
                          <div
                            key={operation.bulletId}
                            className="ai-comparison"
                          >
                            <div>
                              <h4>Before</h4>
                              <p>{operation.before}</p>
                            </div>
                            <div>
                              <h4>Suggested</h4>
                              <p>{operation.text}</p>
                            </div>
                            <details>
                              <summary>Supporting original bullets</summary>
                              <ul>
                                {operation.evidenceIds.map((id) => (
                                  <li key={id}>
                                    {bullets.find((b) => b.id === id)?.text}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </div>
                        ))}
                        {proposal.operations.length > 0 && (
                          <>
                            <p>
                              The support check can make mistakes. Check every
                              claim against your own experience. Accepted
                              wording can be undone in this session.
                            </p>
                            <label className="ai-check">
                              <input
                                type="checkbox"
                                checked={confirmed}
                                disabled={working}
                                onChange={(event) =>
                                  setConfirmed(event.target.checked)
                                }
                              />
                              I checked the wording and confirm it accurately
                              describes my experience.
                            </label>
                          </>
                        )}
                        <div className="button-row">
                          {proposal.operations.length > 0 && (
                            <button
                              className="primary"
                              disabled={working || !confirmed}
                              onClick={() =>
                                void run(async () => {
                                  await accept(proposal);
                                  setProposal(null);
                                  request.current = null;
                                  setConfirmed(false);
                                  setMessage(
                                    "Suggestion saved. Use Undo in the editor to restore the previous wording.",
                                  );
                                })
                              }
                            >
                              Accept and save
                            </button>
                          )}
                          <button
                            disabled={working}
                            onClick={() =>
                              void run(async () => {
                                await accountRequest(
                                  `/api/ai/${encodeURIComponent(proposal.id)}`,
                                  {
                                    method: "POST",
                                    body: JSON.stringify({
                                      decision: "reject",
                                      confirmed: true,
                                    }),
                                  },
                                  owner,
                                );
                                setProposal(null);
                                request.current = null;
                                setMessage(
                                  "Suggestion dismissed. Your resume was not changed.",
                                );
                              })
                            }
                          >
                            {proposal.operations.length
                              ? "Reject suggestion"
                              : "Dismiss questions"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* --- TAB 2: SUMMARY DRAFTER --- */}
            {mode === "summary" && (
              <div className="ai-summary-drafter">
                <p className="ai-intro-note">
                  Pick a starting draft made from your existing details, then
                  edit and review it. Using a draft replaces the text in
                  Profile; Undo can restore it.
                </p>
                {!summaryDrafts.length && (
                  <div className="assistant-next-step">
                    <p>
                      Add your role, experience or projects first. There are no
                      facts to summarize yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => onEditSection?.("contact")}
                    >
                      Add my details
                    </button>
                  </div>
                )}
                {selectedSummaryOption && (
                  <div className="ai-review">
                    <h3>Review your summary</h3>
                    <label>
                      Summary draft
                      <textarea
                        rows={5}
                        maxLength={5000}
                        value={summaryText}
                        onChange={(e) => {
                          setSummaryText(e.target.value);
                          setSummaryConfirmed(false);
                        }}
                      />
                    </label>
                    <label className="ai-check">
                      <input
                        type="checkbox"
                        checked={summaryConfirmed}
                        onChange={(e) => setSummaryConfirmed(e.target.checked)}
                      />
                      I checked this summary against my own experience.
                    </label>
                    <div className="button-row">
                      <button
                        className="primary"
                        disabled={!summaryConfirmed || !summaryText.trim()}
                        onClick={() => applySummaryToDoc(summaryText)}
                      >
                        Use this summary
                      </button>
                      <button onClick={() => setSelectedSummaryOption(null)}>
                        Keep my current summary
                      </button>
                    </div>
                  </div>
                )}

                <div className="ai-summary-grid">
                  {summaryDrafts.map((draft) => (
                    <div key={draft.id} className="ai-card ai-summary-card">
                      <div className="ai-card-header">
                        <div>
                          <h4>{draft.title}</h4>
                          <p className="ai-card-sub">{draft.description}</p>
                        </div>
                        <span className="badge word-count-badge">
                          {draft.wordCount} words
                        </span>
                      </div>

                      <div className="ai-summary-text-box">
                        <p>{draft.text}</p>
                      </div>

                      {draft.highlightedEvidence.length > 0 && (
                        <div className="ai-evidence-pills">
                          <span className="pill-label">Grounded in:</span>
                          {draft.highlightedEvidence.map((ev, i) => (
                            <span key={i} className="evidence-pill">
                              {ev}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="ai-card-actions">
                        <button
                          type="button"
                          className="primary"
                          onClick={() => {
                            setSelectedSummaryOption(draft);
                            setSummaryText(draft.text);
                            setSummaryConfirmed(false);
                          }}
                        >
                          Review this draft
                        </button>
                        <small>
                          Apply to your CV, then sign in to download or export.
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- TAB 3: IMPACT INTERVIEW --- */}
            {mode === "interview" && (
              <div className="ai-interview-container">
                <p className="ai-intro-note">
                  A result can explain why your work mattered. Add one only if
                  you can support it. A number is optional; keep your original
                  bullet if no outcome is known.
                </p>

                {interviewQuestions.length === 0 ? (
                  <div className="ai-empty-box">
                    <p>
                      No bullets need this prompt right now. Add an experience
                      or project bullet to use the result helper.
                    </p>
                  </div>
                ) : (
                  <div className="ai-questions-list">
                    <label>
                      Bullet to add a result to
                      <select
                        value={
                          interviewQuestions.some(
                            (q) => q.bulletId === impactBulletId,
                          )
                            ? impactBulletId
                            : interviewQuestions[0].bulletId
                        }
                        onChange={(e) => setImpactBulletId(e.target.value)}
                      >
                        {interviewQuestions.map((q, i) => (
                          <option key={q.id} value={q.bulletId}>
                            {i + 1}. {q.originalBullet.slice(0, 90)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {interviewQuestions
                      .filter(
                        (q) =>
                          q.bulletId ===
                          (interviewQuestions.some(
                            (q) => q.bulletId === impactBulletId,
                          )
                            ? impactBulletId
                            : interviewQuestions[0].bulletId),
                      )
                      .map((q) => {
                        const answer = interviewAnswers[q.id] || "";
                        const synthesized = synthesizedBullets[q.id];

                        return (
                          <div key={q.id} className="ai-card ai-interview-card">
                            <div className="ai-card-header">
                              <div>
                                <strong>
                                  {q.entryTitle}
                                  {q.organization ? ` · ${q.organization}` : ""}
                                </strong>
                                <p className="original-bullet-quote">
                                  "{q.originalBullet}"
                                </p>
                              </div>
                              <span className="badge metric-kind-badge">
                                {q.suggestedMetricKind}
                              </span>
                            </div>

                            <div className="ai-prompt-box">
                              <p className="interview-question">
                                <Bot size={16} aria-hidden /> {q.questionPrompt}
                              </p>
                              <p className="helper-text">
                                Think about time saved, fewer errors, work
                                completed, or people helped. Use your own
                                outcome, not an example number.
                              </p>

                              <div className="interview-input-row">
                                <input
                                  type="text"
                                  aria-label="Your documented result"
                                  maxLength={2000}
                                  placeholder="What changed because of your work?"
                                  value={answer}
                                  onChange={(e) => {
                                    setSynthesizedBullets((prev) => {
                                      const next = { ...prev };
                                      delete next[q.id];
                                      return next;
                                    });
                                    setImpactConfirmed((prev) => ({
                                      ...prev,
                                      [q.id]: false,
                                    }));
                                    setInterviewAnswers((prev) => ({
                                      ...prev,
                                      [q.id]: e.target.value,
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSynthesizeInterview(q);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="primary"
                                  disabled={!answer.trim()}
                                  onClick={() => handleSynthesizeInterview(q)}
                                >
                                  Preview updated bullet
                                </button>
                              </div>
                            </div>

                            {synthesized && (
                              <div className="ai-interview-diff">
                                <p className="diff-title">
                                  PREVIEW REVISED BULLET:
                                </p>
                                <p className="diff-view">
                                  <del className="diff-del">
                                    {q.originalBullet}
                                  </del>{" "}
                                  <ins className="diff-ins">{synthesized}</ins>
                                </p>
                                <div className="diff-actions">
                                  <label className="ai-check">
                                    <input
                                      type="checkbox"
                                      checked={impactConfirmed[q.id] || false}
                                      onChange={(e) =>
                                        setImpactConfirmed((prev) => ({
                                          ...prev,
                                          [q.id]: e.target.checked,
                                        }))
                                      }
                                    />
                                    This result is accurate and belongs to this
                                    work.
                                  </label>
                                  <button
                                    type="button"
                                    className="primary"
                                    disabled={!impactConfirmed[q.id]}
                                    onClick={() =>
                                      handleAcceptInterviewBullet(q)
                                    }
                                  >
                                    Use this bullet
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSynthesizedBullets((prev) => {
                                        const copy = { ...prev };
                                        delete copy[q.id];
                                        return copy;
                                      })
                                    }
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* --- TAB 4: SKILL DISCOVERY --- */}
            {mode === "skills" && (
              <div className="ai-skills-discovery">
                <div className="ai-skills-header-row">
                  <div>
                    <p className="ai-intro-note">
                      These terms appear in your bullets but are not listed in
                      Skills. Read each source; a mention alone does not prove
                      proficiency.
                    </p>
                  </div>
                  {discoveredSkills.length > 0 && (
                    <button
                      type="button"
                      className="primary"
                      onClick={handleAddAllSkills}
                    >
                      <Plus size={14} aria-hidden /> Add All{" "}
                      {discoveredSkills.length} Skills
                    </button>
                  )}
                </div>

                {discoveredSkills.length === 0 ? (
                  <div className="ai-empty-box">
                    <p>
                      No additional skill terms found. Add your actual
                      experience first, or edit Skills directly.
                    </p>
                  </div>
                ) : (
                  <div className="ai-discovered-skills-grid">
                    {discoveredSkills.map((item, idx) => {
                      const isAdded = addedSkills.has(item.skill);

                      return (
                        <div
                          key={idx}
                          className="ai-card ai-discovered-skill-card"
                        >
                          <div className="skill-card-top">
                            <div className="skill-name-col">
                              <strong>{item.skill}</strong>
                              <span className="badge category-badge">
                                {item.category}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={isAdded}
                              className={isAdded ? "btn-added" : "primary"}
                              onClick={() => handleAddSkill(item.skill)}
                            >
                              {isAdded ? (
                                <Check size={14} aria-hidden />
                              ) : (
                                <Plus size={14} aria-hidden />
                              )}
                              {isAdded ? "Added" : "Add"}
                            </button>
                          </div>
                          <p className="skill-evidence-quote">
                            Evidenced in <em>{item.entryTitle}</em>: "
                            {item.evidenceBullet}"
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <footer className="modal-footer">
          <button type="button" onClick={close}>
            Done & return to editor
          </button>
        </footer>
      </section>
    </div>
  );
}
