# Q2.2 dashboard and editor foundation

Date: 2026-10-10 (Asia/Dhaka)
Status: implemented locally; final acceptance evidence is recorded in PLAN.md. This is a Q2 slice, not launch readiness.

## Delivered behavior

The library now shows each saved CV's own rendered thumbnail, user-chosen title, name, role, design, update date, draft label and storage context. Practice and older unclassified records remain separate. Cards open the editor, duplicate a CV or request deletion with a confirmation naming the document and storage location. Thumbnails are visual samples, not extraction diagnostics or a page-count claim.

Sorting offers recently updated or title order. Search preserves the current collection and has a clear reset action. Empty personal collections explain blank, reviewed-import and design paths without seeding fictional records. Existing import review and explicit device-to-account transfer remain unchanged.

The editor heading identifies the current document instead of repeating the dashboard heading. Workspace chrome uses the public paper/mist/ink/blue/teal direction with system sans-serif controls and Georgia display type. Resume paper retains its rendering typography. Mobile Edit/Preview controls now include Review and visible save feedback while scrolling.

Blank and example-design personal starts have a collapsible guide for adding contact details, choosing an existing career section and reviewing content. The guide moves keyboard focus to the name field or selected editor region. It adds no entries, facts, scores or automatic section reordering. Dismissal is local to the open editor, and the guide remains available to reopen. Imported/practice CVs are not forced through it.

## Persistence and ownership decisions

- Duplicate first flushes pending edits, then reads the latest document from the selected repository. The new CV has independent IDs and retains its purpose/provenance. A practice copy never becomes personal by duplication.
- Deletion uses the existing revision-checked repository boundary and a native confirmation. Cancellation performs no write. A newer revision causes a conflict rather than deletion. Editor and dashboard deletion share the same handler.
- Account operations continue to use the current workspace owner and authenticated server APIs. Device records are not imported or removed by account duplicate/delete actions.
- No database/schema migration, new provider, entitlement rule, export format or storage policy was introduced.

## Reproduce checks

Run typecheck, unit tests, the full browser suite and production build as documented in README.md. The six dashboard browser tests use synthetic data and the existing isolated server/database/outbox configuration. They cover three widths, guide focus/collapse, saved reload, search/reset, sort, duplicate isolation, cancellation, stale deletion, latest-fact duplication and account/device independence.

Source captures and horizontal-control/overflow manifests are in `test-results/dashboard/{360,768,1440}/` (20 states), with an additional populated A4/Letter desktop gallery in `1440/filled-gallery.png` (21 images total). Build review contact sheets with Pillow:

```sh
python scripts/review-visual-baseline.py --root test-results/dashboard
python scripts/review-visual-baseline.py --pdfs
python scripts/verify-pdfs.py
```

Dashboard contact sheets go to `test-results/dashboard/review/`. The existing 121-state baseline, 32 public captures and 48 preview/print fixtures remain separate. Manually inspect full-size changed states as well; contact sheets and overflow measurements do not establish accessibility conformance or server-renderer parity.

## Acceptance and visual review

Typecheck, 89 unit tests, the production build and the complete 66-test browser suite passed (3.8 minutes). Nine dashboard/baseline browser tests passed after final visual corrections (1.1 minutes). The six new dashboard journeys cover the persistence and ownership cases above without live providers. All 48 preview/print PDF audits passed; 24 representative Poppler pages were rendered and reviewed across the eight designs. This does not close the separate authenticated server-renderer/DOCX parity gate.

All five dashboard contact sheets, the populated A4/Letter gallery and readable changed desktop/mobile/tablet states were reviewed. Existing modal contact sheets were sampled at all three widths; the full 121-state baseline and all 20 dashboard manifest states passed horizontal-overflow checks. Thumbnail heading/paragraph inheritance and default button centering were corrected so paper retains its layout, A4/Letter thumbnails use actual paper metrics, and tablet header actions no longer wrap the brand. Search-empty wording and control focus remain visible at each width. Toolbar disclosure and keyboard/focus behavior were improved in the subsequent [Q2.4 slice](q2-editor-polish-review.md); broader human accessibility review remains a Q5 gate.

Feature scope, its distribution copy and all 15 ZIP entries agree. `git diff --check` passed. Tests used the isolated port 3100 server and synthetic database; the test server stopped afterward. Port 3000 was unavailable at the final preview check, so the normal development server was started; `/builder` returned HTTP 200. Existing workspace data was retained.

## Remaining Q2 work

Google sign-in and account navigation were implemented in the subsequent [Q2.3 slice](q2-google-account-review.md), with synthetic account-linking/draft-preservation tests; real credentials and live Google validation remain open. Bundled typography, toolbar disclosure and keyboard/focus improvements were delivered in [Q2.4](q2-editor-polish-review.md); comprehensive human assistive-technology review remains open. Import staging is the existing flow, not a new onboarding wizard. Q1/Q5 live email, hosting and operational validation, Q3 export parity and Q4 actual-file/evidence evaluations remain open.

Release scope and skill guidance are unchanged. Keep root/distribution/ZIP feature scope synchronized if future work changes scope.
