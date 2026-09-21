# AI CV Builder - Implementation Plan

Status: Phases 1 and 2 implemented and verified on 2026-09-21. Hosted foundation is next; later phases remain planned. See the implementation record below for checks and limitations.
Project: `D:\utility-projects\ai-cv-builder`
Basis: the supplied resume-builder R&D and the three installed Codex development skills.

## 1. Product goal

Build a CV/resume application where users can enter or import their career history, choose different templates, improve content through an AI chatbot, tailor a resume to a job description, and export a readable document. Users retain control over every factual claim and saved edit.

The initial audience is individual job seekers. University, outplacement, and enterprise workflows are later extensions. The supplied R&D describes desired capabilities; it is not evidence of existing implemented features.

## 2. Release scope

### First usable milestone

- Manual resume creation with contact details, summary, experience, education, skills, projects, certifications, and languages.
- Rename, reorder, hide, add, and remove section entries.
- Classic single-column template with a live preview.
- Local persistence, named independent resume variants, undo, and visible save states.
- A4/Letter print-to-PDF, plain-text export, and versioned JSON backup/restore.

### MVP completion

- Four template families: Classic, Modern, Compact, and Creative.
- Accent colors, controlled typography, four density presets, and page-size selection.
- Chatbot for guided fact collection, summary drafting, bullet improvements, and supported skill suggestions.
- Before/after AI edit proposals with accept, reject, and undo.
- User-supplied LinkedIn CSV/ZIP import, pasted text parsing, import preview, and merge/replace choices.
- Pasted job descriptions, requirement coverage, matched/missing skills, and suggested tailored rewrites.
- Local writing audit with explained findings rather than a hiring-success prediction.
- Hosted accounts and cloud persistence for the hosted beta; the initial local milestone must label browser-storage limitations clearly.

### Subsequent releases

- Structured DOCX, standalone HTML, and Markdown exports.
- Cover-letter generation, richer history, custom sections, and a searchable skills taxonomy.
- Existing PDF/DOCX resume import, including a separate decision about OCR for scans.
- Shared branded templates, organizations, approvals, SSO/SCIM, and integrations when customer needs justify them.

Billing, job-board scraping, automatic job applications, and a universal ATS integration are outside the MVP.

## 3. User journeys and screens

1. **Resume dashboard:** create, name, duplicate, open, export, and delete a resume. Show save status and recent changes.
2. **Start flow:** choose manual entry, example data, JSON restore, LinkedIn export, or pasted text. Explain when AI parsing sends content to a provider.
3. **Editor:** section navigation, editable content, and live preview. On narrow screens, use separate editor/preview tabs.
4. **Template gallery:** previews of all template families; switching preserves all content and section preferences.
5. **AI assistant:** choose a resume or specific entry as context, chat, inspect proposed edits, and accept/reject changes. Show generation and error states.
6. **Job tailoring:** paste a job description, inspect requirements and supporting evidence, and create a named tailored variant.
7. **Audit and export:** inspect actionable findings, choose format/page size, and export the current revision.
8. **Account/data settings for hosted mode:** export stored data and delete documents/account data with clearly documented retention behavior.

Accessibility requirements include keyboard navigation, labeled form controls, visible focus, accessible validation errors, and status announcements. Start with an English interface while preserving Unicode content; claim additional language/RTL support only after testing it.

## 4. Architecture proposal

The project began as planning documents and development skills. Phase 1 uses Next.js App Router, TypeScript, React, Zod runtime validation, and IndexedDB behind a repository interface. The user selected SQLite for local account storage and Turso/libSQL for deployment. Better Auth with Drizzle provides authentication; the application hosting service is still undecided.

