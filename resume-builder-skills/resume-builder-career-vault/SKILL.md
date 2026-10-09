---
name: resume-builder-career-vault
description: Implement the Master Career Vault, job description requirement extraction, evidence matching engine, targeted resume variant generation, and the Google XYZ Impact Coach. Use for candidate vault management and automated job-tailoring systems.
---

# Master Career Vault and Job Tailoring

Inspect the existing document schema ([document.ts](file:///D:/utility-projects/ai-cv-builder/src/lib/document.ts)) and database tables ([schema.ts](file:///D:/utility-projects/ai-cv-builder/src/lib/server/schema.ts)) before implementing vault storage or tailoring engines. Read [vault-and-tailoring.md](references/vault-and-tailoring.md) for data schemas, job parsing contracts, evidence matching algorithms, and prompt templates.

## Master Career Vault architecture

The Master Career Vault represents the candidate's single immutable source of truth:
1. Store a comprehensive, uncompressed record of the candidate's career:
   - 10–20 detailed bullets per role (including secondary projects and internal initiatives).
   - Full technical skills inventory categorized by proficiency and domain.
   - Verified metrics, project links, patents, and certifications.
2. Maintain strict separation between Vault records and Resume variants:
   - The Vault is never submitted directly; it acts as the reservoir.
   - Individual resumes are named, lightweight projection variants that select and order subsets of vault items.
   - Editing a bullet in a specific resume variant must prompt the user whether to update the Master Vault or keep the change variant-specific.

## Job description parsing

When a user provides a job posting (via pasted text or URL text extract):
1. Extract structured criteria using a dedicated extraction prompt:
   - **Hard requirements** (must-haves): Minimum years of experience, specific programming languages, core frameworks, required degrees/certifications.
   - **Preferred qualifications** (nice-to-haves): Secondary tools, domain knowledge, bonus cloud platforms.
   - **Key responsibilities & soft signals**: Architecture ownership, mentoring, cross-functional collaboration.
2. Normalize technical terms using a versioned synonym dictionary (e.g. `K8s` -> `Kubernetes`, `Postgres` -> `PostgreSQL`, `React.js` -> `React`).

## Evidence matching engine and gap analysis

Compare parsed job requirements against the candidate's Master Career Vault:
1. **Calculate Heuristic Requirement Coverage**:
   - Match hard requirements and preferred qualifications against vault bullets, skills, and certifications.
   - Compute a transparent percentage score: weighted match divided by total scorable requirements.
   - Never represent this score as a probability of interview or hiring outcome.
2. **Deterministic Gap Analysis**:
   - Clearly separate **Matched Evidence** (with pointers to specific candidate bullets) from **Skill Gaps**.
   - **Anti-Hallucination Invariant**: Missing requirements must NEVER be converted into candidate skills or inserted into bullets as factual claims.
   - Present missing skills as actionable user choices: *"Do you have unlisted experience with AWS? If so, enter a bullet; otherwise, we'll keep this as an acknowledged gap."*

## 1-Click targeted variant generation

Derive a targeted resume variant in under 30 seconds:
1. Filter the candidate's master bullets for each role, selecting the top 3–5 bullets with the highest heuristic relevance to the target job description.
2. Order skills sections so that matching hard requirements appear first.
3. Name the resulting variant predictably (e.g., `Senior SWE - Stripe (Targeted)`).
4. Save the variant as an independent document in local or cloud storage, preserving the original resume and master vault unmodified.

## Evidence-grounded tailored cover letter generation

Produce a tailored 3-to-4 paragraph cover letter matched directly to a target job description:
1. Ground every claim, past project, and metric strictly in the candidate's verified resume/vault history (Anti-Hallucination Invariant).
2. Construct opening, body achievements with metrics, skill alignment, and professional call-to-action.
3. Provide editable review and 1-click export to plain text (.txt) and Markdown (.md).

## Google XYZ Impact Coach

Detect and reinforce high-impact bullet phrasing:
1. Evaluate bullets against the Google XYZ formula: *"Accomplished [X], as measured by [Y], by doing [Z]"*.
2. Flag bullets that state an action [Z] without stating measurable impact or outcome [Y].
3. Interactively prompt the user for real metrics: *"You mentioned optimizing database queries. What was the measurable result? (e.g., reduced P99 latency from 450ms to 85ms, or saved $12k/mo in compute)."*
4. Re-synthesize the bullet using only user-supplied verified metrics.

## Verification and testing

Validate vault and tailoring implementations with rigorous tests:
- Synthetic evaluation tests: Ensure missing job requirements are never hallucinated into candidate experience.
- Matching algorithm tests: Assert correct coverage calculation across varying requirement counts and synonym variants.
- Isolation tests: Verify modifying a tailored resume does not corrupt or overwrite master vault entries.
- XYZ Coach tests: Assert that bullets without metrics trigger the prompt, and user-provided numbers are incorporated accurately.
