# Step 3 — Interview practice: implementation plan

Date: 2026-10-17. Scope source: FEATURE-PLAN.md "Career workflow roadmap", step 3. Background: [2026-10-17-career-platform-analysis.md](2026-10-17-career-platform-analysis.md). Starts after Gate 0. It works without the tracker (step 2) but links to it when present. Nothing here is implemented.

Revised 2026-11-04 for [the plans review](2026-11-04-plans-review.md) findings 7 and 8 (§3 feedback checks, §5, §6).

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
// What the model returns
{ strengths: { quote: string; note: string }[],    // quote must be an exact part of the answer
  improve: { part: "situation" | "task" | "action" | "result" | "relevance" | "clarity";
             note: string }[],                      // generic coaching, no claims about the person
  checks: { answerQuote: string; evidenceId: string }[],  // places the answer and CV may disagree
  structure: { situation: boolean; task: boolean; action: boolean; result: boolean } }
// What the person sees adds, built by the server:
//   outline (from fixed prompts), clarifications and conflicts with cvText from the stored CV
```

Checks (revised 2026-11-04 for [plans review](2026-11-04-plans-review.md) findings 7 and 8):

- **Quotes:** each `strengths.quote` and `checks.answerQuote` must be a substring of the answer; each `evidenceId` must exist in this CV revision and is resolved on the server.
- **No model-written outline (finding 7).** The outline is assembled by code from fixed, neutral prompts for the parts the answer is missing ("Situation: [where and when this happened]", "Your action: [what you did yourself]", "Result: [what changed, and how you know]"), with the person's own quoted sentences placed in the parts they already cover. The model cannot add words to it, so it cannot introduce a tool, responsibility, seniority level or number. Shown with `BlankFiller` from `src/lib/starter-blanks.ts`. There is still no "perfect answer".
- **Coaching notes stay generic (finding 7).** `improve.note` and `strengths.note` must give advice about the answer ("Say what you did yourself, not the team") and must not state facts about the candidate. Every note sentence that says something about the person or their experience ("you led…", "your AWS work…") goes through the existing independent support check against the answer plus the resolved CV evidence. A sentence that is not supported is removed, and a note left empty is withheld with a plain message, as Ask the AI does.
- **Conflicts are narrow; everything else is a clarification (finding 8).** The `cvText` shown is always the stored CV text for the resolved `evidenceId`, never text from the model. The rules label a pair a **conflict** ("Your CV says a team of 5; your answer says a team of 8") only when both statements have a number with the same unit noun after normalisation (team, people, customers, %, money with the same currency), the answer sentence names the same role, employer or project as the evidence item, and neither mentions a different period ("in 2021", "now", "at first"). Any other pair, including every AI `checks` item that fails these rules, is shown as a neutral **clarification**: "Your CV mentions …; your answer mentions …. Make sure both are right." Different counts of different things are never compared.
- New-number check: the outline and notes may not contain numbers absent from the answer and CV evidence.

### Storage and plan

- **No server storage of answers** in v1. The session lives in the browser tab. In a signed-in account with step 2, **"Save to application notes"** appends the questions and the person's own answers (no AI text) to the application's notes, only when clicked.
- `PlanConfig.aiPractice: boolean` (`billing-plans.ts`, `planAllows("ai-practice")`). Recommended: Go and Pro. Free sees the plan message plus the rule-based "back this up" questions, which cost nothing. Each AI call counts toward the existing daily limits (Free 5 / Go 50 / Pro 200).
- Logs: metadata only (question count, withheld count, prompt version, duration). Never the job text or answers.

## 4. Interface

- A full-width **Practice** view (`PanelDialog`), not a fifth AI Assistant tab: four tabs are already tight at phone width.
- It opens from: the application detail panel ("Practice for this interview", job post filled in), the Match a job results ("Practice questions for this job"), and a new Ask the AI action `practice` (added to `ASK_ACTIONS` and `validAskActions`).
- Layout: the question list on the left, the current question with "Why they ask this", the CV items it refers to (click to open them in the editor), and an answer box. "Get feedback" (shows "uses 1 AI request") gives the rule checks instantly and then the AI feedback. "Next question" moves on.
- The top says: "Practice feedback from AI. It is not a prediction of how an interview will go."
- Before building this UI, **extract the shared AI request hook** (consent prompt, plan message, daily limit, error text) that PLAN.md §39 lists as repeated across the AI components, and use it here first. If step 4 is built first, it extracts the hook and this step reuses it.
- **Coordination with step 4 (2026-11-04,** [plan](2026-11-04-career-switch-and-follow-up-questions-plan.md)**):** the question-and-answer layout is one shared component, `FollowUpQuestions`, used both here and by step 4a's "Ask me about it". "Back this up" questions here cover claims already in the CV; step 4a's questions draw out results that are missing. When the job or application is in career switch mode, the question set adds "Why are you moving into <to>?" and one question per transferable item from the match.

## 5. Evaluation

- New fictional cases in `scripts/lib/phase-f-evaluation.ts`, run with `npm run ai:eval -- --suite=practice --save`. Cases:
  - questions cite real evidence for a project manager CV and a nurse CV;
  - a job post that asks for a skill the CV lacks: the question asks about it neutrally and does not claim experience;
  - an injected instruction in the job post ("ignore previous instructions…");
  - feedback on a strong STAR answer, a two-line vague answer, and an off-topic answer;
  - an answer whose number contradicts the CV for the same role and metric (a conflict must be shown);
  - unrelated counts (a team of 5 in the CV, 8 customers in the answer), different periods, and a percentage against an absolute number: clarifications or nothing, never a conflict;
  - feedback whose notes invent a tool, a responsibility or seniority with no numbers ("you led the AWS migration" for a CV without it): those sentences must be withheld;
  - an outline with no new numbers and no words beyond the fixed prompts and the person's quotes.
- About 12 paid calls, added to the live-run maximum and cost table. Results template `docs/plans/evaluations/phase-f-live-template.md`. Record cost per action; a session (1 question set + 6 feedback calls = 7 requests) must fit the plan prices.

## 6. Tests

- **Unit** `tests/ai-practice.test.ts` with the fake transport: valid questions kept; an invented evidence ID, a non-substring job quote and an asserted-but-unsupported experience are withheld; contact details are never sent; strengths quotes must be in the answer; conflict rules (same unit and context → conflict; unrelated counts, different periods, percentage versus absolute → clarification); `cvText` always comes from the stored evidence, and a model-supplied one is ignored; the outline is built only from fixed prompts and answer quotes; note sentences asserting unsupported tools, duties or seniority are removed; plan, consent, revision and daily limit are refused before any provider call. Also the rule-only pieces (STAR detection, back-this-up questions).
- **E2E** `tests/e2e/ai-practice.spec.ts` (fake provider, as the other AI specs): open from Match a job → questions → answer → feedback → save to application notes; Free sees the rule-based questions and the plan message; keyboard-only; 375 px.

## 7. Done when

- Every check in §3 has a passing test, and the live evaluation passes with the results recorded.
- The privacy page lists what Practice sends (the CV without contact details, the job post, answers) and that answers are not stored unless saved to an application.
- PLAN.md records the delivery; the `resume-builder-ai` skill guide describes the practice pattern (installed and distribution copies agree).

## 8. Size and risks

- Size: medium, about 1 week plus the live evaluation.
- **Cost:** feedback per answer is the main cost. If the evaluation shows it is too high, batch feedback for up to 3 answers in one request.
- **Fabrication:** the most likely failure is a "better answer" containing facts the person never stated. The guards are a code-built outline (the model writes none of it), the support check on every note sentence about the person, and the new-number check; the evaluation must include each.
- **Later:** spoken answers (the browser's speech recognition sends audio to the browser maker, which needs its own disclosure, so it waits), saved practice history, and recruiter-perspective views (roadmap "later").
