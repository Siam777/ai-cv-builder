# Product quality and launch improvement plan

Date: 2026-10-10 (Asia/Dhaka)
Status: researched proposal followed by local Q1 implementation, completed Q0 trust/dependency/visual baseline work, Q2.1 public shell, Q2.2 dashboard/editor foundation and Q2.3 Google/account integration; current progress and acceptance evidence live in PLAN.md. The initial audit below is historical, not a description of current behavior. Q2.4 bundled typography, toolbar disclosure and keyboard/focus improvements are implemented locally; live OAuth/email/deployment and human assistive-technology gates remain open. Q3 shared renderer and the 12-design/12-starter collection are implemented locally; catalog, comparison, sidebar/date layout and matching letterhead are delivered locally; passed local checks and remaining human/Word visual gates are tracked in [Q3 review](q3-template-export-review.md). Google is locally validated with a synthetic provider and requires real credentials before availability. Decisions and checks are recorded in [Q2 public shell review](q2-public-shell-review.md), [Q2 dashboard/editor review](q2-dashboard-editor-review.md), [Q2 Google/account review](q2-google-account-review.md) and [Q2 editor polish review](q2-editor-polish-review.md).

This plan responds to the request for excellent starter templates, a proper landing page, polished UI, a credible AI analyzer, production authentication, and authentication for every download/export. `PLAN.md` owns execution progress; `FEATURE-PLAN.md` owns release scope. This document supersedes conflicting recommendations in the two earlier improvement plans, especially anonymous exports, fixed ATS percentages, and generating fictional work history as a candidate's resume.

## 1. Product direction and differentiation

Build a resume studio that helps a candidate present **real experience beautifully and explain how it matches a particular job**. The memorable product moment is one continuous loop: choose a compelling example, add real experience, see the evidence behind a recommendation, accept a precise change, and export a checked document.

Initial positioning: professionals in technology, business, product, design, and operations, with a genuine graduate starting path. Broader examples can serve other occupations without implying that every occupation has a validated specialist analyzer.

The proposed advantages must be demonstrated in the product:

| Advantage | Product behavior | Proof required before marketing it |
| --- | --- | --- |
| Strong visual quality | Distinct typography and layouts, realistic examples, readable full-page previews | Design review of actual exports, not only gallery images |
| Evidence behind every AI edit | Click a recommendation to inspect the candidate fact and job requirement it uses | Evaluation corpus, traceable references, accept/reject/undo |
| Useful file diagnostics | Inspect the actual exported file and identify lost or scrambled content | Parser/version and artifact-specific results |
| A smooth first session | Demo, blank, and reviewed import paths; drafts survive sign-in | Measured task completion with first-time users |
| Predictable ownership and access | Every app export requires a valid account session | Direct API and cross-account tests for every artifact |
| Honest commercial experience | Show account requirements, free limits, and premium restrictions before editing | Landing, pricing, gallery, and export dialog agree |

Do not use “industry standard” as an unverified badge. Define it through measurable quality gates below. Do not promise interview probability, universal ATS acceptance, market percentiles, or superiority over every competitor.

## 2. Research and current-state audit

### Competitor patterns worth learning from

Reviewed public official pages on 2026-10-10. These are observations of advertised functionality and information architecture, not logged-in product tests or independent validation of vendors' performance claims. Resume.io's homepage did not load through the research tool; its template and AI pages were accessible. No competitor artwork, resume text, or customer claims should be copied into the product.