| Concern | Proposed approach | Rationale |
| --- | --- | --- |
| App | Next.js with TypeScript | Shared frontend/server project with typed boundaries |
| Document validation | Shared runtime schemas | Validate editor state, imports, AI operations, and backups consistently |
| Initial persistence | IndexedDB behind a repository interface | A usable local milestone without cloud infrastructure |
| Hosted persistence | SQLite locally; Turso/libSQL with Drizzle for deployment | Ownership, revisions, and reliable cloud storage |
| Identity | Better Auth email/password sessions | Avoid custom authentication machinery |
| AI | Server-side provider adapter with structured proposals | Keep credentials private and isolate provider-specific logic |
| Rendering | Shared document-to-template layer | Preview and export use the same content and settings |
| PDF | Browser print initially; isolated server Chromium for consistent hosted output | Match complexity to release requirements |
| Background work | Add Redis/BullMQ or equivalent when queued rendering is required | Avoid unnecessary infrastructure in the first milestone |
| Assets | Controlled bundled assets first; object storage when uploads are introduced | Keep rendering predictable |

Suggested modules: `document`, `editor`, `persistence`, `templates`, `imports`, `ai`, `tailoring`, `audit`, and `exports`. Keep domain logic independent of UI components. Do not require a microservice split for the MVP.

## 5. Data model and invariants

- **Candidate facts:** user-confirmed facts with stable identifiers and source references.
- **Resume document:** ID, owner in hosted mode, name, optional target role, schema version, revision, ordered sections, and presentation settings.
- **Section/entry/bullet:** stable identifiers, typed fields, visibility, order, and evidence references where relevant.
- **Source:** manual input or imported field/row reference. Store only the provenance needed; avoid retaining complete source archives indefinitely.
- **AI proposal:** target document, base revision, allowlisted operations, evidence IDs, questions, and acceptance status.
- **Revision:** snapshot or change history sufficient for the promised undo/version features.

Keep candidate facts, resume-specific wording, and presentation separate. Duplicating a resume creates an independent variant. Changes to shared candidate facts must not silently rewrite existing variants. Month-only dates remain month-only; current roles and unknown dates are explicit states.

Autosave exposes pending, saved, and failed states. Use revision checks to prevent stale overwrites. Import replacement is scoped to the active resume, validated before commit, and reversible. JSON backup includes a schema version and excludes credentials or hidden application state.

## 6. AI chatbot contract

Supported intents: collect missing facts, draft a summary, improve a selected bullet, suggest supported skills, tailor wording to requirements, and later draft cover letters.

The model returns a message, questions, and structured edit proposals. Operations identify allowed targets by stable IDs; arbitrary code, SQL, HTML, or document paths are not executable output. Validate ownership, target IDs, output shape, length bounds, and base revision before applying anything.

Employers, dates, qualifications, achievements, metrics, and skills must have candidate-provided support. When impact is unclear, ask a focused question. Missing job requirements remain gaps rather than automatically becoming claimed skills. Treat imported documents and job descriptions as untrusted data, including any embedded instructions.

Proposals appear as before/after changes with accept/reject controls. Accepted operations apply atomically and at most once, with undo available. A timeout, malformed response, or unsupported assertion cannot corrupt the saved resume. Bound input size, retries, latency, and provider spending. Routine logs contain operational metadata rather than raw resume text.

## 7. Templates and exports

| Template | Design direction |
| --- | --- |
| Classic | Conventional single column, clear headings, straightforward text extraction |
| Modern | Single column with restrained color and stronger typographic hierarchy |
| Compact | Denser single column with bounded spacing and readable minimum text size |
| Creative | Optional sidebar with verified extraction order and accessible contrast |

Templates consume the same document model. Support A4 and Letter, controlled font options, accent color, and density. Keep headings with the next entry when possible; permit long entries to span pages without overflow. Do not shrink text indefinitely to force one page.

Verify selectable PDF text, reading order, hyperlinks, clipping, loaded fonts, and page breaks. Browser-print pagination may vary and must not be marketed as deterministic. Server exports capture a specific document revision, restrict network access, and use authorized downloads. DOCX is generated from structured content, not from PDF images. No universal ATS-compatibility guarantee is part of the product.

## 8. Imports, tailoring, and audit

**Imports:** adapters produce staged canonical data. Handle missing CSVs, changing headers, quoted multiline cells, BOMs, duplicate rows, unknown fields, and ambiguous dates. Bound ZIP sizes, expanded bytes, and entry counts; reject unsafe paths. Preview omissions/conflicts before merge or replace. A LinkedIn URL alone is not an import mechanism. Verify current export formats and API permissions before promising LinkedIn capabilities.

