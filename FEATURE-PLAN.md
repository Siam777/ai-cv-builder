# AI CV/resume builder: feature plan

Updated: 2026-10-17. This document owns release scope; PLAN.md owns implementation progress and acceptance evidence. The current improvement specification is `docs/plans/product-quality-and-launch-plan.md` in the application repository. All new requirements below are planned, not claims of implemented behavior.

The initial source audit confirmed an existing editor, eight registered template styles, five demo profiles, Better Auth account infrastructure, six resume export formats, and analyzer/AI flows, and identified anonymous exports, fixed ATS percentages, and fictional generation requiring correction. Current implementation and validation are recorded in PLAN.md; historical audit findings are not a statement of current behavior or a production certification.

## Polished launch scope

| Area | Features | Done when |
| --- | --- | --- |
| Landing and navigation | Public landing page, template/example galleries and detail pages, resume review entry point, pricing, help, and privacy information | Coherent mobile/desktop UI; working CTAs; authentic product demonstrations and claims |
| Editor | Existing content types and custom sections; focused editing, preview navigation, keyboard bullets, accessible mobile modes | Edits persist, template switching loses no facts, and core journeys pass accessibility checks |
| Resume management | Distinct My CVs, On this device, and Demo examples views; explicit purpose/provenance; safe legacy-draft review; named variants, autosave, undo, history, authenticated backup | User can recognize personal CVs; viewing demos creates no personal record; no deleted legacy edits, silent overwrite, cross-account mixing, or lost draft during sign-in |
| Templates | Refine Classic, Modern, Compact, Creative, Tech, Executive, Timeline, Minimalist; add Elegant, Portfolio, Bold, Academic for 12 total; bounded fonts, accents, density, A4/Letter | 72 short/long PDF cases across 12 templates and two sizes, plus stress and DOCX checks; no fixed ATS percentages |
| Demo starters | Separate read-only library with 12 fictional profiles; persistent Demo badge; preview, design-only personal start, and optional clearly separated practice copies | Examples never populate My CVs, personal recents or counts; personal documents start without inherited fictional history |
| Authentication | Better Auth email/password, verification, recovery, Google sign-in, session controls, safe account deletion | Live flows verified; session expiry preserves drafts; server ownership checks cover private resources |
| Mandatory export access | Authenticate every app-provided download/export, including free users, backups, cover letters, reports, sample files, account data, and app print/copy actions | Direct requests and all UI paths reject anonymous/expired/wrong-owner access; no print fallback bypass |
| Export formats | PDF, DOCX, HTML, Markdown, TXT, JSON; matching cover-letter outputs integrated with the same policy | Actual files preserve content and order; editable DOCX verified; unsupported format/layout differences disclosed |
| Analyzer | Actual PDF/DOCX readability, deterministic writing findings, explicit target role, evidence-based job coverage, semantic AI coaching | Explained methods and uncertainty, no perfect default extraction score, versioned held-out evaluations meet launch gates |
| AI assistance | One-time AI consent per account; Write with AI from rough notes; labelled examples for a job title with blanks to fill; Build my CV with AI interview; bullet help (improve, shorten, continue, rewrite selection, Improve all, Fix with AI from Check my CV); summary and skill suggestions; Match a job post with AI, gap lines and Tailor with AI; AI cover letter; Tidy with AI after imports; Ask the AI with buttons into these tools. Free, Go and Pro split per PLAN.md §38–39 | Candidate facts only: evidence IDs, new-number and independent support checks, examples labelled with blanks that must be filled; review before apply and one-step undo; consent, plan and daily limits enforced on the server before any provider call; no contact details sent; the fictional live evaluation (`npm run ai:eval`) passes and cost per action fits the plan prices |
| Imports | Text, text-based PDF, staged LinkedIn CSV/ZIP, JSON restore; review omissions before merge/replace | Validated input and explicit review; scanned PDFs and unsupported formats receive honest feedback |
| Privacy and operations | Explicit local/cloud storage choice, authenticated transient processing for local exports, metadata-only logs, retention/deletion, monitoring and restore runbook | Production provider behavior verified; no silent cloud import; ownership and backup-restoration tests pass |

## Authentication policy and first improvement milestone

Guests can browse, edit a device-local draft, preview templates, and view basic review findings. Every app-provided download/export requires a valid server-verified account session, independently of payment. CVs, cover letters, recovery backups and app print/copy additionally require verified email; account-data export remains available to authenticated owners before verification and is never paywalled. Sign-in and verification return to the pending document and format. Recovery backups have no anonymous exemption. An expired or changed cloud session pauses the workspace without discarding its in-tab draft; restore the original session or explicitly keep a device copy before switching. Browser/OS printing or manual copying of visible content cannot be technically prohibited and is not a DRM promise.

After establishing the baseline, start with the My CVs versus Demo examples separation: personal/account documents, device-local drafts, and read-only examples have distinct views and reliable metadata. Preserve older documents with unknown provenance for explicit review; never infer ownership from names or silently delete them. Finish production authentication and close every anonymous export path within this first Q1 slice. Then deliver the public landing and product shell, polish the existing eight templates, expand to the 12-design/12-demo launch collection, validate the analyzer, and complete live release checks. Existing editor functionality must survive route and account changes.

## Career workflow roadmap (accepted 2026-10-17)

