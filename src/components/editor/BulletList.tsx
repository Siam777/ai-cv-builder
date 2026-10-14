"use client";

import { useRef, useState } from "react";
import type { Bullet, SectionType } from "@/lib/document";
import { lintBullet } from "@/lib/linter/ats-linter";
import { describeFinding } from "@/lib/check-findings";
import { uid } from "@/lib/document";
import { InlineAiMagicBar } from "./InlineAiMagicBar";
import { Lightbulb, TriangleAlert, X } from "lucide-react";

export interface BulletListProps {
  bullets: Bullet[];
  /** Section the bullets belong to; it decides which checks apply. */
  sectionType?: SectionType;
  dismissed?: Set<string>;
  onChange: (bullets: Bullet[]) => void;
  disabled?: boolean;
  activeBulletId?: string | null;
  onWritingAction?: (
    bulletId: string,
    action: "improve" | "concise" | "metric",
  ) => void;
}

export function BulletList({
  bullets,
  sectionType = "experience",
  dismissed,
  onChange,
  disabled = false,
  activeBulletId,
  onWritingAction,
}: BulletListProps) {
  const inputRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(
    new Map(),
  );
  // Hints wait until the person leaves a bullet, so typing is not interrupted.
  const [editingId, setEditingId] = useState<string | null>(null);

  function updateBulletText(bulletId: string, text: string) {
    onChange(bullets.map((b) => (b.id === bulletId ? { ...b, text } : b)));
  }

  function removeBullet(bulletIndex: number) {
    const toRemove = bullets[bulletIndex];
    if (!toRemove) return;
    const nextBullets = bullets.filter((_, i) => i !== bulletIndex);
    onChange(nextBullets);

    // Focus previous or next bullet
    const targetIndex = Math.max(0, bulletIndex - 1);
    const targetBullet = nextBullets[targetIndex];
    if (targetBullet) {
      setTimeout(() => {
        inputRefs.current.get(targetBullet.id)?.focus();
      }, 10);
    }
  }

  function addBulletBelow(bulletIndex: number) {
    if (bullets.length >= 100) return;
    const newBullet: Bullet = { id: uid(), text: "" };
    const nextBullets = [...bullets];
    nextBullets.splice(bulletIndex + 1, 0, newBullet);
    onChange(nextBullets);

    // Focus new bullet
    setTimeout(() => {
      inputRefs.current.get(newBullet.id)?.focus();
    }, 10);
  }

  function moveBullet(index: number, delta: number) {
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= bullets.length) return;
    const nextBullets = [...bullets];
    const [moved] = nextBullets.splice(index, 1);
    nextBullets.splice(targetIndex, 0, moved);
    onChange(nextBullets);

    setTimeout(() => {
      inputRefs.current.get(moved.id)?.focus();
    }, 10);
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    bullet: Bullet,
    index: number,
  ) {
    const target = e.currentTarget;

    // Alt + ArrowUp / ArrowDown for reordering
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      moveBullet(index, -1);
      return;
    }
    if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      moveBullet(index, 1);
      return;
    }

    // Enter to insert new bullet below
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addBulletBelow(index);
      return;
    }

    // Backspace on empty bullet to delete and focus previous
    if (e.key === "Backspace" && bullet.text === "") {
      e.preventDefault();
      removeBullet(index);
      return;
    }

    // Arrow navigation across bullet boundaries
    if (
      e.key === "ArrowUp" &&
      target.selectionStart === 0 &&
      target.selectionEnd === 0 &&
      index > 0
    ) {
      e.preventDefault();
      const prevBullet = bullets[index - 1];
      if (prevBullet) {
        const prevInput = inputRefs.current.get(prevBullet.id);
        if (prevInput) {
          prevInput.focus();
          const len = prevInput.value.length;
          prevInput.setSelectionRange(len, len);
        }
      }
      return;
    }

    if (
      e.key === "ArrowDown" &&
      target.selectionStart === target.value.length &&
      target.selectionEnd === target.value.length &&
      index < bullets.length - 1
    ) {
      e.preventDefault();
      const nextBullet = bullets[index + 1];
      if (nextBullet) {
        const nextInput = inputRefs.current.get(nextBullet.id);
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(0, 0);
        }
      }
      return;
    }
  }

  return (
    <div className="bullet-list-flow">
      {bullets.map((bullet, bi) => {
        const isActive = activeBulletId === bullet.id;
        const hints =
          editingId === bullet.id
            ? []
            : lintBullet(bullet.text, sectionType, { bulletId: bullet.id })
                .issues.filter((issue) => !dismissed?.has(issue.id))
                .map((issue) => ({ id: issue.id, ...describeFinding(issue) }));
        const hintId = `bullet-hints-${bullet.id}`;
        return (
          <div
            className={`bullet-field ${isActive ? "bullet-highlighted" : ""}`}
            key={bullet.id}
            data-bullet-id={bullet.id}
          >
            <div className="bullet-main-row">
              <span
                className="bullet-drag-handle"
                title="Use Alt+Up/Down to reorder, Enter for next bullet"
                aria-hidden="true"
              >
                •
              </span>
              <div className="bullet-input-wrapper">
                <label
                  htmlFor={`field-bullet-${bullet.id}`}
                  className="sr-only"
                >
                  Bullet {bi + 1}
                </label>
                <textarea
                  ref={(el) => {
                    if (el) inputRefs.current.set(bullet.id, el);
                    else inputRefs.current.delete(bullet.id);
                  }}
                  id={`field-bullet-${bullet.id}`}
                  aria-label={`Bullet ${bi + 1}`}
                  aria-describedby={hints.length ? hintId : undefined}
                  onFocus={() => setEditingId(bullet.id)}
                  onBlur={() => setEditingId(null)}
                  className="bullet-textarea"
                  disabled={disabled}
                  rows={2}
                  value={bullet.text}
                  placeholder="What did you do? Add a result if you can support it."
                  onChange={(e) => updateBulletText(bullet.id, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, bullet, bi)}
                />
              </div>
              <button
                type="button"
                className="bullet-remove-btn"
                aria-label={`Remove bullet ${bi + 1}`}
                title="Remove bullet (or Backspace when empty)"
                onClick={() => removeBullet(bi)}
                disabled={disabled}
              >
                <X size={14} aria-hidden />
              </button>
            </div>
            <InlineAiMagicBar
              bulletText={bullet.text}
              disabled={disabled}
              onApplyEdit={(newText) => updateBulletText(bullet.id, newText)}
              onTriggerAction={
                onWritingAction
                  ? (action) => {
                      if (action !== "match")
                        onWritingAction(bullet.id, action);
                    }
                  : undefined
              }
            />
            {/* Below the AI bar, so hints appearing on blur never move a button being clicked. */}
            {hints.length > 0 && (
              <ul className="field-hints" id={hintId}>
                {hints.map((hint) => (
                  <li key={hint.id} className={hint.tone}>
                    {hint.tone === "attention" ? (
                      <TriangleAlert size={14} aria-hidden />
                    ) : (
                      <Lightbulb size={14} aria-hidden />
                    )}
                    {hint.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="add-bullet-action-btn"
        disabled={disabled || bullets.length >= 100}
        onClick={() => {
          onChange([...bullets, { id: uid(), text: "" }]);
          setTimeout(() => {
            const inputs = Array.from(inputRefs.current.values());
            const last = inputs[inputs.length - 1];
            last?.focus();
          }, 10);
        }}
      >
        + Add accomplishment bullet
      </button>
    </div>
  );
}
