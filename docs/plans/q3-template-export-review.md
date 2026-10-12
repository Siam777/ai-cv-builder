# Q3 template and export review

Status: Q3 implementation and local verification delivered, 2026-10-11. Word/LibreOffice and broader human release gates remain open. `PLAN.md` owns progress; this is a review record, not release certification.

## Implemented locally

- PDF, standalone HTML and app print share the preview's document blocks, presentation tokens, template CSS and browser-measured pagination. Exports contain static pages, selectable text and contact links. The server evaluates only its own pagination function; user data stays escaped/structured. Scripts, service workers and network resource loads remain disabled, and existing verified-session, origin, ownership, consent, revision, entitlement and post-render session checks remain in force.
- Resume typography uses bundled Source Sans 3, Source Serif 4 and Lato, with identical assets embedded in standalone exports. Stable `sans`/`serif`/`humanist` keys remain valid, although typography/wrapping can change. New blank documents use 11 pt and keep photos off. Fonts outside the supplied character coverage still require fallback/script-specific review. Word references these families and may substitute fonts on a recipient's device.
- Word exports use semantic headings, real editable bullet numbering, clickable contact relationships, selected font/size/accent/line spacing, A4/Letter and density margins, keep-next/widow controls, and a recurring free-tier footer outside the body. Word deliberately uses a sequential single column and omits photos/decorative rails. It can reflow; XML auditing is not visual Word/LibreOffice approval.
- Twelve designs are available locally: the existing eight IDs, plus `elegant` (Consulting), `portfolio` (Portfolio), `bold` (Brand), and `academic` (Research). Facts, visibility and section order survive design switching. Creative has an optional contact sidebar with mirrored RTL placement; career sections remain sequential in the main column. Timeline aligns date cells beside organization details. Both layouts pass actual PDF text-order checks. Decorative styling is original CSS; reference portraits/assets are not included.
- Twelve fictional profiles stay separate from personal CVs. Seven new starters cover product management, data analysis, project management, HR, senior leadership, research/graduate work and a career change. Original profiles now use fictional display names and replacements for real employer/school names; old URLs/factory identifiers are retained for compatibility. Public detail pages include synthetic job briefs and annotated rewrites using the example's own evidence. Browsing writes no career records; design-only starts remain blank; exported practice documents retain a visible fictional label.
- The catalog combines style, column, suggested career-stage and supported-format filters. Sample length selects short/long fictional content; every design supports multiple pages. Current designs are free to edit, with the existing free-export watermark. Two full paginated previews compare identical content without creating records. Detail pages provide short/long examples, customization and extraction-test scope, and matching letterhead.
- Authorized letter printing now uses shared template, font, paper, pagination and watermark rules. Only contact facts and the reviewed letter body enter the letter layout; the saved CV stays unchanged. Text, Markdown and copy preserve the reviewed text. Public letterhead previews are explicitly fictional.
- Render version `2026-10-11.q3.2` is included in preview/HTML and template matrix manifests. Production traces explicitly include approved CSS/fonts and exclude local databases, test email outboxes and review artifacts. Rendering has a 45-second browser deadline.
- Unsafe website protocols become plain text. External profile images are excluded from the shared layout; supported photos use embedded data images and respect the design/show-photo setting. Hidden and empty sections use the same content-selection rules in preview, HTML/PDF and Word.

## Acceptance coverage

The template suite extends the original 48 cases to 72: all 12 designs, A4/Letter, short content and an oversized entry at both density extremes. Each case captures browser print PDF and authenticated server PDF/HTML/DOCX. PDF audits compare source-text order, page count, paper size, contact links and nonempty pages. DOCX audits compare exact paragraph order, valid XML/ZIP, editable numbering/headings, links, size/margins and footer placement.

An additional browser journey checks all 12 starter previews without IndexedDB writes and authenticates their HTML/PDF exports. It exercises the three fonts, accented text, RTL direction and unsafe website text, with overflow checks and fictional labels.

Additional coverage exercises both comparison views and filters at 360/1440 px, all twelve authorized letterhead prints, and four photo/sidebar/RTL/oversized-metadata cases. Splitting oversized metadata preserves the exact source text rather than reconstructing the original unsplit date block. Candidate pages now use their actual rendered geometry, so inline contacts and shared sidebar rows are counted once. Long content still uses multiple pages; no automatic font shrinking is introduced.

Initial Q3 checkpoint results (2026-10-11, renderer `2026-10-10.q3.1`):