Source analysis: `docs/plans/2026-10-17-career-platform-analysis.md` in the application repository. Each step needs its own detailed plan under `docs/plans/` before implementation. Nothing in this section is implemented.

| Step | Scope | Done when |
| --- | --- | --- |
| Gate 0: finish what is built | Live AI evaluation for every AI assistance phase, live Stripe checkout/webhooks, live OAuth/email, deployment, and phone-width/accessibility checks for the AI views | The release checks in the launch scope pass; no new feature work starts until then |
| 1. CV truth and consistency check | One whole-CV pass, mostly deterministic, in Check my CV: contradictory or overlapping dates, inconsistent job titles, duplicate claims, skills with no supporting entry, numbers the person has not confirmed. Each finding can be fixed or confirmed before export | Every finding is explained and links to the statement; nothing is changed without review; no score or hiring prediction |
| 2. Application tracker (basic) | Saved jobs and links, stages (saved, applied, assessment, interview, offer, rejected), dates, notes, recruiter contacts, follow-up reminders, and a frozen copy of the exact CV and cover letter sent | Owner-only server storage; included in account export and deletion; contacts and notes covered by the privacy page; no external submission or contact on the person's behalf |
| 3. Interview practice | Questions from the person's CV and a pasted job post; typed answers with feedback on relevance, clarity, structure and examples; flags CV claims that may be hard to back up | Same evidence rules as AI assistance (evidence IDs, support checks, labelled as practice, not a prediction); consent, plan and daily limits; live evaluation cases added before release |

Later candidates, each requiring its own plan and acceptance gate: a career-switch mode for job matching and tailoring, per-bullet follow-up questions for missing results, outcome insights from tracker data (with sample-size warnings), a skills gap roadmap, recruiter perspective views, portfolio pages (after a public sharing policy), country-specific CV conventions, a personal career agent, job URL import (after fetch-safety and site-terms review) and spoken practice. Still to decide: which plans include the tracker (the analysis suggests a free basic tracker) and whether the persistent Master Career Vault moves forward.

## Follow-on scope

- Expanded, persistently stored Master Career Vault after validating the existing separation of facts and variants. Application workflows follow the career workflow roadmap above.
- DOCX import and OCR, each with a dedicated extraction/review acceptance gate.
- More occupation-specific rubrics, language-specific analysis, and RTL template families after their own evaluations. Unicode preservation remains a launch requirement; it is not a claim of validated analysis in every language.
- MFA/passkeys, collaboration, and public sharing only after defining their access policies. Public sharing cannot create anonymous file-download access.
- Pricing (decided 2026-10-16): three monthly tiers, Free ($0), Go ($9.99) and Pro ($29.99), with a 30-day free Go period for new accounts during the beta. Stripe checkout and webhooks still need live verification before paid release; no lifetime or unlimited-AI offer is committed.

## Enterprise, when required

Organization roles, tenant isolation, shared brand templates, approval workflows, SSO/SCIM, retention controls, audit events, tenant AI budgets, queued rendering, and documented deletion/export behavior. Build integrations individually against verified official APIs and customer authorization. Do not promise generic one-click ATS submission.

## Suggested architecture

Retain Next.js/TypeScript, IndexedDB, SQLite/Turso, Drizzle, and Better Auth. Keep a versioned canonical document and a shared preview/export contract. Add a central authenticated export service and client coordinator, versioned analysis results and evidence, and a public marketing/workspace route split. Use private temporary artifacts and a queue only when required by measured workloads. The application host, email service, and production AI configuration require current documentation and staging validation.

Implementation order: Q0 baseline and factual integrity; Q1 My CVs/demo separation plus authentication/export policy; Q2 landing/product shell; Q3 templates/demos; Q4 analyzer/evidence workflow; Q5 production validation. Detailed acceptance gates and progress live in PLAN.md. Preserve existing code and candidate data while implementing reviewable slices.

## R&D assumptions to verify during implementation

- Current LinkedIn permissions, export filenames, and available fields. Do not assume sign-in grants a complete profile or that every archive contains all listed files.
- Current provider data-use/retention settings and model API capabilities.
- Applicable privacy obligations for the intended market and deployment; this plan does not establish legal compliance.
- Text extraction and reading order in each supported output. No template can promise universal ATS acceptance.

## Use the skills

After installation, invoke them in a task containing your application repository:

```text
Use $resume-builder-product to implement the canonical document, persistence, cold-start imports, and feature boundaries.
```

```text
Use $resume-builder-editor-ux to decompose the studio monolith, add keyboard-driven bullet editing, bidirectional preview sync, and inline AI diff chips.
```

```text
Use $resume-builder-career-vault to build the Master Career Vault, 1-click job tailoring engine, evidence matching, and Google XYZ coach.
```

```text
Use $resume-builder-ats-linter to implement real-time bullet linting, ATS plain-text extraction diagnostics, reading-order audits, and the lead magnet grader.
```

```text
Use $resume-builder-monetization to integrate Stripe Checkout, subscription webhooks, tiered entitlements, and export watermark enforcement.
```

```text
Use $resume-builder-ai to add an evidence-grounded chatbot and server AI proposals with atomic accept/reject and anti-hallucination verification.
```

```text
Use $resume-builder-templates to refine the existing eight designs and add the planned launch collection with live preview, actual-file diagnostics, and authenticated, verified exports.
```

These skills guide Codex while developing the application. The application's chatbot still needs its own runtime prompts, validation, model connection, and tests.

