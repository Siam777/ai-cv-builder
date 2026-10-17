# Career platform proposal: feature and plan analysis — 2026-10-17

Source: `docs/Resume Builder.docx` (future-direction proposal: "AI Career Copilot — one profile, every opportunity"). This document compares that proposal with what is built today (PLAN.md, FEATURE-PLAN.md, `src/`) and recommends an order. It is analysis only: nothing here changes release scope in FEATURE-PLAN.md until it is accepted and synchronized there.

## 1. Summary

- The proposal's Phase 1 (core builder) and most of its Phase 2 (job application intelligence) **already exist locally**: job-post matching, Tailor with AI, ATS/actual-file checks, cover letters, the AI interview start, notes → bullets and evidence-grounded AI with no invented facts.
- The proposal's own top three picks are tailoring (built), Achievement Discovery (mostly built) and the **Application Outcome Learning Loop (not built, and it depends on an application tracker that does not exist)**.
- The biggest real gaps are the **job-search workflow** (application tracker, outcome loop, interview practice) and **career growth** (skills gap roadmap, career switch, portfolio). These are what turn a one-off CV tool into something used every time someone applies, which matches the proposal's monetization advice.
- None of this should start before the open release gate: the live AI evaluation (`npm run ai:eval -- --save`) and production validation (live OAuth/email, Stripe, deployment). New features on an unverified AI layer multiply the evaluation work.

## 2. Feature-by-feature status

Status key: **Built** = implemented locally (still subject to the open live/production checks) · **Partial** = foundation exists, named gap remains · **New** = not started.

### Core proposals (1–6)

| # | Proposal | Status | What exists | Gap |
|---|---|---|---|---|
| 1 | AI Job Match Simulator | **Built** | Match a job post with AI, evidence-based job coverage, gap lines, criterion coaching, saved job-review history (`src/components/vault/AiJobMatch.tsx`, `JobCriterionCoach.tsx`, `JobReviewHistory.tsx`, `/api/ai/job-match`, `/api/ai/gap-line`). No fixed ATS percentage. | Job **URL** input (paste only today). A clearer split of "skills / experience / qualifications / certifications" in the breakdown. |
| 2 | One-click job-specific CV | **Partial** | Tailor with AI (`/api/ai/tailor`, `JobTailorModal.tsx`), named variants, vault model (`src/lib/vault/vault-model.ts`), exports in PDF/DOCX. | The **persistent Master Career Vault** is still follow-on scope; tailoring works from the open CV rather than one master profile feeding many variants. |
| 3 | Achievement Discovery Engine | **Mostly built** | AI interview start (`/api/ai/interview`, `interview-step`), notes → bullets, XYZ impact coach, Fix with AI, the new-number and support checks that refuse invented metrics. | Targeted **follow-up questions per weak bullet** ("how many people? what changed?") rather than a whole-CV interview. |
| 4 | ATS & Recruiter Readiness Lab | **Built** | Actual-file diagnostics (`/api/diagnostics`, `FileDiagnostics.tsx`), plain-text stream inspector, heuristic linter (`src/lib/linter/ats-linter.ts`), public `/grader`, honest "ATS systems differ" wording. | DOCX/OCR import is still follow-on. Small: surface readability/"unnecessary content" findings more clearly. |
| 5 | Career Gap & Growth Planner | **New** | Role analyzer (`src/lib/linter/role-analyzer.ts`) and skills taxonomy are reusable pieces. | Role requirement data, roadmap UI, 30/60/90-day plan, progress evidence feeding back into the profile. |
| 6 | Smart Job Application CRM | **New** | Job-review history and version snapshots could link to applications. | Everything: jobs, stages, reminders, contacts, notes, "exact CV and cover letter sent". |

### Stand-out proposals (7–11)

| # | Proposal | Status | Notes |
|---|---|---|---|
| 7 | CV-to-Interview AI Coach | **New** | The existing "AI interview" builds the CV; it is not interview practice. Can reuse job-match evidence and the claims/support-check pattern from Ask the AI. Typed answers first; speech later (cost and privacy). |
| 8 | Proof-of-Work Portfolio | **New** | Needs **public sharing**, which FEATURE-PLAN.md defers until an access policy exists. Projects section and Portfolio template are a start. |
| 9 | Career Switch Translator | **New** | Fits best as a **mode of Match a job / Tailor** ("I'm moving from X to Y") using the same evidence rules and follow-up questions where evidence is missing. |
| 10 | Global CV Localization | **Partial** | RTL/multilingual template engine exists (PLAN.md §27). Country conventions, local spelling and per-country personal-detail guidance do not. Language-specific analysis is follow-on scope. Country guidance needs a maintained source. |
| 11 | Personal Career Agent | **Partial (seed)** | Ask the AI answers about the open CV and opens existing tools. A real agent needs preferences (roles, location, salary), the tracker, and memory. Job-board integrations and auto-apply are **out of scope** per FEATURE-PLAN.md ("no generic one-click ATS submission"). |

### Combined workflows (A–C)

