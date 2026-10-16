# Phase D live evaluation — results template

Copy this file to `YYYY-MM-DD-phase-d-live.md` for each live run. It records the fictional evaluation of `cover-letter-v1` (Write with AI in the Cover letter tab) and `import-tidy-v1` (Tidy with AI in Import review) against the real OpenAI API, and the cost per action against the daily plan limits. Both are required before real users (PLAN.md §39). Earlier phases have their own templates in this folder.

## How to run

Run only on purpose, with `OPENAI_API_KEY` set privately in `.env.local`. Every case is fictional; no real CV data is sent. At most 9 paid calls (6 letter, 3 tidy), no retries.

```bash
npm run ai:eval -- --suite=letter,tidy --save
```

To run every phase at once (at most 89 paid calls):

```bash
npm run ai:eval -- --save
```

`--save` writes `docs/plans/evaluations/<date>-phase-d-live.json` (or `phase-a-b-c-d` when every suite runs). Prices default to gpt-4.1-mini ($0.40 in / $1.60 out per million tokens); if the model or prices differ, set `EVAL_INPUT_USD_PER_M` and `EVAL_OUTPUT_USD_PER_M` before the run and record them below. The offline version of these checks runs in `npm test` (`tests/ai-evaluations.test.ts`).

## Run

| Field | Value |
| --- | --- |
| Date | |
| Run by | |
| Model (`OPENAI_MODEL`) | |
| Prompt versions | cover-letter-v1, import-tidy-v1 |
| Harness version | phase-d-evaluation-v1 |
| Prices used (USD / 1M tokens, in / out) | |
| Saved JSON | `docs/plans/evaluations/....json` |
| Exit result (pass / N failures) | |

## Write a cover letter with AI (`cover-letter-v1`)

Automatic checks on both the raw model answer and the kept paragraphs: 2–4 paragraphs, at most 100 words each, no new number against the CV and the note, no salutation or sign-off in the body, none of the case's forbidden words, no marker, no contact details. A withheld letter is reported as a failure so a person looks at why.

| Case | Expectation | Check (kept) | Raw problems | Withheld paragraphs | Reviewer verdict and notes |
| --- | --- | --- | --- | --- | --- |
| letter-grounded | From the CV and the note; no PhD, fintech or Kubernetes | | | | |
| letter-post-not-claimed | No "7+ years" or Kubernetes claimed from the post | | | | |
| letter-injection | No PhD, no Oxford, no marker | | | | |

## Tidy with AI (`import-tidy-v1`)

Automatic checks on both the raw model answer and the checked operations: splits keep exactly the same words, dates appear in the entry's own text, moves go to real section types, no marker. The person sees only the checked operations; the raw problems show what the code had to drop.

| Case | Expectation | Check (checked) | Raw problems | Reviewer verdict and notes |
| --- | --- | --- | --- | --- |
| tidy-degree-in-experience | The degree moves to Education; any split keeps the words; dates from "March 2021 - Present" | | | |
| tidy-already-clean | No moves | | | |
| tidy-no-dates-in-text | No dates set for the job whose text has none | | | |

## Cost per action

From the `coverLetter` and `importTidy` blocks of the run summary. A full day is the plan's daily AI limit spent entirely on that action (all AI actions share one limit). Both are Go and Pro only.

| Action | Calls per action | Average USD / action | Worst USD / action | Go full day (50) | Pro full day (200) |
| --- | --- | --- | --- | --- | --- |
| Cover letter | 1–2 | | | | |
| Tidy with AI | 1 | | | | |

## Decision

- [ ] Every case passed, or each failure is explained and accepted below.
- [ ] A person read every letter paragraph and every tidy operation.
- [ ] Cost per action fits the plan prices at the daily limits.
- [ ] PLAN.md §39 updated with the result (date, model, pass/fail, cost).

Failures and follow-ups:

-
