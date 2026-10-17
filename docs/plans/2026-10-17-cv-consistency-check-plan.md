# Step 1 — CV truth and consistency check: implementation plan

Date: 2026-10-17. Scope source: FEATURE-PLAN.md "Career workflow roadmap", step 1. Background: [2026-10-17-career-platform-analysis.md](2026-10-17-career-platform-analysis.md). Starts only after Gate 0. Nothing here is implemented.

## 1. Goal

One check over the whole CV that finds statements that contradict each other, repeat each other or may be hard to back up. Each finding names the exact statement, and the person can fix it or confirm it. It is advice: it never blocks an export, never gives a score and never predicts hiring.

## 2. What exists and is reused

| Piece | Where | Use |
| --- | --- | --- |
| Heuristic linter, finding type `AtsLintIssue` | `src/lib/linter/ats-linter.ts` | Already checks date format; new rules return the same shape |
| Finding copy, grouping by editor step | `src/lib/check-findings.ts` (`describeFinding`, `groupFindings`, `issuesToFix`) | New `ruleId` cases; grouping works unchanged |
| Check my CV panel and inline hints | `src/components/editor/CheckPanel.tsx` | Shows the new findings in their own group |
| Per-CV dismissals (browser only) | `src/lib/dismissed-findings.ts` | Pattern for the new "Confirmed" store |
| Number patterns | `METRIC_PATTERNS` in `ats-linter.ts` | Finds numbers to confirm and repeated number claims |
| Skills aliases | `src/lib/skills-taxonomy.ts` | Matches "JS" to "JavaScript" when looking for skill evidence |
| Export buttons | `EditorToolbar.tsx` → `onExport` | Where the reminder before export is shown |

There is no AI in this step, so it costs nothing per run and needs no consent. It runs in the browser on every edit, like the linter.

## 3. Rules

Code: new pure module `src/lib/linter/consistency.ts` exporting `checkConsistency(doc: ResumeDocument, today = new Date()): AtsLintIssue[]`. Only visible sections are checked. Each finding ID is stable, built from the IDs of the items involved plus a short hash of the text it quotes, so editing that text reopens a confirmed finding.

| ruleId | Detects | Tone | Notes |
| --- | --- | --- | --- |
| `date_order` | End date before start date (not current) | attention | Any section with dates |
| `date_future` | End date after this month, not marked current | attention | Offer "Mark as current" |
| `date_missing` | Experience entry with a title but no start date | attention | Education and projects are exempt |
| `date_overlap` | Two experience entries overlapping by 3 months or more, neither marked part-time/concurrent | suggestion | Overlaps are often real (part-time, freelance), so the wording is "Check these dates", never "error". Needs `relatedEntryIds` |
| `org_spelling` | The same employer written two ways ("Acme Ltd" / "ACME Limited") | suggestion | Normalize case, punctuation and company suffixes |
| `title_variant` | The same title written two ways ("Sr. Engineer" / "Senior Engineer") | suggestion | Small abbreviation table |
| `duplicate_bullet` | Two bullets that say the same thing (normalized word overlap ≥ 0.85) | attention | Quote both, link to both |
| `repeated_number` | The same number and unit claimed in two different entries ("cut costs 30%") | suggestion | Often a copy-paste mistake |
| `years_claim` | The summary or headline says "N years" and N is more than the years the dates cover plus one | attention | Uses experience dates only; says how many years the dates show |
| `skill_without_evidence` | A listed skill that appears nowhere else (summary, bullets, descriptions, projects, certificates) | suggestion | One grouped finding listing up to 8 skills, with "Show where you used it" |
| `number_to_confirm` | A bullet with a specific number (percentages, money, team size, counts) | suggestion | "Can you back this up in an interview?" Buttons: Confirm or Edit. Never says the number is wrong |

Not checked on purpose: **employment gaps** (they are not a contradiction, and flagging them pushes people to hide them), age, and anything about protected characteristics.

## 4. Type and copy changes

