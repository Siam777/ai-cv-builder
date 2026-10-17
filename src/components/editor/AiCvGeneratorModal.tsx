"use client";

import { useState } from "react";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { ResumeDocument } from "@/lib/document";
import { ROLE_BENCHMARKS } from "@/lib/linter/role-analyzer";
import { generateAiResume } from "@/lib/vault/ai-cv-generator";
import { Check, Plus, X } from "lucide-react";

export interface AiCvGeneratorModalProps {
  currentDoc?: ResumeDocument | null;
  busy: boolean;
  onApplyResume: (doc: ResumeDocument) => void;
  onClose: () => void;
}

export function AiCvGeneratorModal({
  currentDoc,
  busy,
  onApplyResume,
  onClose,
}: AiCvGeneratorModalProps) {
  useBodyScrollLock(true);
  const dialogRef = useModalFocus(onClose);
  const [name, setName] = useState("Alex Mercer");
  const [roleId, setRoleId] = useState("software-engineer");
  const [seniority, setSeniority] = useState<"junior" | "mid" | "senior" | "lead">("senior");
  const [industry, setIndustry] = useState("High-Growth SaaS & Distributed Systems");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([
    "TypeScript",
    "React",
    "Node.js",
    "PostgreSQL",
    "AWS",
    "Docker",
  ]);
  const [customSkill, setCustomSkill] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState("");

  const currentBenchmark = ROLE_BENCHMARKS[roleId] || ROLE_BENCHMARKS["software-engineer"];

  function handleRoleChange(newRoleId: string) {
    setRoleId(newRoleId);
    const bench = ROLE_BENCHMARKS[newRoleId];
    if (bench) {
      setSelectedSkills(bench.coreCompetencies.slice(0, 6));
    }
  }

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  function handleAddCustomSkill() {
    if (!customSkill.trim()) return;
    if (!selectedSkills.includes(customSkill.trim())) {
      setSelectedSkills([...selectedSkills, customSkill.trim()]);
    }
    setCustomSkill("");
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setGenStep("Preparing fictional practice content…");

    const generated = generateAiResume({
      name,
      roleId,
      seniority,
      keySkills: selectedSkills,
      industry,
      location: "San Francisco, CA",
      email: "alex.mercer@example.com",
      phone: "+1 (555) 382-9104",
    });

    setIsGenerating(false);
    onApplyResume(generated);
  }

  return (
    <div
      className="modal-backdrop no-print"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Create fictional practice CV"
    >
      <div className="modal-card tailor-modal" style={{ maxWidth: "800px" }}>
        <header className="modal-header">
          <div>
            <p className="library-kind">Fictional practice content</p>
            <h2>Practice CV (fictional)</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={isGenerating}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="tailor-content">
          {isGenerating ? (
            <div className="ai-gen-progress-stage" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div className="ai-gen-spinner" />
              <h3 style={{ marginTop: "20px", fontSize: "var(--text-lg)", fontWeight: 600 }}>
                Creating practice CV…
              </h3>
              <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)", marginTop: "6px" }}>
                {genStep}
              </p>
            </div>
          ) : (
            <div className="ai-gen-input-stage">
              <p className="helper-text" style={{ marginBottom: "18px" }}>
                This example generator uses fictional employers, dates, education, and achievements.
                It saves to Practice copies, separate from your personal CVs. Replace and review
                every sample fact before marking a copy as your own.
              </p>

              <div className="field-grid" style={{ marginBottom: "14px" }}>
                <label>
                  Candidate Full Name
                  <input
                    type="text"
                    value={name}
                    placeholder="e.g. Alex Mercer"
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Target Role
                  <select
                    value={roleId}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontWeight: 600,
                    }}
                  >
                    {Object.values(ROLE_BENCHMARKS).map((bench) => (
                      <option key={bench.id} value={bench.id}>
                        {bench.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Seniority Selector */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "var(--text-xs)" }}>
                  Target Seniority Level
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {(
                    [
                      { id: "junior", label: "Entry / Junior (0-2 yrs)" },
                      { id: "mid", label: "Mid-Level (3-5 yrs)" },
                      { id: "senior", label: "Senior (6-9 yrs)" },
                      { id: "lead", label: "Lead / Staff Architect (10+ yrs)" },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`role-chip-btn ${seniority === s.id ? "active" : ""}`}
                      onClick={() => setSeniority(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills Selector */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "var(--text-xs)" }}>
                  Core Technologies & Skills for {currentBenchmark.title}
                </label>
                <div className="skills-pill-cloud" style={{ marginBottom: "10px" }}>
                  {currentBenchmark.coreCompetencies.map((skill) => {
                    const active = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`skill-pill ${active ? "matched" : ""}`}
                        style={{
                          cursor: "pointer",
                          background: active ? "var(--color-brand-soft)" : "var(--gray-100)",
                          color: active ? "var(--color-brand)" : "var(--gray-600)",
                          border: active ? "1px solid var(--green-200)" : "1px solid var(--gray-300)",
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {active ? (
                          <Check size={12} aria-hidden />
                        ) : (
                          <Plus size={12} aria-hidden />
                        )}{" "}
                        {skill}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={customSkill}
                    placeholder="Add custom skill (e.g. Next.js, GCP, Spark)..."
                    onChange={(e) => setCustomSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomSkill();
                      }
                    }}
                    style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--color-border)" }}
                  />
                  <button type="button" onClick={handleAddCustomSkill} className="secondary">
                    + Add
                  </button>
                </div>
              </div>

              {/* Industry / Domain */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "var(--text-xs)" }}>
                  Primary Domain / Industry
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    "High-Growth SaaS & Distributed Systems",
                    "Fintech, Payments & Banking",
                    "Enterprise Cloud & Infrastructure",
                    "E-commerce, Retail & Consumer Tech",
                    "Healthcare, MedTech & Security",
                  ].map((ind) => (
                    <button
                      key={ind}
                      type="button"
                      className={`role-chip-btn ${industry === ind ? "active" : ""}`}
                      onClick={() => setIndustry(ind)}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {!isGenerating && (
          <div className="button-row">
            <button
              type="button"
              className="primary"
              disabled={busy || isGenerating}
              onClick={handleGenerate}
              style={{ background: "var(--color-brand)", borderColor: "var(--color-brand)" }}
            >
              Create fictional practice CV
            </button>
            <button type="button" onClick={onClose} disabled={isGenerating}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
