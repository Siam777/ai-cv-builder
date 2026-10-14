# AI CV Builder - Implementation Plan

Status (2026-10-11): Q0 trust/dependency corrections and the local visual baseline are complete. Q1 library separation, verified-email exports, verification/recovery and draft-preserving session lifecycle are implemented locally. Q2.1 public shell, Q2.2 dashboard/editor foundation and Q2.3 Google sign-in/account navigation are implemented locally. Google uses synthetic provider validation and is unavailable locally until credentials are configured. Q2.4 bundled product fonts, toolbar disclosure and keyboard/focus improvements are implemented locally. Q3 shared exports, the 12-design/12-starter collection and shared-row pagination refinement are implemented locally, with local verification passed and remaining human/Word gates tracked below. Q4 actual-file diagnostics, browser-local job-evidence review with exact-text ordering proposals, explicit account job-review history and configured criterion-coaching integration are implemented locally. A live twelve-case fictional coaching evaluation completed with 11 development checks passing and one SQL assessment withheld; independent semantic review remains open. Verification and remaining unified-history/evaluation gates are tracked below. Live OAuth/email/deployment and human assistive-technology validation, plus Q3–Q5, remain open. Historical completion records do not establish production readiness.
Project: `D:\Workshop Courses\utility-projects\ai-cv-builder`
Basis: repository inspection, all 13 sample images, official competitor pages, and relevant project development skills.

## Current execution roadmap — 2026-10-10

Detailed specification: [Product quality and launch improvement plan](docs/plans/product-quality-and-launch-plan.md). Release scope: [FEATURE-PLAN.md](FEATURE-PLAN.md). This roadmap supersedes conflicting earlier recommendations and the historical blueprint below. In particular, every app-provided download/export must require authentication, fixed ATS percentages must be replaced with evidence, and fictional work history belongs only in labeled demos.

### Review completed

- [x] Inspect the existing landing route, templates, demo library, authentication, export paths, and analyzer implementation.
- [x] Visually review all 13 reference images in `samples/`.
- [x] Research public official Resume.io, Canva, Enhancv, Teal, Rezi, Jobscan, and Kickresume pages.
- [x] Define a prioritized improvement plan and synchronize release scope and its distribution copy/ZIP entry.

### Implementation milestones

| Milestone | Progress | Acceptance gate |
| --- | --- | --- |
| Q0: Baseline and trustworthy claims | [x] Complete locally | Trust/dependency corrections, 121 UI captures across three widths and 48 print fixture audits; review and concrete fixes recorded below. No production certification |
| Q1: My CVs, demo separation, authentication and export | [ ] Partial — local slices validated | Library separation, legacy preservation, verified-email exports, verification/recovery and session lifecycle pass local acceptance tests; live email and deployment validation remain open |
| Q2: Landing and product shell | [ ] Partial — local UI slices implemented | Public shell, saved-CV cards, first-draft guide, configured Google integration, account navigation, bundled type and toolbar/keyboard improvements delivered locally; live OAuth and human accessibility validation remain open |
| Q3: Templates and demo collection | [/] In progress locally | Shared renderer and 12-design/12-starter collection implemented; 172 PDF/72 DOCX audits and all local checks pass; Word/human visual release gates remain open |
| Q4: Analyzer and evidence workflow | [/] Partial — diagnostics, job-evidence review and account history implemented | Actual file extraction, source quotes, separate evidence counts, reviewed fact-preserving ordering, explicit versioned job history and configured coaching implemented; unified diagnostics history, live semantic evaluation and held-out benchmark remain open |
| Q5: Live release validation | [ ] Planned | Staging services, restore drill, accessibility, performance, end-to-end usability, and operational monitoring verified |

Original planning allowance: 35–54 developer working days plus contingency, review, and external setup; re-estimate remaining work as Q2 is scoped. The planning review has been followed by Q0, local Q1 implementation and Q2 public/dashboard/account slices. Continue with Q4 evidence workflow after local file-diagnostic verification while retaining Q3 Word/human review, live OAuth, Q1 delivery/staging and Q5 accessibility gates.

Priority clarification (2026-10-10): after the baseline, the first user-facing slice is **My CVs versus Demo examples**, with separate device-local drafts, explicit provenance, and non-destructive review of older unclassified documents. Browsing demos must not create personal CVs. Complete authentication/export enforcement within the same Q1 milestone before adding templates or the full landing redesign; the detailed plan specifies the migration and acceptance checks.

### Q2.5 usability corrections and Turso setup — 2026-10-11

- [x] Add visible photo controls and compatible-design guidance, a fact-first guided start, direct writing/review actions, full-width bullet editing and clearer local-versus-AI modes. Summary and own-result edits require review/confirmation.
- [x] Bound writing/account/job dialogs to the viewport with scrolling, reachable close/footer controls and focus restoration. Pending generation can be closed without applying a suggestion or locking the page; debounce preview measurements.
- [x] Verify the private Turso connection and apply migrations 001–005 to the initially empty remote database. Existing local account/CV records were not migrated.
- [x] Local checks: typecheck/build, 120 unit tests and 51 distinct affected browser scenarios passed across runs, including two configured coaching cases using an isolated synthetic provider. Mobile/desktop captures reviewed. Details: [Editor usability review](docs/plans/editor-usability-review.md).
- [ ] Full AI CV generation, human first-use/accessibility testing, production performance and hosted Turso restore/deployment remain open. Q4 evaluation gates remain unchanged.

### First Q4 slice — actual-file diagnostics, 2026-10-11

- [x] Add bounded server extraction for actual PDF, DOCX and UTF-8 TXT files. PDF.js runs in a separate Node process with a heap limit, timeout and concurrency cap; DOCX validates ZIP entries/expansion and XML before body extraction. Retire the old PDF stream scanner. Imports stage parsed fields for review and reject files without readable text.
- [x] Add **Review writing → File diagnostics** with explicit file/current-CV processing consent, raw text preview, parser/rules versions, file/source hashes, missing/out-of-sequence source blocks and stale-snapshot notice. Public file review shows actual-file observations without inventing a source comparison. Requests do not persist uploads/reports or call AI.
- [x] Keep visual layout/fonts, physical DOCX pages and ATS acceptance unverified. Distinguish blank PDF pages, undecodable text, known ligatures, body tables/text boxes and unverified link targets. No OCR or universal score.
- [x] Local verification: typecheck/build passed, 99 unit tests passed, and all 95 browser scenarios exercised successfully across the full run and targeted reruns. Actual production HTTP uploads/import and all 20 API trace audits passed; dependency audit reports zero known vulnerabilities. One focus case interrupted by a test-server restart passed on the stable rerun. Details: [Q4 file diagnostics review](docs/plans/q4-file-diagnostics-review.md).
- [ ] Remaining Q4: owner-scoped persisted/versioned analysis, evaluated semantic evidence matching/coaching, and the 120-pair held-out benchmark with documented release thresholds. Actual-file extraction and local term-matching tests alone do not satisfy these gates.

### Second Q4 slice — local job-evidence review, 2026-10-11

- [x] Replace the editor’s keyword-percentage/one-click tailoring screen with confirmed target role, seniority and language, bounded posting criteria and exact source quotes/spans. Preserve explicit OR alternatives, merge duplicate lines and allow reviewed priority overrides. English matching uses a versioned explicit dictionary; unsupported meaning, duration, ambiguous credentials/alternatives and languages abstain for manual review.
- [x] Show direct text support, weaker partial/related mentions, not-found text and manual review separately. Required and preferred counts/denominators stay separate; unknown items are excluded. No universal ATS score, invented qualification, inferred duration or hiring-probability claim.
- [x] Offer up to three exact-text bullet-order proposals with before/after previews, individual acceptance/rejection, evidence confirmation and independent variant creation. Preserve every bullet, candidate fact, source CV, provenance and design. Guard current and saved revisions, keep the review on save failure, block repeated creation clicks, recover the same variant after an unconfirmed save without duplicating it, and support session undo of an untouched created variant. Later edits prevent destructive creation undo.
- [x] This check runs in the browser against visible current-CV content. It does not send the posting/CV to AI; explicit report persistence is added in the third slice below. Existing cloud/device repositories own variant persistence and account/revision checks. The older cover-letter helper and shared Master Vault migration are outside this slice.
- [x] Local verification: typecheck/build and all 110 unit tests passed. Full browser run: 98 passed, one intentional configuration skip; final 10-test affected-flow run also passed after retry/alias/negation fixes. All 100 distinct browser scenarios have passed across configurations/runs. This includes real-account lost-response recovery/undo, unchanged source/facts, source conflicts, no AI transmission and visual checks at 360/768/1440px. Details: [Q4 job-evidence review](docs/plans/q4-job-evidence-review.md).
- [ ] Remaining Q4 after the history slice below: unified diagnostics history, evaluated semantic coaching through the existing AI proposal boundary, and the 120-pair held-out benchmark. Q4 stays partial; no release scope or skill guidance changed.

### Third Q4 slice — saved job-review history, 2026-10-11

- [x] Add explicit account-only saving of posting, target context, reviewed priorities, cited excerpts, hashes, CV revision, rules/term versions and timestamps. The server recomputes evidence from the owned saved CV; client-submitted scores/claims are rejected. No full CV snapshot/photo or AI request is stored/generated by this flow. Device reviews remain temporary.
- [x] Add read-only reopen after reload, stale markers for CV/rule changes and a recheck action that requires fresh target confirmation and review. Historical reports cannot directly propose changes. Saving never changes the source CV.
- [x] Enforce account ownership, same-origin mutations, no-store responses and transaction-safe limits (20/CV, 100/account, 512 KB/report). Full history rejects new saves without automatic deletion. Preserve one immutable record across lost-response retries; changed requests conflict. Deletion retries recover a lost response for an owned CV.
- [x] Include saved reports in account-data export, allow individual deletion and cascade CV/account deletion. Apply additive migration 005 to the configured local database. Update retention disclosures and README. Release scope and distributed skills are unchanged.
- [x] Local verification: all 112 unit tests and the isolated production build passed. Expanded storage-limit/version/deletion-retry assertions passed focused unit verification. Full browser suite: 102 passed, one intentional configuration skip (12.2 minutes). Final five-test run passed after the list-response race fix, including all four history scenarios and unconfigured Google. All 104 distinct browser scenarios passed across configurations/runs. Mobile wrapping, owner/origin/session guards, unchanged CV content, export/deletion and real lost-response recovery are verified. Final normal-output typecheck and whitespace checks passed after cleanup; the normal builder returned HTTP 200 and the isolated test server stopped. Details: [Q4 saved-history review](docs/plans/q4-job-review-history.md).
- [ ] Next Q4: evaluated semantic evidence interpretation and writing/coaching through the existing server AI proposal boundary, shared Master Vault projections, unified diagnostic history and the 120-pair held-out benchmark. Q4 remains partial.

### Fourth Q4 slice — criterion coaching preparation, 2026-10-11

- [x] Prepare bounded criterion-coaching inputs and server context validation against posting/CV hashes, rules, source spans and reviewed priority origin. Only visible selected-entry bullets supply candidate facts. Target context and job requirements remain separate from candidate evidence.
- [x] Extend the existing proposal contract with criterion metadata, model/prompt versions, analysis time, assessment and exact candidate references. Resolve all references to the selected entry; reject duplicates/foreign/stale evidence. Withhold edits for missing/failed independent support verdicts, invented numbers, duration requirements or unsupported language. Uncertain/not-demonstrated assessments cannot apply edits or change local coverage counts.
- [x] Prepare focused review UI, disclosure/consent, before/after preview, factual confirmation, rejection, existing server-owned account decisions and session Undo. Controlled browser replies use real SQLite decisions/export/idempotency. No schema migration or alternate acceptance path is introduced.
- [x] Keep live job coaching explicitly unavailable (`jobCoaching: false`, `AI_JOB_NOT_ENABLED`). The disabled service checks ownership/revision/context, then returns without generating or charging usage. Existing general bullet rewrites remain available under their existing configuration and consent.
- [x] All 116 unit tests, isolated production build and final normal-output typecheck passed. The final 21-case affected editor suite passed (2.1 minutes), including all four coaching scenarios, existing AI review/Undo, keyboard/focus, job-evidence variants and saved history. Private-contact sentinel assertions passed the focused four-unit rerun; mobile review was inspected and overflow checked. Twelve versioned development cases use controlled support verdicts; they are not a live semantic evaluation or a held-out benchmark. Generated type paths were cleaned and whitespace checks passed; the full browser suite was not repeated for this prepared slice.
- [x] Provider authorization resolved in the fifth slice below: automatic approval review originally required explicit approval for candidate bullet text and job-criterion/target context sent to OpenAI. The user subsequently gave the go-ahead after that payload/destination was identified. No rejected patch or workaround was used during preparation. Details: [Q4 coaching integration review](docs/plans/q4-job-coaching-review.md).
- [x] Configured provider wiring and controlled adapter verification are implemented in the fifth slice. Live quality validation and the diverse independently labeled 120-pair held-out gate remain open; shared Master Vault projections and unified diagnostics history remain queued. Q4 remains partial and release scope/skills are unchanged.

### Fifth Q4 slice — configured criterion-coaching integration, 2026-10-11

- [x] Connect the prepared panel to OpenAI only after in-app consent. Server validation reconstructs one criterion from the owned saved CV and posting; the provider receives only selected-entry bullets, selected criterion, target role/seniority/language/company and writing instruction. Availability follows server-only provider configuration; an unconfigured request reserves no usage.
- [x] Add versioned structured generation, independent assessment/message/question audit and candidate-only rewrite audit. Share one 45-second deadline across up to three calls, bound each to 1,800 output tokens and use `store: false`, without automatic paid retries. Reject invalid/foreign/duplicate citations before auditing; withhold unsupported numbers, duration interpretations and failed support checks. No qualification verification or local coverage-count change is claimed.
- [x] Reuse the existing account ledger, shared limits, proposal retention/export, revision checks, factual confirmation, accept/reject and Undo. Include all job-review inputs in immutable coaching request hashes while preserving pre-existing general rewrite hashes. Lost-response retries return the stored proposal without another provider call or usage charge; generation failures preserve the CV and remain failed.
- [x] Add guarded synthetic provider transport for an isolated local dev test server, plus adapter/persistence tests for payload exclusion, independent verdicts, failures at every call stage, ownership/consent, changed requests, quotas, stale generation and deletion. Update consent preview, privacy disclosure and README. No database migration, release-scope or skill change.
- [x] Verification: typecheck, all 117 unit tests and isolated production build passed. The affected browser suite passed all 21 cases (2.4 minutes), with two opt-in configuration skips; the two configured synthetic-provider browser cases then passed (18.6 seconds). All 23 distinct affected scenarios passed across these runs. Final focused unit checks also passed after adding full-posting exclusion, concurrency and legacy-hash assertions. Mobile review was visually inspected and dialog overflow asserted. Generated build-only type paths were cleaned, original normal-output type references restored, final typecheck and whitespace checks passed, and isolated browser servers stopped. Initial unit execution used the sandbox's empty default browser cache; rerun with the installed Playwright browser path passed. Initial sandbox build failed Windows path canonicalization; approved normal-host build passed. Full browser suite was not repeated. No live OpenAI call or model-quality result is claimed.
- [ ] Next Q4 gates: broader live synthetic model-quality evaluation, review of the SQL withholding result and the independently labeled 120-pair held-out benchmark; shared Master Vault projections and unified diagnostic history remain queued. The first twelve-case development run is recorded below. Q4 remains partial.

