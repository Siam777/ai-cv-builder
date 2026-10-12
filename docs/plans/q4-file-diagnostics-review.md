# Q4 actual-file diagnostics review

Status: first Q4 implementation slice, 2026-10-11. Local verification passed for this slice. Q4 remains partial; PLAN.md owns implementation progress and FEATURE-PLAN.md owns unchanged release scope.

## Implemented

The editor’s Review writing dialog includes File diagnostics. A user selects an actual PDF, DOCX or UTF-8 TXT file and explicitly agrees to send that file and the current CV snapshot to the application server. The report compares visible source blocks against the extracted stream, preserving raw text for review. Missing and reordered blocks are counted separately; duplicate source facts require separate extracted occurrences. Case/whitespace and Unicode compatibility forms are normalized for matching. Known app PDF footer rows are excluded from comparison only, including split RTL counters; raw text still includes them. A changed current CV marks the result stale. Closing the view discards its in-memory report.

Reports record actual byte SHA-256, filename/format/size, parser version, diagnostic rules version, analysis time and the compared CV revision/source hash. They distinguish observed facts, issues and checks not performed. PDF pages without extracted text, replacement/private-use characters and common Latin ligatures are reported. Links are shown as inert text without opening destinations. DOCX body tables/text boxes are counted; headers/footers and physical pages are not analyzed. There is no ATS score, visual clipping/font verdict, OCR or acceptance guarantee.

The public reviewer reuses actual-file reports but supplies no expected source document, so missing facts/source order remain unknown. Paste stays browser-only. PDF/DOCX imports use the new extractor, warn that field mapping needs review and reject empty extraction rather than staging an empty CV. No upload, source snapshot or report is persisted or sent to an AI provider.

## Parser and request limits

- Same-origin multipart requests, 30 requests/minute per process/IP bucket, 7.1 MB streamed request ceiling, 5 MB file ceiling and 200,000 extracted-character ceiling. CV snapshots have a 2 MB ceiling and require processingConsent. Shared infrastructure rate limits remain a deployment consideration.
- PDF.js 5.5.207 is pinned for the current Node 20 runtime. Each PDF runs in a separate hidden Node process with a 128 MB JavaScript heap cap, 15-second timeout and at most two concurrent parsers per app process. This avoids a native-library thread-shutdown crash observed on Windows; JavaScript heap limits do not bound all native memory. Native crashes return an unreadable-file error. Only text/link extraction runs: no viewer, candidate scripting, rendering, network source or AI request. PDFs over 40 pages and encrypted files are rejected; annotations are limited to 1,000 targets and 200,000 total link characters before returning a report. A shared large URI repeated across annotations is covered by a synthetic negative test.
- DOCX uses yauzl 3.4.0 and fast-xml-parser 5.11.2. Reject encrypted/duplicate/traversal ZIP entries, more than 1,000 entries, claimed expansion over 20 MB, individual parts over 5 MB and a 10-second ZIP timeout. Read only content types, body XML and body relationships. Reject DTD/custom entities, invalid UTF-8/XML, more than 50,000 tags and nesting over 100. No archive files are written and external relationships are not fetched.
- Next output tracing includes the parser process and PDF.js/native dependencies for both upload routes; local databases, outboxes and review artifacts remain excluded. The built app passed actual HTTP PDF/DOCX/TXT diagnostic requests and PDF import on a separate local production port. All 20 API traces exclude data/review artifacts; both upload traces include existing parser/PDF/native files. The temporary production server was stopped after verification.

## Verification

Final local results:

- `npm run typecheck`: passed; `npm test`: 99 passed, including the final relative subprocess path and lifecycle fixes.
- `npm run build`: passed in isolated `.next-q4-build`; the normal dev server/output remained available. Temporary production servers were stopped after checks, and build-specific type paths were removed.
- Full `npm run test:e2e` with synthetic Google: 93 passed, one intentionally skipped unconfigured-provider case and one focus timeout during our parser-config-triggered server restart (13.8 minutes). Stable final rerun: seven passed, including that focus case, all five affected upload/reviewer flows and unconfigured Google. All 95 distinct browser scenarios have a successful result across these configurations. Final origin enforcement and relative parser URL are covered by the rerun and production smoke. After adding the PDF aggregate-link cap, the full 99-test unit suite and build passed again, and the three upload/browser cases passed again (41.9 seconds).
- Actual built app over HTTP: PDF/DOCX/TXT diagnostics and PDF import passed with no-store responses. DOCX source comparison found all expected blocks in order. The real multi-page PDF produced selectable text. All 20 API traces exclude local data/reviews; both upload routes include the parser process, PDF.js module/worker and native canvas dependencies, with traced files present.
- `npm audit`: zero known vulnerabilities. No live AI/OAuth/email provider calls, deployment or changes to the user’s account data occurred for this slice; browser tests use isolated synthetic accounts.
- Desktop/mobile report screenshots were inspected; wrapped tabs, consent/disclosure, hashes and diagnostic cards fit at 360 px. Browser assertions cover no horizontal overflow and unchanged CV fields after checks.

Focused preflight: generated PDF/DOCX comparison across all 12 designs (three fonts, both paper sizes, multi-page RTL content), malformed/encrypted/empty files, missing/reordered/duplicate source blocks and hostile ZIP/XML cases; five browser upload/consent/unknown-source/error flows also passed after process isolation and final origin enforcement. Mobile screenshots show wrapped tabs, disclosure and reports without horizontal overflow.

## Remaining Q4 gates

This slice provides an artifact-specific text observation, not validated recruiting-system compatibility or a completed evidence workflow. The subsequent [local job-evidence slice](q4-job-evidence-review.md) implements bounded English criteria, source-cited matching and reviewed exact-text ordering proposals. Evaluated semantic matching/coaching, owner-scoped persisted analysis history, corpus diversity/parser calibration and the documented 120-pair held-out evaluation still need implementation/review. Human Word/LibreOffice, non-English/font coverage, assistive-technology and hosted runtime/native dependency checks remain open. No production deployment or external provider validation occurred.
