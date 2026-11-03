# Career platform proposal: feature and plan analysis — 2026-10-17

Source: `docs/Resume Builder.docx` (future-direction proposal: "AI Career Copilot — one profile, every opportunity"). This document compares that proposal with what is built today (PLAN.md, FEATURE-PLAN.md, `src/`) and recommends an order. It is analysis only: nothing here changes release scope in FEATURE-PLAN.md until it is accepted and synchronized there.

**Updated 2026-11-04.** Step 1 (consistency check) is implemented locally (PLAN.md §41), started ahead of Gate 0 at the owner's request. The app will capture jobs rather than search for them ([job capture plan](2026-11-04-job-capture-and-tracker-plan.md), FEATURE-PLAN.md row 2b). Step 4 has a detailed plan ([follow-up questions and career switch](2026-11-04-career-switch-and-follow-up-questions-plan.md)). The status tables, order and decisions below reflect this; items not mentioned are unchanged since 2026-10-17.

## 1. Summary

- The proposal's Phase 1 (core builder) and most of its Phase 2 (job application intelligence) **already exist locally**: job-post matching, Tailor with AI, ATS/actual-file checks, cover letters, the AI interview start, notes → bullets and evidence-grounded AI with no invented facts.
- The proposal's own top three picks are tailoring (built), Achievement Discovery (mostly built) and the **Application Outcome Learning Loop (not built, and it depends on an application tracker that does not exist)**.
- The biggest real gaps are the **job-search workflow** (application tracker, outcome loop, interview practice) and **career growth** (skills gap roadmap, career switch, portfolio). These are what turn a one-off CV tool into something used every time someone applies, which matches the proposal's monetization advice.
- None of this should start before the open release gate: the live AI evaluation (`npm run ai:eval -- --save`) and production validation (live OAuth/email, Stripe, deployment). New features on an unverified AI layer multiply the evaluation work. (2026-11-04: the owner chose to start step 1 early; Gate 0 is still open and still blocks release.)

## 2. Feature-by-feature status

Status key: **Built** = implemented locally (still subject to the open live/production checks) · **Partial** = foundation exists, named gap remains · **New** = not started.

### Core proposals (1–6)

| # | Proposal | Status | What exists | Gap |
|---|---|---|---|---|
| 1 | AI Job Match Simulator | **Built** | Match a job post with AI, evidence-based job coverage, gap lines, criterion coaching, saved job-review history (`src/components/vault/AiJobMatch.tsx`, `JobCriterionCoach.tsx`, `JobReviewHistory.tsx`, `/api/ai/job-match`, `/api/ai/gap-line`). No fixed ATS percentage. | Job **URL** input (paste only today). A clearer split of "skills / experience / qualifications / certifications" in the breakdown. |
| 2 | One-click job-specific CV | **Partial** | Tailor with AI (`/api/ai/tailor`, `JobTailorModal.tsx`), named variants, vault model (`src/lib/vault/vault-model.ts`), exports in PDF/DOCX. | The **persistent Master Career Vault** is still follow-on scope; tailoring works from the open CV rather than one master profile feeding many variants. |
| 3 | Achievement Discovery Engine | **Mostly built** | AI interview start (`/api/ai/interview`, `interview-step`), notes → bullets, XYZ impact coach, Fix with AI, the new-number and support checks that refuse invented metrics. | Targeted **follow-up questions per weak bullet** ("how many people? what changed?") rather than a whole-CV interview. **Planned as step 4a** ([plan](2026-11-04-career-switch-and-follow-up-questions-plan.md) §3). |
| 4 | ATS & Recruiter Readiness Lab | **Built** | Actual-file diagnostics (`/api/diagnostics`, `FileDiagnostics.tsx`), plain-text stream inspector, heuristic linter (`src/lib/linter/ats-linter.ts`), public `/grader`, honest "ATS systems differ" wording. | OCR (scanned PDFs and images) is still follow-on; Word (`.docx`) text import is built (see the roadmap table). Small: surface readability/"unnecessary content" findings more clearly. |
| 5 | Career Gap & Growth Planner | **New** | Role analyzer (`src/lib/linter/role-analyzer.ts`) and skills taxonomy are reusable pieces. | Role requirement data, roadmap UI, 30/60/90-day plan, progress evidence feeding back into the profile. |
| 6 | Smart Job Application CRM | **New — planned (step 2 + 2b)** | Job-review history and version snapshots could link to applications. | Everything: jobs, stages, reminders, contacts, notes, "exact CV and cover letter sent". Plans: [tracker](2026-10-17-application-tracker-plan.md) and [job capture](2026-11-04-job-capture-and-tracker-plan.md) (paste and AI reading of job posts, referrals, follow-ups, bookmarklet and click-only extension; no built-in job search). |

