"use client";

import type {
  Benchmark,
  JobGapAnalysis,
  KeywordMatch,
  ResumeScore,
} from "@/lib/linter/resume-score";

function gradeTone(total: number) {
  return total >= 90 ? "excellent" : total >= 75 ? "strong" : total >= 55 ? "fair" : "low";
}

export function ScoreDial({
  value,
  label,
  caption,
  suffix = "/100",
}: {
  value: number;
  label: string;
  caption?: string;
  suffix?: string;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <div className={`score-dial tone-${gradeTone(value)}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="dial-track" cx="60" cy="60" r={radius} />
        <circle
          className="dial-fill"
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={`${filled} ${circumference}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="dial-center">
        <strong className="dial-value">
          {value}
          <small>{suffix}</small>
        </strong>
        <span className="dial-label">{label}</span>
      </div>
      {caption && <p className="dial-caption">{caption}</p>}
    </div>
  );
}

function BenchmarkRow({ item }: { item: Benchmark }) {
  // Position the value on a scale that shows the target band in context.
  const ceiling = item.unit === "%" ? 100 : item.max * 1.6;
  const position = Math.min(100, (item.value / ceiling) * 100);
  const bandStart = (item.min / ceiling) * 100;
  const bandEnd = Math.min(100, (item.max / ceiling) * 100);
  return (
    <li className={`benchmark-row is-${item.status}`}>
      <div className="benchmark-head">
        <span className="benchmark-label">{item.label}</span>
        <span className="benchmark-values">
          <strong>{item.display}</strong>
          <span>
            target {item.target}
            {item.unit === "%" ? "" : ` ${item.unit}`}
          </span>
        </span>
      </div>
      <div className="benchmark-track" aria-hidden="true">
        <span
          className="benchmark-band"
          style={{ left: `${bandStart}%`, width: `${Math.max(2, bandEnd - bandStart)}%` }}
        />
        <span className="benchmark-marker" style={{ left: `${position}%` }} />
      </div>
      {item.advice && (
        <p className="benchmark-advice">
          <span className="benchmark-status">
            {item.status === "within" ? "On target" : item.status === "below" ? "Below target" : "Above target"}
          </span>{" "}
          {item.advice}
        </p>
      )}
    </li>
  );
}

export function ResumeScoreReport({
  score,
  onFix,
  jobMatch,
}: {
  score: ResumeScore;
  /** Jump to the editor section for a fix. Omitted on public pages. */
  onFix?: (sectionType: string) => void;
  jobMatch?: number;
}) {
  return (
    <div className="score-report">
      <section className="score-hero" aria-label="Resume score">
        <ScoreDial
          value={score.total}
          label={score.grade}
          caption="Content quality from visible checks"
        />
        {jobMatch !== undefined && (
          <ScoreDial
            value={jobMatch}
            label="Job match"
            suffix="%"
            caption="Posting keywords found in your CV"
          />
        )}
        <div className="score-categories">
          {score.categories.map((cat) => {
            const pct = Math.round((cat.score / cat.max) * 100);
            return (
              <div key={cat.id} className="score-category">
                <div className="score-category-head">
                  <span>{cat.label}</span>
                  <strong>
                    {Math.round(cat.score)}
                    <small>/{cat.max}</small>
                  </strong>
                </div>
                <div className="score-bar" aria-hidden="true">
                  <span className={`tone-${gradeTone(pct)}`} style={{ width: `${pct}%` }} />
                </div>
                <p>{cat.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {score.topFixes.length > 0 && (
        <section className="score-fixes" aria-label="Fix these first">
          <h3>Fix these first</h3>
          <ol>
            {score.topFixes.map((fix) => (
              <li key={fix.label}>
                <span className="fix-points">+{Math.round(fix.points)}</span>
                <div>
                  <strong>{fix.label}</strong>
                  <p>{fix.fix}</p>
                </div>
                {onFix && fix.sectionType && (
                  <button type="button" className="fix-jump" onClick={() => onFix(fix.sectionType!)}>
                    Fix now
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="score-benchmarks" aria-label="Benchmarks">
        <h3>How you compare</h3>
        <p className="score-note">
          Targets reflect common recruiter guidance for one-to-two page resumes. They are guides, not rules: a
          career changer or academic CV can sensibly differ.
        </p>
        <ul>
          {score.benchmarks.map((item) => (
            <BenchmarkRow key={item.id} item={item} />
          ))}
        </ul>
      </section>

      <details className="score-breakdown">
        <summary>See how every point was scored</summary>
        {score.categories.map((cat) => (
          <div key={cat.id} className="score-breakdown-group">
            <h4>
              {cat.label} · {Math.round(cat.score)}/{cat.max}
            </h4>
            <ul>
              {cat.checks.map((c) => (
                <li key={c.id} className={c.earned >= c.max ? "is-pass" : "is-miss"}>
                  <span className="check-points">
                    {c.earned}/{c.max}
                  </span>
                  <div>
                    <strong>{c.label}</strong>
                    <p>{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="score-note">
          Scoring version {score.version}. The same CV always gets the same score. It reflects the written content
          only: it does not predict ATS acceptance, check the exported file layout, or verify that claims are true.
        </p>
      </details>
    </div>
  );
}

function KeywordChips({ items, tone }: { items: KeywordMatch[]; tone: "found" | "missing" | "unproven" }) {
  if (!items.length) return <p className="gap-empty">None</p>;
  return (
    <ul className={`gap-chips is-${tone}`}>
      {items.map((k) => (
        <li key={k.name}>
          {k.name}
          {k.importance === "preferred" && <small>preferred</small>}
        </li>
      ))}
    </ul>
  );
}

export function JobGapReport({ gap, title }: { gap: JobGapAnalysis; title?: string }) {
  const provenIn = gap.matched.filter((k) => !gap.unproven.includes(k));
  return (
    <section className="gap-report" aria-label="Job gap analysis">
      <div className="gap-head">
        <div>
          <h3>Gap analysis{title ? `: ${title}` : ""}</h3>
          <p className="score-note">
            Compares skills and requirements named in the posting with the words in your CV. A match is text
            overlap, not proof of a qualification.
          </p>
        </div>
        <div className="gap-summary">
          <strong>{gap.matchPercent}%</strong>
          <span>
            {gap.matched.length} of {gap.keywords.length} keywords
          </span>
        </div>
      </div>

      <div className="gap-facts">
        <div className={`gap-fact ${gap.years.meets === false ? "is-warn" : gap.years.meets ? "is-ok" : ""}`}>
          <span>Experience</span>
          <strong>
            {gap.years.required !== null
              ? `${gap.years.candidate} yrs of ${gap.years.required}+ asked`
              : `${gap.years.candidate} yrs dated`}
          </strong>
        </div>
        <div className={`gap-fact ${gap.education.found === false ? "is-warn" : gap.education.found ? "is-ok" : ""}`}>
          <span>Education</span>
          <strong>
            {gap.education.required
              ? gap.education.found
                ? "Degree listed"
                : "Degree asked, none listed"
              : "Not specified"}
          </strong>
        </div>
        <div className={`gap-fact ${gap.missing.some((k) => k.importance === "required") ? "is-warn" : "is-ok"}`}>
          <span>Required skills missing</span>
          <strong>{gap.missing.filter((k) => k.importance === "required").length}</strong>
        </div>
      </div>

      <div className="gap-columns">
        <div>
          <h4>Missing from your CV</h4>
          <KeywordChips items={gap.missing} tone="missing" />
        </div>
        <div>
          <h4>Listed but not shown in a bullet</h4>
          <KeywordChips items={gap.unproven} tone="unproven" />
        </div>
        <div>
          <h4>Shown in your experience</h4>
          <KeywordChips items={provenIn} tone="found" />
        </div>
      </div>

      <div className="gap-steps">
        <h4>What to do next</h4>
        <ol>
          {gap.nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="score-note">Only add skills and experience you actually have.</p>
      </div>
    </section>
  );
}