**Tailoring:** extract required/preferred requirements separately from candidate evidence. Use a versioned synonym mapping; do not equate merely related skills. If showing a percentage, disclose weights and denominator, ignore duplicated keywords, and show supporting evidence. With no recognized requirements, show an unscorable state. The percentage is heuristic coverage, not interview probability.

**Audit:** start with deterministic checks for empty sections, date inconsistencies, excessive bullet length, vague wording, and export reading-order issues. Suggestions about metrics and employment gaps must be contextual. Avoid English-specific penalties for non-English resumes. Defer a combined score until its rules and limitations are clear.

## 9. Implementation phases and acceptance gates

### Phase 1 - Foundation and usable editor

- [x] Initialize app, shared schemas, synthetic sample data, and document state.
- [x] Implement all eight initial section types, entry editing, visibility, and ordering.
- [x] Add local persistence, independent named variants, save/error states, and undo.
- [x] Add Classic preview, A4/Letter print, plain-text export, and JSON restore.

Gate: create, edit, reload, duplicate, switch variants, export, and restore without losing facts. Malformed backups leave the current resume untouched.

### Phase 2 - Template system

- [x] Implement Modern, Compact, and Creative templates and design tokens.
- [x] Add gallery, density controls, responsive editor/preview, and pagination rules.
- [x] Inspect short/long fixtures across every template and page size.

Gate: switching templates preserves content; no clipped text or accidental blank pages; extracted PDF text retains expected reading order.

### Phase 3 - Hosted foundation

- [x] Implement SQLite persistence and Better Auth; configure the Turso/libSQL deployment adapter.
- [ ] Provision and verify a live Turso database and the application host.
- [x] Add ownership enforcement, revision checks, account data export/deletion, and migrations.
- [x] Add an explicit local-to-account import flow without silent duplication or overwrite.

Gate: unauthorized document access fails across editor, export, and AI endpoints; stale saves cannot overwrite newer work; persistence failures are visible.

### Phase 4 - AI assistant

- [ ] Implement server provider adapter, contextual chat, and structured proposals.
- [ ] Add fact collection, summary generation, bullet rewrites, and skill suggestions.
- [ ] Add evidence checks, before/after review, atomic acceptance, undo, and retry protection.
- [ ] Evaluate unsupported metrics, prompt injection, cross-user targets, stale revisions, malformed output, and timeouts.

Gate: evaluation fixtures cannot add unsupported facts or mutate unauthorized targets; failures preserve saved content. A mocked chatbot is labeled as a demo and does not satisfy this gate.

### Phase 5 - Imports and job tailoring

- [ ] Add staged LinkedIn CSV/ZIP import, pasted-text parsing, and merge/replace review.
- [ ] Add job requirement extraction, evidence matching, and tailored variants.
- [ ] Add transparent local audit findings and a basic searchable skill library.

Gate: partial/malformed imports expose warnings without destructive writes; missing requirements remain gaps; AI processing disclosures match actual network behavior.

### Phase 6 - Release readiness

- [ ] Add deterministic server PDF rendering if required by hosted export promises.
- [ ] Complete keyboard and screen-reader checks, loading/empty/error states, and supported-browser checks.
- [ ] Verify rate limits, operational logging, data retention, backups, and restoration.
- [ ] Run the end-to-end creation-to-export journey and document remaining limitations.

Gate: all advertised MVP features work with real configured services; unavailable integrations and demo-only behavior are clearly identified.

## 10. Verification strategy

Use targeted domain tests for migrations, merge behavior, revision checks, and AI operation validation. Use integration tests for persistence, authorization, and provider failure handling. Use end-to-end tests for creation, editing, template switching, variant isolation, proposal acceptance/undo, and export.

Use synthetic fixtures covering one-page and long resumes, empty sections, long URLs, non-Latin names, multiline bullets, overlapping roles, and partial archives. PDF verification includes rendered-page inspection and text extraction; neither substitutes for the other. Keep prompt versions and AI evaluation cases together.

