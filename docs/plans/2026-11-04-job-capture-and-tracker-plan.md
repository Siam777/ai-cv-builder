# Finding and tracking jobs: recommended approach and implementation plan

Date: 2026-11-04. Extends roadmap step 2 ([2026-10-17-application-tracker-plan.md](2026-10-17-application-tracker-plan.md)) and replaces its "no AI in this step" decision. Nothing here is implemented. Revised the same day for [the plans review](2026-11-04-plans-review.md) findings 1, 3, 4 and 5.

## 1. Decision: capture jobs, do not search for them

The app will **not** have its own job search. Candidates keep finding jobs where they already look (LinkedIn, Indeed, company career sites, referrals), and the app makes it effortless to bring a job in and do everything after that: match, tailor, write, apply, follow up and track.

Why (research on 2026-11-04):

- **The leading tools work this way.** Teal and Huntr save a job from LinkedIn, Indeed and other boards with a browser extension into a tracker, then tailor the CV to it. Neither runs its own job board. Enhancv markets "AI job search and matching", but this is unverified; Kickresume's job board is described inconsistently; Resume.io shows no board.
- **Job data is not freely available.** Indeed's self-serve Publisher API is retired and its current APIs are partner-only. Scraping LinkedIn or Indeed breaks their terms. Jooble has a free key, but it exists to send traffic to Jooble's listings; Adzuna's terms mention fees.
- **Where hires come from.** Surveys (mostly older, directional) put referrals at or near the top source of hire and job boards as the most-used channel. A tool that helps with referrals and follow-ups helps more than another list of postings.
- **It uses what the app already does well.** Evidence-grounded matching, tailoring and cover letters all start once a job exists, and OpenAI is already configured through `.env` (`OPENAI_API_KEY`, `OPENAI_MODEL`) with consent, plan limits and daily request counting in `src/lib/server/ai-service.ts`.

## 2. Phases

| Phase | Delivers | Size | Depends on |
| --- | --- | --- | --- |
| **A. Tracker** | Roadmap step 2 as already planned: applications, stages, notes, contacts, reminders, frozen CV and letter copies | 1–1.5 weeks | Migration 008 |
| **B. Add a job, read by AI** | Paste a job post (and its link); AI reads it into fields and requirements with quotes; review, then save to the tracker; one click to Match and Tailor | 3–4 days | A |
| **C. Referrals and follow-ups** | A referral contact type, follow-up reminders on a schedule, AI drafts for follow-up and referral-request messages that the person copies and sends themselves | 2–3 days | A, B |
| **D. Save from the browser** | A "Save to AI CV Builder" bookmarklet, then a Chrome extension that saves the job page you are viewing | Bookmarklet 2 days; extension 1–1.5 weeks plus store review | B |
| **E. Suggested jobs (experiment, deferred)** | Optional listings from one licensed aggregator API, matched against the CV, linked out to the original posting | 1 week after a terms review | D live, a terms review and a new decision |

Recommended order: A → B → C → D (bookmarklet) → D (extension). E only if, after D, people ask for discovery and a provider's terms and costs are acceptable.

**Gate 0 note.** The career roadmap puts these steps after Gate 0. Step 1 was started early at the owner's request; this plan does not change that ordering. The AI features in B and C must get live evaluation cases before release, the same as every other AI feature.

## 3. Phase A — tracker

Implement [2026-10-17-application-tracker-plan.md](2026-10-17-application-tracker-plan.md) unchanged, with these additions to the migration so later phases need no second migration:

```sql
-- in applications (008-applications.sql)
employment_type TEXT, salary_text TEXT, deadline_at TEXT,
requirements TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(requirements)),  -- phase B
captured_via TEXT NOT NULL DEFAULT 'manual'
  CHECK(captured_via IN ('manual','paste','bookmarklet','extension','suggested')),
referral_contact_id TEXT,                                                 -- phase C
switch_from TEXT, switch_to TEXT,                                         -- step 4b career switch mode
```

- `requirements` is a JSON array of `{ id, text, kind: "must" | "nice", quote }`, at most 40 items of at most 300 characters, validated with zod.
- `captured_via` tells later insights how jobs arrive. It is metadata only and is never shown to employers.
- **Decided 2026-11-04:** the tracker is free on every plan, capped at 500 applications per account. AI actions inside it (Read with AI, message drafts) still use each plan's daily AI requests.

## 4. Phase B — add a job, read by AI

### 4.1 Flow

