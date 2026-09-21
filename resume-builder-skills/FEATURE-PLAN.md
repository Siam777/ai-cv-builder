# AI CV/resume builder: feature plan

This document defines the release scope for AI CV Builder. PLAN.md owns implementation phases and verified progress. The repository includes the local editor, Phase 2 templates, and a working SQLite account foundation. Turso deployment is configured but not live-verified. The OpenAI bullet assistant is implemented and awaits live API verification; broader AI features remain planned.

## First release

| Area | Features | Done when |
| --- | --- | --- |
| Editor | Contact details; summary, experience, education, skills, projects, certifications, languages; reorder/rename/hide sections | Edits persist and template switching loses no data |
| Resume management | Named variants, autosave states, undo, JSON backup/restore | Variants remain independent and restore preserves content |
| Templates | Classic, Modern, Compact, Creative; accents, density, A4/Letter | All four render short and long resumes without clipped content |
| Chatbot | Guided fact collection, summary drafts, bullet rewrites, evidence-based skill suggestions | Proposed changes are reviewable, reversible, and contain no unsupported factual additions in evaluation fixtures |
| Imports | Paste text; staged LinkedIn CSV/ZIP; JSON restore; merge/replace preview | Partial and malformed input cannot silently overwrite a resume |
| Tailoring | Pasted job description, evidence-based requirement coverage, targeted rewrites | Missing skills stay gaps and every reported match has supporting evidence |
| Export | Selectable PDF, plain text, JSON | Exported content preserves facts and expected reading order |
| Writing audit and skills | Explained local writing findings and a basic searchable skill library | Findings are contextual and missing requirements never become claimed skills |
| Access and privacy | Choose local-only or account storage explicitly; server-side AI credentials; document ownership for hosted mode | No cross-user access and no resume text in routine logs |

## First usable milestone

Manual editing, local IndexedDB persistence, independent named variants, undo, a Classic preview, A4/Letter browser print, plain-text export, and validated version 1 JSON backup/restore. Phase 2 adds all four template families, bounded design controls, and a measured paginated preview shared with browser print. Phase 3 adds Better Auth accounts on SQLite, a Turso/libSQL deployment adapter, ownership/revision checks, account export/deletion, and explicit local-to-account copying. Live hosting and Turso verification remain outstanding. The first Phase 4 flow adds an account-only OpenAI bullet assistant with transmission consent, evidence checks, before/after review, atomic acceptance, rejection, and undo; live API verification is pending. Contextual chat, summaries, skill suggestions, LinkedIn/pasted-text imports, tailoring, writing audit, and basic skills search remain planned. Browser, font, and printer differences remain; deterministic hosted PDF rendering is not claimed.

## Next release

- DOCX, standalone HTML, Markdown, cover letters, version history, and reusable custom sections.
- Expanded writing audit rules; no score may imply a prediction of hiring outcomes.
- Richer skills taxonomy with versioned synonym mapping; assess current ESCO/O*NET data terms, regional coverage, and maintenance before adopting either.
- Existing PDF/DOCX resume import, with extraction preview and explicit handling of unsupported layouts or scanned PDFs.
- Localization and tested RTL templates. Keyboard operation, screen-reader semantics, and Unicode content are first-release requirements.

## Enterprise, when required

Organization roles, tenant isolation, shared brand templates, approval workflows, SSO/SCIM, retention controls, audit events, tenant AI budgets, queued rendering, and documented deletion/export behavior. Build integrations individually against verified official APIs and customer authorization. Do not promise generic one-click ATS submission.

## Suggested architecture

This project uses Next.js/TypeScript, browser IndexedDB, SQLite for local accounts, and Turso/libSQL for the deployed database, with Drizzle and Better Auth. Turso is the database provider; an application host remains to be selected. Keep a versioned resume document and one rendering contract shared by preview/export. Add object storage for real asset needs and a worker queue for server PDF workloads. Choose authentication, ORM, queue, AI provider, and deployment based on project constraints; they are not skill prerequisites. A local prototype can begin without enterprise infrastructure.

Implement in this order: canonical document and editor; local persistence and variants; templates and exports; hosted foundation; AI proposals; imports, tailoring, and local audit; release readiness; optional enterprise features. Each phase should leave a usable vertical slice.

## R&D assumptions to verify during implementation

- Current LinkedIn permissions, export filenames, and available fields. Do not assume sign-in grants a complete profile or that every archive contains all listed files.
- Current provider data-use/retention settings and model API capabilities.
- Applicable privacy obligations for the intended market and deployment; this plan does not establish legal compliance.
- Text extraction and reading order in each supported output. No template can promise universal ATS acceptance.

## Use the skills

After installation, invoke them in a task containing your application repository:

```text
Use $resume-builder-product to implement the first usable editor, canonical document, and named resume variants in this project.
```

```text
Use $resume-builder-ai to add a chatbot that proposes evidence-grounded resume edits with accept/reject and undo.
```

```text
Use $resume-builder-templates to add Classic, Modern, Compact, and Creative templates with live preview and verified PDF export.
```

These skills guide Codex while developing the application. The application's chatbot still needs its own runtime prompts, validation, model connection, and tests.
