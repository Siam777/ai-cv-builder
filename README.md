# AI CV Builder

A resume editor built with Next.js, TypeScript, React, Zod, and IndexedDB, with optional Better Auth accounts backed by SQLite locally and Turso/libSQL for deployment. Phases 1 and 2 and the local Phase 3 account foundation are implemented. An OpenAI bullet assistant is implemented but awaits live API verification. Live Turso deployment and LinkedIn imports remain unverified or planned.

## Run

Use Node.js 20.9 or newer and npm.

```sh
npm install
npm run db:setup
npm run dev
```

Open http://localhost:3000. Create a blank resume or open the clearly fictional example.

## Available

- Contact details plus summary, experience, education, skills, projects, certifications, and languages.
- Editable section headings, visibility and ordering; entry creation, removal and ordering; individually identified bullets.
- Autosave to IndexedDB with visible status and optimistic revision checks across tabs.
- Independent named resume variants and up to 80 undo steps in the current editing session. Switching resumes or reloading clears undo history.
- Classic, Modern, Compact, and Creative templates, with a gallery showing your own content. Open **Design & templates** in the editor toolbar.
- Five accent colors, three font families, 10/11/12 pt body text, four density presets, and an optional Creative side rail. Changing the design preserves section order, visibility, and facts.
- Measured, numbered A4/Letter pages shared by preview and browser print; plain-text download and version 1 JSON backup. Long text splits across pages without shrinking the font.
- Validated backup preview; restore to a new resume or replace active content with undo. Unsupported fields/versions are rejected rather than silently dropped.

The default workspace keeps resumes in this browser profile. Account workspace saves to the application database. Signing in never uploads local resumes: use **Account ? Review local resumes for import**, select the resumes, and explicitly copy them. Local originals remain independent. Each page reload starts in the local workspace; reopen Account workspace to access server data. Clearing site data, private browsing, or changing devices can lose access; download JSON backups. Resume text is sent to OpenAI only after explicit consent in the account-only AI bullet assistant. Print at 100% scale with browser headers/footers disabled and the selected paper size. Preview and print share page content and physical dimensions, but installed fonts, browsers, and printer settings can affect output. No universal ATS compatibility or deterministic server rendering is claimed.

Existing Phase 1 resumes and version 1 backups receive default design settings when loaded. Their facts, IDs, revisions, and section preferences are preserved; no destructive data migration is needed. Unknown settings are rejected. Font options use local system fonts with fallbacks, without downloading remote assets.

## Accounts and database deployment

`npm run db:setup` creates `data/cv-builder.db`, applies checked migrations, and generates a private authentication secret in ignored `.env.local` for default local development. It is safe to rerun; an edited applied migration is rejected. Use a new migration for schema changes. Keep database files and secrets out of source control. Restart the dev server after changing environment values.

Open **Account** to create an account, sign in, choose storage, copy selected local resumes, change your password, download account data, or delete the account. Passwords require 12 characters. Authenticated routes derive ownership from the verified session and check the active workspace identity. Revision checks reject concurrent saves/deletes. Imports run in a transaction and remember source IDs per account, so retries cannot duplicate copies. Import receipts survive deletion of an imported resume; duplicate the local original to deliberately import again.

Turso hosts the database; the Next.js application still needs an application host. For a Node-compatible deployment (including Vercel), set these **server-only** environment variables:

- `TURSO_DATABASE_URL`: the remote `libsql://` database URL.
- `TURSO_AUTH_TOKEN`: the database token, stored in the host's secret settings.
- `BETTER_AUTH_SECRET`: a generated secret of at least 32 characters, stable across application instances.
- `APP_ORIGIN`: the exact HTTPS application origin, without a trailing slash.

Run `npm run db:setup` once against the configured deployment database before starting the app; run `npm run build` and deploy with the standard Next.js build/start configuration. The same libSQL client and migrations serve SQLite and Turso. Production account requests reject a local file database rather than storing data on an ephemeral host filesystem. A live Turso database has not been provisioned or tested in this workspace.

Account deletion requires the current password and the exact confirmation phrase. It cascades through account resumes, import receipts, sessions, and authentication records. Browser copies remain; database/provider backups follow the operator's retention policy. Account export includes profile metadata, resumes, and import receipts, excluding password hashes and session tokens. Its bundle is an archive; individual resumes can be restored through the existing JSON import.

Current deployment limits: email verification/recovery and outbound email are not configured; password change requires the current password. Better Auth's request rate limiter is enabled in memory; configure shared rate-limit storage or a trusted hosting gateway before a public multi-instance release. Configure trusted proxy/IP handling for the chosen application host. Backup restoration, remote Turso behavior, provider retention, and deployment operations still require live verification. AI evidence is sent only after explicit consent. Resume text is excluded from routine application logging.

## Verify

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

To test with an installed Chrome instead, set `PLAYWRIGHT_CHANNEL=chrome` before running the browser tests (PowerShell: `$env:PLAYWRIGHT_CHANNEL='chrome'`).

