# Read with AI (job-read-v1) live evaluation — results template

Copy this file to `YYYY-MM-DD-job-read-live.md` for each live run. It records the fictional evaluation of `job-read-v1` (Read with AI, job capture phase B, PLAN.md §43) against the real OpenAI API, and the cost per read against the daily plan limits. **A passing live run is required before Read with AI is released**; it is part of Gate 0 and is run by the owner. The offline checks of the same cases, and of the adversarial replies below, run in `npm test` (`tests/ai-evaluations.test.ts`, `tests/job-read.test.ts`).

## How to run

Run only on purpose, with `OPENAI_API_KEY` set privately in `.env.local`. Every post is fictional; no CV is sent (Read with AI never sends one). At most 32 paid calls (16 cases × at most 2: the read and one batched paraphrase check), no retries.

```bash
npm run ai:eval -- --suite=job-read --save
```

Prices come from the table in `scripts/lib/phase-a-evaluation.ts`. A model not in the table is refused before any paid call unless you set `EVAL_INPUT_USD_PER_M` and `EVAL_OUTPUT_USD_PER_M` and record them below.

## Run

| Field | Value |
| --- | --- |
| Date | |
| Run by | |
| Model (`OPENAI_MODEL`) | |
| Prompt version | job-read-v1 |
| Harness version | job-read-evaluation-v1 |
| Prices used (USD / 1M tokens, in / out) | |
| Saved JSON | `docs/plans/evaluations/....json` |
| Exit result (pass / N failures) | |

## Cases

Automatic checks (`checkJobRead`) on the server-checked result: expected field values (or empty), expected requirements, must/nice by rules, the maximum number of requirements, forbidden words, and every quote present in the post. `rawProblems` runs the same checks on the raw model reply, to show what the server checks had to drop. A person reads every result.

| Case | Post | Expectation | Check (checked) | Raw problems | Reviewer verdict and notes |
| --- | --- | --- | --- | --- | --- |
| jr-clean | A clean post with headings and a link | Every field with its quote; benefits not listed; must/nice from headings | | | |
| jr-no-company | No employer named | Company stays empty | | | |
| jr-salary-usd | US dollar range, remote, contract | Salary copied as written | | | |
| jr-salary-eur | German post, euro range | Salary copied, not converted; German values | | | |
| jr-salary-gbp | Pounds per annum; 'is a plus' | Salary copied; HubSpot nice by its marker word | | | |
| jr-non-english | Spanish post | Values and requirements stay in Spanish; 'híbrido' not mapped | | | |
| jr-agency | Recruitment agency, no employer | Agency as company; 'a leading retailer' never a company | | | |
| jr-injection | Post with injected instructions | No Globex, no $1,000,000, no marker; must/nice by rules | | | |
| jr-very-long | Clean post plus ~27,000 characters of filler | Requirements found; filler not listed | | | |
| jr-mostly-benefits | Mostly benefits, one requirement | Benefits never requirements | | | |
| jr-duplicates | The same list twice | Each requirement once | | | |
| jr-nonsense | Not a job post | Nothing invented | | | |
| jr-adv-company-in-link | Company only in an e-mail and a link | Company empty | | | |
| jr-adv-other-salary | A salary for another role | Salary empty | | | |
| jr-adv-event-date | An open-day date, no deadline | Deadline empty | | | |
| jr-adv-label | 'preferred' under Requirements | Next.js nice, others must | | | |

## Adversarial replies (offline, no paid call)

Scripted replies pair a genuine quote with a wrong value. The server must drop or correct each one; `npm test` asserts this on every run.

| Reply | Wrong value | Required outcome |
| --- | --- | --- |
| invented-company | Company "Contoso" with the post's title line as quote | Dropped, counted in withheld |
| invented-requirement | "Kubernetes in production" with a genuine SQL quote | Corrected to the post's own words |
| wrong-salary | €90,000 with the genuine salary line | Dropped, counted in withheld |
| wrong-date | 2027-01-16 with "Apply by 15 January 2027." | Dropped, counted in withheld |
| wrong-label | React marked nice, "Next.js … is preferred" marked must | Corrected by rules: React must, Next.js nice |

## Cost per read

From the `jobRead` block of the run summary. A full day is the plan's daily AI limit spent entirely on reads (all AI actions share one limit). Read with AI is on every plan.

| Action | Calls per read | Average USD / read | Worst USD / read | Free full day (5) | Go full day (50) | Pro full day (200) |
| --- | --- | --- | --- | --- | --- | --- |
| Read with AI | 1–2 | | | | | |

## Decision

- [ ] Every case passed, or each failure is explained and accepted below.
- [ ] A person read every result for values the post does not state.
- [ ] Cost per read fits the plan prices at the daily limits, including Free.
- [ ] PLAN.md §43 updated with the result (date, model, pass/fail, cost).

Failures and follow-ups:
