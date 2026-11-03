# Review of modified and added plans

Date: 2026-11-04. Expanded after the initial review to cover the full October 17 documents, rather than only their coordination changes. Reviewed against project guidance and the current implementation contracts. This review does not change feature scope or mark planned work as implemented.

Twelve findings are recorded below: findings 1–5 cover the November plans, and findings 6–12 cover the October plans. P1 indicates a high-priority evidence, retention or snapshot-integrity issue; P2 indicates another correctness, integration or planning issue. Findings concerning the already implemented consistency check are follow-up decisions, not claims that its implementation is still pending.

## Review coverage

| Document | Coverage | Findings |
| --- | --- | --- |
| [2026-10-17-application-tracker-plan.md](2026-10-17-application-tracker-plan.md) | Full plan, including schema, routes, frozen copies, history and acceptance tests | 6, 9, 10 |
| [2026-10-17-interview-practice-plan.md](2026-10-17-interview-practice-plan.md) | Full plan, including evidence checks, feedback, storage and evaluation | 7, 8 |
| [2026-10-17-cv-consistency-check-plan.md](2026-10-17-cv-consistency-check-plan.md) | Full plan, with current implementation and PLAN.md §41 consulted | 11 |
| [2026-10-17-career-platform-analysis.md](2026-10-17-career-platform-analysis.md) | Full analysis, roadmap order, status tables and cross-plan agreements | 12; cross-plan observations below |
| [2026-11-04-job-capture-and-tracker-plan.md](2026-11-04-job-capture-and-tracker-plan.md) | Initial review of extraction, matching, browser integration and input contracts | 1, 3, 4, 5 |
| [2026-11-04-career-switch-and-follow-up-questions-plan.md](2026-11-04-career-switch-and-follow-up-questions-plan.md) | Initial review of answer evidence, proposal lifecycle and coordination | 2, 3 |
| Root and packaged feature plans; PLAN.md | Scope/progress reconciliation and feature-plan copy comparison | Cross-plan observations below |

## 1. [P1] Job-reading validation does not prove that extracted values are supported

