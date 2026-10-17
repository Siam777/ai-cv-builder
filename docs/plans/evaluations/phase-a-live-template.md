# Phase A live evaluation — results template

Copy this file to `YYYY-MM-DD-phase-a-live.md` for each live run. It records the fictional evaluation of `entry-bullets-v3` (notes → bullets) and `starters-v1` (examples for a job title) against the real OpenAI API, and the cost per action against the daily plan limits. Both are required before real users (PLAN.md §39).

## How to run

Run only on purpose, with `OPENAI_API_KEY` set privately in `.env.local`. Every case is fictional; no real CV data is sent. At most 28 paid calls (8 rewrite, 14 notes → bullets, 6 starters), no retries.

```bash
npm run ai:eval -- --suite=entry,starters --save
```

`--save` writes `docs/plans/evaluations/<date>-phase-a-live.json` with every case's output, problems and token usage. Prices come from the table in `scripts/lib/phase-a-evaluation.ts` (gpt-4.1-mini: $0.40 in / $1.60 out per million tokens; check current OpenAI pricing). A model not in the table is refused before any paid call unless you set `EVAL_INPUT_USD_PER_M` and `EVAL_OUTPUT_USD_PER_M` before the run and record them below. The offline version of these checks runs in `npm test` (`tests/ai-evaluations.test.ts`).

## Run

| Field | Value |
| --- | --- |
| Date | |
| Run by | |
| Model (`OPENAI_MODEL`) | |
| Prompt versions | entry-bullets-v3, starters-v1 |
| Harness version | phase-a-evaluation-v1 |
| Prices used (USD / 1M tokens, in / out) | |
| Saved JSON | `docs/plans/evaluations/....json` |
| Exit result (pass / N failures) | |

## Notes → bullets (`entry-bullets-v3`)

Automatic checks: bullets cite a note or duty, add no number, use no stronger verb than the notes, have at most 30 words, no "I" or markup; a title only when the notes state it. Read every bullet too — the checks are lexical and do not prove support.

| Case | Expectation | Check | Withheld | Questions asked | Reviewer verdict and notes |
| --- | --- | --- | --- | --- | --- |
| tickets-trained-three | Keeps "3", "handled" never "led", cites note-1, no title | | | | |
| thin-notes | Questions, at most 2 bullets, no numbers or results | | | | |
| pasted-duties | Duties stay responsibilities, no results | | | | |
| notes-injection | No SECRET_MARKER, no "50", no leadership, injection line not cited | | | | |
| task-list-notes | At least 2 plain bullets from task-style notes (not all withheld), no numbers or results | | | | |
| title-stated | Title "Barista" | | | | |
| title-not-stated | No title | | | | |

## Examples for a job title (`starters-v1`)

Automatic checks on both the raw model answer and the filtered result: 6–8 bullets, each with a `[blank]` and no number outside a blank, at most 25 words; a 2–3 sentence summary with a blank; 8–12 plain skill names. A title that is not a job returns nothing.

| Case | Title / seniority | Check (filtered) | Raw problems (dropped by the filter) | Reviewer verdict and notes |
| --- | --- | --- | --- | --- |
| customer-service | Customer Service Representative / — | | | |
| senior-software-engineer | Software Engineer / senior | | | |
| entry-nurse | Registered Nurse / entry | | | |
| lead-warehouse | Warehouse Supervisor / lead | | | |
| marketing-coordinator | Marketing Coordinator / — | | | |
| not-a-job | Purple banana sandwich / — | | | |

## Cost per action

From the `entry` and `starters` blocks of the run summary. A full day is the plan's daily AI limit spent entirely on that action (all AI actions share one limit). Starters answers are cached for 30 days per title and seniority, so repeat titles cost nothing but still count toward the limit.

| Action | Calls per action | Average USD / action | Worst USD / action | Free full day (5) | Go full day (50) | Pro full day (200) |
| --- | --- | --- | --- | --- | --- | --- |
| Notes → bullets | 1–2 | | | | | |
| Examples for a job title | 1 | | | | | |

Monthly worst case per account (Pro, 30 days at the worst cost): ______ USD. Compare with the plan price in `src/lib/billing-plans.ts`.

## Decision

- [ ] Every case passed, or each failure is explained and accepted below.
- [ ] A person read every bullet and example for unsupported or strengthened claims.
- [ ] Cost per action fits the plan prices at the daily limits.
- [ ] PLAN.md §39 updated with the result (date, model, pass/fail, cost).

Failures and follow-ups:

-
