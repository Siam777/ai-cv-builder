# Step 4 — Follow-up questions for weak bullets and career switch mode: implementation plan

Date: 2026-11-04. Scope source: [career platform analysis](2026-10-17-career-platform-analysis.md) §4 step 4 (proposal items 3 "Achievement Discovery" and 9 "Career Switch Translator"), recorded in FEATURE-PLAN.md "Career workflow roadmap". Starts after steps 2 and 3, or after Gate 0 if the owner reorders. Nothing here is implemented. Revised the same day for [the plans review](2026-11-04-plans-review.md) findings 2 and 3.

## 1. Goal

Two extensions of flows that already exist. Neither adds a new page.

1. **Follow-up questions (4a).** When a bullet has no result or is vague, ask the person two or three questions about *that* bullet ("How many customers used it? What changed after launch?"), then rewrite the bullet using only what they answered. This closes the gap between "Add a result" (the person must already know what to write) and the whole-CV AI interview.
2. **Career switch mode (4b).** In Match a job and Tailor, the person can say "I'm moving from teaching to instructional design". The match then separates requirements the CV **shows**, ones it shows through **transferable** experience (with the evidence quoted and the link explained), and real **gaps**. Gaps lead into follow-up questions, so the person can add experience they really have. Tailoring rewrites the same facts in the new field's words.

Build 4a first: 4b reuses its question flow for gaps.

## 2. What exists and is reused

| Piece | Where | Use |
| --- | --- | --- |
| Bullet rewrite route, modes `rewrite` / `continue` / `selection` / `entry` | `generateSchema` in `src/lib/ai-contract.ts`, `/api/ai` | New mode `answers` for the rewrite from answers |
| New-number check | `hasNewNumbers(text, evidence)` in `src/lib/ai-contract.ts` | A rewrite may only contain numbers from the bullet or the answers |
| Independent support check | `supportSchema` / `batchSupportSchema` | Every added claim must be supported by an answer |
| Metric prompt templates | `getMetricPromptTemplates()` in `src/lib/vault/impact-coach.ts` | Free, rule-based questions on every plan |
| `missing_metric`, `weak_verb` findings | `src/lib/linter/ats-linter.ts`, `aiFixFor` in `src/lib/field-ai.ts` | Entry point: "Ask me about it" next to Fix with AI |
| Match a job with AI, gap lines | `jobMatchRequestSchema`, `/api/ai/job-match`, `/api/ai/gap-line` | Switch mode adds a status and a profile; gaps reuse gap lines |
| Tailor with AI | `tailorRequestSchema`, `/api/ai/tailor`, `JobTailorModal.tsx` | Switch mode adds the target field to the prompt |
| Plan gating | `planAllows()` in `src/lib/ai-access.ts`; `aiJobMatch` (Go, Pro), `aiTailor` (Pro) | Switch mode follows the host feature's plan |
| Daily AI limits | `reserveDailyRequest` in `src/lib/server/ai-service.ts` (Free 5 / Go 50 / Pro 200) | Every AI call below counts once |

## 3. Step 4a — follow-up questions for a weak bullet

### 3.1 Flow

1. Entry points:
   - The bullet's sparkle menu gets **Ask me about it** (AI).
   - Check my CV shows **Ask me about it** on `missing_metric` and `weak_verb` findings, beside Fix with AI.
   - The existing local **Add a result (you type it)** keeps working and now shows the free rule-based questions as prompts.
2. A small inline panel under the bullet shows two or three questions. Each has a one-line "why this helps" ("A number shows the scale") and an answer box. Every answer is optional, and the panel always offers **I don't know / skip**.
3. **Write it with my answers** sends the bullet and the answers. The review shows the old and new bullet with the usual diff. Words that came from an answer are marked "from your answer". The person can apply it, edit it or discard it. Nothing changes without review.
4. If the person answered nothing useful, the result says so and keeps the bullet. It never fills a blank with a guess.

### 3.2 Questions

- **Rule-based, every plan, no request:** chosen from the metric templates by the bullet's verb and nouns (scale: how many or how often; change: before → after; scope: team size, budget, users; outcome: what happened next). At most three, never asking for something the bullet already states.
- **AI, Go and Pro (one request) — `POST /api/ai/bullet-questions`:**
  - Input `{ requestId, documentId, revision, bulletId }`. The server reads the bullet and its entry (title, organisation, dates, sibling bullets) from the stored document, as the other routes do.
  - Output `{ questions: [{ id, text ≤ 160, why ≤ 100, kind: "scale"|"change"|"scope"|"outcome"|"method" }] }`, at most 3.
  - Rules in the prompt: ask, never assert; no question that assumes a fact not in the CV ("How did you cut costs by 30%?" is rejected when 30% is not in the bullet). A check rejects questions containing numbers that are not in the bullet.
  - Prompt `bullet-questions-v1`.

### 3.3 Rewrite from answers — `generateSchema` mode `answers`

