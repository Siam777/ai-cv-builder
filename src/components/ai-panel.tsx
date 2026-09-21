"use client";
import { useEffect, useRef, useState } from "react";
import { type ResumeDocument } from "@/lib/document";
import {
  bulletEvidence,
  proposalSchema,
  type Proposal,
} from "@/lib/ai-proposals";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";

export function AIPanel({
  doc,
  owner,
  prepare,
  accept,
  onClose,
}: {
  doc: ResumeDocument;
  owner: string | null;
  prepare: () => Promise<ResumeDocument>;
  accept: (proposal: Proposal) => Promise<void>;
  onClose: () => void;
}) {
  const bullets = bulletEvidence(doc);
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
            OpenAI suggests wording. You decide what belongs in your resume.
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
      {!owner && (
        <p>
          Open an account workspace to use the assistant. Local resumes are
          never uploaded automatically; choose what to copy in Account settings.
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
    </section>
  );
}
