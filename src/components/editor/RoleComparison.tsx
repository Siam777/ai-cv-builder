"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResumeDocument } from "@/lib/document";
import {
  ROLE_BENCHMARKS,
  analyzeResumeForRole,
  detectAppliedRoleFromDocument,
} from "@/lib/linter/role-analyzer";

/** Compare visible CV terms with a curated role checklist the person confirms. */
export function RoleComparison({ doc }: { doc: ResumeDocument }) {
  const suggestedRole = useMemo(
    () => detectAppliedRoleFromDocument(doc),
    [doc],
  );
  const [selectedRoleId, setSelectedRoleId] = useState(suggestedRole.roleId);
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  useEffect(() => {
    setSelectedRoleId(suggestedRole.roleId);
    setRoleConfirmed(false);
  }, [doc.id, suggestedRole.roleId]);
  const role = useMemo(
    () => analyzeResumeForRole(doc, selectedRoleId),
    [doc, selectedRoleId],
  );
  function selectRole(id: string) {
    setSelectedRoleId(id);
    setRoleConfirmed(false);
  }

  return (
    <div className="role-analyzer-stage">
      <div className="applied-role-banner">
        <div className="applied-role-info">
          <span className="applied-role-badge">
            Suggested checklist · {suggestedRole.source}
          </span>
          <strong className="applied-role-name">
            {suggestedRole.detectedHeadline}
          </strong>
          <span className="applied-role-meta">
            Confirm a checklist relevant to your application.
            Unsupported roles receive a general content review.
          </span>
        </div>
      </div>
      <div className="role-selector-bar">
        <div className="role-selector-group">
          <label htmlFor="target-role-select">Role checklist</label>
          <select
            id="target-role-select"
            value={selectedRoleId}
            onChange={(e) => selectRole(e.target.value)}
            className="role-dropdown"
          >
            <option value="general">General content review</option>
            {Object.values(ROLE_BENCHMARKS).map((bench) => (
              <option key={bench.id} value={bench.id}>
                {bench.title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={`role-chip-btn applied-chip ${selectedRoleId === suggestedRole.roleId ? "active" : ""}`}
          onClick={() => selectRole(suggestedRole.roleId)}
        >
          Suggested: {suggestedRole.roleTitle}
        </button>
      </div>
      {!roleConfirmed ? (
        <div className="role-section-card">
          <p>
            This is a curated term checklist, not a job description or a
            validated market benchmark.
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => setRoleConfirmed(true)}
          >
            Review selected checklist
          </button>
        </div>
      ) : role.status === "general" ? (
        <div className="role-section-card">
          <h3>General content review</h3>
          <p>
            No role-specific checklist is available for this selection.
            Use writing findings or paste the actual job description in
            the public reviewer.
          </p>
        </div>
      ) : (
        <>
          <div className="role-section-card">
            <div className="role-section-head">
              <h3>{role.roleTitle} · Term observations</h3>
            </div>
            <p className="helper-text">
              Literal terms or listed aliases found in visible content:{" "}
              {role.matchedCompetencies.length}/
              {role.matchedCompetencies.length +
                role.missingCompetencies.length}
              . Term presence does not demonstrate proficiency.
            </p>
            <h4>Terms found</h4>
            <div className="skills-pill-cloud">
              {role.matchedCompetencies.map((term) => (
                <span key={term} className="skill-pill matched">
                  {term}
                </span>
              ))}
            </div>
            {role.matchedCompetencies.length === 0 && (
              <p>No checklist terms found.</p>
            )}
            <h4>Terms not found</h4>
            <div className="skills-pill-cloud">
              {role.missingCompetencies.map((term) => (
                <span key={term} className="skill-pill missing">
                  {term}
                </span>
              ))}
            </div>
            <p className="helper-text">
              Only add a skill in the editor if your own experience
              supports it. An absent term does not establish a skill gap
              or a job requirement.
            </p>
          </div>
          <div className="role-section-card">
            <div className="role-section-head">
              <h3>Role numeric patterns</h3>
            </div>
            <p className="helper-text">
              Regex observations in visible experience and project
              descriptions and bullets. Values and achievements have not
              been verified.
            </p>
            {role.matchedMetricTypes.map((name) => (
              <div key={name} className="metric-benchmark-item matched">
                <strong>{name}</strong>
                <span className="matched-note">Pattern found</span>
              </div>
            ))}
            {role.missingMetricTypes.map((metric) => (
              <div
                key={metric.name}
                className="metric-benchmark-item missing"
              >
                <strong>{metric.name} · Pattern not found</strong>
                <p>{metric.description}</p>
                <div className="metric-example-box">
                  <span className="example-label">
                    Fictional wording example
                  </span>
                  <p>{metric.example}</p>
                  <small>
                    Use only your own supported outcomes. A qualitative
                    result can be appropriate.
                  </small>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
