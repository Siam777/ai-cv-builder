"use client";

import { useState } from "react";
import { synthesizeVerifiedXyzBullet } from "@/lib/vault/impact-coach";

export interface InlineAiMagicBarProps {
  bulletText: string;
  onApplyEdit: (newText: string) => void;
  onTriggerAction?: (
    actionType: "improve" | "metric" | "match" | "concise",
  ) => void;
  disabled?: boolean;
}

export function InlineAiMagicBar({
  bulletText,
  onApplyEdit,
  onTriggerAction,
  disabled = false,
}: InlineAiMagicBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [proposedText, setProposedText] = useState<string | null>(null);
  const [promptingMetric, setPromptingMetric] = useState(false);
  const [metricInput, setMetricInput] = useState("");

  function handleAction(type: "improve" | "metric" | "match" | "concise") {
    if (disabled) return;
    if (onTriggerAction) {
      onTriggerAction(type);
      return;
    }

    if (type === "metric") {
      setPromptingMetric(true);
      return;
    }

    // Standalone local fallback removes filler only; it never strengthens responsibility.
    if (type === "improve") {
      const enhanced = bulletText
        .replace(/\b(successfully|effectively|proactively|diligently)\s+/gi, "")
        .trim();
      setProposedText(enhanced);
    } else if (type === "concise") {
      const trimmed = bulletText
        .replace(/\b(in order to|with the goal of)\b/gi, "to")
        .replace(/\s+/g, " ")
        .trim();
      setProposedText(trimmed);
    } else if (type === "match") {
      setProposedText(bulletText);
    }
  }

  function handleMetricSubmit() {
    if (!metricInput.trim()) {
      setPromptingMetric(false);
      return;
    }
    const enhanced = synthesizeVerifiedXyzBullet(bulletText, metricInput);
    setProposedText(enhanced);
    setPromptingMetric(false);
    setMetricInput("");
  }

  function acceptProposal() {
    if (proposedText !== null) {
      onApplyEdit(proposedText);
      setProposedText(null);
      setIsOpen(false);
    }
  }

  function dismissProposal() {
    setProposedText(null);
    setPromptingMetric(false);
    setIsOpen(false);
  }

  return (
    <div
      className="inline-ai-container"
      onKeyDown={(e) => {
        if (proposedText !== null) {
          if (e.key === "Tab") {
            e.preventDefault();
            acceptProposal();
          } else if (e.key === "Escape") {
            e.preventDefault();
            dismissProposal();
          }
        }
      }}
    >
      <div className="inline-ai-trigger-row">
        <button
          type="button"
          className="inline-ai-toggle"
          disabled={disabled || !bulletText.trim()}
          onClick={() => setIsOpen((prev) => !prev)}
          title="Improve this bullet or add a result you can support"
          aria-expanded={isOpen}
        >
          Improve this bullet
        </button>

        {isOpen && (
          <div
            className="inline-ai-chips"
            role="toolbar"
            aria-label="AI bullet actions"
          >
            <button
              type="button"
              className="ai-chip"
              disabled={disabled}
              onClick={() => handleAction("improve")}
            >
              Rewrite with AI
            </button>
            <button
              type="button"
              className="ai-chip"
              disabled={disabled}
              onClick={() => handleAction("metric")}
            >
              Add a real result
            </button>
            <button
              type="button"
              className="ai-chip"
              disabled={disabled}
              onClick={() => handleAction("concise")}
            >
              Shorten with AI
            </button>
          </div>
        )}
      </div>

      {promptingMetric && (
        <div className="inline-metric-prompt">
          <label>
            <span>
              What was the measurable outcome? (e.g. 35% latency drop, $15k
              saved)
            </span>
            <input
              type="text"
              value={metricInput}
              autoFocus
              placeholder="e.g. 40% reduction in query time"
              onChange={(e) => setMetricInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleMetricSubmit();
                } else if (e.key === "Escape") {
                  setPromptingMetric(false);
                }
              }}
            />
          </label>
          <div className="inline-metric-buttons">
            <button
              type="button"
              className="primary"
              onClick={handleMetricSubmit}
            >
              Apply metric
            </button>
            <button type="button" onClick={() => setPromptingMetric(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {proposedText !== null && (
        <div
          className="inline-diff-card"
          role="region"
          aria-label="Proposed bullet rewrite"
        >
          <div className="inline-diff-content">
            <p className="diff-label">
              PROPOSED REWRITE (Press Tab to Accept, Esc to Dismiss):
            </p>
            <p className="diff-text">
              <del className="diff-del">{bulletText}</del>{" "}
              <ins className="diff-ins">{proposedText}</ins>
            </p>
          </div>
          <div className="inline-diff-actions">
            <button
              type="button"
              className="primary diff-accept"
              onClick={acceptProposal}
            >
              Accept (Tab)
            </button>
            <button
              type="button"
              className="diff-dismiss"
              onClick={dismissProposal}
            >
              Dismiss (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
