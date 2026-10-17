# AI Assistance Plan — "Build the CV with AI, from your own facts"

Status: **Phases A–E delivered** (items 0–9, 2026-10-16 and 2026-10-17). Not yet run against the real OpenAI API: the live evaluation (`npm run ai:eval -- --save`) is the gate before real users. See PLAN.md §39.

Goal: someone should be able to build most of a good CV by telling the app about their work in plain words, or by starting from suggestions for their job title. AI turns rough notes into a summary, jobs with bullets, skills and a cover letter, matches the CV to a job post, then helps fix what Check my CV finds.

The rule that sets this app apart: **AI never presents anything as the person's fact unless the person said it or it is already in their CV.** Suggestions that are not the person's facts (examples for a job title, common skills for a role) are always labelled as examples, have blanks for anything specific, and are never applied without the person editing or ticking them.

---

## 1. Where AI is today (audit, 2026-10-16)

Only three features call the AI provider:

| Feature | Where | Plan |
|---|---|---|
| Improve wording, Shorten (one bullet at a time) | Bullet ✨ menu | All plans (daily limit) |
| Write with AI (summary) | Summary ✨ menu | Go, Pro |
| AI job coaching (one requirement at a time) | AI Assistant → Match a job | Pro |

Everything else that looks like help is built-in rules or templates:

| Feature | What it really does |
|---|---|
| Add a result | Template that inserts the result you type |
| Quick draft (summary) | Template from headline and job titles |
| Add skills from my CV | Keyword matching against bullets |
| Start from my job title | Plain form, no AI |
| Upload my CV, Import from LinkedIn | Rule-based parsing |
| Match a job | Keyword and token overlap |
| Cover letter | Fill-in template |
| Create a practice CV ("AI CV Generator") | Fictional template content |
| Check my CV, Help me finish | Rules; "Fix" only jumps to the field |

Two things also block AI before it starts:
- AI only works on CVs saved to an account. A new visitor builds in the browser first and meets "Copy to my account".
- Some labels promise AI that is not there ("Add a result" under the AI button, "AI CV Generator").

---

## 2. What the leading CV builders do (market review, 2026-10-16)

Based on 2026 reviews and vendor pages (sources at the end; third-party reviews disagree on details such as prices and free limits).

| Product | AI that matters to users | Notes |
|---|---|---|
| **Kickresume** | Name + job title → a whole first draft (summary, experience, education). Bullets from a job title. | Monthly AI-use limits. Praised for draft quality. |
| **Rezi** | Bullet writer that asks for field, level, target role and job post; completes or rewrites a highlighted bullet. Keyword targeting from a pasted job post. Summary writer, cover letter, 23-point score. | Free plan; about $29/month or a lifetime plan. |
| **Teal** | Paste a job post → match score, missing keywords and where to add them. Master resume with tailored versions. AI bullets, summary, skills and cover letter. | Reviewers call its writing help weaker than its tailoring. About $29/month; AI limited on free. |
| **Enhancv** | Real-time checks for clichés and weak verbs; AI content suggestions. | From about $20–25/month. |
| **Zety, Resume.io** | Pre-written phrases and bullets by job title; skill suggestions; tone and passive-voice checks. | Mostly paid. |

What the market shows:
1. **The blank page is the main problem.** Every leader offers content from just a job title, either AI-written or from a library of pre-written phrases. This plan had no answer for someone who doesn't know what to write.
2. **The job post is the centre of the paid product.** Teal and Rezi build around "paste a job post → see the gaps → fix them". This plan had that late (Phase D) and only on Pro.
3. **AI is used inline and without friction:** completing or rewriting the selected bullet, no consent box each time.
4. **Invented content is the big risk.** In 2026 surveys, recruiters report widespread AI-written applications and say generic or inflated bullets fall apart in behavioural interviews. Vendors that generate a full CV from a job title produce plausible but unverified claims. So the app's evidence rule is a real selling point, not a limitation, as long as it does not leave people with a blank page.

### What this changes in the plan