- `npm run typecheck`: passed.
- `npm test`: 91 passed, including the new letter-layout immutability/content/escaping check.
- Full `npm run test:e2e` with synthetic Google: 91 passed in 10.4 minutes; one intentionally skipped unconfigured-provider case passes separately (one test, 10.8 seconds). All 92 distinct cases are exercised across the configurations.
- `scripts/verify-pdfs.py`: 172 passed (72 preview/print, 72 authenticated server resumes, 12 starters, 12 authorized letter prints and four presentation stress files). Exact block order, expected page count, A4/Letter dimensions, links and nonempty pages pass. Letter PDFs are browser prints of authenticated server HTML.
- `scripts/verify-docx.py`: all 72 matrix files pass exact paragraph order, semantic/editable structure, hyperlinks, paper/margins, watermark footer and XML/ZIP validity. This does not establish Word pagination fidelity.
- `NEXT_DIST_DIR=.next-e2e npm run build`: passed. A smoke check invokes the actual compiled renderer and verifies HTML/PDF pagination with Lato and an oversized entry; its three-page Letter PDF passes source-order/paper-size checks. Both export routes trace shared CSS and all three fonts; all 19 production API route traces exclude local data/test artifacts. The production server correctly requires a hosted database; authenticated production deployment is not tested by this isolated renderer check.
- Review all 72 sampled print-page renders across the twelve designs and both browser/server outputs, the twelve starter captures during iteration, full-size sidebar/date layouts, and mobile/desktop comparison/filter/letterhead captures. Correct the Creative thumbnail background selector after image inspection; three catalog/letter tests pass again (36.2 seconds). No sampled text clipping/overlap was found. Conservative pagination and sparse final pages remain a refinement.
- All 121 baseline and 20 dashboard overflow/control checks pass. Scope/distribution and all 15 ZIP entries agree; three font licenses are retained and hashes match recorded provenance. `git diff --check` passes. Normal `/builder` on port 3000 returns HTTP 200; isolated test/production servers have stopped. No live provider was called.

## Pagination refinement - 2026-10-11

Renderer `2026-10-11.q3.2` measures candidate pages in their own layout context instead of adding isolated block heights. The Creative short sample occupies 895.19 px within a 973.12 px A4 capacity, but summing its blocks produces 991.94 px because contact rows share space with the main column. The sample now uses one page instead of two. The same principle applies to inline contact rows in other designs.

Temporary measurement roots preserve the page width, CSS and source order and are removed after pagination. Short entries and heading lookahead still use measured keep-together rules. Oversized text still splits at grapheme boundaries, prefers nearby word breaks and preserves every source character. Facts, paper settings, font size and export authorization remain unchanged.

The new server-rendered regression checks one-page Creative output in both A4/LTR and Letter/RTL, exact source strings, no overflow, the existing 11 pt setting and canonical-document immutability. The editor matrix also requires one-page Creative short fixtures. All twelve standard A4 samples physically fit and paginate to one page. Typecheck and 92 unit tests pass; the focused Creative and photo/sidebar/metadata browser journeys pass (two tests, 48.4 seconds). Final refinement verification:

- Typecheck and all 92 unit tests pass on the final implementation.
- Full browser suite: 91 pass in 11.4 minutes, with one intentional unconfigured-Google skip. That case passes separately (one test, 9.2 seconds); all 92 distinct cases are exercised.
- Regenerated PDF audits: all 172 pass source order, preview/server page count, paper dimensions, contact links and nonempty pages. All 72 regenerated DOCX structural audits pass.
- Isolated production build passes. The actual compiled renderer produces matching HTML/PDF and a three-page Letter/Lato oversized-entry probe. Extracted source blocks remain in order after normalizing typographic ligatures. Both export routes trace approved CSS/fonts, and all 19 API traces exclude local data/test artifacts.
- Review all 72 sampled print renders across twelve designs, including long final pages from browser/server output, plus full-size Creative A4/Letter and long-letter final pages. No sampled clipping or footer overlap was found. Keep-together rules still permit valid sparse final pages; the fix removes false page breaks caused by shared-row accounting.
- All 121 baseline and 20 dashboard overflow checks pass. Scope/distribution and all 15 ZIP entries still agree. Font provenance checks pass. `git diff --check` passes. Port 3000 `/builder` returns HTTP 200; isolated servers have stopped. No live provider call was made.

## Remaining Q3 gates

- Visual opening/editing/pagination in Microsoft Word and LibreOffice; neither application is installed on this machine.
- Human visual sign-off, more script-specific glyph/bidi cases and cross-platform/browser checks.
- Human content/design sign-off for the fictional collection and broader page-break preferences. Shared-row overcounting is corrected; sparse tails caused by short-entry keep-together rules may still be valid for longer documents. The sidebar carries contact information; it does not move career sections or skills into a second reading stream. The aligned dates stay on the right in LTR to preserve the source order. Broader optional sidebar composition remains a refinement rather than a claim about the current design.

Live email/OAuth/database/payment/AI deployment, human assistive-technology review and Q4 actual-file diagnostics/evidence evaluation remain separate gates. No live provider call, email or payment is part of this local verification.