| | Proposal | Status | Notes |
|---|---|---|---|
| A | Application Outcome Learning Loop | **New, blocked by #6** | Needs applications linked to CV version, job post, cover letter and outcome. Insights must say when samples are too small. |
| B | CV Truth & Consistency Checker | **Partial** | Linter already checks date consistency; AI features verify each claim against evidence. Missing: one whole-CV pass (contradictory dates, overlapping roles, inconsistent titles, duplicate claims, skills with no supporting bullet, metrics never confirmed) with **review and approve each flag before export**. Mostly deterministic, so cheap to run. |
| C | Recruiter Perspective Simulator | **New** | Overlaps job coaching. Could be a view on Match a job (recruiter / hiring manager / specialist). Must be labelled as simulated feedback, never a hiring prediction. |

### Proposal's roadmap vs. today

| Proposal phase | Item | Today |
|---|---|---|
| 1 Core | Guided questionnaire | Built (AI interview start, first-draft guide) |
| | Upload and parse CVs | Built for text, text PDF, LinkedIn CSV/ZIP, JSON; DOCX/OCR follow-on |
| | Editable master career profile | Partial (vault model; persistent vault follow-on) |
| | Templates and live preview | Built (12 designs) |
| | PDF and DOCX export | Built (6 formats; Word gate open) |
| | AI writing and achievements | Built |
| 2 Job intelligence | Job matching, tailored CV, ATS checks, cover letter | Built |
| | Application tracker | **New** |
| | Truth & consistency checker | **Partial** |
| 3 Growth | Interview coach, career switch, portfolio, skills gap, agent, outcome learning | **New** (Ask the AI is a seed for the agent) |

## 3. Monetization comparison

| Proposal tier | Proposed content | Decided today (2026-10-16) |
|---|---|---|
| Free | One CV, basic templates, limited AI | Free $0, 5 AI requests/day |
| Pro | Multiple CVs, tailoring, advanced templates, cover letters | Go $9.99, 50/day, job matching and more |
| Career Plus | Interview practice, roadmap, portfolio, insights | — |
| Career Coach | Higher limits, multiple target roles/profiles | Pro $29.99, 200/day |

Recommendation: keep the three decided tiers. Put new workflow features (tracker basics on Free; interview practice, outcome insights, roadmap on Go/Pro) inside them rather than adding tiers before those features exist and willingness to pay is measured. The proposal's own advice (keep basic CV creation free, charge for the ongoing job-search workflow) supports making the **basic tracker free**, because it brings people back on every application.

## 4. Recommended order

**Gate 0 — finish what is built (before any new feature).** Live AI evaluation for Phases A–E, Stripe live check, live OAuth/email, deployment, AI views at phone width and with accessibility checks. Close the PLAN.md §39 "Still open" list.

**Step 1 — CV Truth & Consistency Checker (B).** Small, mostly deterministic, extends the linter and Check my CV panel, and makes "we never fabricate" visible. Low AI cost.

**Step 2 — Application tracker (6), basic version.** Jobs, stages (Applied → Assessment → Interview → Offer/Rejected), dates, notes, contacts, reminders, and a **frozen copy of the exact CV and cover letter sent** (reuse snapshots). No AI needed. This unblocks A, 7 and 11 and adds the return visits the proposal wants.

**Step 3 — Interview practice from CV + job post (7), typed answers.** Reuses job-match evidence and the claims/support-check pattern. Flags CV claims the person may struggle to back up.

**Step 4 — Career switch mode (9) and per-bullet follow-up questions (3).** Both extend existing matching and writing flows instead of adding new surfaces.

**Step 5 — Outcome insights (A).** Only after the tracker holds real data; show counts and "too few applications to tell" rather than percentages on small samples.

**Later, each with its own plan:** persistent Master Career Vault (2), skills gap roadmap (5), recruiter perspectives (C), portfolio pages (8, needs a public sharing policy), country localization (10), career agent (11), job URL import (needs fetch safety and site-terms review), speech practice.

## 5. Risks and rules to carry over

- **No invented facts** applies to every new AI feature: evidence IDs, new-number check, independent support check, review before apply (existing `resume-builder-ai` rules).
- **No guarantees:** no "pass every ATS", no interview or hiring predictions; simulated feedback is labelled as such.
- **Small samples:** outcome insights must state sample size and uncertainty.
- **Job URLs:** server-side fetching needs SSRF protection and respect for job-board terms; paste stays the default.
- **Sensitive data:** salary expectations, recruiter contacts and interview recordings need retention, export and deletion rules in the privacy page and account export before launch.
- **External actions:** no submitting applications or contacting recruiters without explicit per-action approval; no unverified job-board integrations.
- **Changing knowledge:** certifications, role requirements and country conventions go out of date; each needs a named source and a review date.
- **Evaluation cost:** each new AI feature adds live evaluation cases and per-action cost to `npm run ai:eval`.

## 6. Decisions

- **Accepted 2026-10-17:** the order Gate 0 → CV truth and consistency check → basic application tracker → interview practice. Recorded in FEATURE-PLAN.md ("Career workflow roadmap"), its distribution copy and the `resume-builder-skills.zip` entry.
- **Still open:** whether the basic application tracker is free; whether the persistent Master Career Vault moves into the next release.
- **Detailed plans (2026-10-17):** [step 1, consistency check](2026-10-17-cv-consistency-check-plan.md) · [step 2, application tracker](2026-10-17-application-tracker-plan.md) · [step 3, interview practice](2026-10-17-interview-practice-plan.md). Progress is recorded in PLAN.md §40.
