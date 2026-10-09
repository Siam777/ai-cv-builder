"use client";

import { useState } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { ResumeDocument } from "@/lib/document";
import { ROLE_BENCHMARKS } from "@/lib/linter/role-analyzer";
import { generateAiResume } from "@/lib/vault/ai-cv-generator";

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
  const [name, setName] = useState(currentDoc?.contact.name || "Alex Mercer");
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
    setGenStep("Analyzing role competency benchmarks…");
    await new Promise((r) => setTimeout(r, 350));

    setGenStep("Drafting Google XYZ accomplishment bullets with quantified metrics…");
    await new Promise((r) => setTimeout(r, 450));

    setGenStep("Structuring ATS-optimized linear hierarchy…");
    await new Promise((r) => setTimeout(r, 300));

    const generated = generateAiResume({
      name,
      roleId,
      seniority,
      keySkills: selectedSkills,
      industry,
      location: currentDoc?.contact.location || "San Francisco, CA",
      email: currentDoc?.contact.email || `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      phone: currentDoc?.contact.phone || "+1 (555) 382-9104",
      website: currentDoc?.contact.website,
    });

    setIsGenerating(false);
    onApplyResume(generated);
  }

  return (
    <div
      className="modal-backdrop no-print"
      role="dialog"
      aria-label="Generate CV with AI"
    >
      <div className="modal-card tailor-modal" style={{ maxWidth: "800px" }}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">AI RESUME STUDIO · 1-CLICK GENERATOR</p>
            <h2>Generate a Grounded, High-Impact CV with AI</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={isGenerating}
          >
            ✕
          </button>
        </header>

        <div className="tailor-content">
          {isGenerating ? (
            <div className="ai-gen-progress-stage" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div className="ai-gen-spinner" />
              <h3 style={{ marginTop: "20px", fontSize: "18px", fontWeight: 600 }}>
                Generating Tailored Resume…
              </h3>
              <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "6px" }}>
                {genStep}
              </p>
            </div>
          ) : (
            <div className="ai-gen-input-stage">
              <p className="helper-text" style={{ marginBottom: "18px" }}>
                Select your target market role and seniority. Our AI engine generates a complete,
                professional draft featuring strong active verbs, verified Google XYZ accomplishment
                formulas, and clean ATS formatting.
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
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--foreground)",
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
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "12px", textTransform: "uppercase" }}>
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
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "12px", textTransform: "uppercase" }}>
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
                          background: active ? "#ecfdf5" : "#f1f5f9",
                          color: active ? "#065f46" : "#475569",
                          border: active ? "1px solid #a7f3d0" : "1px solid #cbd5e1",
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {active ? "✓ " : "+ "}
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
                    style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)" }}
                  />
                  <button type="button" onClick={handleAddCustomSkill} className="secondary">
                    + Add
                  </button>
                </div>
              </div>

              {/* Industry / Domain */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "12px", textTransform: "uppercase" }}>
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
              style={{ background: "#059669", borderColor: "#059669" }}
            >
              ⚡ Generate Full AI Resume Draft
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