- `generateSchema` gains `mode: "answers"` and `answers: [{ questionId, question ≤ 160, answer ≤ 500 }]` (at most 3; required in this mode).
- The evidence for this mode is the bullet, its entry and the answers. `hasNewNumbers(text, [bullet, ...answers])` must pass, and the independent support check runs with the answers as extra evidence. A claim backed by neither is withheld with a reason, the same as Write with AI.
- An answer is the person's own statement, so it counts as evidence for this bullet only. It is never written anywhere else in the CV.

**Evidence and retention contract (review finding 2).** Today `reviewProposal()` resolves evidence only against CV bullets (`bulletEvidence(doc)`), and `storeProposal()` saves the proposal and its `evidence_snapshot` in `ai_requests` before the person accepts. Answer-backed rewrites therefore use **disclosed temporary storage** in that existing flow, not an ephemeral path:

| Point | Rule |
| --- | --- |
| Identity | Each answer becomes an evidence item `ans:<requestId>:<questionId>` with `{ text, question, bulletId, baseRevision }`. IDs are created by the server, never accepted from the model or client. |
| Scope | Answer items are valid only for the proposal's own `bulletId` and `baseRevision`. `reviewProposal()` gains a second evidence source, the stored answer items for that request, and rejects an answer ID cited for any other bullet, revision or request. |
| Review and accept | On accept, the server re-runs `reviewProposal()` against the **stored** `evidence_snapshot` (answers included), as it does for bullet evidence today. The client cannot add or change answers at accept time. |
| Retry | Same `requestId` and same body (questions and answers included in `request_hash`) returns the existing proposal; same `requestId` with different answers is a 409. Changed answers need a new request (and a new AI request count). |
| Reject, expiry, accept | After accept, reject or the existing `expires_at`, the answer text in `evidence_snapshot` is replaced with `"[removed]"` in the same transaction that changes the status (expiry is applied on read, as the expiry check already is, plus the existing retention job). The applied bullet text is the only lasting copy. |
| Export and deletion | While a proposal is pending, its answers are part of the account's AI request data: included in account export and deleted with the account (`ai_requests` already cascades). |
| Disclosure | The panel says: "Your answers are kept with this suggestion until you apply or discard it (or it expires), then removed." The privacy page gets the same sentence. |

- One request on Go and Pro. On Free, the answers are joined into the bullet with the local "Add a result" logic (no AI), and the person edits the wording.
- Prompt `bullet-answers-v1`.

### 3.4 Coordination with step 1 (consistency check)

A rewrite that adds a number from an answer creates a new `number_to_confirm` ID (its hash covers the numbers), so the finding reappears for that entry. That is intended: the person typed the number, and the check still asks whether they can back it up. The rewrite panel's copy says so.

## 4. Step 4b — career switch mode

### 4.1 Profile

- Match a job and Tailor get a toggle: **I'm changing careers**, with "From" (pre-filled from the most recent experience title; editable) and "To" (pre-filled from the job title; editable). Both ≤ 80 characters.
- Remembered per CV in the browser (like dismissals). On an application in the tracker (step 2 / 2b), the same two fields are stored on the application, so Match my CV from the tracker remembers them. That is migration 008, added there now, so no second migration is needed: `switch_from TEXT, switch_to TEXT`.

### 4.2 Match in switch mode

- `jobMatchRequestSchema` gains `careerSwitch?: { from, to }`. `jobMatchDraftSchema` requirements gain `status: "shown" | "transferable" | "gap"` and, for transferable, `link ≤ 200` (a short explanation of the link, such as "Planning lessons for 30 pupils is planning learning content for a group").
- **Rules for transferable:** it must cite 1–3 evidence IDs, like "shown". The support check is asked a narrower question: "Does this evidence show the underlying skill described in the link?", not "does it show the requirement". If the check fails, the item becomes a gap and `withheld` goes up. Transferable never upgrades to "shown".
- The result groups items as **Your CV shows this**, **You have related experience**, and **Not in your CV yet**. Every transferable item shows the quote and the link sentence, plus **Use this wording** (an emphasis hint for Tailor) and **That's not right** (moves it to gaps for this session).
- Gaps keep the existing **I have this** gap line, plus **Ask me about it**. That runs 4a's question flow against the requirement instead of a bullet (`bullet-questions` with `requirement` in place of `bulletId`), so a person who has relevant experience outside their CV can describe it, and a new bullet is drafted from the answers through the existing gap-line placement.
- Plans: AI Match is Go and Pro (`aiJobMatch`), and switch mode is part of it. On Free, the local comparison stays as it is, plus a plain note that switch mode needs Go.
- Prompt `job-match-v<next>` with a switch section; the non-switch path must produce the same output as today (regression cases).

### 4.3 Tailor in switch mode