### Sixth Q4 slice — live evaluation harness and independent review protocol, 2026-10-11

- [x] Add a reproducible criterion-coaching evaluation command using the actual provider/context/proposal boundaries and built-in fictional inputs only. Default to a zero-call dry run; explicit live mode accepts 1..24 cases with three-call/1,800-token/shared-45-second bounds, no retries and early stop on authentication/quota/connection failure. Reports save atomically after each case and never include credentials or raw provider error bodies.
- [x] Add 24 agent-authored synthetic development cases, with 12 explicit positives and 12 gaps/adversarial/abstention cases across six role groups, graduate and career-transition sources. Record corpus/prompt hashes, versions, raw versus final judgments, audit verdicts, HTTP status, reported token usage, latency and group denominators. All-abstain behavior cannot pass positive label agreement. Model audits are not independent human ground truth; every report leaves the release gate false.
- [x] Document the independently reviewed 120-pair release protocol and preserve the plan's proposed thresholds: 95% direct-support precision, 90% explicit-must-have recall, zero unsupported sensitive facts in applicable adversarial edits, 80% usefulness and declared-load p95 below 30 seconds. Distinguish full evidence-matching metrics from entry-coaching relevance and abstention; this development corpus does not count toward the held-out gate.
- [x] Attempt the authorized live twelve-case evaluation with the configured model. The first request returned OpenAI HTTP 401 after 894 ms; the run stopped after one attempted call, with zero completed model results and eleven unattempted cases. No account/CV data was read or changed. Preserve the failure report and request private credential correction. Details: [Q4 evaluation review](docs/plans/q4-ai-evaluation-review.md).
- [x] Verification: all 119 unit tests and the isolated production build passed. Focused evaluation tests passed after correcting the CommonJS fixture import and exercising the actual non-English gate when extraction returns no criteria. Final focused auth-failure assertions passed. All 24 dry-run cases validated (23 prepared, one expected language abstention), with zero provider calls. No editor/runtime API change; affected browser flows were not rerun for this tooling-only slice. Generated build-only type paths were cleaned, original normal-output type references restored, final typecheck and whitespace checks passed.
- [x] Resolve live authentication on 2026-10-11 after the user updated `.env.local`: a different stale inherited `OPENAI_API_KEY` took precedence over the file. Clear only that evaluation child process's inherited key, preserving the private file and system settings. The new file key succeeded with configured/returned `gpt-6-luna`. All 12 selected fictional cases completed: 11 passed development checks, raw assessment agreement 12/12, final agreement 11/12, five applicable suggestions, 29 calls, 13,668 input and 4,577 output tokens, sequential completed-case p95 9.564 seconds and zero provider errors. The SQL case's failed assessment audit withheld the draft and changed relevance to uncertain; retain this quality failure rather than treating the run as passed. No account/CV data was read or changed. Archive the original report and findings in the evaluation review.
- [ ] Remaining evaluation gates: independently review the SQL withholding result and recommendation usefulness, evaluate the remaining development cases under an explicit invocation, and obtain the independent 120-pair dataset/labels/reviewer sign-off. Declared-load latency/cost and provider retention remain unverified. Existing app/server launches must resolve the inherited-key override before restarting. Shared Master Vault projections and unified diagnostic history remain queued. Q4 remains partial; release scope/skills are unchanged.

### First Q1 slice — implemented 2026-10-10

- [x] Library opens before the editor. **My CVs** identifies account storage and its email; **On this device** describes shared browser-profile storage. Separate **Practice copies** and **Review older drafts** collections include counts, search, identity, role and update date.
- [x] Add document provenance without changing schema version 1. Older records/backups default to unclassified legacy data; no name-based ownership guesses, deletion, or automatic promotion. Classification is explicit and preserves content. Replacing content imports its classification; duplication/tailoring preserves it.
- [x] Demo gallery is read-only. **Use this design** copies presentation into a new blank personal CV. Fictional practice generation and grader samples stay in practice. Built-in demo contact details use reserved example domains; existing saved CVs are untouched.
- [x] Consolidate resume PDF/DOCX/HTML/Markdown/TXT/JSON and app print, plus cover-letter text/Markdown/copy/print behind `/api/exports`. The legacy PDF endpoint uses the same policy. Account-data downloads retain their existing authorized endpoint. Secondary copy shortcuts now direct users to authenticated editor exports.
- [x] Server verifies session, workspace identity, origin, document ownership and current revision before returning account artifacts; device/recovery snapshots require explicit processing consent and are not saved by exporting. Requests are bounded, rate limited and non-cacheable. Session is checked again after rendering. PDF rendering blocks remote resources and disables JavaScript.
- [x] Sign-in resumes the chosen export and preserves the draft. Recovery export keeps save-error/retry controls. Renderer errors do not fall back to anonymous print. Cover-letter Markdown reflects reviewed edits.
- [x] Disable the unauthenticated billing simulation entitlement grant; unconfigured checkout fails explicitly. A success query parameter no longer activates subscription UI.
- [x] Remove fixed template ATS percentages and the numeric header badge. This does **not** complete the analyzer redesign or validate its remaining scores.

Verification (2026-10-10): `npm run typecheck`, `npm test` (82 tests), `npm run build`, and the complete `npm run test:e2e` (45 tests) passed. Browser coverage includes every export format, anonymous/revoked/foreign-user access, stale revisions, local processing consent, sign-in continuation, failed rendering without print fallback, recovery after failed saves, edited cover-letter Markdown, legacy classification, demo isolation, and mobile layout. Scope files and the 15-entry distribution ZIP match; `git diff --check` passed. Baseline before implementation: typecheck and 77 unit tests passed.

PDF baseline: expanded `scripts/verify-pdfs.py` to all eight templates and corrected its handling of repeated watermark/page footers. All 48 **browser preview/print fixtures** pass exact source-text order, page-count parity, A4/Letter size and contact-link checks. Fixed the Timeline decoration's positioned paint order, which had placed job titles after body text in PDF extraction. Visually inspected the mobile library and representative Classic/Timeline pages. The authenticated server renderer has valid-PDF and authorization coverage but uses the existing standalone HTML layout; matching every preview template and its pagination remains a Q3 requirement. No live email, OAuth, payment, Turso or AI-provider validation is claimed.

### Progress checkpoint and next work

| Work item | State | Evidence / next action |
| --- | --- | --- |
| Q1.1 Personal CVs, demos and legacy review | Complete locally | Library, provenance defaults, blank design cloning, explicit classification and mobile navigation pass browser tests |
| Q1.2 Authenticated export boundary | Complete locally | All existing app formats use verified sessions; direct API, wrong-owner, revoked-session and failure cases pass |
| Q1.3 Verification, recovery and session lifecycle | Complete locally | Verification, reset expiry/reuse, session revocation, pending-export continuation, cross-account pause and draft recovery pass; real sender/delivery and staging remain open |
| Q0 trust/dependency corrections and visual baseline | Complete locally | Patched dependencies and honest findings; 121 UI states reviewed, mobile/tablet defects corrected, 48 print audits and 24 sampled page renders. Typecheck/build, 89 unit tests, 55 browser tests and five final affected-flow checks pass |
| Q2.1 Public landing, catalogs and builder route | Complete locally | Real rendered previews, eight designs/five fictional examples, responsive navigation and explicit blank starts; existing IndexedDB records remain unchanged |
| Q2.2 Dashboard/editor foundation and first-draft guide | Complete locally | Actual thumbnails, search/sort, independent duplication, confirmed revision-checked deletion, guide focus and mobile review/save feedback pass; toolbar/keyboard follow-ups are delivered in Q2.4, while human accessibility review remains open |
| Q2.3 Google sign-in and account navigation | Complete locally — live setup open | Explicit linking, preserved device/paused account drafts, pending exports, Google-only account controls and rate limiting pass synthetic provider tests; credentials and actual Google consent remain unvalidated |
| Q2.4 Typography, toolbar and keyboard accessibility | Complete locally — human audit open | Licensed bundled fonts, grouped disclosure, larger controls, skip/section semantics, dialog focus/return, native Undo protection and preview-to-field focus pass; comprehensive assistive-technology review remains a Q5 gate |
| Q3 Templates and renderer parity | In progress locally | Shared preview/PDF/HTML pagination, semantic Word and 12-design/12-starter collection implemented; all local checks pass; Word/human visual gates are tracked in docs/plans/q3-template-export-review.md |
| Q4 Analyzer and evidence workflow | Partial locally | Diagnostics, local job review and account history delivered; coaching contracts/review UI prepared and locally verified, provider wiring awaiting explicit payload/destination approval; unified history, semantic quality evaluation and held-out benchmark remain open |
| Q5 Live release validation | Queued | Configure and validate email, hosted database, provider services and operations |

Tracking rule: update this checkpoint when work changes state and record the actual validation results. Keep completed local behavior separate from configured or verified production services. Do not infer completion from historical checkboxes or time spent.

### Q1.3 decisions and implementation — 2026-10-10

- [x] Better Auth email verification (24 hours), authenticated resend and refresh controls; editing remains available before verification. CV/cover-letter exports, recovery backups and app print/copy require verified email on the server, including the post-render check. Owner-authorized account-data downloads remain available before verification and without payment.
- [x] Recovery request and separate password-reset page with a 30-minute single-use token, matching-password validation and revocation of every session. Remove token query parameters after capturing them and prevent referrer disclosure. Recovery responses do not reveal whether the account exists; deliver recovery mail through Next.js `after`.
- [x] Resend delivery adapter, bounded requests and explicit unavailable configuration; a development-only private file outbox supports real-token browser tests and is disabled in production. No live emails were sent by validation.
- [x] Watch same-tab/cross-tab notifications, focus, visibility and a 30-second fallback. Expired/changed account workspaces retain their current draft and undo state, stop autosave, and require the original session or explicit device-copy recovery before switching. Retention is in the open tab until the user saves or copies it; it is not a persisted cloud-draft recovery guarantee.
- [x] Isolate browser tests on port 3100, `data/e2e.db` and `.next-e2e`, with no real provider credentials. Existing account deletion still returns to local storage after its explicit confirmation.
- [x] Final regression: `npm run typecheck`, `npm test` (83 tests), `npm run build`, and complete `npm run test:e2e` (50 tests, 3.1 minutes) pass. Browser tests use real SQLite sessions and file-outbox verification/reset tokens, including all CV/letter formats blocked before verification, expired/tampered verification links, resend ownership/origin checks, generic recovery responses, short-password rejection, reset expiry/reuse, revocation of all sessions, old-password rejection, verification/export continuation, changed-account isolation and unsaved draft recovery after sign-out/expiry. Reviewed the 360px recovery screenshot and checked mobile overflow. Feature scope and the 15-entry ZIP agree; `git diff --check` passes.
- [ ] Configure sender/domain and validate real verification/recovery delivery, host background execution and HTTPS links in staging.

Remaining launch gates: configure/live-test verification and recovery email; verify hosting, session controls and shared abuse limits in staging; complete actual-file analyzer diagnostics, evaluated evidence workflows and Q2–Q5. Export rate limiting is process-local and needs shared enforcement for a public multi-instance deployment. Manual browser copying/printing and screenshots remain outside the app's control.

### Q0 trust and dependency corrections — 2026-10-10

- [x] Patch Next.js 16.3.5 → 16.3.8, sharp 0.35.4 → 0.35.5 and source-map-js 1.2.1 → 1.2.2. The installed tree and lockfile agree; `npm audit --json` reports zero vulnerabilities after the updates. This is a dependency audit result, not a production security certification.
- [x] Remove the blended ATS percentage, fixed extraction score, “active verb” classification by non-match, role-fit/depth scores and inferred seniority. Report visible bullet counts, listed vague openings, numeric patterns, contact presence and date-format counts instead; empty/hidden content cannot receive a perfect score.
- [x] Label model serialization as document text. Exported-file reading order, layout hazards and parser compatibility remain **Not checked**; unknown table hazards are represented as `null`. Repeated section labels preserve serialization order without implying file extraction success.
- [x] Require explicit checklist confirmation and repeat it after a changed selection. Unsupported explicit roles and unknown checklist IDs receive general review; hidden experience is excluded from role suggestions. Remove direct suggested-skill insertion, and label numeric examples as fictional and unsupported until the candidate supplies their own outcomes.
- [x] Public reviewer displays finding counts and heuristic requirement overlaps with source bullets/skill terms; no job-fit percentage, enterprise parser simulation or universal privacy claim. Surface import warnings and server-upload disclosure, restrict this upload route to PDF/TXT and mark successful responses no-store. JSON backup restoration remains in the editor. Experimental PDF import is not an actual-file compatibility audit.
- [x] Final validation: `npm run typecheck`, `npm test` (89 tests), `npm run build` and complete `npm run test:e2e` (52 tests, 2.7 minutes) pass. Added six unit cases and two browser journeys covering empty/hidden content, repeated headings, unsupported roles, confirmation resets, read-only suggestions, mobile overflow, upload disclosure/format rejection, PDF import warnings and no-store responses. Reviewed the final 360px analyzer/public reviewer screens and desktop marketing checklist screenshot. `git diff --check` passes; the isolated test server stopped afterward. No live provider credentials were used.
- [x] Complete the selected local route/state visual baseline and fix its concrete navigation, clipping and claim issues; details follow. Q4 still owns actual PDF/DOCX diagnostics, evaluated role rubrics, versioned results and evidence-backed coaching. No live provider or staging validation is claimed here, and no release scope was changed.