Location: [Job capture plan, §4.2](2026-11-04-job-capture-and-tracker-plan.md#42-ai-contract--post-apiaijob-read), particularly line 62 at review time.

The proposed validation checks that each quote exists in the post, but does not establish that the quote supports the extracted value. An invented company or requirement paired with an unrelated, genuine quote would pass. Only salary and deadline receive an additional literal-value check.

Require extracted values to be exact source text or validated normalizations. Paraphrased requirements need a support check. Add adversarial cases where a genuine quote accompanies an unsupported value, including an incorrect must-have/nice-to-have classification.

## 2. [P1] Answer-backed rewrites need a proposal and retention contract

Location: [Follow-up plan, §3.3](2026-11-04-career-switch-and-follow-up-questions-plan.md#33-rewrite-from-answers--generateschema-mode-answers), particularly lines 51–53 at review time.

The plan adds answers as evidence and promises they are not saved before acceptance. Currently, `reviewProposal()` in `src/lib/ai-proposals.ts` resolves evidence only against existing CV bullets. `storeProposal()` in `src/lib/server/ai-service.ts` persists the proposal and evidence snapshot before acceptance. Merely extending the generation schema and support-check context leaves both the evidence lifecycle and the retention promise unresolved.

Define how answer evidence is identified, scoped to the selected bullet and revision, validated during review and acceptance, and handled on retry, rejection and expiry. Choose either an ephemeral preview flow or explicitly disclosed temporary storage, then align the retention wording and account export/deletion behavior with that choice.

## 3. [P2] Reviewed requirements cannot currently reach the matcher as specified

Location: [Job capture plan, §4.3](2026-11-04-job-capture-and-tracker-plan.md#43-requirements-feed-the-existing-matcher), particularly lines 70–72 at review time. The same assumption appears in the follow-up/career-switch plan’s coordination section.

The plan assumes the matcher accepts a reviewed requirement list. Its current strict request schema accepts only the job title, company and post; the model extracts requirements again. Job capture also allows 40 requirements of 300 characters, versus the matcher's output limit of 15 requirements of 200 characters. For long posts, the existing `fromPost()` filter can reject requirements whose source text lies beyond the first 12,000 characters.

Specify the request-contract change and reconcile the count and text limits. Define how reviewed priorities, deletions and source quotes are preserved without re-extraction, including requirements beyond the truncated post. Add an integration test that verifies those corrections survive matching.

## 4. [P2] Extension access excludes its own AI-reading action

Location: [Job capture plan, §6.2](2026-11-04-job-capture-and-tracker-plan.md#62-chrome-extension-manifest-v3), particularly line 92 at review time.

The plan permits the extension origin only for application creation, but also offers **Read with AI** in the popup. The proposed `job-read` route requires the app's origin, so the described origin exception does not cover that action.

Define an authenticated extension path for AI reading, with explicit origin handling and the existing consent and plan checks, or hand the captured content to the app for review and AI reading. Test this using the unpacked extension against the actual server routes.

## 5. [P2] The request byte limit cannot accommodate all supported posts

Location: [Job capture plan, §4.2](2026-11-04-job-capture-and-tracker-plan.md#42-ai-contract--post-apiaijob-read), particularly line 60 at review time.

The contract permits 30,000 characters but caps the JSON request at 65,536 bytes. A 30,000-character Bengali or Chinese post can exceed 90 KB before JSON overhead, causing a valid-length post to be rejected before schema validation.

Align the byte cap with the character limit and JSON overhead, or document and enforce a separate byte limit in the interface. Add a multibyte boundary test.

## 6. [P1] Freezing after export does not preserve an exported account revision

Location: [Application tracker plan, §4 and §5](2026-10-17-application-tracker-plan.md#4-server), particularly lines 78 and 92 at review time.

The flow offers to record an application after export succeeds, but freezing an account CV reads the current stored row using `{resumeId, revision}`. If the person edits and saves the CV after exporting but before completing the application form, the exported revision may no longer be available. Sending the original revision produces a conflict; sending the current revision freezes different content from the downloaded CV. The current export service reads a document for rendering but does not issue a durable snapshot receipt.

Preserve the document used by the export independently of later edits, for example with an owner-scoped export snapshot receipt. Attach that exact snapshot when recording the application. Define cancellation and cleanup for unused receipts. This is separate from the already acknowledged limitation that rendering stored JSON with a future template can change appearance.

Add a test: export revision N, save N+1, then record the application; its frozen content must still be N. Repeat for a device CV and for an edited cover letter.

## 7. [P1] Practice outlines can invent facts while passing the proposed checks

Location: [Interview practice plan, §3 feedback checks](2026-10-17-interview-practice-plan.md#feedback--post-apiaipracticefeedback), particularly lines 58–61 at review time.

The specified outline checks require blanks and reject new numbers. They do not reject unsupported nonnumeric claims. For example, “I led an AWS migration that reduced costs by [your result]” has a result blank and no new number, but invents leadership and AWS experience when neither is supported. Notes about strengths and improvements can also assert unsupported candidate facts even when their accompanying answer quote is genuine. The explicitly described support check covers wording mismatches, not all those output fields.

Specify either a deterministic outline assembled from neutral structural prompts, or a support check over every factual assertion in outlines and feedback, using the person's answer and resolved CV evidence. Keep generic coaching separate from claims about the candidate. Add cases with invented tools, responsibilities and seniority but no numbers; those claims must be withheld.

## 8. [P2] Different numbers do not by themselves establish an answer/CV contradiction

Location: [Interview practice plan, §3 feedback checks](2026-10-17-interview-practice-plan.md#feedback--post-apiaipracticefeedback), particularly lines 53 and 59 at review time.

The plan proposes detecting mismatches by comparing numbers in the answer with numbers in cited CV items. A CV can describe a team of five and an answer can describe eight customers without contradiction. Even the same metric can differ legitimately across projects or time periods. No subject, unit, event or period alignment rule is specified. The model-returned `cvText` also needs validation against the resolved CV source, not just validation of `answerQuote` against the answer.

Only label a contradiction when both statements refer to the same metric and context. Otherwise present a neutral clarification question. Resolve evidence IDs server-side and derive or validate `cvText` from that evidence. Test unrelated counts, different periods, percentages versus absolute values, and genuine same-context conflicts.

## 9. [P2] Frozen-document writes lack an explicit idempotency contract

Location: [Application tracker plan, §4](2026-10-17-application-tracker-plan.md#4-server), particularly line 78 at review time.

Application creation has a request identifier, but the frozen-document POST only specifies the document source or cover-letter text. If the write succeeds and its response is lost, retrying can create duplicate frozen documents and consume the five-document limit. A repeated cover-letter attachment has the same problem.

Give the freeze/attach action a stable client request ID and immutable payload hash. A retry with the same body must return the original document receipt; a changed body under that ID must conflict. Commit any associated sent event atomically. Add a lost-response retry test and concurrent retries near the document limit.

## 10. [P2] Stage history cannot identify which document versions were actually sent

Location: [Application tracker plan, §3](2026-10-17-application-tracker-plan.md#3-data-model--migration-migrations008-applicationssql), particularly lines 44–63 at review time; also the career analysis's outcome-learning dependency.

The events table allows `kind = 'sent'` but has no document IDs or submission-group identifier, while the plan says future outcome insights read only this table. Up to five frozen documents can exist on an application, and the application’s `resume_id` is a mutable soft link. The model therefore cannot reliably associate an outcome with the CV and cover letter sent at a particular stage, especially after a revised CV is supplied later.

Define an immutable sent receipt that links a send time to the frozen CV and optional letter IDs. Distinguish saving a snapshot from the person's confirmation that it was sent. Specify which routes create these receipts and how later outcome analysis joins them. Test two different CV/letter pairs sent for the same application; each receipt must retain its own document references.

## 11. [P2] The years-of-experience rule assumes the CV contains the full career history

Location: [CV consistency check plan, §3](2026-10-17-cv-consistency-check-plan.md#3-rules), particularly line 37 at review time.

`years_claim` treats a summary claim exceeding the visible experience date span as an attention-level issue. A targeted CV may show only the most recent five years of a fifteen-year career, so that difference alone is not a contradiction. The current implementation follows the planned comparison and also recognizes any “N years” phrase in the headline or summary, making contextual duration claims another source of noise.

Define this as a request to explain the claim's coverage rather than a factual inconsistency, or require explicit confirmation that the listed history is complete before escalating it. Restrict matching to personal experience claims and provide a confirm/dismiss path appropriate for intentionally abbreviated histories. Add examples with omitted earlier roles, a complete history with a genuine overclaim, and non-experience duration statements. Record the chosen behavior in PLAN.md if the implemented rule changes.

## 12. [P2] The career analysis incorrectly lists DOCX import as future work

Location: [Career platform analysis, §2](2026-10-17-career-platform-analysis.md#2-feature-by-feature-status), particularly lines 25 and 52 at review time.

Both status tables group DOCX import with OCR as follow-on work. Current `src/lib/importers/read-resume-file.ts` handles `.docx` uploads through `/api/resumes/import-file`, and the start screen advertises Word import. The analysis says its tables reflect the current status, so this classification can cause duplicate implementation work or incorrect release planning.

Separate implemented DOCX text import from planned OCR and document the actual parser limitations. Update the status tables against the current code and validation evidence. Do not treat the presence of an import path as proof that every Word layout is faithfully reconstructed.

## Cross-plan observations

- PLAN.md §40 still says “Nothing below is implemented,” immediately before describing step 1 as implemented and linking to §41. Remove or narrow that stale sentence when reconciling progress.
- The October consistency plan now explicitly points to PLAN.md §41 for delivered behavior and deviations. The experience-only future-date check, grouped number confirmations and app-print reminder are documented deviations, so they are not reported here as new omissions.
- The Gate 0 exception for step 1 is recorded. The tracker plan, interview-practice plan and career analysis still describe later work as planned; this review does not authorize another exception or close the live/production gates.
- The tracker plan’s JSON snapshot versus original-file limitation is already disclosed. Finding 6 concerns preserving the correct content revision, rather than repeating that accepted rendering limitation.

## Verification and limits

- The root `FEATURE-PLAN.md`, `resume-builder-skills/FEATURE-PLAN.md`, and the `FEATURE-PLAN.md` entry in `resume-builder-skills.zip` match.
- This was a document and implementation-contract review. Implementation tests were not run, and the reported historical test results in `PLAN.md` were not independently reproduced. Recommendations above describe missing plan contracts and acceptance cases, not observed failures of tracker or practice features that have not been built.
- No implementation files or feature-scope decisions were changed by this review.

## Resolution — 2026-11-04

Each finding was checked against the code before changing the plans. The code facts in findings 2, 3 and 12 were confirmed: `reviewProposal()` resolves evidence only from `bulletEvidence(doc)`, `storeProposal()` saves the proposal and `evidence_snapshot` before acceptance, `jobMatchRequestSchema` takes only title, company and post, `fromPost()` filters requirements against the post sent, and `read-resume-file.ts` imports `.docx`.

| # | Resolution | Where |
| --- | --- | --- |
| 1 | Copied fields must be the quote or a listed normalisation of it; requirements store the quote, and a paraphrase must pass the support check; must/nice comes from headings and marker words, not the model ("Not stated" otherwise); adversarial cases with genuine quotes and wrong values | [Job capture §4.2](2026-11-04-job-capture-and-tracker-plan.md#42-ai-contract--post-apiaijob-read) |
| 2 | Disclosed temporary storage in the existing `ai_requests` flow: server-made answer evidence IDs scoped to bullet, revision and request; accept re-checks the stored snapshot; retry and 409 rules; answer text replaced after accept, reject and expiry; included in account export and deleted with the account | [Step 4 §3.3](2026-11-04-career-switch-and-follow-up-questions-plan.md#33-rewrite-from-answers--generateschema-mode-answers) |
| 3 | Optional `requirements` (≤ 15, ≤ 300 characters, with IDs and priorities) in `jobMatchRequestSchema`; no re-extraction; given requirements bypass `fromPost()`; the 40-versus-15 difference is handled in the review form; integration test for corrections and a requirement beyond character 12,000 | [Job capture §4.3](2026-11-04-job-capture-and-tracker-plan.md#43-requirements-feed-the-existing-matcher), step 4 §5 |
| 4 | The extension hands the capture to an app tab (script injection into the app's own domain); reading, AI and saving run from the app origin with existing checks; no route accepts the extension origin; a popup-only save is a later, separately planned option | [Job capture §6.2](2026-11-04-job-capture-and-tracker-plan.md#62-chrome-extension-manifest-v3) |
| 5 | `readJson` limit 192 KiB for 30,000 characters; the character limit stays in the schema; clients trim; multibyte boundary test | Job capture §4.2 |
| 6 | `export_snapshots` receipts written by the export service and attached when recording the application; 7-day expiry, 20 unclaimed per account, deleted on dismiss; tests for revision N then N+1, device CV and edited letter | [Tracker §3–§5, §7](2026-10-17-application-tracker-plan.md#3-data-model--migration-migrations008-applicationssql) |
| 7 | The outline is assembled by code from fixed prompts and the person's own quotes; coaching notes are generic, and every sentence about the candidate goes through the support check; cases with invented tools, duties and seniority without numbers | [Interview practice §3, §5, §6](2026-10-17-interview-practice-plan.md#feedback--post-apiaipracticefeedback) |
| 8 | "Conflict" only for the same unit noun, the same role or project, and no differing period; everything else is a neutral clarification; `cvText` always comes from server-resolved evidence; tests for unrelated counts, periods and percentages | Interview practice §3, §5, §6 |
| 9 | Freeze and attach carry `requestId` plus a body hash (`UNIQUE(owner_id, application_id, request_id)`); same body returns the original, a changed body gives 409; the limit is checked in the same transaction; lost-response and concurrency tests | Tracker §3, §4, §7 |
| 10 | Immutable `application_submissions` (sent time, stage, frozen CV and optional letter); `sent` events must reference one; saving a frozen copy is separate from marking it sent; outcome insights join through submissions | Tracker §3, §4, §7 |
| 11 | **Code changed:** `years_claim` is a confirmable suggestion (no export reminder), matches only claims about the person's own experience, ignores other durations, and the copy covers CVs that list only recent roles; tests added; recorded in PLAN.md §41 | `src/lib/linter/consistency.ts`, `src/lib/check-findings.ts`, `tests/consistency.test.ts`; [consistency plan §3](2026-10-17-cv-consistency-check-plan.md#3-rules) |
| 12 | Word `.docx` text import is listed as built, with its limits; only OCR and fuller layout reconstruction remain follow-on. FEATURE-PLAN.md's Imports row and follow-on list had the same error and were corrected (copy and zip entry synced) | [Analysis §2](2026-10-17-career-platform-analysis.md#2-feature-by-feature-status), FEATURE-PLAN.md |

Cross-plan observations: the stale "Nothing below is implemented" sentence in PLAN.md §40 now says step 1 is implemented locally (§41) and everything else is planned. No other Gate 0 exception was made.

Decisions taken at the same time (the owner asked for the recommended approach): the tracker is free on every plan with a 500-application cap; the persistent Master Career Vault stays follow-on and is reconsidered after step 4; suggested jobs (job capture phase E) are deferred. These are recorded in FEATURE-PLAN.md (and its copy and zip entry), PLAN.md §40, the analysis and the tracker and job capture plans.
