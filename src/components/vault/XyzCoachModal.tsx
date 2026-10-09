"use client";

import { useState } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import {
  analyzeBulletForImpact,
  getMetricPromptTemplates,
  synthesizeVerifiedXyzBullet,
  type MetricTemplateOption,
} from "@/lib/vault/impact-coach";

export interface XyzCoachModalProps {
  initialBulletText: string;
  onApply: (newText: string) => void;
  onClose: () => void;
}

export function XyzCoachModal({
  initialBulletText,
  onApply,
  onClose,
}: XyzCoachModalProps) {
  useBodyScrollLock(true);
  const [metricInput, setMetricInput] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("latency");

  const templates = getMetricPromptTemplates();
  const analysis = analyzeBulletForImpact(initialBulletText);
  const synthesized = metricInput.trim()
    ? synthesizeVerifiedXyzBullet(initialBulletText, metricInput)
    : "";

  function handleSelectTemplate(tpl: MetricTemplateOption) {
    setSelectedTemplate(tpl.id);
    if (!metricInput) {
      setMetricInput(tpl.placeholder.replace(/^e\.g\.,?\s*/, ""));
    }
  }

  return (
    <div className="modal-backdrop no-print" role="dialog" aria-label="Google XYZ Impact Coach">
      <div className="modal-card xyz-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">GOOGLE XYZ IMPACT FORMULA</p>
            <h2>Accomplished [X], as measured by [Y], by doing [Z]</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </header>

        <div className="xyz-body">
          <div className="original-bullet-card">
            <span className="card-label">Current Bullet:</span>
            <p className="bullet-text">“{initialBulletText}”</p>
            <div className="score-row">
              <span className={`score-badge ${analysis.score >= 80 ? "good" : "warn"}`}>
                Impact Score: {analysis.score}/100
              </span>
              {analysis.isPassive && <span className="chip warn">Passive Opener</span>}
              {analysis.hasActionVerb && <span className="chip good">Strong Action Verb</span>}
              {analysis.hasMetric ? (
                <span className="chip good">Metric Present</span>
              ) : (
                <span className="chip warn">Missing Quantifiable Metric [Y]</span>
              )}
            </div>
            <p className="feedback-text">{analysis.feedback}</p>
          </div>

          <div className="metric-elicitation">
            <h4>Select a metric category to quantify your impact:</h4>
            <div className="template-pills">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`template-pill ${selectedTemplate === tpl.id ? "active" : ""}`}
                  onClick={() => handleSelectTemplate(tpl)}
                >
                  {tpl.label}
                </button>
              ))}
            </div>

            <label className="metric-input-label">
              Your verified metric or outcome [Y]:
              <input
                type="text"
                value={metricInput}
                placeholder="e.g. cutting query latency by 55%, or saving $12k/mo in compute"
                onChange={(e) => setMetricInput(e.target.value)}
              />
            </label>
            <p className="hint">
              🔒 <strong>Strict Invariant:</strong> Only enter real numbers from your work. Never
              guess or fabricate metrics.
            </p>
          </div>

          {synthesized && (
            <div className="synthesized-preview-card">
              <span className="card-label">High-Impact Google XYZ Preview:</span>
              <p className="synthesized-text">{synthesized}</p>
            </div>
          )}
        </div>

        <div className="button-row">
          <button
            type="button"
            className="primary"
            disabled={!metricInput.trim()}
            onClick={() => {
              onApply(synthesized || initialBulletText);
              onClose();
            }}
          >
            Apply Verified XYZ Bullet <span>↗</span>
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