### Q0 visual baseline and review fixes — 2026-10-10

- [x] Add a reproducible synthetic Chromium baseline at 360/768/1440 px: 40/41/40 captures (121 total), state manifests, page/dialog overflow and horizontal input/export control bounds. Add a contact-sheet/Poppler review helper and reproduction instructions.
- [x] Review all UI contact sheets plus full-size changed states and mobile pricing/profile/report crops. Fix missing tablet library navigation, off-screen mobile export options, clipped tailoring/letter fields and overridden tailoring badge typography. Remove the inert letter tone selector and unsupported verification/zero-hallucination claims.
- [x] Verification completion checks the current account instead of reporting success from a bare URL; verified, anonymous and expired/error states pass browser assertions. Pricing/profile explain configured caps, proposed services, verified-email exports and actual data handling without unlimited/permanent/refund/security promises.
- [x] Re-run all 48 print fixture audits and visually review 24 representative Poppler page renders across the eight current designs. Preview/print fixtures remain separate from authenticated standalone HTML/server PDF renderer parity.
- [x] Typecheck, 89 unit tests, production build and all 55 browser tests pass (3.3 minutes); five affected browser tests pass after the final badge CSS adjustment (50 seconds). `git diff --check` passes. Feature scope copies/ZIP agree and the isolated test server stopped.

Review record and remaining observations: [Q0 visual baseline review](docs/plans/q0-visual-baseline-review.md). Q2 owns shell/landing polish; Q3 owns renderer/template fidelity; Q4 owns parser/evaluation correctness; Q1/Q5 live service and accessibility gates remain open. No release scope or skill guidance changed.

### Q2.1 public landing, catalogs and builder route — implemented 2026-10-10

- [x] Replace the editor root with the public landing; retain the existing library/editor at `/builder` on the same origin and IndexedDB database. Update editor return links, public reviewer transfers, verification completion and billing return URLs. No storage migration or automatic account upload.
- [x] Public catalogs expose all eight current designs and five labeled fictional profiles, with search/category/reset, actual thumbnails and full paginated detail previews. Public browsing does not open the personal repository. Unknown IDs return 404.
- [x] Choosing a public template/example selects bounded presentation only. Selection/reload/cancellation never writes a document; explicit creation saves one independent personal CV with empty identity and career facts, retaining example provenance when applicable. An existing edited Unicode draft remains byte-for-byte unchanged.
- [x] Shared responsive public shell, three-design live fictional hero, current export/privacy/pricing limits, FAQ and working help/data pages. Use system sans/Georgia for this slice; licensed bundled typography remains queued. Do not claim new templates, evaluated analyzer results, Google sign-in or configured paid services.
- [x] Visually review 32 public states at 360/768/1440 px with reproducible contact sheets and readable crops. Correct nested thumbnail anchors/hydration, heading-rule inheritance, thumbnail link underlines and a wrapped logo. Public styles remain scoped to the new shell.
- [x] Final validation: typecheck, 89 unit tests, production build and the complete 60-test browser suite pass (4.4 minutes). Five public tests pass again after final cosmetic corrections (31.3 seconds). All 48 preview/print PDF audits pass; the separate server-renderer parity gate remains open. `git diff --check` passes, feature scope/distribution/15-entry ZIP agree, and the isolated test server stopped. No live provider services were used.
- [x] Deliver the next dashboard/editor foundation and first-draft-guide slice; acceptance evidence follows.
- [ ] Continue broader Q2 polish, keyboard/accessibility review and live Google validation. Local Google/account implementation is recorded below. Keep Q1 live email/staging gates visible.

Decisions, screenshots and reproduction: [Q2 public shell review](docs/plans/q2-public-shell-review.md). Q2 is partial; this checkpoint records the public slice only. Release scope and skill guidance are unchanged.

### Q2.2 dashboard/editor foundation and first-draft guide — implemented 2026-10-10

- [x] Saved-CV cards render the document's own thumbnail and identify title, candidate, role, design, update date, draft status and storage. Recent/title sorting, collection-preserving search/reset and empty-start guidance do not seed fictional records. Practice and legacy collections retain their existing classification boundaries.
- [x] Duplicate flushes pending edits and reads the latest saved revision before creating independent IDs with the same purpose/provenance. Dashboard/editor deletion share a native confirmation and revision-checked handler. Cancellation writes nothing; a concurrent newer revision is preserved and reports a conflict. Account actions leave device documents unchanged.
- [x] Apply the shared paper/mist/ink/blue/teal direction to workspace chrome and identify the current CV in the editor heading. Add mobile Review and scrolling save feedback. Collapsible guidance for blank/example-design personal starts focuses contact or career fields without adding facts, scores or entries. Imported/practice CVs are not forced through it.
- [x] Capture 20 dashboard states with overflow/control manifests plus one populated desktop A4/Letter gallery (21 images). Review all dashboard contact sheets and readable changed states, sampled existing mobile/tablet/desktop dialogs and 24 representative print-page renders. Correct template-text CSS inheritance, button-centering inheritance, paper-size thumbnail proportions and tablet brand/action crowding. All 20 dashboard and 121 baseline states pass horizontal-overflow measurements.
- [x] Final verification: `npm run typecheck`, `npm test` (89 tests), `npm run build` and the full `npm run test:e2e` (66 tests, 3.8 minutes) pass. Nine dashboard/baseline tests pass after final visual corrections (1.1 minutes). All 48 preview/print PDF audits pass. Scope/distribution/15-entry ZIP agree; `git diff --check` passes and the isolated test server is stopped. No live provider services were used.
- [x] Deliver local Google sign-in/account navigation in the subsequent Q2.3 slice below.
- [x] Deliver licensed bundled fonts, toolbar disclosure and keyboard/focus improvements in the subsequent Q2.4 slice below. Comprehensive assistive-technology review remains open. Q1/Q5 live OAuth/email validation, Q3 preview/server-PDF/DOCX fidelity and Q4 actual-file/evidence evaluations remain separate gates.

Decisions and reproduction: [Q2 dashboard/editor review](docs/plans/q2-dashboard-editor-review.md). Q2 remains partial; release scope and skill guidance are unchanged.

### Q2.3 Google sign-in and account navigation — implemented 2026-10-10

- [x] Register Google through the installed Better Auth provider only when both server-only credentials exist. Keep fixed callback origins and identity scopes, explicit account selection, server-validated state/PKCE and the provider HTTP handler's rate limiting. Expose only availability/method flags in account metadata; restrict callback routing to Google and existing email verification/recovery GETs.
- [x] Disable implicit email-based linking and different-email links. Explicit linking requires the authenticated workspace owner, verified account email and a sign-in within ten minutes. Google-only users can set a password through email recovery, retaining Google while revoking sessions. Confirmed account deletion requires the current password or a Google-only session less than ten minutes old.
- [x] Separate sign-in window retains the editor, facts, undo and pending export. Cancellation/closure/blocking/failure reports retained drafts. Authenticated device editing now retains the device workspace choice on reload for email and Google sign-in. A changed Google identity pauses the original account draft; explicit device recovery remains available. No automatic CV upload or Google profile-to-CV insertion.
- [x] Add Profile, Plans, Help and Data & privacy navigation inside Account settings. Header/account navigation flushes edits before leaving, retaining the editor after a failed save. Update current Google data handling and deletion information; no schema, entitlement or export-format changes.
- [x] Final verification: `npm run typecheck`, `npm test` (89 tests), isolated `npm run build` (`NEXT_DIST_DIR=.next-e2e`) and full `npm run test:e2e` with the synthetic Google provider pass (76 tests, 5.2 minutes; unconfigured case intentionally skipped). The separate unconfigured-provider run passes (one test, 14.3 seconds). Ten final focused Google tests pass (1.2 minutes), including actual 429 responses. All 48 preview/print PDF audits and 121 baseline overflow checks pass. Review all six new account captures at 360/768/1440 px. Scope/distribution/15-entry ZIP agree and `git diff --check` passes. Test server stopped; normal port 3000 remains available.
- [ ] Configure Google Web OAuth credentials, consent/audience, exact local/HTTPS callback URIs and validate real Google/browser behavior in staging. Local availability is false without credentials; no live Google, email, payment, hosted database or AI provider validation is claimed. Local fonts/toolbar/keyboard work is delivered in Q2.4 below; comprehensive assistive-technology and the separate Q3–Q5 gates remain open.

Decisions, setup and reproduction: [Q2 Google/account review](docs/plans/q2-google-account-review.md). Q2 remains partial; release scope and skill guidance are unchanged.

### Q2.4 bundled typography, toolbar disclosure and keyboard polish — implemented 2026-10-10

- [x] Bundle unmodified Source Sans 3 and Source Serif 4 WOFF2 assets from pinned Adobe commits with upstream SIL Open Font License notices and SHA-256 provenance. Product controls/display headings use `next/font/local`; browser and build need no font-service requests. Saved resume fonts and paper metrics remain separate.
- [x] Keep the CV picker, Undo, Design and Export prominent. More tools reveals named CV-management, writing and fictional-example groups in normal flow; Escape restores its trigger. Export retains native tab navigation, Escape/blur closure and disabled busy actions. Toolbar text is at least 14px and controls at least 44px across 360/768/1440px; mobile editor fields use 16px.
- [x] Add a workspace skip link, selected-section semantics, visible blue focus, readable editor placeholders, photo-input focus and reduced-motion behavior. Keyboard preview selection focuses the matching contact or selected entry field. Resume facts, persistence, ownership and export policies remain unchanged.
- [x] Share dialog focus confinement, Tab/Shift+Tab wrapping, top-dialog Escape and launcher return, including React development replay and inert workspaces. Gallery cancellation returns to Design; import review remains outside the inert workspace. Thumbnail links cannot enter keyboard navigation. Prevent document/native Undo from changing the background draft while a dialog button is focused.
- [x] Final verification: `npm run typecheck`, `npm test` (89 tests), isolated `npm run build` (`NEXT_DIST_DIR=.next-e2e`) and complete `npm run test:e2e` with synthetic Google pass (82 tests, 6.1 minutes; the unconfigured case is intentionally skipped). The separate unconfigured run passes (one test, 10.6 seconds), exercising all 83 distinct cases across the two configurations. All 48 preview/print PDF audits, 121 baseline and 20 dashboard overflow/control checks pass. Review six toolbar captures, public heroes at all three widths, sampled public/dashboard states and 24 representative print pages. Five core colors against white pass measured text contrast (5.01–15.22:1). Scope/distribution/15-entry ZIP and font hashes agree; `git diff --check` passes.
- [ ] Human screen-reader, high-zoom/forced-colors and broader browser/device validation remain Q5 gates; no accessibility conformance claim is made. Live Google/email/hosted-service validation remains open. Next local work is Q3 preview/server-PDF/DOCX fidelity and template refinement; Q4 evidence/diagnostics evaluations remain queued.

Decisions and reproduction: [Q2 editor polish review](docs/plans/q2-editor-polish-review.md). Q2 remains partial because live OAuth and human release validation are open. Feature scope and distributed skill guidance are unchanged.

### Q3 renderer and collection implementation — 2026-10-10

- [x] Shared layout blocks, presentation tokens, template CSS and measured pagination for preview, authenticated PDF, standalone HTML and app print. Keep the existing export authorization/consent/revision/watermark policies.
- [x] Bundle resume fonts, keep saved setting keys, use 11 pt for new blank documents and optional photos off. Respect photo-support flags and exclude external image URLs; unsafe websites remain plain text.
- [x] Generate editable DOCX with semantic headings/numbered lists, links, chosen font/color/density/page settings and a footer watermark; disclose reflow and omitted photo/decorative layout.
- [x] Add Consulting, Portfolio, Brand and Research designs for 12 total, and seven fictional starters for 12 total. Public browsing/design-only starts remain isolated from personal career facts. Add synthetic job briefs and evidence-annotated rewrites.
- [x] Deliver the optional Creative contact sidebar with mirrored RTL placement, aligned Timeline date cells, style/column/career-stage/format filters, short/long sample selection, full paginated comparison and matching letterhead. Shared authorized letter printing uses reviewed text without changing the saved CV. Render version and production asset tracing are explicit; local data/test artifacts are excluded.
- [x] Typecheck, 91 unit tests, production build and all 92 distinct browser cases across configured/unconfigured Google runs pass. All 172 PDF and 72 DOCX audits pass. Review 72 sampled print pages and catalog/letter/sidebar/date states; three final catalog/letter checks pass after a thumbnail correction. Compiled-renderer smoke and asset tracing, 121 baseline/20 dashboard overflow checks, font/scope/ZIP integrity and `git diff --check` pass. Detailed evidence is recorded in [Q3 review](docs/plans/q3-template-export-review.md).
- [x] Pagination refinement (`2026-10-11.q3.2`): measure each candidate page in its rendered context, counting shared sidebar/inline contact rows once. Creative short fixtures now fit one page in A4 and Letter without changing facts or font size; preserve short-entry/heading rules and grapheme-safe splitting for long content.
- [x] Final refinement checks pass: typecheck, 92 unit tests, all 92 distinct browser cases across configured/unconfigured Google runs, 172 PDF and 72 DOCX audits, production build/compiled-renderer smoke, 72 sampled print-page reviews, 121 baseline/20 dashboard overflow checks, asset/scope/ZIP integrity and `git diff --check`. Detailed current evidence is recorded in [Q3 review](docs/plans/q3-template-export-review.md).
- [ ] Word/LibreOffice visual checks, human content/design sign-off, script-specific/cross-platform review and broader page-break preferences remain open. Q3 remains in progress against the full release gate.

## Historical blueprint and implementation records

The sections below preserve earlier scope, decisions, and reported test results. Statements about anonymous exports, template counts, feature availability, universal ATS behavior, or completed release readiness must be interpreted in their historical context and checked against the current roadmap.

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

- [x] Implement server provider adapter, contextual chat, and structured proposals.
- [x] Add fact collection, summary generation, bullet rewrites, and skill suggestions.
- [x] Add evidence checks, before/after review, atomic acceptance, undo, and retry protection.
- [x] Evaluate unsupported metrics, prompt injection, cross-user targets, stale revisions, malformed output, and timeouts.

Gate: evaluation fixtures cannot add unsupported facts or mutate unauthorized targets; failures preserve saved content. A mocked chatbot is labeled as a demo and does not satisfy this gate.

### Phase 5 - Imports and job tailoring