Database tests verify atomic import rollback and deletion cascades. Account browser/API tests exercise real SQLite sessions, two-user isolation, stale writes, origin checks, duplicate import retries, password changes/sign-in, explicit local copying, recovery after failed saves, export, and deletion. Domain tests cover backup validation/defaults, bounded settings, fact preservation, empty entries, variant isolation, text export, and stale write/delete rejection. Browser tests cover the editor journey, concurrent tabs, all templates and paper sizes, long/unbroken content, density extremes, design persistence, mobile layout, print readiness, and overflow. Generated screenshots, 24 template PDFs, and expected text/page manifests go to the ignored `test-results/` directory.

For PDF verification, install `pypdf` in a Python environment and run `python scripts/verify-pdfs.py` after the full browser suite. It checks every source text block in reading order, preview/print page-count parity, page sizes, contact links, and blank pages. Render the PDFs with Poppler for visual review as well. Running a subset of browser tests replaces the previous `test-results/` outputs.

## Project map

- `src/lib/document.ts`: versioned schema, synthetic fixture, backup and text contracts.
- `src/lib/repository.ts`: transactional IndexedDB repository.
- `src/lib/server/`: Better Auth, SQLite/Turso connection, owner-scoped persistence.
- `src/app/api/`: authenticated account and resume routes.
- `migrations/` and `scripts/setup-db.mjs`: checked SQLite/libSQL migrations.
- `src/components/account-panel.tsx`: explicit storage choice and account data controls.
- `src/lib/presentation.ts`: allowlisted design tokens and legacy defaults.
- `src/lib/layout.ts`: ordered render blocks and DOM-measured pagination with grapheme-safe text splitting.
- `src/components/resume-studio.tsx`: editor, autosave, undo, management and restore review.
- `src/components/resume-preview.tsx`: measured, scaled pages shared with print, plus print readiness.
- `src/components/design-panel.tsx`: template gallery and presentation controls.
- `src/app/templates.css`: physical page dimensions and template typography shared by measurement, preview, and print.
- `PLAN.md`: phase progress and acceptance gates.
- `FEATURE-PLAN.md`: release scope, synchronized with the packaged copy and ZIP.

Phase 1 user-entered data is stored per resume. A shared candidate-fact store and evidence/proposal model must be introduced before AI integration, with migrations preserving existing documents.

Setup references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Zod validation](https://zod.dev/basics).

Database/auth references: [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [Better Auth user accounts](https://better-auth.com/docs/concepts/users-accounts), [Drizzle and Turso](https://orm.drizzle.team/docs/sqlite/connect-turso).

## OpenAI bullet assistant

The editor now includes **AI bullet assistant**. It requires an account workspace, a nonempty bullet, and explicit consent to send the selected entry's bullets and writing instruction. It does not upload local resumes or send contact fields or other entries. Instructions express writing preferences; add new candidate facts to the original entry before asking for another rewrite.

Add `OPENAI_API_KEY` privately to `.env.local` (or the deployment's secret settings), then restart the app. Do not put keys in chat or any `NEXT_PUBLIC_` variable. `OPENAI_MODEL` defaults to `gpt-4.1-mini-2025-04-14`; model access and actual output quality still require testing with your OpenAI project. Run `npm run db:setup` for the proposal/usage migration.

The server calls the Responses API with strict JSON output and `store: false`. A second structured call checks factual support. Invalid references, new numeric claims, incomplete output, refusals, and failed support checks cannot become applicable edits. The model has no tools, URLs to fetch, or mutation privileges. Semantic checks can still make mistakes: the user reviews the original evidence and proposed wording, confirms factual accuracy, and chooses **Accept and save** or **Reject suggestion**. Acceptance derives content from the server-stored proposal, checks ownership and revision, and saves the resume and acceptance receipt in one transaction. Repeated acceptance cannot apply twice; session Undo can restore the original text.

Limits: at most 10 evidence bullets/12,000 characters per entry, a 1,000-character instruction, two provider calls with 1,800 output tokens each, and a 45-second total timeout with no automatic paid retries. Database-backed counters default to 20 rewrite requests per account/day and 200 installation-wide/day (UTC), configurable through `AI_DAILY_USER_LIMIT` and `AI_DAILY_GLOBAL_LIMIT` (0 disables new generation). Failed attempts count; deleting resumes cannot reset these counters. At most two requests per account may be active within the 90-second reservation window. Provider/project spending limits should also be set for the chosen deployment.

Proposals expire for acceptance after 24 hours. Pending/accepted proposal content, original evidence snapshots, and prompt/model versions remain in account storage until the resume/account is deleted; rejection clears the proposal body. Usage counters and receipt metadata remain with the account and are included in account export. Account deletion removes account-specific AI records; anonymous installation-wide daily totals remain. `store: false` is not a promise of zero provider retention; verify the OpenAI project's data settings before release.

Validation currently uses controlled provider responses and real SQLite, including consent, evidence checks, accept/reject/undo, stale writes, ownership, retry receipts, quotas, malformed output, refusal, timeout, and mobile layout. **No live OpenAI call has been verified in this workspace because no API key is configured.** After configuring it, run `npm run ai:eval` explicitly for four synthetic smoke fixtures (up to eight API calls), then inspect the output for semantic support. This command makes paid provider calls and does not touch saved resumes.

This is the first Phase 4 flow. Full contextual chat, summary generation, skill suggestions, shared fact/provenance migration, and broader live adversarial evaluations remain planned.

Official references: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-4.1 mini snapshot](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
