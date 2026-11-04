"use client";
import { useEffect, useRef, useState } from "react";
import { MATCH_REQUIREMENT_MAX, type RequirementKind } from "@/lib/job-read";
import {
  moveToKind,
  moveWithinKind,
  ordered,
  usedForMatching,
} from "@/lib/job-draft";

export interface EditableRequirement {
  id: string;
  text: string;
  kind: RequirementKind;
  quote: string;
  paraphrased?: boolean;
}
const GROUPS: { kind: RequirementKind; label: string }[] = [
  { kind: "must", label: "Must have" },
  { kind: "nice", label: "Nice to have" },
  { kind: "unstated", label: "Not stated" },
];

/**
 * Must have / Nice to have / Not stated lists. Every action is a button, so
 * reordering and moving work by keyboard; focus stays on the moved item.
 * The first 15 (must haves first) are marked "Used for matching".
 */
export function RequirementsEditor<T extends EditableRequirement>({
  items,
  onChange,
  disabled,
  idPrefix,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const [focus, setFocus] = useState<{ id: string; action: string } | null>(
    null,
  );
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focus || !root.current) return;
    const row = root.current.querySelector<HTMLElement>(
      `[data-req="${CSS.escape(focus.id)}"]`,
    );
    const target =
      row?.querySelector<HTMLButtonElement>(
        `[data-action="${focus.action}"]:not(:disabled)`,
      ) ?? row?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    target?.focus();
    setFocus(null);
  }, [focus, items]);

  const list = ordered(items);
  const used = usedForMatching(list);
  const kept = list.filter((row) => row.kind !== "unstated").length;
  const update = (next: T[], id: string, action: string) => {
    onChange(next);
    setFocus({ id, action });
  };
  return (
    <div className="requirements-editor" ref={root}>
      <p className="tracker-muted" id={`${idPrefix}-count`}>
        {list.length === 0
          ? "No requirements yet. Read the post to list them."
          : `${list.length} requirement${list.length === 1 ? "" : "s"}. The first ${MATCH_REQUIREMENT_MAX} (must haves first, in this order) are used for matching${kept > MATCH_REQUIREMENT_MAX ? `; the other ${kept - MATCH_REQUIREMENT_MAX} stay on the application` : ""}.`}
      </p>
      {GROUPS.map((group) => {
        const rows = list.filter((row) => row.kind === group.kind);
        if (group.kind === "unstated" && rows.length === 0) return null;
        return (
          <section
            key={group.kind}
            className={`requirements-group ${group.kind}`}
            aria-labelledby={`${idPrefix}-${group.kind}`}
          >
            <h4 id={`${idPrefix}-${group.kind}`}>
              {group.label} <span className="tracker-count">{rows.length}</span>
            </h4>
            {group.kind === "unstated" && (
              <p className="tracker-muted">
                The post does not say whether these are required. Choose Must
                have or Nice to have, or remove them.
              </p>
            )}
            {rows.length === 0 ? (
              <p className="tracker-muted">None.</p>
            ) : (
              <ol className="requirements-list">
                {rows.map((row, index) => {
                  const label =
                    row.text.length > 60
                      ? `${row.text.slice(0, 57)}…`
                      : row.text;
                  return (
                    <li key={row.id} data-req={row.id}>
                      <div className="requirement-text">
                        <span>{row.text}</span>
                        {used.has(row.id) && (
                          <span className="used-badge">Used for matching</span>
                        )}
                        {row.quote &&
                          (row.paraphrased || row.quote !== row.text) && (
                            <span className="field-quote">
                              From the post: “{row.quote}”
                            </span>
                          )}
                      </div>
                      <div
                        className="requirement-actions"
                        role="group"
                        aria-label={`Actions for ${label}`}
                      >
                        <button
                          type="button"
                          data-action="up"
                          disabled={disabled || index === 0}
                          aria-label={`Move “${label}” up`}
                          onClick={() =>
                            update(
                              moveWithinKind(list, row.id, -1),
                              row.id,
                              "up",
                            )
                          }
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          data-action="down"
                          disabled={disabled || index === rows.length - 1}
                          aria-label={`Move “${label}” down`}
                          onClick={() =>
                            update(
                              moveWithinKind(list, row.id, 1),
                              row.id,
                              "down",
                            )
                          }
                        >
                          Down
                        </button>
                        {row.kind !== "must" && (
                          <button
                            type="button"
                            data-action="must"
                            disabled={disabled}
                            aria-label={`Move “${label}” to Must have`}
                            onClick={() =>
                              update(
                                moveToKind(list, row.id, "must" as T["kind"]),
                                row.id,
                                "nice",
                              )
                            }
                          >
                            Must have
                          </button>
                        )}
                        {row.kind !== "nice" && (
                          <button
                            type="button"
                            data-action="nice"
                            disabled={disabled}
                            aria-label={`Move “${label}” to Nice to have`}
                            onClick={() =>
                              update(
                                moveToKind(list, row.id, "nice" as T["kind"]),
                                row.id,
                                "must",
                              )
                            }
                          >
                            Nice to have
                          </button>
                        )}
                        <button
                          type="button"
                          data-action="remove"
                          disabled={disabled}
                          aria-label={`Remove “${label}”`}
                          onClick={() => {
                            const next = list.filter(
                              (item) => item.id !== row.id,
                            );
                            const neighbour =
                              list[list.indexOf(row) + 1] ??
                              list[list.indexOf(row) - 1];
                            onChange(next);
                            if (neighbour)
                              setFocus({ id: neighbour.id, action: "remove" });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
