"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useFieldAi } from "./FieldAiContext";
import { AiBlocked, AiConsent } from "./AiGate";
import { rewriteStatus } from "@/lib/ai-access";
import type { AskAction, AskResult } from "@/lib/ai-contract";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";

interface Turn {
  id: string;
  question: string;
  answer: string;
  actions: AskAction[];
  withheld: boolean;
}

const EXAMPLES = [
  "How can I make my CV stronger for project manager roles?",
  "Which bullet should I improve first?",
  "What is missing from my CV?",
];

/**
 * Ask the AI (Go and Pro): advice about the open CV with buttons that start
 * the other tools on the right field. The chat never edits the CV; only the
 * last three exchanges on this screen are sent with a question.
 */
export function AskAi({ onAction }: { onAction: (action: AskAction) => void }) {
  const ai = useFieldAi();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<
    | { stage: "idle" }
    | { stage: "consent" }
    | { stage: "working" }
    | { stage: "error"; message: string; plans?: boolean }
  >({ stage: "idle" });
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [turns.length]);

  if (!ai) return null;
  const services = ai;
  const status = rewriteStatus(services.owner, services.availability, services.signedIn);

  async function send(text = question) {
    const asked = text.trim();
    if (!asked) return;
    setState({ stage: "working" });
    try {
      const snapshot = await services.prepare();
      const result = (await accountRequest(
        "/api/ai/ask",
        {
          method: "POST",
          signal: AbortSignal.timeout(65000),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            documentId: snapshot.id,
            revision: snapshot.revision,
            question: asked.slice(0, 500),
            history: turns
              .filter((t) => !t.withheld)
              .slice(-3)
              .map((t) => ({ question: t.question, answer: t.answer.slice(0, 1500) })),
          }),
        },
        services.owner ?? undefined,
      )) as AskResult;
      setTurns((all) => [
        ...all,
        { id: result.requestId, question: asked, answer: result.answer, actions: result.actions, withheld: result.withheld },
      ]);
      setQuestion("");
      setState({ stage: "idle" });
    } catch (error) {
      if (error instanceof CloudRequestError && error.code === "AI_CONSENT_REQUIRED")
        return setState({ stage: "consent" });
      setState({
        stage: "error",
        message:
          error instanceof CloudRequestError && error.code === "NETWORK_ERROR"
            ? "The assistant could not finish in time or lost its connection."
            : (error as Error).message,
        plans: error instanceof CloudRequestError && (error.code === "AI_LIMIT" || error.code === "PLAN_REQUIRED"),
      });
    }
  }

  if (!services.askAi)
    return (
      <div className="field-ai-note ask-ai">
        <p>Asking the AI about your CV is part of Go and Pro. Help me finish works on every plan.</p>
        <button type="button" className="primary" onClick={services.onSeePlans}>
          See plans
        </button>
      </div>
    );
  if (status !== "ready") return <AiBlocked status={status} services={services} />;

  return (
    <div className="ask-ai">
      <p className="panel-intro">
        Ask about your CV. Answers are advice with buttons that open the right tool; the AI never changes
        your CV. Sends your question and CV text, not your contact details.
      </p>
      {turns.length > 0 && (
        <ol className="ask-ai-thread" ref={list} aria-label="Your questions and answers">
          {turns.map((turn) => (
            <li key={turn.id}>
              <p className="ask-ai-question">
                <strong>You:</strong> {turn.question}
              </p>
              <p className={turn.withheld ? "ask-ai-answer withheld" : "ask-ai-answer"}>
                <strong>AI:</strong> {turn.answer}
              </p>
              {turn.actions.length > 0 && (
                <div className="field-ai-actions">
                  {turn.actions.map((action) => (
                    <button key={`${action.type}:${action.targetId}`} type="button" onClick={() => onAction(action)}>
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {state.stage === "consent" ? (
        <AiConsent
          services={services}
          sends="Ask the AI sends your question and your headline, jobs, bullets, education and skills. Contact details are not sent."
          onAgreed={() => void send()}
          onCancel={() => setState({ stage: "idle" })}
        />
      ) : (
        <form
          className="field-ai-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (services.aiConsent) void send();
            else setState({ stage: "consent" });
          }}
        >
          <label>
            Your question
            <textarea
              rows={2}
              maxLength={500}
              value={question}
              placeholder={EXAMPLES[0]}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          {!turns.length && (
            <div className="ask-ai-examples">
              {EXAMPLES.map((example) => (
                <button key={example} type="button" onClick={() => setQuestion(example)}>
                  {example}
                </button>
              ))}
            </div>
          )}
          {state.stage === "error" && (
            <div className="field-ai-note">
              <p className="field-ai-error" role="alert">{state.message}</p>
              {state.plans && (
                <button type="button" onClick={services.onSeePlans}>See plans</button>
              )}
            </div>
          )}
          <div className="field-ai-actions">
            <button
              type="submit"
              className="primary"
              disabled={!question.trim() || state.stage === "working"}
            >
              <Send size={16} aria-hidden /> {state.stage === "working" ? "Asking…" : "Ask"}
            </button>
          </div>
          <p role="status" className="sr-only">
            {state.stage === "working" ? "Asking the AI." : turns.length ? "Answer ready." : ""}
          </p>
        </form>
      )}
    </div>
  );
}