1. **Add a job** on `/applications` (and **Save this job** in the editor's Match a job tab) opens one form: a large "Job post" box, an optional "Link to the post" field, and **Read the post**.
2. **Read the post** first runs a free local pass (title from the first line, company after "at"/"About", location, salary patterns, "Requirements"/"Nice to have" headings). Signed-in people with AI consent also get **Read with AI**, which costs one AI request.
3. The result appears as editable fields: role, company, location, work type (on-site/hybrid/remote), employment type, salary as written, deadline, apply link, and two lists, **Must have** and **Nice to have**. Each AI field shows the words it came from; a field with no supporting quote is left empty, not guessed.
4. **Save to applications** creates a "Saved" application with the post, the fields and the requirements.
5. On the saved application: **Match my CV** (opens Match a job with the post filled in, no second paste) and **Tailor a copy** (the existing Tailor flow; the variant is linked to the application, and freezing it records what was sent).

### 4.2 AI contract — `POST /api/ai/job-read`

- Input: `{ requestId, post (≤ 30,000 characters), url? }` with a zod schema in `src/lib/ai-contract.ts`. Same `requireSameOrigin`, `authorized`, consent check and `reserveDailyRequest(owner, plan.aiRequestsPerDay, plan.name)` as the other AI routes.
- **Byte limit (review finding 5):** 30,000 characters of Bengali, Chinese or other multibyte text can exceed 90 KB in UTF-8, so the route reads JSON with `readJson(request, 196608)` (192 KiB: 30,000 × 4 bytes plus JSON overhead). The character limit stays in the schema, the form counts characters and shows the limit before sending, and the bookmarklet and extension trim to 30,000 characters before sending. A unit test sends exactly 30,000 four-byte characters (accepted) and 30,001 (rejected by the schema with the character message, not a size error).
- Output (structured JSON from OpenAI, validated with zod): every field is `{ value, quote }` and every requirement is `{ text, kind, quote }`.
- **The quote must exist and must support the value (review finding 1).** Checks run on the server, in this order, with no second AI call for the first two:
  1. `quote` is an exact substring of the post after whitespace normalisation.
  2. **Copied fields** (role, company, location, salary, deadline, apply link, employment type) must be the quote itself or a substring of it, after a listed normalisation only: case, whitespace, trailing punctuation, a date parsed to `YYYY-MM-DD` that must round-trip to the same date, and a fixed table for work type and employment type ("hybrid", "remote", "on-site", "full-time", …) whose source word must appear in the quote. Anything else is dropped and counted in `withheld`.
  3. **Requirements** keep the quote as their stored text when it is ≤ 300 characters (`text = quote`). A shortened, paraphrased `text` is allowed only if it passes the existing independent support check against the quote (one batched call for all paraphrased requirements); otherwise the quote is used instead.
  4. **Must-have or nice-to-have** is decided by rules, not taken from the model: the heading the quote sits under ("Requirements", "Must have", "Essential" → must; "Nice to have", "Preferred", "Bonus", "Desirable" → nice) or a marker word in the quote ("required", "must" / "preferred", "ideally", "a plus"). With neither, the item is shown as "Not stated", and the person chooses.
- Adversarial evaluation cases: a genuine quote paired with an invented company, an invented requirement, a wrong salary, a wrong date and a wrong must/nice label. All must be dropped or corrected.
- The prompt says the post is untrusted data: instructions inside it are ignored. The CV is **not** sent in this request.
- Logging is metadata only (`ai_job_read`: duration, field counts, withheld count, model), never the post text.
- Plans: one request on every plan, inside the existing daily limits (Free 5, Go 50, Pro 200). With AI not configured or no consent, the local pass still works.
- Prompt version `job-read-v1` in the evaluation registry; new suite `--suite=job-read` with at least 12 cases: a clean post, a post with no company name, salary ranges in three currencies, a non-English post, a recruiter-agency post naming no employer, a post with a prompt injection, a very long post, a post that is mostly benefits, a duplicate requirements list, and an empty or nonsense paste (it must return nothing, not invent a job).

### 4.3 Requirements feed the existing matcher

Today `jobMatchRequestSchema` accepts only `{ title, company?, post }`, the model extracts requirements again (at most 15 of 200 characters), and `fromPost()` drops any requirement whose words are not in the post that was sent. So reviewed requirements need a contract change (review finding 3):

- **Request:** `jobMatchRequestSchema` gains an optional `requirements: [{ id, text ≤ 300, priority: "required" | "preferred" }]`, at most 15. When present, the model **does not extract**: it is asked only to cite evidence for each given requirement by `id`, and the response must return the same IDs in the same order (extra or missing IDs fail the response, which is retried once and then reported as an error).
- **Count and length:** job reading allows 40 requirements, but Match takes 15. The review form shows the count, marks the first 15 must-haves (then nice-to-haves) as "used for matching", and lets the person reorder. The rest stay on the application. The 300-character text limit applies to given requirements; the 200-character limit remains for extracted ones.
- **Priorities and deletions are kept:** priority comes from the request, never from the model. Requirements the person deleted are simply not sent.
- **Long posts:** `jobPostSchema` still caps the post at 12,000 characters. With given requirements, `fromPost()` is **not** applied to them: they were already checked against the full post when the job was read (their stored text is a quote or a support-checked paraphrase), so a requirement from beyond character 12,000 is kept. The post is sent truncated, with a note that it was shortened.
- **Output:** unchanged `JobMatchResult`; each requirement carries the request `id`, so the tracker can store which requirements the CV shows.
- **Integration test:** read a job post longer than 12,000 characters → move one item from must to nice, delete one and keep one from after character 12,000 → Match my CV with the synthetic provider → the result has exactly the kept items, with the person's priorities, including the late one.

When the application has `switch_from`/`switch_to`, Match my CV opens in career switch mode ([step 4 plan](2026-11-04-career-switch-and-follow-up-questions-plan.md) §4), using the same `requirements` field.

## 5. Phase C — referrals and follow-ups

- **Referral contact:** contacts get `relationship: "recruiter" | "hiring_manager" | "referrer" | "other"`. Marking a contact as referrer sets `referral_contact_id`, and the list shows a "Referred" tag. A "Who do you know there?" prompt appears on Saved applications; it is only a prompt, and nothing is looked up.
- **Follow-up schedule:** moving to Applied offers a reminder in 7 days ("Follow up") and moving to Interview offers one for the day after ("Send a thank-you"). Both are editable and optional, in-app only (the existing Due strip). Email reminders remain later.
- **AI drafts — `POST /api/ai/job-message`:** kinds `follow_up`, `thank_you`, `referral_request`, `withdraw`. Input: the application's role, company and stage, the contact's name and role, and an optional note from the person. The CV is included only for `referral_request`, and only the facts the person ticks. Output: a short message (≤ 150 words) and a subject line. It is shown as an editable draft with **Copy**. The app never sends it, never stores contact email addresses in AI logs, and never sends contact details other than the name and role to OpenAI. Each draft costs one AI request (Go and Pro; Free gets fixed templates without AI). Evaluation cases go in `--suite=job-message`: no invented meetings, dates or claims about the person, no flattery about the company that the person did not write, and the right tone for each kind.

## 6. Phase D — save from the browser

### 6.1 Bookmarklet first (cheap, no store review)

- `/applications/save-helper` shows a draggable **Save to AI CV Builder** link and how to use it.
- On a job page, the bookmarklet opens `/applications/new?via=bookmarklet` in a new window and sends `{ url, title, text }` (the selected text, or `document.body.innerText` capped at 30,000 characters) with `postMessage` to the app's exact origin only after the new page announces it is ready. The data never goes in the address, so it is not in server logs or history.
- The new page treats the message as untrusted. The sender's origin is whatever job site it came from, so it cannot be allow-listed; instead the page accepts only a message whose `event.source` is `window.opener`, checks the shape and caps the size, and only pre-fills the Add a job form. Nothing is saved until the person reviews it and clicks Save.
- Known limit: some sites block bookmarklets with a strict content security policy, and Firefox is stricter than Chrome. The helper page says so and falls back to copy and paste.

### 6.2 Chrome extension (Manifest V3)

- Permissions: `activeTab` and `scripting` only, plus host permission for the app's own domain. No `<all_urls>` and no background reading: it reads a page **only when the person clicks** the toolbar button, like Teal and Huntr.
- The click extracts the visible job text (selection first, otherwise the main content) and **hands it to the app instead of calling the API from the extension** (review finding 4). The extension opens `/applications/new?via=extension` in a tab. That tab has no `window.opener`, so the bookmarklet handshake does not apply: once the page is loaded, the extension injects the capture into it with `chrome.scripting.executeScript` (allowed by its host permission for the app's own domain), which dispatches a `cv-capture` event on the page. The page accepts one capture, only while its "waiting for capture" state is open, and applies the same shape and size checks as §6.1. It only pre-fills the form. The app page then offers Read the post, Read with AI and Save, so every request comes from the app's own origin, with the existing `requireSameOrigin`, session, consent and plan checks. No server route accepts the extension origin, and the extension needs no cookie access.
- A popup that saves without opening the app (as Teal does) is a later option. It would need a dedicated extension route with its own token, origin allow-list and the same consent and plan checks, planned and tested separately.
- Test: an unpacked-extension Playwright run against the real local server captures a fixture job page, opens the app tab, runs Read with AI with the synthetic provider and saves; a direct request from the extension origin to `/api/ai/job-read` or `/api/applications` is rejected.
- Store listing, a privacy section ("reads the page you are on only when you click; sends it to your account; nothing else"), and a review of each major board's terms before naming them in the listing. No autofilling or submitting applications in v1: that is what draws the most site and terms risk.
- Firefox and Edge later, from the same code.

### 6.3 Not planned: server-side fetching of job URLs

A pasted link is stored, but the server does not fetch it. Fetching would need SSRF protection, would often be blocked by job sites, and raises the same terms issues. The extension reads the page in the person's own browser instead.

## 7. Phase E — suggested jobs (experiment, deferred)

**Decided 2026-11-04: deferred.** Not scheduled. It is reconsidered only after phase D has been live for long enough to show whether people ask for discovery, and only after a provider's terms and costs are reviewed. If it goes ahead:

- One provider with a self-serve licence (Jooble or Adzuna), after reading its current terms, attribution rules, caching limits and price. Show its name on every listing and link to the original posting; never copy postings into the database beyond what the terms allow.
- Search inputs come from the person (role, location, remote), optionally suggested from the CV headline. Results are ranked with the existing deterministic term matching, not AI, so a search costs no AI request. **Save** creates a Saved application (`captured_via = 'suggested'`).
- Behind a feature flag; success measure: share of suggested jobs saved and applied to, compared with jobs captured in other ways.

## 8. Privacy and safety (all phases)

- The privacy page lists: job posts and links the person saves, requirements, contacts they enter (including referrers), message drafts (not stored unless saved to notes) and frozen copies. All are in account export and deleted with the account.
- Contacts are other people's data: never sent to AI except name and role in a message draft, never messaged by the app, never imported from email or LinkedIn.
- The app never applies, never contacts employers or job boards, and never scrapes in the background.
- Job post text is untrusted in every path (paste, bookmarklet, extension, provider): it is never rendered as HTML and never followed as instructions by the AI.

## 9. Tests

- **Unit:** the local job-post reader (titles, companies, salary formats, headings, no-match cases); the `job-read` and `job-message` schemas; quote support checks dropping unsupported fields; the bookmarklet message handler (wrong source, oversize, missing fields); requirements carried into job-match input; and all tracker tests from the step 2 plan.
- **Evaluation:** `--suite=job-read` and `--suite=job-message`, run live before release, as with §39.
- **E2E:** paste a post → Read the post → correct a field → Save → Match my CV opens with the post filled in → Tailor a copy → export and freeze → stage Applied → follow-up reminder appears in Due → draft a follow-up and copy it. The bookmarklet page receives a message from a test opener and pre-fills the form without saving. Keyboard-only and 375 px.
- **Extension:** a Playwright run with the unpacked extension against a local fixture job page; the store build is checked by hand.

## 10. Done when

- A person can go from a job they found anywhere to a saved, matched, tailored and tracked application without retyping the post, by paste in all browsers and by bookmarklet or extension where supported.
- Every AI field shown is backed by a quote from the post, the evaluation suites pass their thresholds live, and AI requests count against existing plan limits.
- Follow-up and referral drafts are never sent by the app, and contacts' details stay out of AI except name and role.
- Privacy and help pages are updated, and PLAN.md records each phase and the plan-limit decision.

## 11. Risks

- **Extraction quality on messy pages:** the person always reviews before saving; selection-first capture lets them trim noise.
- **Site terms and store review:** click-only reading, minimal permissions and no autofill keep the extension in the same category as Teal and Huntr; the terms review comes before naming boards.
- **AI cost on the Free plan:** job reading uses the existing daily limit (5); the local reader keeps the flow working without AI.
- **Scope creep toward a job board:** phase E stays an experiment with its own decision and measure.
