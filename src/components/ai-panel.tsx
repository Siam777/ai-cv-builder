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

export type AiPanelMode = "bullet" | "summary" | "interview" | "skills";

export interface AIPanelProps {
  doc: ResumeDocument;
  owner: string | null;
  prepare: () => Promise<ResumeDocument>;
  accept: (proposal: Proposal) => Promise<void>;
  onClose: () => void;
  onUpdateDocument?: (updater: (doc: ResumeDocument) => void) => void;
}

export function AIPanel({
  doc,
  owner,
  prepare,
  accept,
  onClose,
  onUpdateDocument,
}: AIPanelProps) {
  const bullets = bulletEvidence(doc);
  const [mode, setMode] = useState<AiPanelMode>("bullet");

  // Bullet Assistant State
  const [bulletId, setBulletId] = useState(bullets[0]?.id || "");
  const [instruction, setInstruction] = useState(
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
  const [interviewAnswers, setInterviewAnswers] = useState<Record<string, string>>({});
  const [synthesizedBullets, setSynthesizedBullets] = useState<Record<string, string>>({});

  // Summary State
  const summaryDrafts = useMemo(() => generateExecutiveSummaries(doc), [doc]);
  const [selectedSummaryOption, setSelectedSummaryOption] = useState<SummaryDraftOption | null>(null);

  // Skill Discovery State
  const discoveredSkills = useMemo(() => discoverDemonstratedSkills(doc), [doc]);
  const [addedSkills, setAddedSkills] = useState<Set<string>>(new Set());

  // Interview Questions
  const interviewQuestions = useMemo(() => generateInterviewClarifications(doc), [doc]);

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
      setError((e as Error).message);
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
    setMessage("Executive summary applied to your resume! Use Undo in the editor anytime.");
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
    setMessage(`Updated bullet with verified metrics for ${item.entryTitle}!`);
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
        first.description = addSkillToText(
          first.description,
          skillName,
        );
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
    setMessage(`Added all ${discoveredSkills.length} discovered skills to your Skills section.`);
  }

  return (
    <section
      className="account-panel ai-panel no-print"
      aria-label="AI bullet assistant"
    >
      <div className="account-heading">
        <div>
          <p className="eyebrow">WRITING WITH YOUR EVIDENCE</p>
          <h2>A clearer bullet, still your story.</h2>
          <p>
            OpenAI & evidence tools suggest wording. You decide what belongs in your resume.
          </p>
        </div>
        <button
          disabled={working}
          onClick={onClose}
          aria-label="Close AI assistant"
        >
          ×
        </button>
      </div>

      <div className="ai-tabs" role="tablist" aria-label="AI assistant capabilities">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "bullet"}
          className={`ai-tab-btn ${mode === "bullet" ? "active" : ""}`}
          onClick={() => {
            setMode("bullet");
            setError("");
            setMessage("");
          }}
        >
          ⚡ Bullet Assistant
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "summary"}
          className={`ai-tab-btn ${mode === "summary" ? "active" : ""}`}
          onClick={() => {
            setMode("summary");
            setError("");
            setMessage("");
          }}
        >
          📝 Summary Drafter
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "interview"}
          className={`ai-tab-btn ${mode === "interview" ? "active" : ""}`}
          onClick={() => {
            setMode("interview");
            setError("");
            setMessage("");
          }}
        >
          💬 Impact Interview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "skills"}
          className={`ai-tab-btn ${mode === "skills" ? "active" : ""}`}
          onClick={() => {
            setMode("skills");
            setError("");
            setMessage("");
          }}
        >
          💡 Skill Discovery
        </button>
      </div>

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
          {!owner && (
            <p>
              Local resumes are never uploaded automatically; choose what to copy in Account settings.
            </p>
          )}
          {availability && !availability.configured && (
            <p>
              OpenAI is not configured on this installation yet. Your editor and
              exports remain available.
            </p>
          )}
          {!availability && !error && <p>Checking availability…</p>}
          {owner && availability?.configured && availability.signedIn && (
            <>
              {!bullets.length ? (
                <p>Add a bullet to an entry before requesting a rewrite.</p>
              ) : (
                <form
                  className="account-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      const snapshot = await prepare();
                      const key = JSON.stringify([
                        snapshot.id,
                        snapshot.revision,
                        bulletId,
                        instruction,
                      ]);
                      if (request.current?.key !== key)
                        request.current = { key, id: crypto.randomUUID() };
                      const result = await accountRequest(
                        "/api/ai",
                        {
                          method: "POST",
                          signal: AbortSignal.timeout(65000),
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
                  <label>
                    Writing instruction
                    <textarea
                      disabled={working || Boolean(proposal)}
                      maxLength={1000}
                      required
                      rows={3}
                      value={instruction}
                      onChange={(event) => setInstruction(event.target.value)}
                    />
                  </label>
                  <details>
                    <summary>
                      Evidence sent with this request ({sources.length} bullets)
                    </summary>
                    <ul>
                      {sources.map((source) => (
                        <li key={source.id}>{source.text}</li>
                      ))}
                    </ul>
                  </details>
                  <p>
                    Only the selected entry’s bullets and your instruction are sent
                    to OpenAI for drafting and a separate support check. Contact
                    fields and other entries are excluded. Requests use no response
                    storage; provider retention still depends on your deployment’s
                    OpenAI settings. Suggestions and source references are stored in
                    your account until rejected or the resume/account is deleted.
                  </p>
                  <label className="ai-check">
                    <input
                      type="checkbox"
                      checked={consent}
                      disabled={working || Boolean(proposal)}
                      onChange={(event) => setConsent(event.target.checked)}
                    />
                    Send this evidence and instruction to OpenAI.
                  </label>
                  <button
                    className="primary"
                    disabled={working || !consent || Boolean(proposal)}
                  >
                    {working ? "Working…" : "Suggest a rewrite"}
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
                    <div key={operation.bulletId} className="ai-comparison">
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
                        The support check can make mistakes. Check every claim
                        against your own experience. Accepted wording can be undone
                        in this session.
                      </p>
                      <label className="ai-check">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          disabled={working}
                          onChange={(event) => setConfirmed(event.target.checked)}
                        />
                        I checked the wording and confirm it accurately describes my
                        experience.
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
            Draft executive summaries strictly grounded in your verified experience, roles, and skills.
            Choose a style tailored to your application strategy:
          </p>

          <div className="ai-summary-grid">
            {summaryDrafts.map((draft) => (
              <div key={draft.id} className="ai-card ai-summary-card">
                <div className="ai-card-header">
                  <div>
                    <h4>{draft.title}</h4>
                    <p className="ai-card-sub">{draft.description}</p>
                  </div>
                  <span className="badge word-count-badge">{draft.wordCount} words</span>
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
                    onClick={() => applySummaryToDoc(draft.text)}
                  >
                    Apply to Summary Section
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(draft.text);
                      setMessage(`Copied "${draft.title}" to clipboard!`);
                    }}
                  >
                    Copy Text
                  </button>
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
            The Google XYZ Coach found opportunities to strengthen bullets lacking quantifiable metrics.
            Answer the assistant’s question to turn vague descriptions into high-impact accomplishments:
          </p>

          {interviewQuestions.length === 0 ? (
            <div className="ai-empty-box">
              <p>🌟 <strong>Outstanding!</strong> All your accomplishment bullets contain quantifiable metrics and strong action verbs.</p>
            </div>
          ) : (
            <div className="ai-questions-list">
              {interviewQuestions.map((q) => {
                const answer = interviewAnswers[q.id] || "";
                const synthesized = synthesizedBullets[q.id];

                return (
                  <div key={q.id} className="ai-card ai-interview-card">
                    <div className="ai-card-header">
                      <div>
                        <strong>{q.entryTitle}{q.organization ? ` · ${q.organization}` : ""}</strong>
                        <p className="original-bullet-quote">"{q.originalBullet}"</p>
                      </div>
                      <span className="badge metric-kind-badge">{q.suggestedMetricKind}</span>
                    </div>

                    <div className="ai-prompt-box">
                      <p className="interview-question">🤖 {q.questionPrompt}</p>
                      <div className="example-chips">
                        <span className="chips-label">Quick examples:</span>
                        {q.exampleAnswers.map((ex, i) => (
                          <button
                            key={i}
                            type="button"
                            className="example-chip-btn"
                            onClick={() =>
                              setInterviewAnswers((prev) => ({ ...prev, [q.id]: ex }))
                            }
                          >
                            {ex}
                          </button>
                        ))}
                      </div>

                      <div className="interview-input-row">
                        <input
                          type="text"
                          placeholder="e.g. reduced P99 latency by 35%, driving $40k annual savings"
                          value={answer}
                          onChange={(e) =>
                            setInterviewAnswers((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
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
                          Synthesize XYZ Bullet
                        </button>
                      </div>
                    </div>

                    {synthesized && (
                      <div className="ai-interview-diff">
                        <p className="diff-title">PREVIEW REVISED BULLET:</p>
                        <p className="diff-view">
                          <del className="diff-del">{q.originalBullet}</del>{" "}
                          <ins className="diff-ins">{synthesized}</ins>
                        </p>
                        <div className="diff-actions">
                          <button
                            type="button"
                            className="primary"
                            onClick={() => handleAcceptInterviewBullet(q)}
                          >
                            Accept & Update Bullet
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
                These technical and professional skills were demonstrated in your experience bullets, but are not yet listed in your Skills section:
              </p>
            </div>
            {discoveredSkills.length > 0 && (
              <button
                type="button"
                className="primary"
                onClick={handleAddAllSkills}
              >
                ＋ Add All {discoveredSkills.length} Skills
              </button>
            )}
          </div>

          {discoveredSkills.length === 0 ? (
            <div className="ai-empty-box">
              <p>✅ All skills evidenced in your experience are already indexed in your Skills section!</p>
            </div>
          ) : (
            <div className="ai-discovered-skills-grid">
              {discoveredSkills.map((item, idx) => {
                const isAdded = addedSkills.has(item.skill);

                return (
                  <div key={idx} className="ai-card ai-discovered-skill-card">
                    <div className="skill-card-top">
                      <div className="skill-name-col">
                        <strong>{item.skill}</strong>
                        <span className="badge category-badge">{item.category}</span>
                      </div>
                      <button
                        type="button"
                        disabled={isAdded}
                        className={isAdded ? "btn-added" : "primary"}
                        onClick={() => handleAddSkill(item.skill)}
                      >
                        {isAdded ? "✓ Added" : "+ Add"}
                      </button>
                    </div>
                    <p className="skill-evidence-quote">
                      Evidenced in <em>{item.entryTitle}</em>: "{item.evidenceBullet}"
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