### Stand-out proposals (7–11)

| # | Proposal | Status | Notes |
|---|---|---|---|
| 7 | CV-to-Interview AI Coach | **New — planned (step 3,** [plan](2026-10-17-interview-practice-plan.md)**)** | The existing "AI interview" builds the CV; it is not interview practice. Can reuse job-match evidence and the claims/support-check pattern from Ask the AI. Typed answers first; speech later (cost and privacy). |
| 8 | Proof-of-Work Portfolio | **New** | Needs **public sharing**, which FEATURE-PLAN.md defers until an access policy exists. Projects section and Portfolio template are a start. |
| 9 | Career Switch Translator | **New — planned (step 4b,** [plan](2026-11-04-career-switch-and-follow-up-questions-plan.md) §4**)** | A **mode of Match a job / Tailor** ("I'm moving from X to Y"): requirements are shown, transferable (quoted evidence plus a link that passes a support check) or gaps, and gaps lead into follow-up questions. Tailor rewords the same facts; titles, employers and qualifications never change. |
| 10 | Global CV Localization | **Partial** | RTL/multilingual template engine exists (PLAN.md §27). Country conventions, local spelling and per-country personal-detail guidance do not. Language-specific analysis is follow-on scope. Country guidance needs a maintained source. |
| 11 | Personal Career Agent | **Partial (seed)** | Ask the AI answers about the open CV and opens existing tools. A real agent needs preferences (roles, location, salary), the tracker, and memory. Job-board integrations and auto-apply are **out of scope** per FEATURE-PLAN.md ("no generic one-click ATS submission"). 2026-11-04: the job capture plan covers bringing jobs in, follow-up reminders and message drafts the person sends; there is no built-in job search, and a licensed aggregator is only a later experiment. |

### Combined workflows (A–C)

| | Proposal | Status | Notes |
|---|---|---|---|
| A | Application Outcome Learning Loop | **New, blocked by #6** | Needs applications linked to CV version, job post, cover letter and outcome. Insights must say when samples are too small. |
| B | CV Truth & Consistency Checker | **Built locally 2026-11-04** (PLAN.md §41; 11 rules, Confirm, export reminder; uncommitted at the time of writing) | Was: linter already checks date consistency; AI features verify each claim against evidence. Missing: one whole-CV pass (contradictory dates, overlapping roles, inconsistent titles, duplicate claims, skills with no supporting bullet, metrics never confirmed) with **review and approve each flag before export**. Mostly deterministic, so cheap to run. |
| C | Recruiter Perspective Simulator | **New** | Overlaps job coaching. Could be a view on Match a job (recruiter / hiring manager / specialist). Must be labelled as simulated feedback, never a hiring prediction. |

### Proposal's roadmap vs. today

| Proposal phase | Item | Today |
|---|---|---|
| 1 Core | Guided questionnaire | Built (AI interview start, first-draft guide) |
| | Upload and parse CVs | Built for text, text-based PDF, **Word `.docx`** (`src/lib/importers/read-resume-file.ts` via `/api/resumes/import-file`; ZIP and XML are validated, body text is extracted and parsed fields are staged for review), LinkedIn CSV/ZIP and JSON. Word import reads text only: layout, text boxes and some tables are not reconstructed, and the result is always reviewed before it is used. OCR is follow-on. (Corrected 2026-11-04, [plans review](2026-11-04-plans-review.md) finding 12.) |
| | Editable master career profile | Partial (vault model; persistent vault follow-on) |
| | Templates and live preview | Built (12 designs) |
| | PDF and DOCX export | Built (6 formats; Word gate open) |
| | AI writing and achievements | Built |
| 2 Job intelligence | Job matching, tailored CV, ATS checks, cover letter | Built |
| | Application tracker | **New** (planned: step 2 + 2b job capture) |
| | Truth & consistency checker | **Built locally** (2026-11-04) |
| 3 Growth | Interview coach, career switch, portfolio, skills gap, agent, outcome learning | **New** (planned: interview coach step 3, career switch step 4b; Ask the AI is a seed for the agent) |

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

**Step 1 — CV Truth & Consistency Checker (B).** Small, mostly deterministic, extends the linter and Check my CV panel, and makes "we never fabricate" visible. Low AI cost. **Built locally 2026-11-04** (PLAN.md §41).

**Step 2 — Application tracker (6), basic version.** Jobs, stages (Applied → Assessment → Interview → Offer/Rejected), dates, notes, contacts, reminders, and a **frozen copy of the exact CV and cover letter sent** (reuse snapshots). No AI needed. This unblocks A, 7 and 11 and adds the return visits the proposal wants.

