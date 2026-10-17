"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

/** Seconds after which each step is shown as current: typical timings, not server progress. */
const STEP_AFTER = [0, 4, 12, 22];
const SLOW_AFTER = 35;

/**
 * Shown while an AI request runs: a spinner, what the AI is doing in plain
 * steps, and the seconds so far. Steps advance on typical timings because the
 * server reports no progress; the last one stays current until the answer
 * arrives. Screen readers hear the title once, not every second.
 */
export function AiProgress({
  title,
  steps,
  sends,
  onCancel,
}: {
  /** What is happening, such as "Writing bullets from your notes". */
  title: string;
  /** Two to four short steps, in order. */
  steps: string[];
  /** What is sent, for example "Sends your notes. Contact details are not sent." */
  sends?: string;
  onCancel?: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const current = Math.max(
    0,
    Math.min(steps.length - 1, STEP_AFTER.filter((after) => seconds >= after).length - 1),
  );

  return (
    <div className="ai-progress" aria-busy="true">
      <div className="ai-progress-head">
        <span className="ai-progress-spinner" aria-hidden />
        <p role="status" className="ai-progress-title">
          {title}… Nothing changes until you accept.
        </p>
        <span className="ai-progress-time" aria-hidden>
          {seconds} s
        </span>
      </div>
      <ol className="ai-progress-steps" aria-hidden>
        {steps.map((step, index) => (
          <li
            key={step}
            className={index < current ? "done" : index === current ? "current" : undefined}
          >
            {index < current ? <Check size={14} /> : <span className="ai-progress-dot" />}
            {step}
          </li>
        ))}
      </ol>
      <p className="field-ai-help">
        {seconds >= SLOW_AFTER
          ? "This is taking longer than usual. You can keep waiting or cancel; your CV is kept either way."
          : "Usually 10 to 30 seconds."}
        {sends ? ` ${sends}` : ""}
      </p>
      {onCancel && (
        <div className="field-ai-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