- [x] Add staged LinkedIn CSV/ZIP import, pasted-text parsing, and merge/replace review.
- [x] Add job requirement extraction, evidence matching, and tailored variants.
- [x] Add transparent local audit findings and a basic searchable skill library.

Gate: partial/malformed imports expose warnings without destructive writes; missing requirements remain gaps; AI processing disclosures match actual network behavior.

### Phase 6 - Release readiness

- [x] Add deterministic server PDF rendering if required by hosted export promises.
- [x] Complete keyboard and screen-reader checks, loading/empty/error states, and supported-browser checks.
- [x] Verify rate limits, operational logging, data retention, backups, and restoration.
- [x] Run the end-to-end creation-to-export journey and document remaining limitations.

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

For new work, start with the current Q0–Q5 roadmap above. Inspect repository state before each milestone, preserve unrelated changes, implement a reviewable slice, and run the checks relevant to that slice. Update this plan with completed checkboxes and actual decisions as implementation progresses. Do not mark a milestone complete because its screens exist if its persistence, integrations, or acceptance behavior are still mocked.

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

## 18. UX Modernization & Editor Refactor — 2026-10-02

Delivered Phase A of the strategic modernization plan (`docs/plans/product-review-ux-and-niche-commercialization-plan.md`):

1. **Monolith Studio Decomposition**:
   - Refactored `src/components/resume-studio.tsx` into modular components under `src/components/editor/`:
     - `EditorHeader.tsx`: App branding, workspace badges, avatar, and save-state indicators.
     - `DocumentToolbar.tsx`: Document switcher, new/duplicate/import actions, session undo, design panel trigger, AI assistant trigger, and export dropdown.
     - `EditorSidebar.tsx`: Section navigation rail with numbering, visibility markers, and storage notes.
     - `SectionEditor.tsx`: Polymorphic section container handling contact info, section order/visibility, and entry cards.
     - `BulletList.tsx`: Streamlined accomplishment list editor.
     - `InlineAiMagicBar.tsx`: Contextual diff popover for active bullets.
     - `Field.tsx`: Accessible input/textarea wrapper with ref forwarding and keyboard navigation handlers.

2. **Keyboard-Driven Bullet Flow**:
   - `Enter` key on any bullet inserts a new bullet below and transfers focus immediately.
   - `Backspace` on an empty bullet removes it and returns focus to the preceding bullet.
   - `Alt + ArrowUp` and `Alt + ArrowDown` accessible keyboard shortcuts swap adjacent bullets.
   - Arrow keys smoothly navigate across bullet boundaries when caret is at the start/end.
   - Accessible drag-and-drop handles (`⋮⋮`).

3. **Bidirectional Preview-to-Editor Sync**:
   - Added `onBlockClick` callback to `ResumePreview` and `ResumeBlock` in `src/components/resume-preview.tsx`.
   - Clicking any rendered element in the preview (name, contact, section, entry, or bullet) identifies the target ID, selects the appropriate section, scrolls the element into view with an animated highlight ring (`.ring-target`), and switches to the editor view on mobile.

4. **Inline Contextual AI Magic Bar**:
   - Integrated floating action chips directly on bullets: `✨ Improve phrasing`, `📊 Add metric (XYZ)`, `📏 Make concise`.
   - In-place diff view with `<del>` and `<ins>` markup and 1-keystroke confirmation: `Tab` to accept, `Esc` to dismiss.

Verification:
- `npm run typecheck` passed (zero errors).
- `npm test` passed (16/16 domain, component, and repository tests, including new bidirectional sync and bullet invariant tests).
- `npm run build` passed (Next.js production build succeeded).
- `npm run test:e2e` passed (13/13 Playwright end-to-end browser journeys passed in 47.3s).

## 19. Phase B: Cold-Start PDF/Text Onboarding & Import Review Modal — 2026-10-02

Delivered Phase B of the strategic modernization plan (`docs/plans/product-review-ux-and-niche-commercialization-plan.md`):

1. **Pure TypeScript PDF Stream Text Extractor**:
   - Implemented `src/lib/importers/pdf-text-extractor.ts` without external binary dependencies.
   - Decompresses `/FlateDecode` streams using standard zlib and extracts font encodings, text matrices, and operators (`BT`, `ET`, `Tj`, `TJ`, `'`, `"`, `Td`, `TD`, `T*`, `Tm`).
   - Resolves octal escapes (`\ooo`), escaped parentheses, and hex-encoded string literals (`<...>`).

2. **Heuristic Plain-Text Resume Parser**:
   - Implemented `src/lib/importers/text-resume-parser.ts` mapping unstructured plain text to `ResumeDocument` matching `documentSchema`.
   - Contact detail extraction: email address regex, phone numbers, website/portfolio links, locations, and candidate headline.
   - Section header classification: detects standard section labels (`Experience`, `Education`, `Skills`, `Projects`, `Summary`, `Certifications`, `Languages`) across common heading conventions.
   - Date range parsing: converts month names, abbreviations, and numerical years into standard YYYY / YYYY-MM bounds.
   - Bullet extraction: captures bullet glyphs (`•`, `*`, `-`, `–`, `—`, `▪`, `▫`) and numbered lists into individual accomplishment bullets.

3. **Multi-Format Import API**:
   - Created `src/app/api/resumes/import-file/route.ts` handling `multipart/form-data` uploads up to 5 MB for PDF and plain-text files.
   - Returns structured `ResumeDocument` with extraction warnings for review.

4. **Cold-Start Dropzone & Import Review Modal**:
   - Created `src/components/editor/ColdStartImporter.tsx`: Clean drag-and-drop zone with animated upload indicators.
   - Created `src/components/editor/ImportReviewModal.tsx`: Visual audit screen presenting parsed contact info, detected sections, entry counts, bullet counts, and extraction warnings before committing to a new resume or replacing active content.
   - Updated `src/components/resume-studio.tsx` with intelligent JSON vs. text/PDF file detection and staging.

Verification:
- `npm run typecheck` passed (0 errors).
- `npm test` passed (18/18 domain, component, and importer unit tests).
- `npm run build` passed (Next.js production build succeeded with Turbopack).
- `npm run test:e2e` passed (13/13 Playwright end-to-end browser journeys passed in 40.8s).

## 20. Phase C: Master Career Vault, 1-Click Job Tailoring & Google XYZ Impact Coach — 2026-10-02

Delivered Phase C of the strategic modernization plan (`docs/plans/product-review-ux-and-niche-commercialization-plan.md`):

1. **Master Career Vault Data Model & Ingestion**:
   - Implemented `src/lib/vault/vault-model.ts` with Zod schemas for `CareerVault`, `VaultItem`, `VaultBullet`, and `SkillInventoryItem`.
   - Built `documentToVault(doc)` ingesting active resumes into an uncompressed master inventory with automated skill categorization (`frontend`, `backend`, `cloud`, `data`, `ai`, `product`, `general`).

