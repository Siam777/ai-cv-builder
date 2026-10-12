# Q0 local visual baseline review

Date: 2026-10-10 (Asia/Dhaka)
Status: completed locally. PLAN.md owns implementation progress; release scope is unchanged.

## Coverage and evidence

The Chromium baseline uses a 1000 px viewport height at three widths:

| Width | Captured states | Horizontal overflow / clipped controls |
| --- | --- | --- |
| 360 px | 40 | None detected by the recorded checks |
| 768 px | 41 | None detected by the recorded checks |
| 1440 px | 40 | None detected by the recorded checks |

The 121 captures cover empty/populated device libraries, demo browsing/preview, import review, contact/experience editing, mobile/tablet preview, design selection, analyzer confirmation/role/findings/text, practice generation, section creation, shortcuts, empty/saved history, tailoring input/results, letter input/review, AI sign-in gate, export menu/sign-in, profile sign-in/signup/recovery/unverified/verified states, verification completion without a session and with a verified session, pricing, unconfigured checkout, public reviewer input/report, expired verification, password reset states and 404. The pricing dialog is captured where its header control is available; the public pricing page is captured at all widths. This is a selected state inventory, not every possible account or network failure combination.

Reviewed all 21 UI contact sheets, full-size mobile export/tailoring/letter captures, and detailed mobile crops of pricing, the verified profile and the public report. Contact sheets supplement original PNGs; they do not replace readable source inspection for small controls or long pages. Confirmed that modal headers/actions remain visible in these captures and that the corrected form controls and export menu fit horizontally. Gallery filters, section navigation and the mobile pricing matrix intentionally scroll within their own containers.

All 48 browser preview/print PDF fixtures pass exact source-text order, preview/print page-count parity, A4/Letter dimensions, contact links and nonblank-page checks. Poppler rendered 24 representative pages: the first short A4 page, first long airy A4 page and final long tight Letter page for each of the eight existing designs. Reviewed the four print contact sheets; the sampled pages show readable hierarchy, wrapped long URLs, continued oversized entries, intact section boundaries and visible page furniture without apparent clipping. This sample does not certify every page or establish parity with the separate authenticated standalone HTML/server PDF renderer.

## Changes made from the review

| Finding | Implemented correction |
| --- | --- |
| Tablet hides the primary navigation while the library shortcut only appears below 760 px | Show the library shortcut through the shared 900 px navigation breakpoint; the 768 px journey can return to the library |
| Visiting `/auth/complete` directly reports email verification without checking the account | Check the current account; show success only for a verified session, a neutral sign-in/check state otherwise, and an explicit expired/error state |
| The mobile export menu extends beyond the left viewport edge | Align its menu to the trigger's left edge on small screens; assert horizontal bounds of every export menu button |
| Tailoring/letter fields are clipped by a two-column grid on mobile | Use bounded grid tracks and stack fields below 520 px; assert input/textarea bounds against the viewport and dialog |
| Shared public-review styles override the tailoring badge's color and text size | Scope the badge's color, size and label typography to the tailoring modal |
| Letter input promises independently verified facts and zero hallucinations; tone buttons do not affect generation | Describe the existing resume-based draft and require fact review; remove the inert tone selector. No generation algorithm changed |
| Pricing/profile copy promises unlimited variants/tailoring, permanent storage, unverified refund/security terms or features unavailable locally | Label proposed plans and configured caps, disclose pending service validation, show current free tools accurately, and explain account/import/export data handling. Billing behavior, prices and entitlements were not changed |

Verification completion has positive, anonymous and expired/error browser assertions. The checkout capture exercises the existing fail-closed endpoint and shows a useful setup message instead of the raw configuration error code.

## Reproduction and final checks

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
python scripts/verify-pdfs.py
python scripts/review-visual-baseline.py --pdfs
```

The Python review helper requires Pillow, pypdf and Poppler's `pdftoppm` on PATH. See README.md for Chromium/installed Chrome setup. The full browser run replaces its previous output directory. A later focused run used `--output=test-results/focused` to preserve the full-suite PDF fixtures while refreshing the baseline screenshots after the final badge typography adjustment.

Final results: typecheck and production build pass; 89 unit tests pass; all 55 browser tests pass (3.3 minutes). After the final CSS adjustment, five affected browser tests pass (50 seconds): all three viewport baselines, the cover-letter export journey and full feature journey. All 48 PDF audits pass. `git diff --check` passes. Root/distribution FEATURE-PLAN.md and the ZIP entry agree; the archive has 15 entries. The isolated port 3100 server stopped after testing.

Only synthetic fixtures, reserved example domains, isolated `data/e2e.db` and the private local file email outbox were used. External email, AI and payment credentials are blank in the browser test configuration; no real email delivery or paid provider call is claimed. The normal development database/server was not used for these tests. Generated evidence is ignored under `test-results/visual-baseline/`, with manifests beside source PNGs and contact sheets/rendered print PNGs under `review/`.

## Remaining work

- **Q2:** coherent public navigation/landing/gallery routes and editor shell polish. Small screens currently have long stacked editor/profile/report pages, densely wrapped toolbar actions and a pricing matrix that needs horizontal scrolling. These are recorded starting points for the redesign, not completed launch UX.
- **Q3:** common preview/server export rendering, template polish/expansion and editable DOCX inspection. The print fixture sample is not a server-renderer sign-off.
- **Q4:** actual-file diagnostics and evaluated evidence/rubric workflows. The public sample parser still treats some standalone skill lines as short bullets; report findings must be reviewed against source content. Removing unsupported scores does not validate every heuristic.
- **Q1/Q5:** live verification/recovery delivery and hosting/session/abuse-limit checks, then OAuth, database/provider/billing operations and usability validation. No cross-browser, screen-reader, zoom, reduced-motion or WCAG certification is established by this baseline.
