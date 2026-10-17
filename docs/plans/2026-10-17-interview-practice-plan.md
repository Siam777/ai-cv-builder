# Step 3 — Interview practice: implementation plan

Date: 2026-10-17. Scope source: FEATURE-PLAN.md "Career workflow roadmap", step 3. Background: [2026-10-17-career-platform-analysis.md](2026-10-17-career-platform-analysis.md). Starts after Gate 0. It works without the tracker (step 2) but links to it when present. Nothing here is implemented.

Name: **Interview practice** in the interface, `practice` in code. It is not the existing "AI interview" (`/api/ai/interview`, `ai_interviews`), which builds a CV.

## 1. Goal

The person picks a CV and pastes a job post (or opens one saved in an application). They get questions built from their own CV and that job, answer them by typing, and get feedback on relevance, structure, clarity and examples. Claims in the CV that an interviewer is likely to probe are flagged. Nothing the AI says may add facts about the person.

## 2. How it is built — split work between rules and AI

| Part | Done by | Why |
| --- | --- | --- |
| "Be ready to back this up" questions for numbers and leadership claims | **Rules** (reuse `METRIC_PATTERNS`, leadership verbs, and step 1's `number_to_confirm`) | Cheap, predictable, no request spent |
| Answer basics: word count, whether there is a result, first-person action, STAR parts present | **Rules** | Shown instantly, also when the AI is unavailable |
| Question set from the CV + job post | **AI**, 1 counted request | Needs understanding of the job |
| Feedback on one answer | **AI**, 1 counted request per answer | Needs judgment |
| Checking the AI's output | **Rules + existing support check** | Same evidence rules as every AI feature |

## 3. Server

### Question set — `POST /api/ai/practice/questions`

Request (`src/lib/ai-contract.ts`, `practiceQuestionsSchema`): `{requestId, documentId, revision, job: {title ≤ 200, text 50–20,000}, applicationId?}`. Flow in `ai-service.ts` with the existing helpers: `preparePlanned` (plan flag `aiPractice`, consent, provider configured, ownership, revision) → `counted("ai_practice_questions", PRACTICE_QUESTIONS_PROMPT_VERSION, …)`.

The prompt (new function in `openai-provider.ts`) sends the CV content with contact details removed (the same redaction as Ask the AI), with evidence IDs per entry and bullet, plus the job text marked as untrusted data. The model returns 6–8 questions:

```ts
{ id, text, kind: "experience" | "role" | "motivation",
  evidenceIds: string[],          // CV items the question is about (experience)
  jobQuote?: string,              // exact words from the job post it comes from (role)
  why: string }                   // one line: why an interviewer would ask it
```

Checks before returning (any failure drops that question, and the count is reported as `withheld`):
- every `evidenceIds` item exists in this CV revision (as in Ask the AI);
- `jobQuote` is an exact substring of the pasted job text;
- a question must not assert experience the CV does not show ("Tell me about your time leading the AWS migration" when the CV has none). This uses one batch support check, the same independent check used by Ask the AI;
- at most 8 questions are kept; if fewer than 3 remain, the result says so plainly.

The rule-based "back this up" questions are added on the client, labelled "From your CV".

### Feedback — `POST /api/ai/practice/feedback`

Request: `{requestId, documentId, revision, question: {text, evidenceIds, jobQuote?}, answer 20–3,000}`. One counted request.

Response:

```ts
{ strengths: { quote: string; note: string }[],    // quote must be an exact part of the answer
  improve: { note: string; outline?: string }[],   // outline uses [blanks], never invented facts
  mismatches: { answerQuote: string; cvText: string; evidenceId: string }[],
  structure: { situation: boolean; task: boolean; action: boolean; result: boolean } }
```

Checks:
- each `strengths.quote` and `mismatches.answerQuote` is a substring of the answer;
- **mismatches are found by rules first**: numbers in the answer compared with numbers in the cited CV items ("Your CV says a team of 5; your answer says 8"). The AI may add wording mismatches, which go through the support check;
- `outline` passes the existing **new-number check** and contains blanks instead of results ("…which cut processing time by [your result]"), shown with `BlankFiller` from `src/lib/starter-blanks.ts`. There is **no model-written "perfect answer"**, because it would put invented facts in the person's mouth;
- feedback that fails a check is withheld with a plain message, as Ask the AI does.

### Storage and plan

- **No server storage of answers** in v1. The session lives in the browser tab. In a signed-in account with step 2, **"Save to application notes"** appends the questions and the person's own answers (no AI text) to the application's notes, only when clicked.
- `PlanConfig.aiPractice: boolean` (`billing-plans.ts`, `planAllows("ai-practice")`). Recommended: Go and Pro. Free sees the plan message plus the rule-based "back this up" questions, which cost nothing. Each AI call counts toward the existing daily limits (Free 5 / Go 50 / Pro 200).
- Logs: metadata only (question count, withheld count, prompt version, duration). Never the job text or answers.

## 4. Interface

- A full-width **Practice** view (`PanelDialog`), not a fifth AI Assistant tab: four tabs are already tight at phone width.
- It opens from: the application detail panel ("Practice for this interview", job post filled in), the Match a job results ("Practice questions for this job"), and a new Ask the AI action `practice` (added to `ASK_ACTIONS` and `validAskActions`).
- Layout: the question list on the left, the current question with "Why they ask this", the CV items it refers to (click to open them in the editor), and an answer box. "Get feedback" (shows "uses 1 AI request") gives the rule checks instantly and then the AI feedback. "Next question" moves on.
- The top says: "Practice feedback from AI. It is not a prediction of how an interview will go."
- Before building this UI, **extract the shared AI request hook** (consent prompt, plan message, daily limit, error text) that PLAN.md §39 lists as repeated across the AI components, and use it here first.

## 5. Evaluation

- New fictional cases in `scripts/lib/phase-f-evaluation.ts`, run with `npm run ai:eval -- --suite=practice --save`. Cases:
  - questions cite real evidence for a project manager CV and a nurse CV;
  - a job post that asks for a skill the CV lacks: the question asks about it neutrally and does not claim experience;
  - an injected instruction in the job post ("ignore previous instructions…");
  - feedback on a strong STAR answer, a two-line vague answer, and an off-topic answer;
  - an answer whose number contradicts the CV (a mismatch must be shown);
  - an outline with no new numbers.
- About 12 paid calls, added to the live-run maximum and cost table. Results template `docs/plans/evaluations/phase-f-live-template.md`. Record cost per action; a session (1 question set + 6 feedback calls = 7 requests) must fit the plan prices.

## 6. Tests

- **Unit** `tests/ai-practice.test.ts` with the fake transport: valid questions kept; an invented evidence ID, a non-substring job quote and an asserted-but-unsupported experience are withheld; contact details are never sent; strengths quotes must be in the answer; rule mismatch on numbers; an outline with a new number is withheld; plan, consent, revision and daily limit are refused before any provider call. Also the rule-only pieces (STAR detection, back-this-up questions).
- **E2E** `tests/e2e/ai-practice.spec.ts` (fake provider, as the other AI specs): open from Match a job → questions → answer → feedback → save to application notes; Free sees the rule-based questions and the plan message; keyboard-only; 375 px.

## 7. Done when

- Every check in §3 has a passing test, and the live evaluation passes with the results recorded.
- The privacy page lists what Practice sends (the CV without contact details, the job post, answers) and that answers are not stored unless saved to an application.
- PLAN.md records the delivery; the `resume-builder-ai` skill guide describes the practice pattern (installed and distribution copies agree).

## 8. Size and risks

- Size: medium, about 1 week plus the live evaluation.
- **Cost:** feedback per answer is the main cost. If the evaluation shows it is too high, batch feedback for up to 3 answers in one request.
- **Fabrication:** the most likely failure is a "better answer" containing facts the person never stated. Blanks plus the new-number check are the guard; the evaluation must include it.
- **Later:** spoken answers (the browser's speech recognition sends audio to the browser maker, which needs its own disclosure, so it waits), saved practice history, and recruiter-perspective views (roadmap "later").