## 11. Decisions to resolve at the relevant phase

| Decision | Proposed direction | Resolve before |
| --- | --- | --- |
| Product name/branding | Neutral working name: AI CV Builder | Polished template gallery |
| Hosting/authentication | SQLite locally, Turso for the deployed database, Better Auth; application host remains to be selected | Hosted foundation |
| AI provider/model | OpenAI selected; configurable GPT-4.1 mini snapshot pending live evaluation | AI integration |
| Language scope | English interface, Unicode content initially | Language-specific audit rules |
| Data location/retention | Document actual provider and deployment behavior | Hosted beta |
| DOCX and OCR priority | Post-MVP unless required earlier | Export/import expansion |
| Enterprise requirements | Defer until a defined customer workflow exists | Enterprise development |

No assumptions about LinkedIn partner timelines, legal compliance, current provider retention, or taxonomy licensing are considered verified by this plan. Check current primary documentation when implementing those integrations.

## 12. Codex execution guidance

Use `$resume-builder-product` for document architecture, persistence, and imports; `$resume-builder-templates` for layouts and exports; and `$resume-builder-ai` for chatbot and tailoring implementation.

Start with Phase 1. Inspect repository state before each phase, preserve unrelated changes, implement a reviewable slice, and run the checks relevant to that slice. Update this plan with completed checkboxes and actual decisions as implementation progresses. Do not mark a phase complete because its screens exist if its persistence, integrations, or acceptance behavior are still mocked.

## 13. Implementation record — 2026-09-21

Phase 1 is implemented as a local application using Next.js 16.3.5, React 19.3.0, TypeScript, Zod 4.6.5, and transactional IndexedDB. The dependency lockfile records exact installed versions. Official Next.js installation and Zod validation documentation were checked during setup.

Delivered: blank/example creation, all eight initial content areas, section labels/order/visibility, entry add/remove/reorder, individually identified bullets, named independent variants, autosave status, revision conflict rejection, session undo, Classic continuous preview, A4/Letter browser print, plain-text export, and staged JSON restore as a new resume or reversible replacement of active content. Import validation rejects unsupported schema versions, unexpected fields, duplicate identifiers, oversized backups, and invalid dates without changing stored content.

Verified:

- `npm run typecheck` and `npm run build` pass.
- Four domain/repository tests pass, covering backup round trips, malformed backups, Unicode and date precision, variant isolation, hidden export content, duplicate IDs, save/reload, stale write/delete rejection, and deletion.
- Three Playwright journeys pass in installed Chrome: create/edit/reload, variants/undo, every section type, section order, remove/undo, backup/restore/replacement/undo, text download, concurrent tabs, and a 390px mobile preview without horizontal page overflow.
- Desktop and mobile screenshots visually inspected. A4 and Letter sample PDFs each contain one page; the long fixture spans two A4 pages and three Letter pages. All seven PDF pages were rendered with Poppler and inspected. Text extraction confirms all 55 long-fixture notes, expected section order, nonempty pages, page dimensions, and contact link annotations in the sample exports.
- `npm install` reports zero known dependency vulnerabilities at setup.

Phase 1 limits at that milestone (preview/template limits superseded by Phase 2 below): local storage can be cleared by the browser; backups are necessary. Undo is limited to 80 steps in the current resume session and resets on navigation/reload. Preview is continuous, not a paginated screen simulation. Browser print controls final pagination and relies on installed fonts; deterministic rendering and full cross-browser/screen-reader validation remain later gates. English UI and Unicode storage/rendering have been exercised; complete multilingual/RTL support is not claimed. User-entered facts live within each resume in schema version 1; shared candidate facts, provenance, and proposal schemas require a migration before Phase 4. No AI, hosted persistence, LinkedIn import, taxonomy, writing audit, or additional template is implemented.

Scope alignment: local writing audit and basic skills search belong to the MVP/Phase 5. Richer taxonomy, DOCX, and language/RTL expansion remain subsequent releases. Baseline keyboard access, semantic form labels, and screen-reader status announcements belong to the first release. `FEATURE-PLAN.md`, the packaged feature plan, and the ZIP agree on this scope.

The next slice after Phase 1 was the Phase 2 template system, now delivered below. Do not begin hosted integration or AI with mock behavior labeled complete.

## 14. Phase 2 implementation record — 2026-09-21

Delivered Classic, Modern, Compact, and Creative designs; a gallery using the active resume's content; five dark accent options; Arial/Georgia/Verdana body typography with local fallbacks; 10/11/12 pt body text; Airy/Balanced/Compact/Tight density presets; and a Creative side rail toggle. Design changes use the existing autosave, backup, variant, and undo paths. Additive defaults read Phase 1 version-1 settings without altering facts, IDs, revisions, or section preferences.

Preview and print now share measured page blocks at physical A4/Letter dimensions. The paginator waits for fonts, measures rendered block heights, keeps short entries together, binds section/entry headings to following content, and splits oversized text at measured grapheme/word boundaries. It never truncates facts or automatically shrinks the chosen font. Measurement stays available when the mobile preview is hidden. Empty optional entries do not produce isolated headings. The print action waits for the current pages; print uses the same page content and page numbering as the preview.

Validation: seven domain/repository tests and nine browser journeys pass, along with type checking and the production build. The template matrix produces 24 PDFs: every template on A4 and Letter with a short fixture and a long fixture at both density extremes. Those 66 pages were rendered for visual review. Automated PDF checks verify every source text block in order, exact preview/print page counts, expected dimensions, nonempty pages, and contact link annotations. Desktop/gallery/mobile views and representative full-size PDF pages were inspected. Fixtures include a long single entry, an unbroken URL, empty sections, accented names, and Unicode editing. Creative reading order is checked explicitly. PDF review found and resolved a long-paragraph placement issue and CSS positioning that reordered extracted bullets.

Current limits: printing remains browser-based, with system font fallbacks. Users should select the matching paper size, print at 100%, and disable browser headers/footers. Other browsers, operating systems, and printer overrides may produce different results; deterministic hosted rendering and full multilingual/RTL/accessibility certification are not claimed. Gallery thumbnails show a cropped overview, while the main preview includes every page. Source text is preserved even when a long paragraph continues on the next page.

The next slice after Phase 2 was the Phase 3 account foundation, delivered locally below. AI remains unimplemented.


## 15. Phase 3 implementation record ? 2026-09-21

User decision: SQLite for now and Turso for the deployed database. Implemented with libSQL, Drizzle, and Better Auth, replacing the tentative Supabase integration. The Next.js application host is not yet selected. Setup creates a local SQLite database, applies checksum-tracked migrations, and generates a private development secret. Production requires remote Turso credentials; it cannot silently use an ephemeral local file.

Delivered real email/password signup, sign-in/out, current-password-verified password change, owner-scoped resume CRUD, optimistic revision checks, account export, and password-confirmed account deletion with database cascades. Every resume/export route derives the owner from the session and verifies the workspace identity. Same-origin writes and bounded validated JSON reject inappropriate requests. Resumes are not included in routine logs. Browser IndexedDB remains the default and requires explicit selection to copy data into an account. Batch imports are atomic, preserve local originals, assign independent IDs, and keep per-account receipts to make concurrent retries safe. Failed saves keep the draft editable and downloadable as a recovery backup.

Validation uses real local SQLite, not mocked storage: database transaction rollback and cascade checks; two-account API isolation, origin rejection, concurrent stale saves, duplicate import retries, export, password change/sign-in/out, account deletion; and a browser journey for explicit copy, independent editing, reload, failed-save recovery, and return to local after account deletion. The existing editor/template regression suite is retained.

Remaining hosted gates: live Turso provisioning and integration checks, application hosting, email verification/recovery, shared production rate limiting/trusted proxy configuration, and backup/retention/restore verification. Better Auth rate limiting is enabled in memory. At this milestone there were no AI endpoints; section 17 records their later implementation. The account foundation works locally, but Phase 3 live deployment is not marked complete.

