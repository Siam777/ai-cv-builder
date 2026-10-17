# Step 2 — Application tracker (basic): implementation plan

Date: 2026-10-17. Scope source: FEATURE-PLAN.md "Career workflow roadmap", step 2. Background: [2026-10-17-career-platform-analysis.md](2026-10-17-career-platform-analysis.md). Starts after Gate 0 (it can run alongside step 1, since they touch different files). Nothing here is implemented.

## 1. Goal

A place to keep every job the person is applying for: the stage it is at, dates, notes, recruiter contacts, a reminder for the next action, and a **frozen copy of the exact CV and cover letter sent**. There is no AI in this step. The stage history it records is the data that later outcome insights need.

## 2. Decisions taken in this plan (change before starting if needed)

| Question | Decision | Why |
| --- | --- | --- |
| Guests? | Account only; guests see "Sign in to track applications" | Contacts and history need server storage with ownership checks; same rule as AI |
| Plan limits? | **Open (FEATURE-PLAN.md).** Recommended: the tracker is free on every plan with a 500-application abuse cap; frozen copies count toward storage only | Storage is cheap, and the tracker brings people back on every application |
| Reminders | In-app only in v1 ("Due" list and badge). Email reminders later | Email needs a scheduler, opt-in and unsubscribe; none exist yet |
| Board view | List grouped by stage with a stage selector, not drag-and-drop | Drag boards are hard to make accessible; a board can come later |
| Frozen copy | Stores the CV document JSON and design settings at the moment of sending, not the PDF file | Fits the existing database; a re-render can differ slightly if a template changes later (disclosed) |

## 3. Data model — migration `migrations/008-applications.sql`

Applied by the existing `npm run db:setup` runner (it reads `migrations/*.sql` in order and records checksums). It follows the `job_reviews` style: owner-scoped primary keys, `ON DELETE CASCADE` from `user`, and JSON columns checked with `json_valid`.

```sql
CREATE TABLE IF NOT EXISTS applications (
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  company TEXT NOT NULL, role TEXT NOT NULL,
  job_url TEXT, location TEXT, source TEXT,
  stage TEXT NOT NULL CHECK(stage IN ('saved','applied','assessment','interview','offer','accepted','rejected','withdrawn')),
  stage_changed_at TEXT NOT NULL, applied_at TEXT,
  next_action_at TEXT, next_action TEXT,
  notes TEXT NOT NULL DEFAULT '',
  job_post TEXT,                       -- pasted text, capped in the schema
  contacts TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(contacts)),
  resume_id TEXT,                      -- soft link to the CV used; no FK (CVs can be deleted)
  request_hash TEXT NOT NULL,          -- idempotent create, as job_reviews
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id, id));
CREATE INDEX IF NOT EXISTS applications_owner_stage ON applications(owner_id, stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS applications_owner_due ON applications(owner_id, next_action_at);

CREATE TABLE IF NOT EXISTS application_events (
  owner_id TEXT NOT NULL, application_id TEXT NOT NULL, id TEXT NOT NULL,
  at TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('created','stage','sent')),
  from_stage TEXT, to_stage TEXT,
  PRIMARY KEY(owner_id, id),
  FOREIGN KEY(owner_id, application_id) REFERENCES applications(owner_id, id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS application_documents (
  owner_id TEXT NOT NULL, application_id TEXT NOT NULL, id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('cv','cover_letter')),
  name TEXT NOT NULL, source_resume_id TEXT, source_revision INTEGER,
  content TEXT NOT NULL CHECK(json_valid(content)),
  sha256 TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(owner_id, id),
  FOREIGN KEY(owner_id, application_id) REFERENCES applications(owner_id, id) ON DELETE CASCADE);
```

- `resume_id` has no foreign key on purpose: a composite `ON DELETE SET NULL` would also null `owner_id`. The frozen copy in `application_documents` keeps the content after the CV is deleted.
- Contacts are a JSON array (≤ 10 items: name, role, email, phone, profile URL, notes ≤ 1,000), validated with zod. They are not a separate table, because they are only read with their application.
- Events record every stage change with a time. Outcome insights (roadmap "later") read only this table.

Limits, in `src/lib/applications.ts`: company and role ≤ 200, notes ≤ 5,000, job post ≤ 30,000, frozen CV ≤ 512 KB (a photo data URL is replaced by a "photo was included" flag to stay inside the limit, and this is disclosed), ≤ 5 documents per application, ≤ 500 applications per account.

## 4. Server

New `src/lib/applications.ts` (shared zod schemas, stage list, labels, limits) and `src/lib/server/applications.ts` (queries). Patterns copied from `src/lib/server/job-review-history.ts` and its routes:

| Route | Does |
| --- | --- |
| `GET /api/applications` | List the owner's applications (summary fields, filters: stage, due) |
| `POST /api/applications` | Create. `requestId` makes it idempotent (`request_hash`), as job reviews do. Writes a `created` event |
| `GET /api/applications/[id]` | One application with contacts, events and document list |
| `PATCH /api/applications/[id]` | Update fields. Takes `updatedAt` and returns 409 if it changed (two tabs). A stage change writes a `stage` event in the same transaction |
| `DELETE /api/applications/[id]` | Delete, cascading events and documents |
| `POST /api/applications/[id]/documents` | Freeze a CV: `{resumeId, revision}` → the server reads **its own stored row** (ownership checked, revision must match) and copies it. For a CV only on this device, the client sends the document and it is validated with `documentSchema`. Cover letter: `{text, name}` |
| `GET /api/applications/[id]/documents/[docId]` | Read a frozen copy (view, or export through the existing authenticated export service) |

Every route uses `authorized`, `requireSameOrigin` for writes, `readJson` with a size cap, `checkRateLimit` (writes: 60 a minute), `HttpError` codes (`APPLICATION_NOT_FOUND`, `APPLICATION_CHANGED`, `APPLICATION_LIMIT`), and metadata-only logging: never company names, notes or contacts in logs.

Account: `GET /api/account/export` adds `applications`, `applicationEvents` and `applicationDocuments`. Account deletion is covered by the cascade; a test proves it.

## 5. Interface

- **Route `/applications`**, linked from the account menu and the dashboard ("Applications"). Signed-out visitors get a sign-in prompt that returns here.
- **List:** grouped by stage (Saved, Applied, Assessment, Interview, Offer, Closed: accepted/rejected/withdrawn). Each row shows the company, role, stage selector, the date applied, the next action with "Due" or "Overdue", and the number of sent documents. Rows that are "applied" with no change for 21 days show a muted "No reply yet" (computed, not a stage). Table on desktop, cards at phone width.
- **"Due" strip** at the top: next actions due today or overdue. A badge count appears on the account menu link.
- **Detail panel** (reuse `PanelDialog`/`SidePanel`): editable fields, a stage timeline from events, contacts, notes, the pasted job post, and sent documents (view, download again). Buttons: **Match this job** (opens the editor's Match a job tab with the post filled in) and, after step 3, **Practice for this interview**.
- **Links from the editor:**
  - After a CV export succeeds: "Record this as an application?" → opens a create form with the CV frozen.
  - In Match a job: "Save this job to applications" (company, role and post filled in).
  - In the cover letter tool: "Attach to an application".
- Copy explains: "The copy you sent is kept as it was. If you change your CV later, this copy does not change."

## 6. Privacy

- Privacy page: what is stored (jobs, notes, recruiter contacts entered by the person, frozen CV and letter copies) and that it is included in account export and deleted with the account.
- Contacts are personal data about other people: only the person's own entries, never sent to AI, never used for messaging. No import from email or LinkedIn in this step.
- Nothing is sent to employers or job boards. The app never applies or contacts anyone.

## 7. Tests

- **Unit** `tests/applications.test.ts`: schema limits; an idempotent create with the same and a changed `requestId` body (409); owner isolation (another account gets 404 for the application and its documents); a stage change writes an event; stale `updatedAt` gives 409; freezing a CV of another owner fails; a revision mismatch fails; the photo is replaced over the size limit; the 500 cap; account export includes all three tables; user delete cascades. Uses the same in-process database setup as `tests/database.test.ts` and `tests/job-review-history.test.ts`.
- **E2E** `tests/e2e/applications.spec.ts`: sign in → export a CV → record as an application → change the stage → set a reminder for today → see it under Due → open the frozen copy after editing the CV (unchanged) → delete. Also signed-out redirect, keyboard-only, and 375 px.
- Migration test: `npm run db:setup` on an existing database applies 008 once and records the checksum.

## 8. Done when

- All routes enforce ownership, size caps and rate limits, with tests. Account export and deletion include tracker data.
- The full flow in §7 passes end to end; the list and detail panel are usable by keyboard and at phone width.
- Privacy and help pages are updated; PLAN.md records the delivery and the plan-limit decision.

## 9. Size and risks

- Size: medium to large, about 1–1.5 weeks.
- **Data growth** from frozen copies: capped at 512 KB × 5 per application; watch database size after launch.
- **"Exact copy" honesty:** a re-render from stored JSON may differ if a template changes. Either version-pin templates for frozen copies later, or store the exported file once blob storage exists.
- **Later:** email reminders (opt-in, unsubscribe, a scheduler), a board view, CSV import/export of applications, and outcome insights (they need enough events; show counts and "too few to tell", not percentages, below about 20 applications per group).