**Step 2b — Job capture (2026-11-04).** No built-in job search: paste a post and link, read it locally or with AI into fields and requirements backed by quotes, one click to Match and Tailor, referral contacts, follow-up reminders and AI message drafts the person sends, then a bookmarklet and a click-only browser extension. Its phases A–D follow step 2; phase E (a licensed aggregator) is an optional experiment.

**Step 3 — Interview practice from CV + job post (7), typed answers.** Reuses job-match evidence and the claims/support-check pattern. Flags CV claims the person may struggle to back up.

**Step 4 — Per-bullet follow-up questions (3) then career switch mode (9).** Both extend existing matching and writing flows instead of adding new surfaces. 4a: "Ask me about it" asks two or three questions about one weak bullet (rule-based on Free, AI on Go and Pro) and rewrites it from the answers alone. 4b: a switch mode in Match and Tailor with transferable evidence and gap questions. Plan: [2026-11-04-career-switch-and-follow-up-questions-plan.md](2026-11-04-career-switch-and-follow-up-questions-plan.md). About 7–9 days plus live evaluation.

**Step 5 — Outcome insights (A).** Only after the tracker holds real data; show counts and "too few applications to tell" rather than percentages on small samples.

**Later, each with its own plan:** persistent Master Career Vault (2), skills gap roadmap (5), recruiter perspectives (C), portfolio pages (8, needs a public sharing policy), country localization (10), career agent (11), job URL import (needs fetch safety and site-terms review; 2b's browser extension reads pages in the person's browser instead), suggested jobs from a licensed aggregator (2b phase E, experiment), speech practice.

## 5. Risks and rules to carry over

- **No invented facts** applies to every new AI feature: evidence IDs, new-number check, independent support check, review before apply (existing `resume-builder-ai` rules).
- **No guarantees:** no "pass every ATS", no interview or hiring predictions; simulated feedback is labelled as such.
- **Small samples:** outcome insights must state sample size and uncertainty.
- **Job URLs:** server-side fetching needs SSRF protection and respect for job-board terms; paste stays the default. (2026-11-04: not planned; the extension reads the page the person is viewing, only when they click.)
- **Stretching in career switch mode:** transferable items need quoted evidence that passes a narrower support check; qualifications and licences are never transferable.
- **Sensitive data:** salary expectations, recruiter contacts and interview recordings need retention, export and deletion rules in the privacy page and account export before launch.
- **External actions:** no submitting applications or contacting recruiters without explicit per-action approval; no unverified job-board integrations.
- **Changing knowledge:** certifications, role requirements and country conventions go out of date; each needs a named source and a review date.
- **Evaluation cost:** each new AI feature adds live evaluation cases and per-action cost to `npm run ai:eval`.

## 6. Decisions

- **Accepted 2026-10-17:** the order Gate 0 → CV truth and consistency check → basic application tracker → interview practice. Recorded in FEATURE-PLAN.md ("Career workflow roadmap"), its distribution copy and the `resume-builder-skills.zip` entry.
- **Decided 2026-11-04** (the owner asked for the recommended approach): the basic application tracker is free on every plan with a 500-application cap; the persistent Master Career Vault stays follow-on scope and is reconsidered after step 4 (whose answers it could store); 2b phase E (suggested jobs) is deferred until phase D has been live and a provider's terms are reviewed.
- **Detailed plans (2026-10-17):** [step 1, consistency check](2026-10-17-cv-consistency-check-plan.md) · [step 2, application tracker](2026-10-17-application-tracker-plan.md) · [step 3, interview practice](2026-10-17-interview-practice-plan.md). Progress is recorded in PLAN.md §40.
- **2026-11-04:** step 1 started ahead of Gate 0 at the owner's request and implemented locally (PLAN.md §41). **Decided:** capture jobs, no built-in job search ([step 2b, job capture](2026-11-04-job-capture-and-tracker-plan.md), FEATURE-PLAN.md row 2b). **Planned:** [step 4, follow-up questions and career switch mode](2026-11-04-career-switch-and-follow-up-questions-plan.md), now a roadmap row in FEATURE-PLAN.md.
- **Cross-plan agreements (2026-11-04):** migration 008 holds the tracker, job capture and switch-mode columns, so no later migration is needed for them. The shared AI request hook is extracted by whichever of steps 3 and 4 is built first. Steps 3 and 4a share one `FollowUpQuestions` component. Posts over 12,000 characters reach Match as reviewed requirements plus the first 12,000 characters.
- **Plans review 2026-11-04** ([2026-11-04-plans-review.md](2026-11-04-plans-review.md)): all 12 findings are addressed in the plans (see its resolution section). The `years_claim` rule was changed in code to a confirmable suggestion. Nothing remains open from the 2026-10-17 decision list.
