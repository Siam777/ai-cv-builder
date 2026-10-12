# Q2.1 public shell implementation and review

Date: 2026-10-10 (Asia/Dhaka)
Status: public slice implemented locally; Q2 remains partial. PLAN.md owns milestone progress and FEATURE-PLAN.md owns release scope.

## Delivered behavior

- `/` now opens a public landing page with real rendered fictional resume content, three switchable designs, template previews, supported wording guidance, current storage/export requirements, FAQ and working creation/review links.
- `/templates` offers the eight existing designs with search, categories, empty-result reset and detail pages. `/examples` offers the five existing fictional profiles, role categories and read-only detail pages. Unknown detail IDs return 404.
- `/builder` retains the existing library/editor, database name, schema, local/account selection and authenticated export boundary. Returning drafts require no migration or implicit upload. Editor, profile, pricing, reviewer transfers and billing return URLs use this route.
- A public design/example link selects allowlisted presentation only. The library explains the pending choice and offers cancellation. Browsing, selection and reload create no personal record. Explicit **Create my resume** creates one independent personal CV with blank contact fields and empty career sections. Example provenance records the source ID; fictional identity, work and metrics are not copied.
- `/help` documents the implemented saving/import/export/recovery paths. `/privacy` describes current data handling and deployment limits. It does not substitute for deployment-specific legal review or a retention policy.

## Design and implementation decisions

The resume is the main visual proof. Public pages use the planned paper/mist/ink/blue/teal palette, restrained borders, Georgia display type and system sans-serif controls. Source Sans/Serif font licensing and bundling remain a later decision; this slice adds no remote font dependency, copied artwork, testimonials, customer totals or ATS scores.

The shared public shell is scoped with a CSS module. Server pages pass synthetic documents to client previews, preserving stable IDs through hydration. Thumbnail rendering suppresses contact hyperlinks inside the enclosing preview link; full detail previews retain the actual renderer and links. Hero examples and thumbnails are inert visual samples; named controls provide the accessible interaction. Details use the existing paginated preview and zoom controls.

Desktop navigation collapses to a native disclosure on narrower screens. Cards become two columns on tablet and one on mobile. Mobile landing highlights three designs with a link to all eight; the full catalog keeps all designs available. Buttons/filters expose pressed states, fields have labels, counts announce changes, and focus styles and reduced-motion rules are provided. These checks do not establish comprehensive assistive-technology conformance.

Pricing and account routes continue to use their existing layouts. The public page describes proposed paid services and current free export watermarking. Google sign-in is not advertised as available. Account verification, reset and session behavior remain governed by Q1.

## Reproduce the review

Run `npm run typecheck`, `npm test`, `npm run test:e2e` and `npm run build`. Browser tests own port 3100, use isolated SQLite/file-outbox state and blank external provider credentials. They do not send live mail or charge payments. Run the build after browser checks to restore the normal generated Next.js type path.

With Python, Pillow and pypdf installed, run:

```sh
python scripts/review-public-shell.py
python scripts/verify-pdfs.py
```

Source captures are in `test-results/public-shell/{360,768,1440}/`; review contact sheets, source-resolution hero crops and landing strips are in `test-results/public-shell/review/`. The 32 public captures supplement the 121 existing private/editor/account baseline states. All data is synthetic. Review captures manually: overflow assertions alone cannot detect typography inheritance or a wrapped logo.

For focused public-route checks that preserve print fixtures:

```sh
npm run test:e2e -- tests/e2e/public-shell.spec.ts --output=test-results/public-shell-check
```

## Review findings

The first visual/hydration pass found and fixed nested contact anchors inside thumbnail links, a landing heading rule overriding template typography, inherited link underlines across thumbnails and a wrapped logo mark. The old feature-verification test was updated to open `/builder` instead of the former editor root. Its editor assertions remain intact.

The public checks cover all three target widths, working navigation and 404s, actual preview readiness, search/filter/reset, hydration errors, horizontal overflow, preservation of an edited Unicode draft, selection/reload/cancellation without writes and exactly one blank independent design start. The new selected-design banner is captured at all three widths.

Final verification: typecheck, 89 unit tests, production build and all 60 browser tests passed (4.4 minutes). After the last logo/underline corrections, all five public browser tests passed again (31.3 seconds), retaining the full print artifacts. All 48 preview/print PDF audits passed exact source-text order, page count, paper dimensions and link checks. The 32 public captures were reviewed through contact sheets, readable landing strips and source-size hero/detail/banner views. Existing private/editor/account coverage passed its 121-state baseline checks; this slice does not repeat the earlier manual 24-page print review or certify renderer parity. The isolated test server stopped, `git diff --check` passed and root/distribution/15-entry ZIP feature scope matched.

Measured solid public foreground pairs on white: ink 15.22:1, muted text 6.12:1, blue 6.45:1 and teal 6.36:1. White button text on solid blue has the same 6.45:1 ratio. These spot checks do not cover every runtime combination or establish an accessibility certification.

## Remaining milestones

- Q2: [dashboard/editor foundation](q2-dashboard-editor-review.md), [Google/account integration](q2-google-account-review.md) and [bundled typography/toolbar/keyboard polish](q2-editor-polish-review.md) were delivered in subsequent local slices. Comprehensive human accessibility review and live Google configuration/validation remain open.
- Q1/Q5: configure and validate live email, hosting, database, shared abuse controls and provider operations.
- Q3: template polish/expansion and parity between the preview, standalone HTML/server PDF and Word. The existing 48 preview/print fixture audits do not establish that parity.
- Q4: actual exported-file diagnostics and evaluated, evidence-backed suggestions. Static supported wording on the landing does not complete that workflow.

No release scope or skill guidance changed in this slice. Existing feature distribution and ZIP entries must continue to match.