- Extend `AtsLintIssue.ruleId` with the new IDs and add an optional `relatedEntryIds?: string[]` and `relatedBulletIds?: string[]` for findings about two items. `describeFinding` gets one case per rule (TypeScript makes the switch exhaustive). Copy follows the existing style: a short title written as the thing to do, plus a muted detail line.
- Add `category: "consistency"` (optional field) so CheckPanel can show these under their own heading, "Is everything consistent?", inside each step group.
- `cv-strength.ts` is **not** changed in this step. Consistency findings do not lower a strength measure or produce a score.

## 5. Confirming a finding

- A new store, `src/lib/confirmed-findings.ts`, works like `dismissed-findings.ts` (per CV, in the browser, with try/catch around storage). A confirmed finding is hidden and shown as "Confirmed" when "Show confirmed" is opened.
- Difference from Dismiss: Confirm is for `number_to_confirm`, `date_overlap` and `skill_without_evidence` ("this is true"). Dismiss stays for advice the person does not want.
- Because the ID contains the text hash, changing the number or the dates reopens the finding.
- Limitation (accepted for v1): confirmations stay in one browser, as dismissals do. Moving dismissals and confirmations into the stored document, so they sync across devices, is a later change because it needs a document schema change (`documentSchema` is strict, `schemaVersion: 1`).

## 6. Reminder before export

- When an export of a CV (PDF, DOCX, TXT, MD, HTML) starts and there are open **attention-level** consistency findings, show a small dialog: "Before you send it: 2 things to check", listing them, with **Review** (opens Check my CV on the first one) and **Export anyway**.
- It never blocks: "Export anyway" continues the normal authenticated export path unchanged. A checkbox, "Don't remind me for this version", is remembered per CV and revision in the browser.
- No reminder for JSON backups or account-data export.

## 7. Files

| Change | File |
| --- | --- |
| New rules | `src/lib/linter/consistency.ts` |
| Run with the linter | call site that builds the Check panel issues (`resume-studio.tsx` / `CheckPanel.tsx`) |
| Types and copy | `src/lib/linter/ats-linter.ts`, `src/lib/check-findings.ts` |
| Confirm store | `src/lib/confirmed-findings.ts` |
| Panel UI | `src/components/editor/CheckPanel.tsx` (group heading, Confirm button, "Show confirmed") |
| Export reminder | new `src/components/editor/ExportCheckDialog.tsx`, wired in `EditorToolbar.tsx` / `resume-studio.tsx` |
| Help | `src/app/help/page.tsx`: what is checked and what is not (gaps) |

## 8. Tests

- **Unit** `tests/consistency.test.ts` (added to the `npm test` list): positive and negative cases per rule, including current roles, year-only dates, real part-time overlaps, company suffixes, near-duplicates below the threshold, "10+ years" phrasing, skill aliases, hidden sections ignored, stable IDs, and an edit changing the ID.
- **Unit** `tests/check-findings.test.ts`: a `describeFinding` case for every new rule.
- **E2E** `tests/e2e/check-panel.spec.ts`: overlap finding → Confirm → hidden → edit the date → back. The export reminder appears, "Export anyway" downloads the file, and the reminder doesn't appear with no attention findings. Keyboard-only and phone width.
- Run `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.

## 9. Done when

- Every rule has passing positive and negative tests, and no finding appears on the 12 demo CVs unless that demo really has the problem (review the list by hand, and fix the demos or the rule).
- Confirm, Dismiss and the export reminder work by keyboard, with a screen reader name for each button, and at 375 px width.
- The help page explains each rule and why gaps are not checked. PLAN.md records what was delivered.

## 10. Size and risks

- Size: small to medium, about 2–3 days.
- **Noise** is the main risk: too many suggestions make people ignore the panel. Start with attention-level rules on, keep suggestions grouped, and check the demo CVs for false positives before release.
- **Fairness:** wording never implies dishonesty ("Check", "Can you back this up", never "suspicious").
- **Later (not this step):** an optional AI pass that checks the summary's claims against the body, reusing the Ask the AI support check. It would be a counted request with consent.
