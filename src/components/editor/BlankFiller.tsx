"use client";

import { Check, PencilLine, X } from "lucide-react";
import {
  blanksReady,
  composeBlanks,
  visibleParts,
  type BlankState,
} from "@/lib/starter-blanks";

export { blankState, blanksReady, composeBlanks, type BlankState } from "@/lib/starter-blanks";

/**
 * Fill-in-the-blanks editing for an example: each [blank] is a small inline
 * field (or can be removed), and the whole sentence can be rewritten freely.
 */
export function BlankFiller({
  state,
  label,
  maxLength = 400,
  onChange,
}: {
  state: BlankState;
  /** Names the example for assistive technology, such as "Example 1". */
  label: string;
  /** Longest text allowed when editing the whole sentence. */
  maxLength?: number;
  onChange: (next: BlankState) => void;
}) {
  const all = visibleParts(state);
  const blanks = all.filter((part): part is { blank: string; index: number } => "blank" in part);
  const done = blanks.filter((b) => state.removed[b.index] || state.fills[b.index].trim()).length;
  const ready = blanksReady(state);
  const composed = composeBlanks(state);

  return (
    <div className="blank-filler">
      {state.free === undefined ? (
        <p className="blank-sentence">
          {all.map((part, i) =>
            "text" in part ? (
              <span key={i}>{part.text}</span>
            ) : state.removed[part.index] ? null : (
              <span key={i} className={`blank-slot${state.fills[part.index].trim() ? " filled" : ""}`}>
                <input
                  aria-label={`${label}: ${part.blank}`}
                  placeholder={part.blank}
                  value={state.fills[part.index]}
                  size={Math.max(part.blank.length, state.fills[part.index].length, 4) + 1}
                  maxLength={120}
                  onChange={(event) => {
                    const fills = [...state.fills];
                    fills[part.index] = event.target.value;
                    onChange({ ...state, fills });
                  }}
                />
                <button
                  type="button"
                  className="blank-remove"
                  aria-label={`${label}: remove ${part.blank}`}
                  title="Remove this blank"
                  onClick={() => {
                    const removed = [...state.removed];
                    removed[part.index] = true;
                    onChange({ ...state, removed });
                  }}
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
            ),
          )}
        </p>
      ) : (
        <textarea
          className="blank-free"
          aria-label={label}
          value={state.free}
          maxLength={maxLength}
          rows={Math.max(3, Math.ceil(state.free.length / 55))}
          onChange={(event) => onChange({ ...state, free: event.target.value })}
        />
      )}
      <div className="blank-filler-foot">
        <span className={`blank-progress${ready ? " ready" : ""}`} aria-live="polite">
          {ready ? (
            <>
              <Check size={14} aria-hidden /> Ready to add
            </>
          ) : state.free === undefined ? (
            `${done} of ${blanks.length} blank${blanks.length === 1 ? "" : "s"} filled`
          ) : (
            "Replace or delete every [blank] in brackets"
          )}
        </span>
        {state.free === undefined && (
          <button
            type="button"
            className="blank-edit"
            onClick={() => onChange({ ...state, free: composed })}
          >
            <PencilLine size={14} aria-hidden /> Edit the whole sentence
          </button>
        )}
      </div>
    </div>
  );
}