- `tailorRequestSchema` gains `careerSwitch?` and `transferable?: [{ requirement, evidenceIds, link }]` from the match.
- The prompt allows **rewording the same facts in the target field's language** ("handled customer escalations" → "resolved stakeholder issues") and a summary that names the move ("Teacher moving into instructional design…"). It forbids new duties, titles, tools, numbers or credentials. `hasNewNumbers` and the support check run as now; the support check also rejects a rewrite whose claim is broader than its evidence.
- The review shows each reworded bullet with its original, and the summary is marked "states your career change; check you're happy with this wording".
- Pro only, as Tailor today (`aiTailor`). Each tailored copy still counts toward `maxTailoredPerMonth`.

### 4.4 What switch mode never does

- It never claims a qualification, licence or degree the CV does not show, even as transferable.
- It never hides the change of field or renames past job titles. Titles and employers stay exactly as written.
- It never says how likely the switch is to succeed.

## 5. Shared work and coordination with other plans

| With | Coordination |
| --- | --- |
| Step 1 consistency check ([plan](2026-10-17-cv-consistency-check-plan.md), PLAN.md §41) | 4a answers that add numbers reopen `number_to_confirm` by design (§3.4). `skill_without_evidence` gets **Ask me about it** for a listed skill: the requirement-style question flow drafts a bullet showing where the skill was used. |
| Step 2 tracker and 2b job capture ([tracker](2026-10-17-application-tracker-plan.md), [job capture](2026-11-04-job-capture-and-tracker-plan.md)) | Migration 008 adds `switch_from` and `switch_to` to `applications`. Reviewed requirements reach Match through the new optional `requirements` field of `jobMatchRequestSchema` defined in job capture §4.3 (at most 15, IDs kept, priorities from the person, no re-extraction, not filtered by `fromPost()`). Switch mode adds `careerSwitch` to the same request and returns `status` per given requirement ID. |
| Step 3 interview practice ([plan](2026-10-17-interview-practice-plan.md)) | Its "back this up" questions are about claims already in the CV; 4a's questions draw out results that are missing. They share one question/answer UI component (`FollowUpQuestions`). In switch mode, practice questions include "Why are you moving into <to>?" and one question per transferable item. |
| Shared AI request hook (PLAN.md §39 open item) | The step 3 plan extracts it first. If step 4 starts earlier, 4a extracts it instead, and step 3 uses it. Either way, it is built once. |
| Gate 0 | The live evaluation must cover the changed `job-match` and `tailor` prompts as well as the new ones. A regression in the non-switch path blocks release. |

## 6. Evaluation (live, before release)

- `--suite=followup` (at least 12 cases): bullets with no result, vague verbs, a bullet that already has a number (no repeat question), answers that are blank or "don't know" (bullet unchanged), an answer with a number (allowed), an answer contradicting the bullet (flagged, not merged), and a prompt injection inside an answer.
- `--suite=switch` (at least 12 cases): teacher → instructional designer, nurse → health-tech product, retail manager → operations, military → project management, developer → product manager, and a "switch" with no real overlap (mostly gaps, no stretched transferable items). Also a job needing a licence the CV lacks: it must be a gap, never transferable. Measures: transferable items whose evidence supports the stated skill (≥ 90% by independent review), zero invented qualifications, and the non-switch regression cases unchanged.

## 7. Tests

- **Unit:** rule-based question choice (verb and noun mapping, no question for facts already stated, at most three); `answers` mode schema and evidence assembly; `hasNewNumbers` with answers as evidence; answer evidence IDs rejected for another bullet, revision or request; accept re-checks the stored snapshot and ignores client-sent answers; a retry with the same body returns the same proposal and changed answers give 409; answer text replaced with `"[removed]"` after accept, reject and expiry; pending answers present in account export and gone after account deletion; rejecting questions with outside numbers; switch-mode schemas; a failing support check moving transferable to gap; titles and employers unchanged by tailored copies in switch mode.
- **E2E:** Check my CV → Ask me about it on a no-result bullet → answer two questions → review → apply → the `missing_metric` finding clears and `number_to_confirm` appears. Match a job in switch mode with the synthetic provider → the three groups → "That's not right" moves an item → Ask me about it on a gap → a drafted bullet lands in the right entry. Keyboard-only and 375 px. Free plan: rule-based questions only, with no AI request spent.

## 8. Done when

- Follow-up questions work on every plan (rule-based on Free, AI on Go and Pro), rewrites contain nothing the bullet or the answers do not support, and nothing is applied without review.
- Switch mode shows transferable items only with quoted evidence that passed the support check, never invents qualifications, and leaves the non-switch match unchanged.
- Both evaluation suites pass live. The help page explains both features. PLAN.md records the delivery.

## 9. Size and risks

- Size: 4a about 3–4 days; 4b about 4–5 days, plus live evaluation.
- **Stretching:** the main risk in switch mode is calling weak evidence transferable. The narrower support question, the "That's not right" control and the licence and degree rule address it; the evaluation measures it.
- **Answer quality:** people may type numbers they cannot back up. The step 1 check asks about them again, and the copy never praises a bigger number.
- **AI cost:** questions plus a rewrite is two requests per bullet on Go and Pro; the Free path costs none.
- **Later:** asking about several weak bullets in one request; saving answers to the persistent Master Career Vault if that moves forward.