| Reference | Observed pattern | Proposed application |
| --- | --- | --- |
| [Resume.io templates](https://resume.io/resume-templates) and [AI builder](https://resume.io/ai-resume-builder) | Named templates, categories, visible format choices, creation/upload entry points | Browseable gallery with useful labels and a direct start path |
| [Canva resume builder](https://www.canva.com/create/resumes/) | Visual template choice, color/font/layout customization, saved versions | Make the resume itself the hero; provide bounded design freedom |
| [Enhancv templates](https://enhancv.com/resume-templates/?gad=1) | Filters for layout, experience, and job; guidance on choosing a design | Explain the intended use of each template and offer a compare view |
| [Teal resume builder](https://www.tealhq.com/tools/resume-builder) | Job matching, analysis, AI writing, and multiple versions within a workflow | Keep the job, supporting experience, and tailored variant connected |
| [Rezi](https://www.rezi.ai/) | Upload-to-score entry point and a guided AI improvement proposition | Offer an immediate, actionable review entry point with transparent scoring |
| [Jobscan scanner](https://www.jobscan.co/resume-scanner) | Job-specific matching plus formatting and writing recommendations | Separate job coverage, file parsing, and writing feedback |
| [Kickresume](https://www.kickresume.com/en/) | Resume and matching cover-letter templates | Extend each visual family into a coherent application set |

These references motivate the direction; they do not establish an objective ranking of “best websites.” Avoid copying vendor ATS scores, user counts, testimonials, or hiring claims.

### Findings verified by source inspection

| Area | Current evidence | Improvement needed |
| --- | --- | --- |
| Landing | `src/app/page.tsx` renders `ResumeStudio` directly | Public marketing page and separate workspace routes |
| Templates | `src/lib/presentation.ts` registers eight styles; `design-panel.tsx` has category filters and previews | Refine existing designs before expanding; add real template detail pages |
| Template claims | Metadata contains fixed 96–100% `atsRating` values rendered as “ATS Safe” | Replace with measured, scoped diagnostics and descriptive labels |
| Demos | `src/lib/demo-resumes.ts` contains five profiles; selecting a demo calls the same `addDocument` path as personal documents, and the canonical schema has no demo-origin field | First separate the example library from personal CVs; then expand to 12 fictional starters |
| Authentication | Better Auth email/password, session helper, and owner-scoped account export exist | Configure verification/recovery, robust session UX, and production controls |
| PDF endpoint | `api/resumes/export-pdf/route.ts` permits a null session and renders a posted document | Require authentication and validate the authorized source before rendering |
| Other exports | `resume-studio.tsx` creates TXT/MD/HTML/DOCX/JSON browser downloads; `verifyExport` only checks cloud documents | Centralize export authorization for all formats and local documents |
| Export escape paths | Recovery JSON, cover-letter downloads/copy/print, and PDF-error print fallback have separate handlers | Cover every app-controlled path with the same policy |
| Analyzer | `ats-linter.ts` assigns `extractionScore = 100`; `ats-plain-text.ts` serializes the document model | Check actual artifacts; a serialization is not a third-party ATS parser |
| Role analysis | Curated keyword/metric rules; unsupported roles can fall back to software engineering | Confirm target role, use an unscorable/general state, validate role rubrics |
| Factual integrity | `ai-cv-generator.ts` generates fixed employers, dates, and metrics; analyzer offers direct missing-skill insertion | Keep fictional content in demos; require candidate evidence for real resumes |
| Rendering | Preview uses layout/pagination modules; server PDF uses standalone HTML export | Establish a shared rendering contract and test preview/export agreement |
| Release records | Existing plans and README contain stale summaries and broad completion claims | Retain historical records but require fresh evidence for launch gates |

This was a code and reference-image review. The application was not started, and historical test passes were not rerun. `node_modules` is absent in this checkout. Live hosting, database, email, AI, billing, and production browser rendering remain to be verified.

## 3. Sample folder review and template collection

All 13 images in `samples/` were visually reviewed. Filenames containing “ATS” are reference names, not compatibility evidence. Use these as design references; recreate original layouts in code and use synthetic content. Do not publish the reference portraits, names, or layouts as licensed assets without confirming reuse rights.

| Sample | Useful design direction | Adaptation / quality concern |
| --- | --- | --- |
| `classic-ats-resume-template.webp` | Centered header, readable single column, ruled headings | Reduce heavy rules; offer plain skill text as well as restrained chips |
| `modern-banner-ats-resume-template.webp` | Strong banner and role accents | Keep banner height bounded; readable contact text and grayscale output |
| `tech-startup-ats-resume-template.webp` | Compact developer profile, project links, stack labels | Improve small metadata; prevent long links and chips from clipping |
| `executive-luxury-ats-resume-template.webp` | Serif name and leadership hierarchy | Support genuine two-page careers; avoid excessive tracking and tiny dates |
| `elegant-professional-ats-resume-template.webp` | Quiet professional single column | Develop a distinct consulting/legal option with consistent spacing |
| `compact-professional-ats-resume-template.webp` | Aligned dates and grouped skills | Preserve readable text; never promise that a fixed career length fits one page |
| `timeline-modern-ats-resume-template.webp` | Date rail and progression markers | Keep dates attached to roles in extraction and across page breaks |
| `creative-portfolio-ats-resume-template.webp` | Tinted header, project-oriented sections | Make project evidence prominent; avoid large decorative blocks |
| `bold-creative-ats-resume-template.webp` | Strong name/banner and prominent section hierarchy | Give it distinct typography rather than another recolor of Modern |
| `566w-S-rQu18x1c8.webp` | Dark sidebar, compact contact/skills, clear main column | Photo optional; verify sidebar continuation and PDF reading order |
| `1131w-MFQG2f7to8k.webp` | Bold name, substantial sidebar, generous main column | Reduce oversized portrait/name; replace placeholder prose and references |
| `566w-yiHcyfHd2aw.webp` | Banner with pale sidebar and timeline | Simplify icons; test photo overlap and multi-page continuity |
| `1131w-dz7vGJ9RodA.webp` | Spacious minimal layout with aligned date/content columns | Optional portrait; reduce wasted space and retain meaningful body size |

### Catalog target: 12 original designs

Release the first eight only when polished; expand to 12 for the full launch collection. Preserve existing template IDs and migrate presentation settings without changing facts. Working display names can be refined during design review.

| ID / working name | Status | Structure and intended use | Starter pairing |
| --- | --- | --- | --- |
| `classic` / Professional | Refine existing | Single column, strong headings, broad use | HR professional |
| `modern` / Modern Banner | Refine existing | Bounded accent header, clear experience hierarchy | Business analyst |
| `compact` / Compact | Refine existing | Dense but readable, aligned dates | Graduate / early career |
| `creative` / Editorial Sidebar | Refine existing | Genuine sidebar, balanced main column | Product designer |
| `tech` / Technical | Refine existing | Projects, repository links, grouped skills | Software engineer |
| `executive` / Executive | Refine existing | Serif heading, leadership achievements, multi-page | Senior leader |
| `timeline` / Career Timeline | Refine existing | Narrow date rail, clear role sequence | Project manager |
| `minimalist` / Minimal | Refine existing | Quiet typography and generous rhythm | Career changer |
| `elegant` / Consulting | New | Refined single column, restrained rules | Finance / consulting |
| `portfolio` / Portfolio | New | Selected work, case-study links, light section panels | Designer / creative |
| `bold` / Brand | New | Expressive nameplate with disciplined content | Sales / marketing |
| `academic` / Research | New | Education, publications, research, longer CVs | Research graduate |

Template is presentation; demo is fictional content. Every compatible demo can be switched into every template without deleting sections. Academic introduces useful long-CV support beyond the supplied samples and must pass the same quality gates.

### Demo content and starting experience

- Create 12 reviewed fictional profiles: software engineer, solutions architect, business analyst, product manager, product designer, data analyst, project manager, marketing/sales professional, HR professional, senior leader, graduate, and career changer. Use balanced one-, two-, and longer-page fixtures, varied career paths, and realistic non-numeric achievements.
- Pair demos with plausible sample jobs and an annotated example of a supported improvement. Keep sample jobs/content explicitly synthetic; never imply a placement or a real person's endorsement.
- Provide **Use this design with my details**, **Explore example**, and **Import my resume** as distinct actions. Starting with the design creates an empty/guided document; exploring a demo never inserts fictional claims into an existing resume.
- Mark demo records and fields as sample content. Show a persistent example banner; confirm replacement before promoting a demo to a personal resume. Any exported example still requires sign-in and remains labeled as a sample.
- Use neutral avatars by default; photos are optional and off by default in personal resumes. Do not import portraits from references.
- Gallery filters: style, columns, career stage, page length, and supported formats. Cards show an actual rendered sample, free/premium label, full-page preview, and use action. Compare two designs using the same content.
- Public detail pages show a one-page and long example, supported formats, customization options, extraction-test scope, and a matching letterhead. Public previews are view-only; sample file download requires authentication.

### Template release gates

- Shared tokens for type scale, spacing, margins, accent, headings, and page size. Bundle licensed fonts used by preview and renderer; avoid remote font dependencies during export.
- Default body text 10.5–11 pt or larger; any supported 10 pt compact mode must pass visual review. No automatic shrinking below the supported floor. Long resumes may span multiple pages.
- Baseline matrix: 12 templates × A4/Letter × short/long fixtures = 48 PDF cases. During the first-eight milestone, run 32. Add stress cases for long URLs, missing fields, one huge role, density extremes, photo on/off, Unicode, and each explicitly supported RTL language.
- Inspect rendered pages and extract actual PDF text: no missing facts, clipping, accidental blank pages, stranded headings, broken links, or interleaved roles. DOM order alone does not satisfy this gate.
- Generate editable DOCX from structured content; validate paragraphs/lists and reading order in Word and LibreOffice. Disclose intentional DOCX layout differences instead of promising pixel identity with PDF.
- Version templates and fixtures; gallery thumbnails come from the same renderer and content version. A failed quality gate removes a template from release availability.

## 4. Landing page, visual identity, and information architecture

### Design brief

Create a calm, precise professional workspace with the resume document as the visual centerpiece. Distinction comes from beautiful typesetting and a visible evidence-to-edit interaction. Avoid a wall of generic feature cards, unsupported statistics, and decorative AI imagery.

Proposed tokens: white paper `#FFFFFF`, workspace mist `#F2F5F8`, ink `#162737`, secondary text `#526473`, action blue `#2254D1`, and evidence teal `#116B62`. Check actual foreground/background pairs for contrast before adoption. Use Source Sans 3 for product controls and body text, and a restrained Source Serif 4 display treatment in the hero and selected template families; verify font license and bundle assets. Keep paragraphs around 60–75 characters per line.

Use a consistent spacing scale, prominent document previews, restrained borders, and purpose-specific surfaces. Put expressive typography in the document showcase; keep editor controls quiet. Motion responds to selection or acceptance and respects reduced-motion preferences.

### Landing page sequence

| Section | Content and interaction | Acceptance |
| --- | --- | --- |
| Navigation | Brand, Templates, Examples, Resume review, Pricing, Sign in, Create resume | Clear active state; usable mobile menu |
| Hero | “Your experience. Clearly presented.” Support: choose a design, improve it with evidence, tailor it to a job | Primary **Create my resume**, secondary **Review my resume**; sign-in-before-export disclosed nearby |
| Interactive product proof | One fictional resume with three switchable designs and a supported before/after bullet | Real rendered content; explicit sample label; accessible static fallback |
| Template showcase | Six varied previews leading into the complete gallery | Full-page inspect; useful filters; no fake ATS percentages |
| Three-step journey | Start with details/import → review recommendations → sign in and export | Copy matches actual guest/account behavior |
| Analyzer demonstration | Job requirement, matching fact, missing evidence, proposed edit | Show why the recommendation exists and its limits |
| Career examples | Graduate, professional, leadership, career transition | Each opens a useful example, not a dead CTA |
| Trust and privacy | Actual storage/AI handling, export checks, account protection | Evidence-backed claims; authentic testimonials only when available |
| Pricing | Account requirement, free allowance, paid features, exact billing cadence | No surprise charge after completion |
| FAQ and final CTA | Formats, login, ATS limitations, data deletion, longer resumes | Helpful answers; **Start my resume** |
| Footer | Help, contact, privacy, terms, accessibility, service status when available | All published links resolve |

Suggested desktop composition: navigation above a left-aligned headline/action area and a large right-side resume preview; use a full-width template strip below. On mobile, put the headline/actions first, a legible preview second, and filters in an accessible disclosure. This is a proposed layout, not an implemented screen.

### Route plan

| Surface | Proposed routes | Access |
| --- | --- | --- |
| Marketing | `/`, `/templates`, `/templates/[slug]`, `/examples`, `/examples/[slug]`, `/pricing` | Public browsing |
| Review funnel | `/grader` retained, marketed as Resume review | Public inline basic report; account required for AI depth, saving, or report export |
| Guest drafting | `/builder` | Device-local draft and preview; every app export requests sign-in |
| Account | `/sign-in`, `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password` | Appropriate anonymous/token/session states |
| Workspace | `/app/resumes`, `/app/resumes/[id]`, `/app/settings`, `/app/billing` | Authenticated; server ownership checks |
| Information | `/help`, `/privacy`, `/terms` | Public |

Preserve IndexedDB data when moving the editor from `/`. Migrate old links and existing `/account`, `/profile`, and `/upgrade` routes deliberately. Do not redirect guest users into an empty cloud workspace or silently upload their local resumes.

## 5. Editor and account experience

### First user-facing milestone: distinguish My CVs from Demo examples

Priority clarified on 2026-10-10: the current mixture makes it hard to identify a user's own CVs. Deliver this separation before more templates or the full landing-page redesign, using the existing authentication foundation. Complete authentication/export enforcement in the same Q1 milestone.

| Place | Contents | Default behavior |
| --- | --- | --- |
| **My CVs** | Only personal documents owned by the signed-in account | Default workspace after sign-in; never seed with demo records |
| **On this device** | Device-local drafts, clearly labeled as local | Separate storage view; never assume which account owns a shared-device draft |
| **Demo examples** | Read-only fictional profiles with a persistent Demo badge | Browsing/previewing creates no personal document, recent item, or resume-count usage |
| **Templates** | Presentation designs without personal career facts | Applying a design preserves the user's existing content |

- Personal CV cards show a user-chosen title (for example, “Frontend developer — Acme”), candidate name, target role/company, last edited time, draft/ready state, and storage label. Keep template name secondary; it cannot identify who owns the CV. Account identity is visible in the workspace header.
- The editor document switcher, personal search, dashboard counts, and recent documents include only documents in the selected personal workspace. Demo navigation is separate. A new user sees **Create my CV**, **Import my CV**, and **Browse examples** in an honest empty state.
- **Preview example** opens a read-only preview. **Use this design** creates a new personal draft with the layout and empty/guided fields. If offering **Copy example to practice**, put that copy in an explicit practice/examples area and keep fictional-field labels until the user replaces/reviews them. No implicit promotion into My CVs.
- Introduce explicit document-purpose and provenance metadata (personal, practice/example, or legacy-unclassified; origin such as blank, import, or example; source example ID where applicable). Keep those separate from server-owned `ownerId` and local/cloud storage. An example-derived document can become personal after deliberate confirmation; its provenance remains recorded. Metadata labels never grant access.
- Migrate schemas, local/cloud repositories, duplication, restore, and export consistently. Existing records and backups without reliable provenance need review; do not classify by the candidate name, email, template, or title. Put ambiguous records in a clearly labeled **Review older drafts** area, preserve edits, and let the user mark personal/practice or archive them. Never delete legacy records automatically.
- Copying device drafts into an account is explicit and preserves originals. Signing out or switching accounts clears the previous account's document list/preview before loading the next workspace; it never reassigns ownership or silently merges local drafts.
- Acceptance: browsing every example leaves My CVs/counts unchanged; creating from a design produces exactly one independent personal draft without fictional claims; personal edits/reload/duplicate work; legacy drafts remain recoverable; two accounts never see each other's CVs; session expiry preserves work and still blocks export.

First usable slice: sign in → see an empty or clearly personal My CVs dashboard → browse a separate example → use its design with personal details → save → export through the authenticated policy. Keep this slice small; the full gallery, marketing polish, and expanded catalog follow it.

### Remaining editor refinements

- Dashboard: meaningful thumbnails, document name, target job, updated time, save state, duplicate/delete, and a clear new-resume action. Keep cover letters and tailored variants connected to their source.
- Start flow: choose example/design, blank, or import. Ask only for the next useful details; let graduates lead with projects and education. Review imported fields, uncertain dates, and omissions before committing.
- Desktop editor: section rail, focused editing area, and readable paginated preview. Header prioritizes title, save status, undo, review, and export. Keep design controls in a roomy gallery/drawer.
- Mobile: Edit / Preview / Review modes, persistent save feedback, large touch targets, and a reachable export action. No squeezed three-column interface or nested modal stacks.
- Preserve keyboard bullet behavior and preview-to-field navigation. Add accessible actions for reordering. Modal focus trapping/return, validation announcements, reduced motion, and zoom are release requirements.
- Use progressive disclosure: show the top three actionable findings first; expose detail on demand. Clicking a finding focuses the exact bullet/field. Never make a user search the whole form for the affected content.
- AI suggestion flow: original → proposed wording → supporting fact(s) → accept/reject → undo. New facts require confirmation. A failed AI call preserves all editing and deterministic checks.
- Export dialog: format, page size, page count, tested-format status, watermark/entitlement terms, and sign-in state. Explain DOCX differences. Preserve the pending export choice through authentication.
- Handle empty/loading/offline/conflict/error/session-expired states explicitly. In-memory and IndexedDB recovery preserve work until reauthentication; there is no anonymous recovery-download exemption.

## 6. Authentication and mandatory export authorization

### Policy

**Every app-provided download/export requires a valid server-verified authenticated session.** This covers PDF, DOCX, HTML, Markdown, TXT, JSON backup, account-data export, cover letters, analyzer reports, batch exports, demo/sample files, and future formats. App-provided print/Save-as-PDF and copy/export actions follow the same gate. Payment entitlements are a separate decision: free users still authenticate.

Guests may browse, try templates, edit a local draft, and view a basic review. State “Sign in to download” before they begin. On export, persist the draft and pending intent, authenticate, return to the same document/revision, confirm any upload/storage choice, then continue. Cancelled or failed sign-in preserves the draft.

An application can gate its own APIs and print/copy buttons; it cannot prevent someone manually copying visible text, taking a screenshot, or invoking browser/OS print. Do not promise DRM. Do not implement fragile keyboard interception as the security boundary.

### Identity improvements

Retain Better Auth and the SQLite/Turso/Drizzle foundation. Configure verified email/password accounts, password recovery, Google sign-in for the polished launch, sign-out, session/device management, and safe account deletion. Use the provider's proven flows instead of custom token/cryptography machinery. Configure transactional email and exercise token expiry/reuse and delivery failures. Better Auth documents [email setup](https://better-auth.com/docs/concepts/email) and [session management](https://better-auth.com/docs/concepts/session-management); verify compatibility with the installed version during implementation.

Validate secure cookie settings over HTTPS, trusted origins/redirect destinations, state/PKCE for OAuth, request origin protection, shared rate limits, generic recovery responses, and session revocation after password reset. Require recent authentication for account deletion and full account-data export. MFA/passkeys can follow the launch; do not add enterprise SSO to this scope.

### Export architecture

1. Introduce one server export service and one client export coordinator. Prefer an authenticated POST that streams the generated file for launch. If asynchronous jobs are needed, use owner-scoped job/status/download endpoints; a bare signed URL must not bypass current-session validation.
2. Authorize before expensive parsing/rendering: valid session, verified account policy, origin protection for mutations, ownership, allowed format, source revision, quotas, and entitlement. Resolve owner identity from the session, never from a body `userId`.
3. For cloud resumes, accept document ID and expected revision, load the owned stored document, and export the immutable snapshot. Flush saves first; reject stale/deleted sources and offer reconciliation.
4. Preserve an authenticated local-only option: disclose that the selected snapshot is sent for export processing without saving it to the account. Validate the payload and bind a short-lived snapshot/job to the authenticated owner. It cannot read a cloud document by a supplied ID. Drafts copied into cloud storage require explicit user choice.
5. Recheck session/ownership when retrieving an artifact, including retry, cached/job downloads, and expired sessions. Keep artifacts private and unguessable; default to streaming and no persistent artifact. Proposed temporary retention is at most one hour with verified cleanup, subject to chosen hosting behavior.
6. Move browser-created downloadable formats behind the same server policy. Remove unauthenticated helper calls and printable fallbacks. Account ZIP/JSON export also uses current authorization; recovery backup can export a validated local snapshot after reauthentication even if cloud saving failed.
7. A PDF 401/403 must show sign-in/access feedback, never fall through to `window.print()`. Renderer failures show retry and preserve the draft. App print opens a gated preview for the authorized snapshot.
8. Bound render time, memory, file size, concurrency, and cost. Restrict render network access and approved assets/fonts; sanitize uploaded images and escape user content. Pin the browser runtime and verify host compatibility. Logs contain IDs/timings/error categories, not resume bodies or download tokens.

Authorization must be enforced for every request, following the [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). A client modal, hidden button, watermark, or billing check is insufficient.

### Required authorization tests

Test every format and every UI entry point with: anonymous user, expired/revoked session, unverified account, verified free account, paid account, wrong owner, deleted document, stale revision, workspace/account switch, direct route request, and render failure. Assert no file body or fallback print on denied requests. Test guest → sign-in → resume export, cancelled sign-in, retries, recovery backup, cover-letter copy/print/download, and account-data export. No production mock-billing route may grant access.

## 7. Credible analyzer and AI assistance

### Four distinct results

| Result | Method | User sees |
| --- | --- | --- |
| File readability | Parse actual exported/imported PDF or DOCX and compare with expected content where available | Missing text, section order, broken characters, links, parser/version, file hash |
| Content quality | Fast deterministic rules, scoped by language and career stage | Specific writing/date/completeness findings with field links |
| Job requirement coverage | Structured job extraction plus candidate evidence matching | Required/preferred criteria, evidence, partial/uncertain matches, genuine gaps |
| AI coaching | Constrained semantic review and evidence-based edit proposals | Why a change helps, what supports it, and questions for missing facts |

Do not blend these into an unexplained universal ATS score. Replace existing fixed extraction scores and template “ATS Safe %” badges. A template may say “PDF extraction checked” only with a current test record and declared scope; an untested artifact says “Not checked.” Never describe a local serializer as emulating Workday, Taleo, Greenhouse, or iCIMS.

### Analysis pipeline and scoring contract

1. Validate file type/size, detect empty/scanned/unreadable input, and preview extracted text. OCR stays separately scoped until implemented. Record extraction failures without awarding a positive score.
2. Confirm target role, seniority, and analysis language with the candidate. Unsupported roles use a general review or pasted job; do not fall back silently to software engineering. Label a role rubric as curated guidance, not live market data.
3. Extract job criteria into a bounded schema: requirement ID, source quote/span, category, required/preferred/uncertain status, alternatives, and weight. Merge duplicate criteria and represent “AWS or Azure” as alternatives. Treat job text as untrusted data.
4. Match only candidate-confirmed evidence. Distinguish direct support, related/partial evidence, unknown, and absent. A skill list is weaker evidence of application than a supported project/role; related technology never proves a missing credential or skill.
5. Proposed transparent coverage formula: `100 × sum(weight × support) / sum(weight)`, with required weight 2, preferred weight 1, direct support 1, partial support 0.5, absent support 0. Show uncertainty separately; publish the exact rubric/version. These initial weights require validation, not marketing as an industry standard. Requirements with unclear meaning are flagged for review; no recognized criteria means “Not enough information,” not 0 or 100.
6. Present required and preferred coverage separately, with denominator and evidence per criterion. Do not let many preferred matches hide a missing mandatory credential. Keyword repetition and hidden/invisible text do not improve coverage.
7. Suggest at most a few high-value improvements at a time. “Add this skill” becomes “Confirm relevant experience” or “Show supporting experience.” Ask for impact evidence; qualitative outcomes are valid. Do not penalize career gaps, non-numeric work, names/photos, or unsupported languages.
8. Generate structured proposals through the existing server AI boundary; validate evidence, targets, revision, allowed operations, and limits. Require accept/reject, idempotent application, and undo. No candidate fact is invented to improve a score.
9. Store analysis tied to owner, document revision/hash, job hash, parser/rule/prompt/model versions, and time. Mark stale after relevant edits. Cache within the owner boundary; do not share personalized results between accounts.
10. If the AI provider is unavailable, show deterministic results and clearly state which AI analysis is unavailable. Fictional example generation is a separate demo feature, never an invisible fallback for a personal resume.

### Evaluation and release bar

Create a held-out benchmark of at least 120 consented/redacted or synthetic resume/job pairs across six initial role groups, several seniority levels, and career-transition/graduate cases. Use separate tuning and evaluation sets; two reviewers annotate disputed matches and resolve disagreements. Keep unsupported-role and non-English cases in the abstention set.

Proposed launch targets, to be validated against an initial baseline:

- At least 95% precision for assertions labeled directly supported; at least 90% recall on explicit must-have criteria. Report sample sizes and results by role; do not hide weak groups behind an aggregate.
- Zero unsupported employers, dates, degrees, credentials, or metrics accepted in the adversarial release suite. This is a test gate, not a guarantee of zero future model errors.
- 100% server schema validation, ownership checks, and revision checks; malicious instructions in job/resume data cannot change tools, authorization, or facts.
- Include negation (“no professional Java experience”), ambiguous acronyms, OR requirements, repeated keywords, hidden text, invented metrics, empty input, scanning failures, timeout/refusal, cross-user targets, and concurrent edits.
- Editing lint p95 under 100 ms for the supported document limit; deep AI review p95 under 30 seconds under the declared load, with timeout/cancel states and bounded per-user/global spending. Establish cost budgets using measured tokens before choosing production model settings.
- Human review: most recommendations must be useful, specific, and evidence-supported; proposed threshold is at least 80% rated useful by reviewers, with published rubric. Repeated unchanged input should retain stable deterministic scores; AI wording may vary.

Keep public `/grader` useful with inline basic findings and a clear next step. No report download or app print/copy without authentication. Require account and consent for paid-provider analysis; disclose actual transmission and retention. Avoid raw uploaded content in analytics.

## 8. Delivery roadmap and implementation boundaries

All milestones below are planned. Estimates are engineering working days for one experienced developer, assuming design/reviewer availability; they are not delivery commitments. Re-estimate after the first milestone. Work can overlap only after interfaces and ownership are clear.

| Milestone | Priority / estimate | Deliverables | Exit gate |
| --- | --- | --- | --- |
| Q0: Establish the baseline | P0 / 2–3 days | Install dependencies, run current checks, inventory exports, capture current UI/PDFs, remove unsupported claims and separate demo generation | Reproducible baseline; no release claims based only on historical checkboxes |
| Q1: My CVs, demo separation, authentication and export | P0 / 7–10 days | First deliver personal/device/demo separation, provenance migration and minimal dashboard; then central export policy, verification/recovery, session-expiry resume flow | Users can identify their own CVs; examples never clutter personal lists; every artifact passes auth/ownership checks; no print fallback bypass |
| Q2: Landing and product shell | P1 / 3–6 days | Public landing, routes, design tokens, dashboard polish, onboarding, responsive navigation, Google sign-in | Guest-to-draft-to-account journey preserves data; all CTAs resolve |
| Q3: Template and demo collection | P1 / 8–12 days | Polish eight then add four original designs, 12 starters, public gallery/detail pages, shared render contract | 48 baseline PDFs plus stress tests; editable DOCX checks; visual sign-off |
| Q4: Analyzer and evidence workflow | P0 quality / 10–15 days | Actual-file diagnostics, role confirmation, job requirements, grounded proposals, held-out evaluations | Targets met by supported role; uncertain/unsupported inputs abstain |
| Q5: Release and usability validation | P0 / 5–8 days | Live email/Turso/AI/render verification, performance/accessibility, restore drill, monitoring, pricing consistency | Zero critical authorization/data-loss defects; launch gates documented |

Total planning allowance: roughly 35–54 developer days before contingency, plus external review and operational setup. A small private pilot can use the polished first eight templates after Q0–Q2 and the applicable Q3/Q4 gates; broad marketing waits for Q5. Do not postpone authorization or factual-integrity fixes for visual polish.

### Code map for implementation

| Workstream | Existing starting points | Planned additions / change |
| --- | --- | --- |
| Public UI | `src/app/page.tsx`, `globals.css`, `layout.tsx` | Marketing/workspace route boundaries; shared UI tokens/components |
| Editor | `resume-studio.tsx`, `components/editor/*` | Export coordinator, start flow, dashboard, focused review pane |
| Templates | `presentation.ts`, `layout.ts`, `resume-preview.tsx`, `templates.css`, `design-panel.tsx` | Versioned template registry, fixtures, gallery/detail routes, unified render inputs |
| Demos and document identity | `demo-resumes.ts`, `DemoResumesModal.tsx`, `document.ts`, local/cloud repositories | Separate example library, purpose/provenance migration, My CVs filtering, safe legacy review and personal-start action |
| Authentication | `server/auth.ts`, `account-panel.tsx`, account/auth routes | Verification/recovery/OAuth, session UI, shared policy helpers |
| Exports | `api/resumes/export-pdf/route.ts`, `server/pdf-generator.ts`, `exporters/*`, `CoverLetterModal.tsx` | Authenticated export service, private artifacts, consistent failures |
| Analyzer | `linter/*`, `AtsReadinessPanel.tsx`, `grader/page.tsx` | Actual-file extraction, versioned rubrics/results, evaluation fixtures |
| AI integrity | `ai-proposals.ts`, `server/ai-service.ts`, `vault/ai-cv-generator.ts` | Evidence-only personal generation and clearly separated demos |
| Release | `tests/*`, `tests/e2e/*`, scripts and environment example | Authorization matrix, artifact checks, service smoke tests, operational runbook |

Before implementation, read relevant guides from the installed `node_modules/next/dist/docs/` as required by `AGENTS.md`; this planning change adds no application code. Reconcile any obsolete ATS/parser or generation advice in development skills when that work starts, keeping installed/distribution skill copies and ZIP entries synchronized.

## 9. Quality, operations, and success measures

- Run `npm run typecheck`, `npm test`, and `npm run build` for implementation changes; run `npm run test:e2e` for the affected editor/auth/export journeys. Existing tests that expect anonymous downloads must change to the new policy.
- Accessibility target: WCAG 2.2 AA for core journeys, verified through automation plus keyboard and screen-reader review. Check 360 px mobile, tablet, desktop, browser zoom, reduced motion, contrast, and modal focus.
- Performance targets under documented test conditions: landing LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at the 75th percentile; editing stays responsive with long resumes; PDF export p95 ≤10 seconds excluding a disclosed queue. Verify in field telemetry when traffic is sufficient. These are targets, not observed results.
- Test current supported Chrome, Firefox, Safari, iOS, and Android paths as appropriate. Test Unicode storage without marketing untested language-specific analysis or RTL typography.
- Select an application host compatible with the pinned render runtime; test Turso migrations, backups/restoration, HTTPS cookies, email delivery, and scoped secrets in staging before production.
- Add errors, latency, export success, queue health, and AI cost monitoring without content logging. Use shared quotas rather than per-process-only controls. Provide bounded retries, useful failure messages, and rollback switches.
- Proposed retention defaults: stream exports; expire temporary render artifacts within one hour; delete raw upload intermediates after processing; user-saved documents and analysis history persist until deletion. Verify provider/backup behavior, document exceptions, and avoid claims of zero retention until supported.
- Keep basic authenticated export available without a paid subscription. Final watermark/template/AI quotas are commercial decisions to test; clearly disclose them in advance. Do not promise unlimited lifetime AI without a cost model. Account data export is never paywalled.
- Track anonymous-to-draft, draft-to-authentication, authentication-to-export, time to first personalized export, export failure rate, recommendation acceptance/undo, and return usage. Collect event metadata only; do not capture form values, job text, or resumes.
- Run at least eight moderated first-use sessions spanning graduates, experienced candidates, career changers, and mobile use. Target at least 80% completing create/import → review → sign-in → export without intervention. Establish baseline conversion before setting growth promises.

## 10. Scope guardrails and decisions

Decided by this request: polished landing/UI, high-quality demo/template collection, credible analyzer, production authentication, and mandatory authentication for every app export. The first user-facing priority is separating My CVs, device-local drafts, and Demo examples so ownership is clear. Existing local drafts remain usable; mandatory export sign-in supersedes earlier anonymous-download plans.

Recommended defaults: improve the existing stack; eight polished templates first, 12 at launch; 12 fictional starters; email/password plus Google; public browsing/basic review; authenticated deep AI and exports; evidence-backed job coverage; no universal ATS score.

Resolve during implementation: final product name, exact brand assets, application host/email vendor, validated AI model/cost budget, free/premium entitlements, and launch language/role coverage. These do not block the plan. Decide providers from current official documentation and staging evidence.

Deferred: enterprise SSO/SCIM, recruiter collaboration, public resume sharing, job auto-apply, job-board scraping, OCR, arbitrary template drag-and-drop, live market-percentile claims, and unsupported ATS integrations. Public sharing must receive a separate access design; it cannot create an anonymous download loophole.

Planning verification: official competitor/reference pages reviewed; all 13 local images inspected; targeted code paths checked. This document does not certify the current UI, AI, export security, or live deployment. Execution checkboxes remain in `PLAN.md` and must be checked only after the corresponding acceptance evidence exists.