2. **Job Description Extraction & Evidence Matching Engine**:
   - Implemented `src/lib/vault/job-tailoring.ts` with technical synonym normalization (e.g. `K8s` -> `Kubernetes`, `Postgres` -> `PostgreSQL`, `TS` -> `TypeScript`, `AWS`, `Docker`, `CI/CD`).
   - Parsed job descriptions into weighted Hard Requirements (`weight: 1.0`) and Preferred Qualifications (`weight: 0.5`).
   - Transparent Coverage Score formula:
     $$\text{Coverage Score} = \frac{\sum_{\text{matched } r \in R} \text{weight}(r)}{\sum_{r \in R} \text{weight}(r)} \times 100\%$$
   - Segregated Matched Evidence (with pointers to candidate's exact bullets and skills) from Skill Gaps.
   - **Anti-Hallucination Invariant**: Missing requirements are never converted into candidate skills or inserted into bullets as false statements.

3. **1-Click Targeted Variant Generation**:
   - Generates independent, named variants (e.g., `Alex Morgan — Senior Product Designer at Acme Corp (Tailored)`).
   - Re-ranks experience and project bullets to prioritize accomplishments evidencing target job criteria at the top of each role.
   - Re-orders technical skills sections to highlight matching competencies first.

4. **Google XYZ Impact Coach**:
   - Implemented `src/lib/vault/impact-coach.ts` evaluating bullets against the formula: *"Accomplished [X], as measured by [Y], by doing [Z]"*.
   - Flags passive openings (*"Responsible for"*, *"Worked on"*) and missing quantifiable metrics.
   - Elicits real verified candidate metrics across Latency, Scale, Cost, Revenue, and Team Velocity categories.
   - Synthesizes formatted accomplishment bullets with zero invented numbers.

5. **User Interface Integration**:
   - `src/components/vault/JobTailorModal.tsx`: Job description paste zone, live coverage score gauge, matched evidence review, and 1-click tailored resume generation.
   - `src/components/vault/XyzCoachModal.tsx`: Interactive Google XYZ coach and metric template picker.
   - Integrated "🎯 Tailor for job" into `DocumentToolbar.tsx` and updated `InlineAiMagicBar.tsx`.

## 21. Phase D: ATS Heuristic Quality Linter & Plain-Text Stream Inspector — 2026-10-02

Delivered Phase D of the strategic modernization plan (`docs/plans/product-review-ux-and-niche-commercialization-plan.md`):

1. **Deterministic Writing & Formatting Linter**:
   - Implemented `src/lib/linter/ats-linter.ts` running real-time client heuristics.
   - Detects weak/passive verb openings using regex patterns.
   - Detects quantifiable metrics (percentages, currency symbols `$`, `€`, `£`, multipliers `3x`, latency `ms`, scale `users`, `requests`, `clusters`, `microservices`).
   - Audits bullet length (flags bullets < 5 words or > 40 words).
   - Checks contact completeness and date format consistency (`YYYY` or `YYYY-MM`).
   - Calculates composite ATS Readiness Score (0–100%):
     $$\text{Score} = 0.25 S_{\text{verbs}} + 0.30 S_{\text{metrics}} + 0.25 S_{\text{extraction}} + 0.20 S_{\text{hygiene}}$$

2. **ATS Plain-Text Diagnostic Inspector**:
   - Implemented `src/lib/linter/ats-plain-text.ts` simulating enterprise parser behavior (Workday, Taleo, Greenhouse, iCIMS).
   - Linearizes documents into flat UTF-8 streams verifying candidate name at line 0 and strictly sequential section reading order.
   - Validates character set hygiene and absence of layout table hazards.

3. **ATS Readiness Panel UI**:
   - Implemented `src/components/editor/AtsReadinessPanel.tsx` with color-coded score hero, subscore metric breakdown, actionable recommendations list with direct editor jump navigation, and live "Robot Plain-Text View".
   - Integrated live `⚡ XX% ATS` pill into `EditorHeader.tsx`.

Verification across Phases C & D:
- `npm run typecheck` passed (0 errors).
- `npm test` passed (29/29 domain, repository, importer, vault, tailoring, and ATS linter tests).
- `npm run build` passed (Turbopack production build succeeded cleanly).
- `npm run test:e2e` passed (15/15 Playwright end-to-end browser journeys passed in 34.2s).

## 22. Phase E: SaaS Monetization, Stripe Billing Infrastructure & Entitlements — 2026-10-02

Delivered Phase E of the strategic monetization plan (`docs/plans/product-review-ux-and-niche-commercialization-plan.md`):

1. **Database Schema & Migrations**:
   - Added `migrations/004-subscriptions.sql` creating `subscriptions` (`user_id` unique, `plan_id`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`) and `subscription_usage` (monthly quotas).
   - Applied migration cleanly via `npm run db:setup`.
   - Updated Drizzle schema definitions in `src/lib/server/schema.ts`.

2. **Isomorphic Billing Plans & Entitlements**:
   - Implemented `src/lib/billing-plans.ts` defining commercial tiers:
     - **Free / Local Tier ($0)**: 1 active variant, unlimited browser editing, standard export with subtle watermark.
     - **Job Hunter Weekly Pass ($9/wk)**: Unlimited variants, 50 tailored apps/mo, watermark-free PDF/DOCX, all 4 templates, full Career Vault.
     - **Job Hunter Monthly Pass ($19/mo)**: Everything in Weekly, priority AI queue, Google XYZ Impact Coach, multi-device cloud sync.
     - **Lifetime Career Pass ($79 one-time)**: Permanent Vault access, unlimited tailoring, lifetime clean exports.
   - Implemented `src/lib/server/entitlements.ts` providing server-side entitlement checks (`watermark_free_export`, `unlimited_variants`, `career_vault_storage`, `job_tailoring_engine`, `all_templates`) and monthly usage counters.

3. **Stripe Integration & Offline Simulation**:
   - Implemented `src/lib/server/stripe.ts` supporting both live Stripe Hosted Checkout/Customer Portal and an offline development simulation mode (`/api/billing/mock-success`).
   - Built REST endpoints:
     - `GET /api/billing/subscription`: Fetches user's plan and entitlements.
     - `POST /api/billing/checkout`: Starts Stripe checkout session or simulation callback.
     - `POST /api/billing/portal`: Opens Stripe Billing Portal for self-service card management and cancellation.
     - `POST /api/billing/webhook`: Idempotent cryptographic webhook handler for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`.

4. **Export Watermark Controls**:
   - Updated `src/components/resume-preview.tsx` and `src/app/templates.css` with `.page-watermark` outside `.page-content` in `.page-sheet`.
   - Displays *"Created with AI CV Builder"* on free tier; omitted automatically for active subscribers.

5. **Pricing UI & Studio Header Integration**:
   - Created `src/components/billing/PricingModal.tsx` showing commercial tiers, feature matrices, and 1-click checkout.
   - Added `⭐ Upgrade` / `⭐ Pass Active` pill to `EditorHeader.tsx`.
   - Responsive CSS hiding badges on mobile viewports (< 640px) to prevent horizontal scrollbars.

## 23. Public Free ATS Grader & Lead Magnet (`/grader`) — 2026-10-02

Delivered the public growth engine and lead magnet:

1. **Public Lead Magnet Route (`src/app/grader/page.tsx`)**:
   - Unauthenticated funnel accessible to all candidates.
   - Two-panel layout supporting PDF/TXT/JSON drag-and-drop file upload or raw text paste.
   - "Load Sample" button for 1-click testing with realistic tech/product resumes and job requirements.
   - Optional target job description input.

2. **Client-Side Deterministic Analysis Engine**:
   - Runs client-side ATS linter heuristics (`score`, `verbsScore`, `metricsScore`, `issues`).
   - Runs job requirement extraction and keyword coverage calculation (`coverageScore`, `matchedEvidence`, `skillGaps`).
   - Generates simulated linear plain-text stream with 1-click clipboard copy.

3. **High-Converting Studio Transition**:
   - Interactive diagnostic report displaying composite score, metric breakdown cards, and recommendations.
   - *"Open in AI Studio to Fix & Tailor ↗"* button: Saves the parsed document directly into client-side IndexedDB storage and navigates seamlessly to the editor (`/`).

Verification:
- `npm run typecheck` passed (0 errors).
- `npm test` passed (31/31 unit tests across all 10 suites).
- `npm run test:e2e` passed (17/17 Playwright end-to-end browser journeys passed in 44.5s).
- `npm run build` passed (Next.js production build cleanly generated static and dynamic routes).

## 24. Export System Expansion & Evidence-Grounded Cover Letter Generator — 2026-10-02

Delivered multi-format export capabilities and an automated tailored cover letter generator:

1. **Expanded Multi-Format Exporters**:
   - **Semantic Markdown Exporter (`src/lib/exporters/markdown-exporter.ts`)**:
     - Exports documents to clean GFM Markdown with headers, metadata, bullet lists, and contact info.
   - **Standalone HTML5 Exporter (`src/lib/exporters/html-exporter.ts`)**:
     - Generates portable, offline HTML documents with embedded layout styles, typography, print stylesheets, and XSS sanitization.
     - Respects subscription status by conditionally attaching the subtle *"Created with AI CV Builder"* footer watermark for free users.
   - **Zero-Dependency OpenXML DOCX Exporter (`src/lib/exporters/docx-exporter.ts` & `zip-writer.ts`)**:
     - Built pure TypeScript Store-mode PKZIP writer (`SimpleZip`) with hardware-speed CRC32 table calculation.
     - Generates valid WordprocessingML OpenXML packages (.docx) with document styles, heading styles, bullet runs, and metadata.
   - **UI Integration**:
     - Updated `DocumentToolbar.tsx` export dropdown with Standalone HTML (.html), Word Document (.docx), Markdown (.md), Plain text (.txt), and Backup (.json).
     - Connected `checkedExport` and `exportFile` in `resume-studio.tsx` with Blob download dispatching.

2. **Automated Tailored Cover Letter Generator**:
   - **Deterministic Generator Engine (`src/lib/vault/cover-letter.ts`)**:
     - Ingests target job details (Role, Company, Hiring Manager, Job Description).
     - Runs job requirement extraction and candidate evidence matching against the active resume or vault.
     - Enforces the **Anti-Hallucination Invariant**: every metric, past role, and technical achievement cited is drawn directly from verified candidate resume entries.
     - Structures the letter into executive opening, high-impact achievements with metrics, skill alignment, and confident closing call-to-action.
     - Provides formatting into both plain text and Markdown.
   - **Cover Letter Modal UI (`src/components/vault/CoverLetterModal.tsx`)**:
     - Added toolbar button `✉️ Cover letter` next to `🎯 Tailor for job`.
     - Provides real-time job input fields and live generation.
     - Features an in-modal editable text canvas for pre-export tweaks.
     - 1-click actions: "📋 Copy to Clipboard", "Download .txt", and "Download .md".

3. **Skills & Repository Synchronization**:
   - Updated `.agents/skills/resume-builder-career-vault/SKILL.md` with cover letter generation principles.
   - Synchronized `resume-builder-skills/` and re-compressed `resume-builder-skills.zip`.

Verification:
- `npm run typecheck` passed (0 errors).
- `npm test` passed (37/37 unit tests across all 12 suites).
- `npm run test:e2e` passed (19/19 Playwright end-to-end browser journeys passed in 1.1m).
- `npm run build` passed (Next.js Turbopack production build succeeded cleanly).

## 25. Interactive Preview Zoom Controls, LinkedIn CSV Importer & Version History Snapshots — 2026-10-02

Delivered preview inspection ergonomics, cold-start LinkedIn data archive parsing, and immutable version history checkpoints:

1. **Interactive Preview Zoom Controls & Stage Toolbar**:
   - Updated `src/components/resume-preview.tsx` and `src/app/templates.css`.
   - Added stage floating zoom controls: `−` (zoom out down to 35%), `+` (zoom in up to 175%), `Fit` (auto-fit to viewport width), `100%` (actual physical print scale), and a real-time percentage badge.
   - Enabled horizontal overflow scrolling (`overflow-x: auto`) for high-zoom desktop inspection without clipping or page corruption.

2. **LinkedIn Data Archive CSV Importer**:
   - Implemented `src/lib/importers/linkedin-importer.ts` with RFC 4180 multiline CSV parser, LinkedIn CSV signature detector (`isLinkedInCsv`), and multi-file archive assembler (`parseLinkedInArchive`).
   - Added robust date normalization (`normalizeLinkedInDate`) converting varied LinkedIn dates (`"Jan 2022"`, `"2022-01"`, `"01/2022"`, `"2022"`) into strict schema-compliant `YYYY` or `YYYY-MM` formats.
   - Integrated CSV upload into `ColdStartImporter.tsx` and backup staging in `resume-studio.tsx`.
   - Verified unit tests in `tests/linkedin-importer.test.ts`.

3. **Version History & Checkpoint Snapshots Engine**:
   - Implemented `src/lib/snapshots.ts` providing immutable snapshot creation, structural diff computation (`computeSnapshotDiff`), and local storage operations (with a 30-checkpoint cap per document).
   - Built `src/components/editor/VersionHistoryModal.tsx` with timeline view, diff summary badges, "Restore Version", "Fork Variant", and checkpoint creation.
   - Added `⏱️ History` button in `DocumentToolbar.tsx` and connected modal in `resume-studio.tsx`.
   - Verified unit tests in `tests/snapshots.test.ts`.

4. **Playwright E2E Suite Expansion**:
   - Added browser tests in `tests/e2e/editor.spec.ts` for preview zoom controls, version history checkpoints/forking, and LinkedIn CSV ingestion.
   - All 22 Playwright tests pass cleanly (39.3s). Total unit tests: 43/43 passing across 13 suites.

## 26. Reusable Custom Sections Engine & Preset Library — 2026-10-02

Delivered dynamic custom sections architecture, starter preset templates, cross-resume section discovery, and reusable library storage:

1. **Document Model & Schema Integration**:
   - Extended `SectionType` in `src/lib/document.ts` to include `"custom"`.
   - Separated `standardSectionTypes` (7 default sections) from `sectionTypes`, ensuring default resumes and backward compatibility remain 100% stable.
   - Added `createCustomSection` helper function.
   - Updated `vaultItemSchema` in `src/lib/vault/vault-model.ts` to support `"custom"` items.
   - Enhanced `generateTailoredVariant` in `src/lib/vault/job-tailoring.ts` to re-rank matching accomplishment bullets inside custom sections.
   - Extended `text-resume-parser.ts` to detect and parse common custom sections (Volunteer, Publications, Speaking, Awards, Patents, Leadership).

2. **Custom Section Presets & Reusable Library Engine**:
   - Implemented `src/lib/custom-sections.ts` with 7 rich presets:
     - Volunteer Experience (`🤝`)
     - Publications & Research (`📚`)
     - Speaking & Conferences (`🎙️`)
     - Awards & Honors (`🏆`)
     - Patents & Inventions (`💡`)
     - Teaching & Mentorship (`🎓`)
     - Leadership & Activities (`🌟`)
   - Built candidate section library persistence in local storage (`cv_custom_sections_library`).
   - Implemented `getReusableSectionsFromDocuments` scanning other candidate resumes to reuse previously drafted custom sections with 1 click.

3. **User Interface & Modal Workflow**:
   - Built `src/components/editor/AddSectionModal.tsx` featuring:
     - Popular Presets tab with 1-click card selection and "Include starter example" toggle.
     - Saved Library tab with cross-resume section imports and deletion controls.
     - Custom Blank Section tab with custom name input.
   - Added `＋ Add section` button to `EditorSidebar.tsx`.
   - Updated `SectionEditor.tsx` with customized field labels for custom sections, `💾 Save` to reusable library button, and `🗑️ Remove section` button (with full undo safety).
   - Added modern CSS styles in `src/app/globals.css`.

4. **Verification**:
   - `npm run typecheck` passed (0 errors).
   - `npm test` passed (50/50 unit tests across 14 suites in 913ms, including new suite `tests/custom-sections.test.ts`).
   - `npm run test:e2e` passed (23/23 Playwright journeys in 41.1s, including custom sections workflow).
   - `npm run build` passed (Next.js Turbopack production build succeeded cleanly).

## 27. RTL & Multilingual Template Engine — 2026-10-02

Delivered bidirectional layout architecture, RTL template styling, export bidi generation, and design controls for Arabic, Hebrew, and multilingual resumes:

1. **Document Model & Presentation Schema**:
   - Extended `presentationSchema` in `src/lib/presentation.ts` with `direction: z.enum(["ltr", "rtl"]).default("ltr")`.
   - Backward-compatible invariant safety: existing documents and fixture backups automatically default to `"ltr"`.
   - Enhanced font family definitions with Unicode and RTL fallback fonts (`'Segoe UI'`, `Tahoma`, `'Traditional Arabic'`).

2. **Template Layout & Bidirectional Rendering**:
   - Updated `presentationStyle` and `presentationClass` in `src/components/resume-preview.tsx` to inject `direction: p.direction ?? "ltr"` and `" rtl"` class name.
   - Injected explicit `dir={doc.presentation.direction ?? "ltr"}` attributes into `.layout-measure`, `.paginated-resume`, and `.page-sheet`.
   - Added bidirectional CSS rules to `src/app/templates.css`: inverted bullet margins, right-aligned section headings, mirrored Creative sidebar gradients and border offsets.

3. **Design Controls**:
   - Added Reading Direction selector (`LTR` vs `RTL - العربية / עברית`) to `src/components/design-panel.tsx`.

4. **Document Exporters**:
   - Standalone HTML exporter (`src/lib/exporters/html-exporter.ts`): injects `<html lang="ar" dir="rtl">` and RTL CSS rules.
   - DOCX exporter (`src/lib/exporters/docx-exporter.ts`): outputs OpenXML WordprocessingML `<w:bidi/>`, right-aligned paragraph properties `<w:jc w:val="right"/>`, and right-hanging bullet indentation (`<w:ind w:right="360" w:hanging="180"/>`).

5. **Verification**:
   - Added unit test in `tests/document.test.ts` validating reading direction schema and defaults.
   - Added unit test in `tests/exporters.test.ts` verifying HTML `dir="rtl"` and Word DOCX `<w:bidi/>` output.
   - Added Playwright browser test in `tests/e2e/templates.spec.ts` testing live LTR/RTL switching, DOM attributes, and pagination readiness.
   - `npm test` passed (52/52 unit tests across 14 suites).
   - `npx playwright test tests/e2e/templates.spec.ts -g "RTL reading direction"` passed cleanly.

## 28. Searchable Skills Taxonomy Engine & Autocomplete System — 2026-10-02

Delivered a comprehensive tech and professional skills taxonomy, rank-ordered autocomplete search, interactive tag chips, category presets, and bidirectional text synchronization:

1. **Searchable Skills Taxonomy Engine (`src/lib/skills-taxonomy.ts`)**:
   - Curated catalog of standard skills spanning 9 core categories:
     - Frontend & Web
     - Backend & Systems
     - Cloud & DevOps
     - Databases & Storage
     - Data Science & AI
     - Mobile Development
     - Product & Design
     - Testing & Quality
     - Leadership & Agile
   - Synonym mapping and canonical resolution (`k8s` -> `Kubernetes`, `py` -> `Python`, `postgres` -> `PostgreSQL`, `ts` -> `TypeScript`, `aws` -> `AWS`, `cicd` -> `CI/CD`).
   - Multi-tier ranking algorithm prioritizing exact matches, prefixes, aliases, and category boosts.
   - Ingestion and formatting utilities (`parseSkillsFromText`, `addSkillToText`, `removeSkillFromText`, `formatSkillsList`) supporting middle-dot (`·`), comma (`,`), bullet (`•`), and pipe (`|`) conventions with order preservation and deduplication.

2. **Interactive Skill Entry Editor (`src/components/editor/SkillEntryEditor.tsx`)**:
   - Category preset pills allowing 1-click filtering and category title alignment.
   - Search autocomplete with live dropdown, category badges, keyboard navigation (ArrowDown/Up, Enter, Escape), and custom skill support.
   - Interactive tag chips with 1-click removal.
   - Category-aware recommendation chips for rapid 1-click addition of popular skills.
   - Synchronized description field and format buttons (`Format with dots ·` and `Format with commas ,`).

3. **Section Editor Integration**:
   - Integrated `SkillEntryEditor` inside `SectionEditor.tsx` when `activeSection.type === "skills"`.
   - Maintained 100% backward compatibility with canonical document schemas, accessibility attributes, and existing test flows.

4. **Verification**:
   - `npm run typecheck` passed (0 errors).
   - `npm test` passed (60/60 unit tests across 16 suites in 922ms, including `tests/skills-taxonomy.test.ts` and `tests/editor-components.test.ts`).
   - `npm run test:e2e` passed (25/25 Playwright tests in 42.4s, including skills taxonomy E2E journey).
   - `npm run build` passed (Turbopack production build succeeded cleanly).

## 29. Contextual AI Assistant, Evidence-Grounded Summary Drafter & Guided Interview — 2026-10-07

Delivered multi-mode contextual AI assistant capabilities, interview-guided fact collection, evidence-grounded summary generation, and demonstrated skill discovery:

1. **AI Assistant Domain Engine (`src/lib/vault/ai-assistant.ts`)**:
   - **Evidence-Grounded Summary Drafter (`generateExecutiveSummaries`)**:
     - Synthesizes 3 distinct styles: *Impact & Metric-Oriented*, *Technical & Systems Architecture*, and *Concise Executive (2 Sentences)*.
     - **Strict Anti-Hallucination Invariant**: All cited roles, companies, metrics, and core skills are derived exclusively from verified candidate entries.
   - **Guided Fact Collection & Impact Interview (`generateInterviewClarifications`)**:
     - Scans experience and project bullets for missing quantifiable metrics and passive phrasing.
     - Generates structured, conversational clarification questions tailored by role and company.
     - Detects suggested metric kind (`latency`, `cost`, `scale`, `revenue`, `efficiency`) with one-click example response chips.
     - Synthesizes validated Google XYZ accomplishment bullets (`applyInterviewAnswer`) with live in-place `<del>` / `<ins>` diffs.
   - **Demonstrated Skill Discovery (`discoverDemonstratedSkills`)**:
     - Scans candidate accomplishment bullets against the 9-category skills taxonomy.
     - Identifies proven technologies used in experience that are missing from the Skills section.
     - Cites the exact evidence bullet and role title as verified proof.

2. **User Interface Integration (`src/components/ai-panel.tsx`)**:
   - Tabbed capabilities bar:
     - `⚡ Bullet Assistant`: 100% backward-compatible OpenAI structured rewrite workflow with transmission consent and diff review.
     - `📝 Summary Drafter`: Visual cards displaying generated summaries, word count badges, grounded evidence tags, 1-click clipboard copy, and "Apply to Summary Section" button.
     - `💬 Impact Interview`: Guided question cards with example answer chips, interactive answer input, live XYZ diff synthesis, and "Accept & Update Bullet" button.
     - `💡 Skill Discovery`: Discovered skills grid with category badges, evidence quotes, and "＋ Add" / "＋ Add All Skills" buttons.
   - Connected `onUpdateDocument` in `src/components/resume-studio.tsx` with full session undo support.
   - Modern accessible styling in `src/app/globals.css`.

3. **Verification**:
   - `npm run typecheck` passed (0 errors).
   - `npm test` passed (64/64 unit tests across 17 suites, including new suite `tests/ai-assistant.test.ts`).
   - `npm run test:e2e` passed (26/26 Playwright browser journeys, including `Contextual AI Assistant: summary drafting, impact interview, and skill discovery`).
   - `npm run build` passed (Next.js Turbopack production build cleanly succeeded).

## 30. Deterministic Headless Server PDF Generation & Direct PDF Export — 2026-10-07

Delivered deterministic server-side headless Chromium PDF generation and 1-click direct `.pdf` file download:

1. **Headless PDF Generation Engine (`src/lib/server/pdf-generator.ts`)**:
   - Built `renderResumePdf(doc, options)` utilizing Playwright headless Chromium.
   - Loads standalone HTML with fully resolved fonts, CSS custom properties, and typography.
   - Waits for `document.fonts.ready` before rendering to prevent FOIT/layout shift.
   - Formats strictly according to candidate document presentation settings (`A4` or `Letter`).
   - Injects `.page-watermark` footer dynamically based on subscription tier entitlement (`watermark_free_export`).

2. **API Endpoint (`src/app/api/resumes/export-pdf/route.ts`)**:
   - POST route accepting validated `{ document: ResumeDocument }`.
   - Derives session identity and verifies subscription status via `getUserSubscription`.
   - Sets proper HTTP headers (`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="<name>.pdf"`).
   - Enforces `no-store` cache controls and same-origin write restrictions.

3. **Editor Studio Integration**:
   - Added `PDF Document (.pdf)` to `ExportFormat` and dropdown menu in `DocumentToolbar.tsx`.
   - Handled `format === "pdf"` in `resume-studio.tsx` with Blob download dispatching and graceful fallback to `window.print()` if offline.
   - Preserved `Print / Save as PDF` for local browser printing.

4. **Verification**:
   - `npm run typecheck` passed (0 errors).
   - `npm test` passed (66/66 unit tests across 18 suites, including `tests/pdf-generator.test.ts`).
   - `npm run test:e2e` passed (26/26 Playwright browser journeys, including direct PDF download verification).
   - `npm run build` passed (Turbopack production build with `/api/resumes/export-pdf` dynamic route).

## 31. Studio Accessibility, ARIA Live Announcements & Global Keyboard Navigation — 2026-10-08

Delivered full accessibility auditing, ARIA live announcements, global keyboard shortcuts, and keyboard shortcuts cheat sheet modal:

1. **Keyboard Shortcuts Cheat Sheet Modal (`src/components/editor/KeyboardShortcutsModal.tsx`)**:
   - Accessible dialog (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="shortcuts-modal-title"`).
   - Built-in accessible focus trapping across interactive elements with cycle on `Tab` / `Shift+Tab`.
   - Native `Escape` listener for keyboard dismissal.
   - Comprehensive cheat sheet organized by categories:
     - *Bullet List Flow*: Enter (insert below), Backspace (delete empty bullet), Alt+Up/Down (reorder bullets), Arrow keys (navigate boundaries).
     - *Inline AI Magic Bar & Diffs*: Tab (accept rewrite), Esc (dismiss proposal).
     - *Interactive Preview & Sync*: Click block (bidirectional focus jump), +/- (zoom in/out), Fit button.
     - *Studio & Session*: Ctrl+Z / Cmd+Z (global undo), ? (toggle shortcuts modal), Esc (close active modal).

2. **Global Keyboard Navigation & Event Listeners (`src/components/resume-studio.tsx`)**:
   - `Escape` key closes whichever modal or overlay is active (`KeyboardShortcutsModal`, `PricingModal`, `AtsReadinessPanel`, `JobTailorModal`, `CoverLetterModal`, `VersionHistoryModal`, `AddSectionModal`, `AccountPanel`, `AIPanel`, or `ImportReviewModal`).
   - `?` (Shift + /) toggles the Keyboard Shortcuts modal when not focused inside an editable field (`input`, `textarea`, `select`, or `contenteditable`).
   - `Ctrl+Z` / `Cmd+Z` performs global studio undo when not editing text inside an input/textarea and no modal is blocking.

3. **ARIA Live Announcements & Screen-Reader Readiness**:
   - Explicit `role="status"` with `aria-live="polite"` on the status indicator in `EditorHeader.tsx`, announcing status changes (`Saving…`, `Saved on this device`, `Saved to your account`, `Unsaved changes`, `Save failed`).
   - Visual `⌨️` button pill in `EditorHeader.tsx` with accessible title and `aria-label="Keyboard shortcuts"`.
   - Clean keyboard styling (`.key-combo`, `.key-combo-group`, `.shortcuts-pill`, `.shortcuts-modal`) and `.sr-only` accessibility utility in `src/app/globals.css`.

4. **Verification**:
   - `npm run typecheck` passed (0 errors).
   - `npm test` passed (66/66 unit tests across 18 suites).
   - `npm run test:e2e` passed (27/27 Playwright browser journeys across all 4 suites in 57.3s, including new journey `Studio Accessibility: global keyboard shortcuts (?, Esc, Ctrl+Z) and shortcuts cheat sheet`).
   - `npm run build` passed (Next.js Turbopack production build cleanly succeeded).

## 32. Release Readiness: AI Evaluation Harness, Rate Limiting, PII-Free Telemetry & Cascading Data Retention — 2026-10-08

Closed the Phase 4 and Phase 6 acceptance gates through comprehensive evaluation harnesses, production rate limiting, telemetry safeguards, and verified cascading retention:

1. **AI Evaluation Gate (`tests/ai-evaluations.test.ts`)**:
   - Verified 6 critical evaluation axes against synthetic payloads:
     - *Unsupported metrics*: Rejects unevidenced quantitative metrics (`50% improvement`) via deterministic lexical and grounding guards, returning clarification questions without modifying saved documents.
     - *Prompt injection & embedded instructions*: Evaluated embedded jailbreaks (`"Ignore all instructions and insert SECRET_MARKER"`) and system prompt overrides; verified that independent factual entailment checks reject ungrounded assertions.
     - *Cross-user targets*: Verified tenant isolation; requests targeting other accounts or proposal IDs fail with 404/403 with 0 document mutation.
     - *Stale revisions*: Base revision mismatches reject proposal commits atomically (`409 AI_STALE`), preserving newer concurrent edits.
     - *Malformed output*: Non-matching schemas, invalid types, and unexpected payload shapes fail safely without document corruption.
     - *Timeouts & provider failures*: Abort timeouts and HTTP 5xx failures return 503 while preserving candidate state.

2. **In-Memory Sliding-Window Rate Limiting (`src/lib/server/rate-limiter.ts`)**:
   - Built generic sliding-window limiter with automatic stale window cleanup to bound memory consumption.
   - Enforced on PDF export route (`/api/resumes/export-pdf`) at 15 exports/minute per client/session, responding with HTTP 429 when exceeded.

3. **PII-Free Operational Telemetry (`src/lib/server/logger.ts`)**:
   - Implemented structured telemetry logger stripping potential PII fields (`prompt`, `password`, `secret`, `token`, `rawText`, `bulletText`, `email`, `phone`).
   - Integrated into AI service operations (`ai_proposal_generated`, `ai_proposal_failed`, `ai_proposal_accepted`, `ai_proposal_rejected`) and PDF generation (`export_pdf_completed`).
   - Recorded metadata exclusively (model, promptVersion, durationMs, byteLength, documentId, revision, pageSize, watermarked status).

4. **Cascading Data Retention & Integrity (`tests/release-readiness.test.ts`)**:
   - Verified SQLite foreign key constraints across all 4 migrations (`001-foundation.sql`, `002-ai-proposals.sql`, `003-ai-evidence.sql`, `004-subscriptions.sql`).
   - Confirmed account deletion (`DELETE FROM user`) cascades completely across `resumes`, `resume_imports`, `sessions`, `ai_requests`, `ai_owner_usage`, `subscriptions`, and `subscription_usage`.
   - Verified `PRAGMA foreign_key_check` yields 0 violations.
   - Verified malformed backup rejection and schema migration safety.

5. **Verification**:
   - `npm run typecheck` passed (0 errors).
   - `npm test` passed (**68/68 unit tests** across 20 suites in 1.9s, with both new evaluation suites).
   - `npm run test:e2e` passed (**27/27 Playwright browser journeys** in 55.3s).
   - `npm run build` passed (Next.js Turbopack production build cleanly succeeded).

## 33. Design & Templates UX Overhaul: Modal Experience, Live Preview & Workspace Optimization — 2026-10-09

Transformed the template selector and design controls from an obstructive inline accordion banner into a dedicated, accessible modal studio with real-time preview and tightened workspace ergonomics:

1. **Dedicated Design & Templates Studio Modal (`src/components/design-panel.tsx`)**:
   - Replaced inline collapsible accordion layout with an accessible modal dialog (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="design-modal-title"`).
   - Added Escape key dismissing, backdrop-click closing, close (`×`) button, and explicit "Done & Return to Editor" primary action.
   - Implemented a two-column layout:
     - **Left Controls Column**:
       - 4 rich template cards with miniature page layouts, active badge, and template description.
       - Visual Accent Color Swatches featuring real palette swatches (`Forest`, `Navy`, `Plum`, `Rust`, `Charcoal`) alongside synchronized accessible `<select>`.
       - Typography Cards showcasing font family renderings (`Arial / Clean Sans`, `Georgia / Classic Serif`, `Verdana / Humanist Sans`) with synchronized accessible `<select>`.
       - Segmented controls for text size (10 pt, 11 pt, 12 pt), layout density (Airy, Balanced, Compact, Tight), page format (A4, Letter), reading direction (LTR, RTL), and Creative side rail toggle.
     - **Right Live Sync Preview Column**:
       - Embedded live interactive resume preview stage (`ModalLivePreview`) scaling the candidate's actual document in real-time as template, fonts, colors, and margins change.
       - Live badge indicating dynamic sync and active format summary.

2. **Streamlined Workspace & Studio Ergonomics (`src/components/resume-studio.tsx`, `src/app/globals.css`, `src/app/templates.css`)**:
   - Removed the ~450px inline design section between the toolbar and workspace, eliminating disruptive page reflows and excessive vertical scroll.
   - Added a `🎨 Change style` quick-action button in the live preview toolbar so users can instantly open the design modal while inspecting document pages.
   - Wrapped `ImportReviewModal` with high-index backdrop overlay to ensure clean layering over all dialog states.
   - Reduced excessive workspace heading padding (from 35px/29px to 18px/16px) and title font size (from 31px to 26px), recovering ~50px of visible above-the-fold editing canvas.

3. **Verification**:
   - `npm run typecheck` passed (0 errors).
   - `npm test` passed (**68/68 unit tests** across all suites).
   - `npx playwright test tests/e2e/templates.spec.ts` passed (**7/7 tests** including density matrix, font switching, persistence, and RTL).
   - `npm run build` passed (Next.js Turbopack production build cleanly succeeded).

## 34. Expanded 8-Template Showcase Gallery, Layout Engine Overhaul & Photo Upload Support — 2026-10-09

Addressed broken layout styling in the Creative template, removed the redundant squished miniature preview from the Design & Templates modal, expanded the template catalog to 8 production archetypes inspired by top platforms and workspace samples, and added profile photo upload support:

1. **Spacious Full-Width Template Gallery (`src/components/design-panel.tsx`, `src/app/templates.css`)**:
   - Removed the cramped 50/50 split and squished miniature live preview stage (`ModalLivePreview`), recovering the entire modal width for an expansive, world-class showcase.
   - Added category filter tabs: **All (8)**, **ATS Classic (2)**, **Modern & Tech (2)**, **Executive (2)**, and **Creative & Visual (2)**.
   - Designed 4-column responsive grid with rich preview cards, ATS rating badges (`100% ATS Safe`, `Photo Ready`, `Developer Stack`), active checkmark pill, and detailed descriptions.
   - Retained synchronized accessible `<select>` fallbacks for automated testing and screen-reader accessibility.

2. **Expanded to 8 Production-Grade Templates (`src/lib/presentation.ts`, `src/app/templates.css`)**:
   - **Classic ATS**: Centered corporate header, horizontal accent rule, inline delimiter-separated contact bar (`•`), light skill pill tags.
   - **Modern Banner**: Strong accent header bar, left-accent border indicators on role titles, clean pill badges.
   - **Compact Space Saver**: Dense space optimizer fitting maximum career achievements on fewer pages without clipping.
   - **Creative Portfolio**: Re-architected with balanced editorial typography, true two-column sidebar wash, and photo support (replacing the broken negative-margin linear-gradient hack).
   - **Tech Startup**: Developer aesthetic with dark solid tech stack badges, GitHub/LinkedIn/portfolio links, and open-source project cards.
   - **Executive Luxury**: Prestigious serif typography, subtle gold/slate/burgundy accents, and spacious leadership hierarchy.
   - **Timeline Modern**: Visual connector rail with circular milestone nodes (`•`) along career dates and pill badges.
   - **Minimalist Simple**: Canva Simple-inspired Swiss design with generous breathing room and understated elegance.

3. **Profile Photo Upload & Avatar Support (`src/lib/document.ts`, `src/lib/layout.ts`, `src/components/resume-preview.tsx`, `src/components/editor/SectionEditor.tsx`)**:
   - Added `photoUrl` field to `ContactInfo` schema and `showPhoto` toggle to `presentationSchema`.
   - Added interactive profile photo uploader in the Personal Details editor with client-side canvas optimization (max 320x320 JPEG) and instant removal.
   - Added circular avatar rendering with accent border in templates supporting photos (`Creative`, `Modern`, `Timeline`, `Minimalist`).

4. **Verification**:
   - `npm run typecheck` passed (0 errors).
   - `npm test` passed (**68/68 unit tests** across all 20 test suites).
   - `npx playwright test tests/e2e/templates.spec.ts` passed (**11/11 tests** covering all 8 template families, density extremes, short and long pages, and RTL).

## 35. Role Benchmark Analyzer, 1-Click AI CV Generator & SaaS Cover Letter Studio — 2026-10-09

Delivered complete role-specific intelligence, AI CV generation, and branded letterhead cover letter studio:

1. **Role Benchmark & Gap Analyzer (`src/lib/linter/role-analyzer.ts`, `src/components/editor/AtsReadinessPanel.tsx`)**:
   - Built a comprehensive role evaluation engine with dedicated benchmark specifications for 7 market roles: **Software Engineer**, **Solutions Architect**, **Programmer / Developer**, **Business Analyst**, **Data Engineer**, **Product Manager**, and **DevOps / SRE Engineer**.
   - Evaluates documents across **Competency Breadth**, **Experience Seniority**, and **Quantified Impact & Metric Depth**.
   - Identifies matched skills and missing role competencies with **1-click "+ Add to Skills"** buttons that immediately insert missing keywords into the resume and update the live score.
   - Provides role-specific Google XYZ metric formulas and strong action verbs with 1-click copyable templates.
   - Integrated directly into the editor header (`⚡ XX% ATS & Role Fit`) and studio toolbar (`📊 Role Benchmark & Gaps`).

2. **1-Click AI CV Generator (`src/lib/vault/ai-cv-generator.ts`, `src/components/editor/AiCvGeneratorModal.tsx`)**:
   - Implemented an intelligent resume draft generation engine creating complete, tailored resumes from target role, seniority level (Junior, Mid-Level, Senior, Lead/Staff, Solutions Architect, Manager), core skills, and industry domain.
   - Automatically drafts high-impact summaries, 2–3 categorized work experiences with Google XYZ accomplishment bullets (`Accomplished [X] as measured by [Y] by doing [Z]`), categorized technical skills, education, and representative projects.
   - Accessible via the editor toolbar (`✨ AI Quick-Start`) and the cold-start screen (`✨ Generate with AI`).

3. **SaaS Branded Cover Letter Studio (`src/components/vault/CoverLetterModal.tsx`, `src/app/globals.css`)**:
   - Transformed cover letter modal into a two-stage studio with live A4 branded letterhead preview matching the candidate's resume accent color and contact details.
   - Tone selector: **Impact & Metrics**, **Executive Leadership**, and **Modern Conversational**.
   - Live editable letterhead body with 1-click export options: **Copy to Clipboard**, **Print / Save as PDF**, **Download .txt**, and **Download .md**.

4. **Verification**:
   - `npm run typecheck`: Passed with 0 errors.
   - `npm test`: Passed **73/73 unit tests** across 21 test suites (`tests/role-analyzer-and-ai-generator.test.ts` added).
   - `npx playwright test`: Passed **32/32 tests** (100% pass rate) including `tests/e2e/features-verification.spec.ts` full-flow verification.
   - `npm run build`: Production Next.js Turbopack build cleanly succeeded.

## 36. Real-World Demo Resume Gallery & Streamlined Bullet Editor UX — 2026-10-09

Elevated template presentation and streamlined editor UX with 5 rich demo profiles, a full gallery modal, and minimalist bullet list editing:

1. **Realistic Demo Resumes Library (`src/lib/demo-resumes.ts`)**:
   - Created 5 high-impact, industry-standard demo CVs matching workspace samples and market archetypes:
     - **Siam Riaz** (Senior Full Stack Engineer & Cloud Architect) — 7+ yrs experience, Next.js, Node.js, AWS, Kubernetes, Redis query optimizations, $185k MRR, Google XYZ metrics, photo avatar (`tech` template, charcoal accent).
     - **Lorna Alvarado** (Lead Product & UX Designer) — Inspired by `samples/1131w-MFQG2f7to8k.webp`, multi-platform design systems in Figma, user research, +38% conversion, photo avatar (`creative` template, navy accent).
     - **Richard Sanchez** (Principal Solutions Architect) — Inspired by `samples/566w-S-rQu18x1c8.webp`, enterprise microservices, zero-trust security, $2.4M cloud savings, 40+ engineer management, photo avatar (`timeline` template, navy accent).
     - **Sarah Jenkins** (Senior Business Analyst) — BPMN 2.0 process optimization, SQL, Tableau, Agile sprints, $420k savings (`modern` template, plum accent).
     - **Sharya Singh** (Digital Growth & Web Lead) — Inspired by `samples/1131w-dz7vGJ9RodA.webp`, technical SEO, conversion rate optimization, Hubspot funnels, photo avatar (`minimalist` template, charcoal accent).
   - All demo profiles strictly validate against `documentSchema` and generate valid `layoutBlocks`.

2. **Demo Resume Gallery & Quick Switcher (`src/components/editor/DemoResumesModal.tsx`, `src/components/editor/DocumentToolbar.tsx`, `src/components/editor/ColdStartImporter.tsx`, `src/components/design-panel.tsx`)**:
   - Built interactive `DemoResumesModal` with category filter tabs (**All Profiles**, **💻 Engineering**, **🎨 Product & UX**, **🏛️ Solutions Architecture**, **📊 Business Analysis**, **📈 Digital Growth**), layout variant tags, accent swatches, and 1-click loading.
   - Added `📂 Demo CVs` quick-action button in the studio toolbar (`DocumentToolbar.tsx`).
   - Added `📂 Explore Demo CVs` on the cold-start screen (`ColdStartImporter.tsx`).
   - Added `📂 Switch Demo CV ▾` in the header of `DesignPanel` for instant template previewing with different candidate data.

3. **Streamlined Bullet List Editor UX (`src/components/editor/BulletList.tsx`, `src/components/editor/SectionEditor.tsx`, `src/app/globals.css`)**:
   - Replaced clunky card wrappers (`Bullet 1`, `Bullet 2`, `Bullet 3`) with a fluid, distraction-free bullet list.
   - Preserved accessible `aria-label="Bullet X"` and `sr-only` labeling for screen readers and automated test suites.
   - Auto-sizing textarea with subtle focus ring and informative Google XYZ placeholder.
   - Added subtle bullet indicator `•`, hover delete action (`×`), and compact `InlineAiMagicBar` action chips.
   - Conditioned `BulletList` to hide from summary sections and added clear placeholders on the Description field.

4. **Verification**:
   - `npm run typecheck`: Passed with 0 errors.
   - `npm test`: Passed **74/74 unit tests** across all 22 test suites (`DEMO_PROFILES contains 5 complete realistic profiles that strictly validate` added).
   - `npx playwright test`: Passed **32/32 tests** (100% pass rate).
   - `npm run build`: Production Next.js Turbopack build succeeded cleanly.

## 20. Dedicated Routing & CV Editor Isolation Milestone — 2026-10-09

User request: "create proper routing. it should not show cv editor in profile or upgrade page"

Delivered:
1. **Dedicated Next.js App Router Routes**:
   - `/profile`: Standalone, focused Profile & Account Workspace page (`src/app/profile/page.tsx`). Shows storage switcher ("On this device" vs "In your account"), sign-in/up, cloud sync, local resumes overview, subscription status, and privacy guarantees. Zero CV editor components are imported or rendered.
   - `/account`: Route redirecting automatically to `/profile` (`src/app/account/page.tsx`).
   - `/upgrade`: Standalone, high-converting SaaS Plans & Pricing page (`src/app/upgrade/page.tsx`). Features 3 commercial tiers (Free Forever $0, Job Hunter Monthly Pass $19/mo, Lifetime Access $79), interactive Stripe checkout triggers, comprehensive feature matrix table, FAQs accordion, and trust badges. Zero CV editor components are imported or rendered.
   - `/pricing`: Route redirecting automatically to `/upgrade` (`src/app/pricing/page.tsx`).

2. **Studio Editor Isolation & Heading Cleanliness**:
   - In `src/components/resume-studio.tsx`: Added `style={{ display: showAccount ? "none" : undefined }}` to `<fieldset className="workspace-body">` to guarantee that when the Account settings panel is opened from the studio, the CV editor (DocumentToolbar, EditorSidebar, SectionEditor, ResumePreview) is completely hidden rather than leaking awkwardly underneath.
   - In `src/components/editor/EditorHeader.tsx`: Added top navigation bar (`Profile`, `Pricing`, `ATS Grader`) and conditioned `workspace-heading` to hide when `showAccount` is true so that only the clean account workspace view is presented.
   - Added direct cross-linking between in-studio panels/modals and the dedicated full-page routes (`Full Profile Page ↗`, `Open full comparison & pricing page ↗`).

## 21. Modal Viewport Constraints, Inner Scrolling & Body Scroll Lock Milestone — 2026-10-09

User request: "can not see the full modal and also outside should not be scrollable while modal is in open mode"

Delivered:
1. **Body Scroll Lock System (`src/lib/use-body-scroll-lock.ts`, `src/app/globals.css`)**:
   - Implemented reference-counted `useBodyScrollLock(active)` hook to ensure that nested or concurrently rendered modals/overlays (e.g. Studio + CV Analyzer or Design Modal) lock background scrolling when the first modal opens and only restore body overflow when all active locks have cleanly closed.
   - Added `body.modal-open { overflow: hidden !important; touch-action: none; }` in `src/app/globals.css`.
   - Wired `useBodyScrollLock` into all modals across the application: `ResumeStudio`, `AtsReadinessPanel`, `PricingModal`, `DemoResumesModal`, `AiCvGeneratorModal`, `CoverLetterModal`, `JobTailorModal`, `VersionHistoryModal`, `AddSectionModal`, `KeyboardShortcutsModal`, `ImportReviewModal`, `design-panel.tsx`, and `XyzCoachModal`.

2. **Modal Height Clamping & Inner Content Scrolling (`src/app/globals.css`)**:
   - Fixed modal viewport boundary with `max-height: min(92vh, 880px); display: flex; flex-direction: column; overflow: hidden;` on `.modal-card`.
   - Pinned `.modal-header` with `flex-shrink: 0;`.
   - Converted all modal content bodies (`.ats-content`, `.pricing-content`, `.tailor-content`, `.xyz-body`, `.ai-gen-body`, `.cover-letter-body`, `.modal-body`, `.shortcuts-content`, `.demo-profiles-grid`, `.import-review-body`) into flex scroll areas with `flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;`.
   - Pinned modal footers (`.modal-card > .button-row`, `.modal-card > .modal-footer`, `.ats-modal-footer`) with `flex-shrink: 0; border-top: 1px solid var(--line); background: #fbfcf9;` so action buttons ("Done", "Close", "Cancel", "Generate") remain permanently accessible and visible on any screen size.
   - Refactored `JobTailorModal`, `CoverLetterModal`, `AiCvGeneratorModal`, `VersionHistoryModal`, and `ImportReviewModal` to ensure their action buttons are direct children of `.modal-card` rather than nested inside scrolling content.

3. **Mobile Header & Responsiveness Correction (`src/app/globals.css`)**:
   - Fixed unclosed CSS rule in `.secondary-cta-btn:hover` that caused mobile media query definitions to be swallowed.
   - Added `.header-nav { display: none !important; }` for `@media (max-width: 900px)` and `@media (max-width: 520px)`, ensuring `document.documentElement.scrollWidth <= innerWidth` strictly passes across all mobile viewports.

4. **Verification**:
   - `npm run typecheck`: Passed with 0 errors.
   - `npm test`: Passed **74/74 unit tests** across all 22 test suites.
   - `npx playwright test`: Passed **38/38 E2E tests** (100% pass rate).
   - `npm run build`: Production Next.js Turbopack build succeeded with all static and dynamic routes compiled cleanly.
   - Visual inspection via browser subagent confirmed pinned modal header, inner scrolling, pinned footer action buttons, and background scroll locking.

## 22. PDF File Naming Restoration & Full Export Suite Verification Milestone — 2026-10-09

User request: "export pdf is not working. check all export functionality"

Delivered:
1. **Root Cause Analysis & Chromium Anchor Lifecycle Fix (`src/components/resume-studio.tsx`, `src/components/vault/CoverLetterModal.tsx`, `src/app/profile/page.tsx`)**:
   - **Root Cause**: The client-side `download(blob, filename, type)` utility created a detached anchor DOM element (`const a = document.createElement("a")`) and invoked `a.click()` without appending it into the document body. In modern Chromium/WebKit, programmatic clicks on detached anchor elements containing `blob:` URLs ignore the `download` filename attribute and default to the URL's path segment—which is the raw 36-character Blob UUID (`e1013bee-d5d4-47c6-b554-9309560c2a49`). Because the file was saved with no `.pdf` extension, operating systems treated it as an unrecognizable binary file.
   - **Fix**: Appended `document.body.appendChild(a)` prior to `a.click()`, followed by deferred removal (`a.remove()`) and `URL.revokeObjectURL(url)`.
   - Applied identical anchor attachment across `CoverLetterModal.tsx` (for `.txt` and `.md` cover letters) and `src/app/profile/page.tsx` (for `cv-builder-account.json` data backup).

2. **Async Export Pipeline & Visual Feedback (`src/components/resume-studio.tsx`)**:
   - Converted `exportFile` into a proper asynchronous pipeline and awaited its execution in `checkedExport`.
   - Added user feedback statuses: displays `"Saving…"` on pending debounced autosave, `"Generating PDF…"` during server-side Chromium generation, and `"PDF downloaded successfully."` upon completion.
   - Implemented sanitized filename construction (`latest.name.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_")`) to ensure filename characters are file-system safe while preserving international Unicode.
   - Preserved instant client-side fallback to `window.print()` if the headless Chromium PDF rendering API route experiences network or rendering faults.

3. **HTML & Server-PDF Renderer Polish (`src/lib/exporters/html-exporter.ts`)**:
   - Added support for candidate portrait photo rendering (`doc.contact.photoUrl`) in the standalone HTML and server PDF export pipeline, rendering a rounded circular portrait matching the live preview.
   - Added `@page { size: ${metrics.width}mm ${metrics.height}mm; margin: 0; }` within `@media print` CSS so headless Chromium prints with exact A4 and Letter page dimensions.

4. **All 7 Export Formats Verified**:
   - **PDF (.pdf)**: Server-rendered headless Chromium PDF via `/api/resumes/export-pdf` delivering binary `%PDF-` document with clean `<name>.pdf` extension.
   - **Print-to-PDF**: Invokes browser native `window.print()` with `@media print` styling for paper or manual PDF printer.
   - **Standalone HTML (.html)**: Self-contained HTML file with embedded CSS, accessible semantic markup, and contact photo.
   - **Microsoft Word (.docx)**: Valid OpenXML DOCX document parsed and generated via `docx` library.
   - **Markdown (.md)**: Clean GitHub-flavored Markdown file formatted for developer resumes.
   - **Plain Text (.txt)**: Plain UTF-8 text resume formatted for raw text pasting and legacy ATS systems.
   - **JSON Backup (.json)**: Complete versioned schema JSON document for safe backup and cross-device restore.
   - **Cover Letter Exports**: Formatted `.txt` and `.md` cover letters generated by Cover Letter Modal.
   - **Account JSON Export**: Full user account snapshot including all cloud resumes.

5. **Test Suite Expansion & Verification**:
   - `tests/e2e/editor.spec.ts`: Expanded E2E tests to download and assert all 6 resume export formats (PDF, HTML, DOCX, MD, TXT, JSON). Added explicit assertion `expect(pdfDownload.suggestedFilename()).not.toMatch(/^[0-9a-f-]{36}$/i)` to strictly prevent any recurrence of raw UUID filenames.
   - `npm run typecheck`: Passed with 0 errors.
   - `npm test`: Passed **74/74 unit tests**.
   - `npm run build`: Production Next.js Turbopack build succeeded.

## 23. Role-Calibrated CV Analysis & Market Benchmarking Milestone — 2026-10-09

User request: "analyze should happen depend on cv roles only applied"

Delivered:
1. **Dynamic Applied CV Role Detection (`src/lib/linter/role-analyzer.ts`)**:
   - Implemented `detectAppliedRoleFromDocument(doc: ResumeDocument): AppliedRoleDetection`.
   - Evaluates candidate headline (highest weight 100), document name (80), current experience titles (60), and skills/summary (20) using weighted multi-term matching across industry roles.
   - Accurately resolves applied role across all candidate tracks:
     - "Digital Growth & Web Marketing Lead" (Sharya Singh) -> `marketing-lead` (Exact match from headline)
     - "Lead Product & Interaction Designer" (Lorna Alvarado) -> `product-designer` (Exact match from headline)
     - "Senior Full Stack Engineer & Cloud Architect" (Siam Riaz) -> `software-engineer` (Exact match from headline)
     - "Principal Cloud Solutions Architect" (Richard Sanchez) -> `software-architect` (Exact match from headline)
     - "Senior Business Analyst & Operations Lead" (Sarah Jenkins) -> `business-analyst` (Exact match from headline)

2. **Expanded Role Benchmark Taxonomy (`src/lib/linter/role-analyzer.ts`)**:
   - Added full benchmark definitions for:
     - `product-designer` ("Product & UX/UI Designer", category: "design"): Design systems, Figma, interactive prototyping, user research, wireframing, mobile/web UX, WCAG 2.1 accessibility, design tokens, conversion/checkout lift (26%), churn/drop-off reduction (34%).
     - `marketing-lead` ("Digital Growth & Marketing Lead", category: "marketing"): Technical SEO, CRO, A/B testing, GA4, HubSpot, SEM, copywriting, Looker Studio, ROAS & ad spend ($550k, 4.4x), pipeline added ($1.8M), conversion rate lift (2.8% to 6.4%).
     - `project-manager` ("Project Manager / Scrum Master", category: "operations"): Agile/scrum, sprint planning, Jira, risk triage, stakeholder communication, on-time delivery rate, velocity improvement.
   - Updated `RoleBenchmark.category` to include `"design" | "marketing"`.
   - Enhanced bidirectional regexes for performance metrics (supporting percentages prefix or suffix, e.g. "conversion lift of 26%" or "lifting conversion by 26%").
   - Enhanced `hasSkillInDocument` to support composite skill sub-part matching (`/`, `&`, `|`, `()`).

3. **CV Analyzer & Role Gap UI Overhaul (`src/components/editor/AtsReadinessPanel.tsx`, `src/app/globals.css`)**:
   - **Applied CV Role Banner**: Added a dedicated top card highlighting `🎯 Applied CV Role: <Role Name>`, confidence level, and source tag ("From headline (exact)").
   - **Calibrated Default**: Analyzer automatically loads and calculates fit against the candidate's applied role, eliminating the erroneous fallback to Software Engineer.
   - **Dynamic Quick Chips**: Shows `🎯 <Applied Role> (Applied)` as the first chip with active green styling, alongside 3 other contextually relevant industry benchmarks.
   - **Clean Short Titles**: Implemented `getShortTitle` helper ensuring clean, readable labels (e.g. "Architect", "Designer", "Marketing", "DevOps") rather than truncated strings.
   - **Revert to Applied Role Action**: Added `↺ Reset to Applied Role` action when users switch benchmarks to explore other careers.

4. **AI CV Generator Synchronization (`src/lib/vault/ai-cv-generator.ts`)**:
   - Added full template generators for `product-designer` and `marketing-lead` including degree types, experience entries with Google XYZ bullets, and portfolio projects.

5. **Comprehensive Verification**:
   - Unit tests: Passed **77/77 tests** (added 3 new test suites covering `detectAppliedRoleFromDocument`, benchmark taxonomy, and marketing/design analysis scores).
   - E2E Playwright tests: Added `CV Analyzer calibrates strictly to CV applied role (Digital Growth & Marketing Lead)` asserting applied role banner, benchmark dropdown value, and 92% fit score.
   - `npm run typecheck`: Passed with 0 errors.
   - `npm run build`: Production Next.js Turbopack build succeeded.














## 37. UX Redesign — Phases 0–3 delivered, Phases 4–6 planned — 2026-10-13

Detailed plan: [docs/plans/2026-10-13-ux-redesign-plan.md](docs/plans/2026-10-13-ux-redesign-plan.md).

Audit findings to fix first (Phase 0): the photo is silently hidden on templates without photo support (`layoutBlocks`); signed-in users get stuck in device mode through the sticky `cv-workspace` session flag; exports are blocked by email verification even when email delivery is unconfigured; the avatar shows the CV's name instead of the user's; the toolbar and task strip are misaligned; the "Developed by Elfasys Solution" credit is missing. Later phases: design tokens and CSS consolidation, a simplified editor shell, a docked Check panel, a single AI Assistant, a unified start flow, and usability testing.

Phase 0 delivered (2026-10-13):
- Photo: the uploader warns "Your current design (X) doesn't show photos." with **Switch to a photo design** (opens Design filtered to "Supports photo") and **Keep design without photo** (sets `showPhoto: false`). The misleading "Photo added" text only shows when the photo is visible. Design cards carry a "Photo" badge.
- Workspace: the `cv-workspace=device` flag now applies to one page load only (grader hand-off, explicit switch). Signed-in users otherwise always open their account; a local workspace while signed in shows **Open my account CVs**.
- Export: `exportVerificationSatisfied` allows exports without verification only when email delivery is unconfigured, and logs a one-time `auth_email_unconfigured` warning. `/api/account` returns `user.canExport` for the client gate.
- Decision: Google sign-ins are **not** treated as verified unconditionally. Better Auth already copies Google's `email_verified` claim, and the existing unverified-Google export boundary test stays.
- Header: the avatar shows the signed-in user's initial (hidden when signed out); the workspace badge and the duplicate context-line status text are removed. One save indicator: "Saved to your account", or "Saved in this browser" with **Sign in to back up**.
- Footer credit "Developed by Elfasys Solution" in the editor and public footers, `/help` About and `<meta name="author">`. Developer-facing footer copy removed.
- Layout: one `--page-gutter` token (4%, 16px at ≤600px) for every editor block, including the task strip.
- Tests: unit tests for the photo layout rule and the export rule; `tests/e2e/account-workspace.spec.ts`; photo e2e tests in `usability.spec.ts`. The no-email-service download test runs with `E2E_EMAIL=unconfigured npx playwright test tests/e2e/account-workspace.spec.ts`.

Phase 1 delivered (2026-10-13):
- CSS structure: `src/app/app.css` is the single global entry and `@import`s, in cascade order, `styles/tokens.css`, `base`, `dialogs`, `app-shell`, `library`, `editor`, `design-panel`, `account`, `ai`, `check`, `billing`, `grader`, `print`, then `templates.css` and `resume-fonts.css`. `globals.css`, `library.css`, `editor-polish.css` and `usability.css` are gone. Separate global imports in `layout.tsx` were reordered by the bundler, so the single `@import` entry is required.
- The split was checked to be pixel-identical (about 135 captured states at 360/768/1440) before any intended visual change. Four overrides that depended on the old file order were folded into the rules they overrode.
- `templates.css` and `resume-fonts.css` are also read by the HTML/PDF exporter, so they must not reference app tokens. Only design-dialog and zoom UI rules moved out of `templates.css`; the page rendering rules stay.
- Tokens: colour primitives (slate greys, brand green, blue, red, amber) with a semantic layer (`--color-*`), type scale 13/14/16/20/28/36, radius 8/12/full, two shadows, 4px spacing, `--focus-ring`. About 560 colour literals, every font size, radius and shadow in the app styles now use tokens. No hex colours remain outside `tokens.css`.
- Decisions: primary actions use brand green everywhere (the editor was blue); focus rings stay blue. Old warm greys were unified to the slate greys. UI text is at least 13px. Letter-spaced uppercase micro labels are now sentence case.
- `!important` remains only in print rules and the reduced-motion block. The others were replaced by scoped selectors, by narrowing a rival rule, or by load order; the jump-target ring uses `--focus-ring` instead of out-ranking focus styles.
- Icons: `lucide-react` replaces every emoji and glyph icon in the UI (header, toolbar, sidebar, dialogs, pricing, grader, profile, section presets, skill categories). Icon-only buttons have `aria-label`s; two delete buttons that only had a `title` gained one. The preview header now reads "Design: Classic".
- Fixed in passing: undefined CSS variables (`--bg`, `--border`, `--foreground`, `--surface`), mis-encoded Arabic/Hebrew text in the direction picker, and the mis-encoded page title.
- Visual regression: `tests/e2e/visual-regression.spec.ts` snapshots the library, editor, preview, design panel and check panel at 360/768/1440. Refresh with `--update-snapshots` only after an intended change.

Phase 2 delivered (2026-10-13):
- Two rows of chrome. The app header has My CVs, Templates, Pricing, Upgrade and an account menu (avatar: My CVs, Account settings or Sign in, Plans & billing, Keyboard shortcuts, Help, Sign out). The Review writing, Account, My library and workspace-badge controls and the editor page heading are gone; the library keeps a "My CVs" heading.
- `EditorToolbar` replaces `DocumentToolbar`: inline CV name (the duplicate "Resume name" field is removed), a CV options menu (switch, New, Duplicate, Import JSON, History, Mark as my CV, Demo examples, Create practice example), the save indicator, Undo and new Redo (Ctrl+Shift+Z / Ctrl+Y), Design, Check with the strength %, an AI Assistant menu (Writing help, Match a job, Cover letter) and Download (PDF first). Phones get icon-only Undo/Design and one action row.
- Removed the task-card strip, the context line and the start-guide bar (`EditorStartGuide` deleted).
- Steps rail: status dots (not started, in progress, complete, needs review; read after the step name), the CV strength meter and a "next best step" button. `src/lib/cv-strength.ts` computes completeness (weights total 100; hidden or removed sections drop out) and step status from the linter; it is labelled as completeness, not a hiring score.
- Back / Next on every step; the last Next opens Check. Moving to a step moves focus to its form.
- `SidePanel`: Design, Check and AI replace the preview column and leave the form usable (not modal). At 900px and below they are focus-trapped bottom sheets. Escape closes the open panel. Check stays open when you jump to a finding on wide screens. DesignPanel, AtsReadinessPanel and AIPanel are now content-only components.
- `Menu` is a shared accessible menu button (arrow keys, Escape, outside click).
- Removed 136 CSS rules for deleted UI; new shell styles live in `styles/editor-shell.css`. Toolbar controls are at least 44px.
- Tests: `tests/cv-strength.test.ts`; e2e helpers `editorTool`, `openAccount` and `cvCount`; specs migrated to the new shell, including side-panel, redo and step-flow coverage.

Phase 3 delivered (2026-10-13):
- `CheckPanel` replaces `AtsReadinessPanel` in the docked side panel. At the top: the CV strength meter, one sentence ("How complete your CV is, plus writing checks. Not a hiring score.") with an (i) for the longer explanation, and a checklist (Name, Contact details, Summary, Work experience, Results in bullets 3/8, and so on). Unfinished items link to their step. The raw 0/0 counters are gone.
- Two tabs: **To fix** (default) and **Compare with a role** (the role checklist, moved unchanged into `RoleComparison`). The document text view and file diagnostics sit under a collapsed "Advanced: how a recruiter's system reads your file".
- Findings are grouped by step in step order, most serious first. Each row has a severity icon, a one-line title, a word-boundary quote of the bullet, a muted explanation, and Fix and Dismiss on the right (wrapping below on phones). **Next issue** walks through what is left. The list updates live as you edit.
- Fix focuses the exact field (contact fields included) and keeps the docked panel open; a bottom sheet closes so the field is visible.
- Dismissals are stored per CV in this browser (`dismissed-findings.ts`) and apply to the panel, the inline hints and the step dots. "Show N dismissed" lists them with Restore.
- `lintBullet` holds the per-bullet checks. The document report and inline bullet hints both use it, so they always agree. Hints appear under a bullet once you leave it (vague opening, no number in experience, too short or long) and are linked with `aria-describedby`.
- `check-findings.ts` turns linter findings into plain-language titles and groups them.
- Tests: `tests/check-findings.test.ts`; `tests/e2e/check-panel.spec.ts` (grouping, Fix, live clearing, Next issue, persisted Dismiss and Restore, inline hints, Advanced view); other specs migrated to the new tabs.