- **Add starter suggestions from a job title (new item 2).** This answers the blank page in a way that is still honest. Bullets for the job title are shown as **examples to edit**, with blanks for any specifics (`[number]`, `[tool]`). They can't be accepted until the blanks are filled or removed, and they are never presented as the person's facts. This matches what Kickresume and Zety offer, without invented claims.
- **Move job-post matching earlier and to Go (new item 5).** Paste a job post → missing keywords the CV does not show, and which existing bullets could mention a keyword the person confirms they have. Tailoring the whole CV stays on Pro.
- **Add inline "Continue writing" and "Rewrite selection"** to the bullet ✨ menu (part of item 4).
- **Ask for AI consent once per account, not once per flow.** Store the choice with an "AI writing help" switch in Account settings, Data & privacy, and say in each AI view what is sent. Still explicit; far less friction.
- **Keep the support check only where something is presented as fact.** Starter examples and role skills are labelled as examples, so they skip the second check; that halves their cost and wait.
- **Make the interview start the headline feature (item 3), earlier than before.** It is this app's honest answer to Kickresume's "full draft from a job title": five questions in, a full reviewable draft out.
- **Not adopted:** score-to-beat ATS percentages (a 2026 review notes few recruiters auto-reject on content; the app's honest Check stays), and lifetime plans (pricing is set in PLAN.md §38).

---

## 3. Shared rules for every AI feature

- **Two kinds of output, always labelled:**
  - **Your facts, reworded:** built only from what the person typed in this flow and the CV's own content, with evidence IDs, the new-number check (`hasNewNumbers`) and the independent support check. If a check fails, the suggestion is withheld with a plain reason and a question.
  - **Examples to edit:** starter bullets and role skills. Shown with an "Example" label and blanks for specifics; cannot be accepted with blanks left. No support check, because no fact is claimed.
- **Never sent:** contact details, photos, other users' data.
- **Review:** every result opens in the existing inline review ("Your wording / Suggested", Accept, Try again, Keep mine). Multi-item results use one review list where each item can be accepted or skipped. Undo restores everything accepted in one step.
- **Consent:** asked once per account ("Use AI writing help: your CV text and notes are sent to OpenAI; contact details are not"). The choice is stored on the account and can be changed in Account settings, Data & privacy. Each AI view still says what it sends.
- **Limits:** one AI request per action counts toward the plan's daily limit (Free 5, Go 50, Pro 200). Multi-item actions are one request, with a cap on input size. A 429 explains the limit and links to plans.
- **Plans:** each feature names the plan that includes it. Server routes check the plan before any provider call (402 `PLAN_REQUIRED`), as `/api/ai/summary` does today.
- **Account CVs:** AI needs a CV saved to an account; item 0 removes that hurdle for new visitors.
- **Server pattern:** follow `requestSummaryDraft` in `src/lib/server/ai-service.ts`: schema in `src/lib/ai-contract.ts`, prompt and provider call in `src/lib/server/openai-provider.ts`, route under `src/app/api/ai/`, `reserveDailyRequest`, structured logging without content.

---

## 4. Planned features, in delivery order

### 0. Open AI to new visitors and fix labels (small, do first)

- Start screen and the browser-CV toolbar: "Sign in to use AI. New accounts get Go free for 30 days." Signing in keeps the current draft and copies it to the account in one step (reuse `copyCurrentToAccount`).
- One-time AI consent stored on the account, with the switch in Data & privacy (replaces the per-request checkbox).
- Rename misleading labels: "Add a result" moves to a "Quick" group ("Add a result (you type it)"); "AI CV Generator" becomes "Practice CV (fictional)".
- **Done when:** a guest reaches a working AI action in at most two steps, and no built-in helper is presented as AI.

### 1. Write a job or project with AI, from notes (all plans, counts toward the limit)

- On an empty or existing job/project: **Write with AI** opens a box: "What did you do in this role? Rough notes are fine." Optional: paste the duties from the old job ad.
- AI returns 3–5 bullets (and a title only if the notes state it), each citing the note lines it came from. Missing results become questions ("How many tickets a week?"), never invented numbers.
- Review list: tick the bullets to add; edit before accepting.
- Server: `POST /api/ai/entry-bullets` {documentId, revision, sectionId, entryId?, notes (≤ 4,000 chars)}. Evidence = the notes plus the entry's title, organization and bullets.
- **Done when:** notes like "handled customer tickets, trained 3 new staff, used Zendesk" give supported bullets, "trained 3 new staff" keeps its number, and no note claim comes back with a stronger verb or scope than written.

### 2. Starter suggestions from a job title (all plans; Free limited by the daily limit)

- Where a job, the summary or skills are empty: **Show examples for "<job title>"**. AI returns 6–8 example bullets for that title (and a sample summary and common skills), written with blanks: "Resolved [number] customer tickets a week using [tool]."
- Each example is labelled "Example — make it yours". Accept is disabled until every blank is filled or deleted; the person can also edit freely. Picking examples feeds item 1 ("Tell us what you actually did") when the person wants AI to adapt them.
- Server: `POST /api/ai/starters` {jobTitle, seniority?, section}. No CV content needed, no support check, and results are cached per title and seniority to keep cost down.
- **Done when:** someone with only a job title can fill a job entry with edited examples in under a minute, and no example can be saved with a blank or presented as their fact.

### 3. AI interview start (Go and Pro; Free gets one interview)

- New start-screen choice, listed first: **Build my CV with AI**. A short guided conversation: target role → latest job (title, organization, dates, what you did) → earlier jobs (repeat or skip) → education → tools, languages, certificates.
- Each answer is one AI request that turns the answer into draft content (reusing item 1 for jobs; item 2's examples are offered when an answer is thin). The preview fills in live; any step can be edited or skipped.
- Ends with a full draft: headline, summary (reusing Write with AI), jobs with bullets, education, and skills to confirm (item 6).
- Server: `POST /api/ai/interview-step` {step, answer, current draft facts}; no hidden memory between steps.
- **Done when:** a person with no CV answers five questions and gets a reviewable draft containing nothing that is not in their answers or their accepted examples.

### 4. Fix with AI, Improve all, Continue writing (Free for single fixes; Improve all on Go and Pro)

- Check my CV: wording findings (weak verb, long, very short, no result) get **Fix with AI** next to Fix, running the matching bullet action and opening the inline review on that bullet.
- Job and project menus: **Improve all bullets** (one request for up to 10 bullets, one review list); a CV-wide version runs entry by entry with progress.
- Bullet ✨ menu: **Continue writing** (finishes a half-written bullet from the entry's facts) and **Rewrite selection** (only the selected words).
- Server: extend `/api/ai` with multi-bullet and continue modes (same proposals and acceptance receipts).
- **Done when:** fixing every wording finding on the sample CV takes one click per finding or one Improve all, and every accepted change is undoable.

### 5. Match a job post (Go and Pro; tailoring the whole CV is Pro)

- Match a job, after pasting the post: AI lists the post's key requirements and keywords, marks the ones the CV already shows (quoting the bullet), and lists the gaps.
- For each gap: "Do you have this?" If yes, the person writes one line about it, and AI suggests which bullet or skill to add it to (item 1 rules). If no, nothing is added; the gap stays visible.
- **Tailor with AI (Pro):** a reworded summary and up to 8 bullet rewrites that emphasise the requirements the CV shows, saved as the existing tailored copy (original kept), using the job coaching evidence rules (`jobCoachContext`).
- **Done when:** the person sees what the post wants, what their CV shows and what is missing, and no gap is filled without their own line about it.

### 6. Skills with AI (Go and Pro)

- Skills ✨ menu: **Suggest skills with AI**, in two groups:
  - "Shown in your CV": skills the bullets demonstrate, each quoting the bullet (support-checked).
  - "Common for <role>: add only if true": unticked by default, labelled as examples.
- Also proposes grouping (Tools, Languages, Methods) for the existing skills.
- Server: `POST /api/ai/skills` → {demonstrated: [{skill, evidenceId}], roleSuggestions: [skill], groups}.
- **Done when:** nothing is added without a tick, and every "Shown in your CV" skill quotes a real bullet.

### 7. AI cover letter (Go and Pro)

- Cover letter tab: **Write with AI** from the CV, the job post and an optional note ("why I want this job"). 3–4 short paragraphs; the post's requirements are context, never claimed qualifications. The editable letterhead and exports stay.
- Server: `POST /api/ai/cover-letter`, support-checked against the CV.
- **Done when:** every claim about the person maps to CV evidence.

### 8. AI import clean-up (Go and Pro)

- After Upload my CV or LinkedIn import, before Import review: **Tidy with AI** fixes the structure only (which section an item belongs to, splitting run-on bullets, dates into YYYY-MM). It never rewrites wording. Import review shows what moved.
- **Done when:** a messy PDF import lands in the right sections with the same words.

### 9. Ask the AI (later; Go and Pro)

- A chat box in the AI Assistant ("Make my CV stronger for project manager roles"). Answers are advice plus buttons that start items 1–7 on the right field. The chat never edits the CV directly. This is the evidence-grounded chatbot from the original product plan (`resume-builder-ai` skill).

### Not planned now

- Education, certifications and languages beyond starter examples: the Quick helpers are enough; revisit after usability testing.
- Interview preparation from the CV (Rezi offers it): a good later follow-on, since every bullet is the person's own fact.

---

## 5. Delivery phases

Each phase ships on its own with `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` passing, plus controlled-provider tests (fake transport) for every new route: success, withheld (new number, unsupported claim), example with blanks refused, refusal, timeout, plan refused, daily limit.

| Phase | Items | Why this order |
|---|---|---|
| A | 0, 1, 2 | Removes the blank page and the sign-in hurdle: notes → bullets and examples for a job title. |
| B | 3, 6 | The headline "build my CV with AI" flow, built from A, plus skills. |
| C | 5, 4 | Job-post matching (the core paid use) and fixing. |
| D | 7, 8 | Cover letter and import clean-up. |
| E | 9 | Ask the AI. |

Before Phase A reaches real users: run each prompt against the fictional evaluation set (`npm run ai:eval`, extended with notes-to-bullets and starter cases) and record results in `docs/plans/evaluations/`. Measure cost per action against the plan limits (PLAN.md §38) and adjust limits if needed.

---

## 6. Out of scope

- AI that presents facts the person did not give (made-up jobs, metrics, skills or certificates) as theirs.
- Automatically applying any suggestion.
- Sending contact details, photos or other users' data to the AI provider.
- Score-to-beat ATS percentages and lifetime plans.

---

## Sources (market review)

Third-party reviews and vendor pages, read 2026-10-16. Prices and free-plan limits differ between sources.

- [VisualCV — Best AI resume builders of 2026](https://www.visualcv.com/blog/best-ai-resume-builders/)
- [Dupple — Best AI resume builders in 2026](https://dupple.com/learn/best-ai-resume-builders)
- [SkillScouter — Best AI resume builders in 2026](https://skillscouter.com/best-ai-resume-builders/)
- [frankx.ai — Best AI resume builder 2026](https://frankx.ai/blog/best-ai-resume-builder-2026)
- [Kickresume — AI Resume Builder](https://kickresume.com/ai-resume-writer)
- [Kickresume — AI resume from a job description](https://www.kickresume.com:443/en/ai-resume-from-job-description)
- [Rezi — AI resume editor](https://www.rezi.ai/rezi-ai-resume-editor)
- [Rezi — Best AI resume builders](https://rezi.ai/posts/best-ai-resume-builders)
- [Unite.AI — Teal review](https://www.unite.ai/tealhq-review)
- [Resume Coach — Teal review](https://www.resumecoach.com/reviews/tealhq-resume-builder-review/)
- [Tools for Humans — Teal](https://www.toolsforhumans.ai/ai-tools/teal)
- [HireQuotient — Zety resume builder](https://hirequotient.com/blog/zety-resume-builder)
- [The Interview Guys — Why AI resumes are backfiring in 2026](https://blog.theinterviewguys.com/?p=15010)
- [JobShinobi — AI resume builder hallucinations](https://jobshinobi.com/blog/ai-resume-builder-hallucinations-how-to-fact-check)
- [NACE — The ghostwritten candidate](https://naceweb.org/career-readiness/best-practices/the-ghostwritten-candidate-ai-fraud-auto-apply-and-the-fight-for-authentic-career-readiness)