Phase 3 verification result: 8 domain/database tests, 11 Playwright journeys, type checking, and the production build pass. All 24 template PDFs still pass text-order, preview/page-count, page-size, link, and blank-page checks. Re-running the database setup is idempotent. The account settings screen was visually reviewed. The root, distribution, and ZIP feature plans match byte-for-byte. Dependency audit reports zero known production vulnerabilities.


## 16. Phase 4 proposal foundation

Started the provider-independent proposal contract in `src/lib/ai-proposals.ts`. Versioned, bounded proposals currently allow only bullet replacement. Review validates the document/revision, section/entry/bullet targets, original text, unique operations, and evidence references scoped to the same entry. Evidence is resolved from candidate-entered bullets without including contact details. The pure application function produces a new document and receipt; the caller must authorize, verify factual support, obtain explicit acceptance, and persist the receipt and document atomically. It preserves the original snapshot for undo and rejects previously applied proposal IDs supplied by the persistence layer.

At this milestone the foundation was not exposed as a working AI feature; section 17 supersedes this implementation status. Syntax and evidence-reference validity do not establish factual support. Provider selection, generation, semantic evidence checks, a fact/provenance migration, review UI, durable receipt persistence, server ownership checks, and live model evaluations remain required. Phase 4 checkboxes remain open. No resume has been sent to a model provider.

Phase 4 foundation verification: all 11 domain/database/proposal tests pass, along with type checking and the production build. No editor flow changed in this slice. Provider integration and factual-support evaluation have not been tested or represented as complete.


## 17. OpenAI bullet assistant implementation

User selected OpenAI. Implemented an account-only bullet rewriting flow using the Responses API, strict structured output, `store: false`, a configurable model (default `gpt-4.1-mini-2025-04-14`), and versioned drafting/support prompts. Context is limited to the selected entry's candidate-entered bullets, with an explicit transmission consent. Contact fields and other entries are omitted. Structured output/target validation and a numeric guard are followed by a separate semantic support call; failed support yields questions without an applicable edit. The checker is fallible and user review is mandatory.

The editor provides evidence disclosure, before/after review, acceptance/rejection, progress/errors, and session undo. SQLite/Turso migration 002 adds proposal states, durable retry receipts, per-account usage and installation-wide counters. Server acceptance loads the owned stored proposal and saves the edited document and receipt atomically with revision checks. Expired/stale proposals and cross-account targets are rejected. Resume/account deletion cascades through proposals; account export includes AI records and account usage. Resume deletion cannot reset usage quotas. Rejection clears proposal content, acceptance expires after 24 hours, and accepted/pending content otherwise remains until resume/account deletion.

Bounds: 10 bullets/12,000 context characters, 1,000 instruction characters, up to two provider calls capped at 1,800 output tokens each, 45-second overall deadline, no automatic paid retries, default 20 requests per account/day and 200 per installation/day, two active requests per account within a 90-second reservation window. Failed attempts count. API keys remain server-only. No raw provider errors or resume text are logged.

Phase 4 is still incomplete: no key is configured, so live OpenAI behavior, semantic accuracy and prompt-injection resistance have not been verified. Controlled-response tests exercise failure handling; they are not model evaluations. A synthetic live smoke runner (`npm run ai:eval`) is provided for later key configuration. Full contextual chat, summaries, skill suggestions, and shared facts/provenance still require implementation and validation. Existing version-1 resume data remains compatible; proposal evidence references are scoped snapshots, not a shared candidate-fact system.

Migration 003 preserves the original evidence snapshot, prompt version and model with each proposal and includes them in account export. Rejection clears the snapshot with the proposal body. Later source edits cannot erase the evidence snapshot for an accepted proposal.

OpenAI integration verification: 13 domain/provider/database tests and all 13 Playwright journeys pass; type checking and the production build pass. The 24 template PDFs still pass extraction order, page-count parity, paper-size and link checks. Account journeys were rerun after the evidence/export migration. AI tests use controlled provider responses; live smoke evaluation remains unrun without OPENAI_API_KEY. Mobile review layout was visually inspected. Feature-plan distribution and ZIP remain synchronized.
