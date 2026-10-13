# UX Redesign Plan — "Simple enough for anyone"

Status: **Phases 0–1 delivered** (2026-10-13); Phases 2–6 planned. See PLAN.md §37 for what shipped.

Goal: someone with no experience should be able to open the app and finish a good CV without wondering where to click. The editor should feel like Resume.io or FlowCV: form on the left, live CV on the right, and one obvious AI helper. It should keep this app's strengths, which are evidence-grounded AI, honest checks and local-first privacy.

---

## 1. What is broken today (audit, 2026-10-13)

Each item gives the symptom the user reported, the root cause found in the code, and the fix direction.

### 1.1 Layout and alignment (user issue 1)

| Symptom | Root cause | Fix |
|---|---|---|
| The four cards (Add or change photo / Writing help / Check my CV / Compare with a job) are wider than the toolbar above and the editor below. | `.document-toolbar` uses `margin: 0 4%` (`globals.css:194`), but `.editor-taskbar` has no horizontal margin (`usability.css:2`). Each block sets its own width. | Use one page container (`--page-max`, `--page-gutter`) for every block, and remove per-block margins. |
| The page has five stacked header layers before you reach the form: app header, title + "Your details, your wording", context line, toolbar, task cards and "Show start guide". | Features were added as new strips over time instead of being merged. | Use one header and one editor toolbar (see §3.2). |
| The CV name appears in three places: the H1, the "Resume" dropdown and the "Resume name" field. | Each part of the screen got its own copy. | Make the CV name an inline-editable title, and turn the CV switcher into a menu under the title. |
| The ⌨️ shortcut button shows as an empty grey square on Windows (screenshot 1). | Emoji are used as icons (⌨️ ⭐ 🎨 🎯 📷). | Replace them with one SVG icon set (`lucide-react`) and add text labels. |
| Small type such as "Page size", "93%" and "Brand ✓" is hard to read. Section labels use letter-spaced micro caps. | Many one-off font sizes across 5 CSS files. | Use a type scale with a 13px minimum for UI text. |
| Styles are hard to keep consistent. | `globals.css` is 4,636 lines, `editor-polish.css` and `usability.css` override it, and there are 40 `!important` rules. | Add a design-token layer and consolidate styles by component (Phase 0). |

### 1.2 The photo does not appear on the CV (user issue 2) — **bug**

- **Root cause:** `layoutBlocks()` (`src/lib/layout.ts:38-44`) silently drops the photo when the current template has `photoSupported: false`. The screenshot uses **Brand** (`bold`), which does not support photos. Classic, Compact, Tech, Executive, Consulting, Brand and Research all drop photos (7 of 12 templates).
- **Why it misleads:** `PhotoUploader` still says "Photo added. Use Preview resume to check your design.", even though the preview will never show it.
- **Fix:**
  1. The uploader checks the current template. If the template does not support photos, it shows an inline warning: "Your current design (Brand) doesn't show photos." It offers two buttons, **Switch to a photo design** (opens the design picker filtered to photo designs) and **Keep design without photo**.
  2. The design picker shows a "Photo" badge and has a "Supports photo" filter.
  3. Longer term: add a header photo slot to Brand, Executive and Consulting so that most designs can show a photo. ATS-first designs (Classic, Compact, Research) stay photo-free, and the UI says so.
  4. Add a unit test for `layoutBlocks` with a photo on an unsupported template, plus an E2E test for the warning.

### 1.3 "Check my CV" review is messy and "Review in editor" is confusing (user issue 3)

| Symptom | Root cause | Fix |
|---|---|---|
| A large modal covers the CV. | `AtsReadinessPanel` is a centred modal dialog. | Replace it with a **docked right-side panel** that swaps with the preview. The CV stays visible. |
| Clicking "Review in editor" closes the list and you lose your place. | `onNavigateToIssue` calls `setShowAts(false)` (`resume-studio.tsx:1297`). | The panel stays open. The editor scrolls to the field and highlights it. Each finding gets **Fix**, **Next issue** and **Dismiss** controls. Findings clear live as you type. |
| The summary shows meaningless numbers on a new CV: "Vague openings 0/0", "Numeric patterns 0/0", "Contact fields 1/3". | Raw linter counters are shown as metrics. | Replace them with one plain **CV strength** meter (0–100%, labelled as content completeness, not a hiring score) and a short checklist: *Contact ✓ · Summary ✗ · 2 jobs ✓ · Results in bullets 3/8*. |
| Four tabs in an unclear order: Role checklist, Writing findings, Document text view, File diagnostics. | Expert tools are shown to everyone. | Show **To fix** (default, grouped by CV section) and **Compare with a role**. Move *How a recruiter's system reads your file* (text view + file diagnostics) under "Advanced". |
| A long instructional paragraph sits above the content. | Copy-heavy UI. | Use one short sentence, and put help behind an (i) tooltip. |
| Each finding row has the button squeezed next to long text. | Row layout. | Use a severity icon, a one-line title, a muted explanation and the action on the right. On mobile the action wraps below. |

### 1.4 Sign-in / account confusion — "signed in but it wants me to sign in again" (user issue 4) — **bug cluster**

Screenshot 3 shows the user signed in as siamriaz802@gmail.com, but the editor shows **"Local workspace"**, **"On this device · not saved to an account"** and **"Sign in to export"**.

Root causes:
1. **Sticky device mode.** `resume-studio.tsx:229` loads the account workspace only when `sessionStorage["cv-workspace"] !== "device"`. If the user ever clicked "Open local workspace", the tab stays local even after sign-in. Nothing in the UI explains this.
2. **Export requires email verification, but email delivery is not configured.** `performExport` sends unverified users back to the Account dialog (`resume-studio.tsx:820`). That dialog says "Email delivery is not configured on this installation" and the Send button is disabled. This is a **dead end**: the user cannot export at all, and it looks like a request to sign in again.
3. **Two workspace concepts** ("Local workspace" vs "Account workspace", "Open account workspace", "Review local resumes for import") are developer ideas shown to end users.
4. **The avatar shows the CV's name initial** ("A" for Alex Morgan), not the signed-in user's initial (`EditorHeader.tsx:147`).
5. The Account dialog mixes workspace switching, sign-in methods, verification, data export, password and deletion in one long scroll.

Fix:
- **One identity state.** When you are signed in, you are in your account, always. Local CVs found at sign-in trigger a single banner: "You have 2 CVs saved in this browser. **Move them to your account**." Remove the local/account workspace toggle from the main UI.
- **Verification:** Google sign-ins count as verified. If email delivery is unconfigured, do not gate exports on verification. Log a warning for the installation owner instead. When gating does apply, show it inline in the Download menu ("Verify your email to download — **Resend link**"), not by opening the Account dialog.
- Replace the status text with one save indicator: "Saved to your account ✓" or "Saved in this browser · **Sign in to back up**".
- Make the avatar a real **account menu**: name, email, My CVs, Account settings, Billing, Help, Sign out.
- Split Account settings into a page (`/profile`) with tabs: *Profile · Sign-in & security · Data & privacy · Billing*. Destructive actions go in their own "Danger zone" card.

### 1.5 Hard-to-understand UX and AI entry points (user issue 5)

The same jobs have too many names and doors:

| Job | Current entry points |
|---|---|
| Review the CV | Header "Review writing", task card "Check my CV", nav "Resume review" (goes to the public `/grader` page) |
| AI writing | Header "Review writing", task card "Writing help", More tools → Writing tools, the inline magic bar, the XYZ coach, the AI CV generator |
| Job tailoring | Task card "Compare with a job", More tools → Tailor, Cover letter |
| CV library | "On this device" nav, the Resume dropdown, More tools → Manage CV |

Labels such as *On this device*, *Local workspace*, *Personal CV*, *Practice / fictional content*, *Evidence*, *Role checklist* and *File diagnostics* are internal language.

Fix: map every job to **one named place** (see §3), and use plain words.

### 1.6 Branding (user issue 6)

- Add **"Developed by Elfasys Solution"** to the editor footer (`resume-studio.tsx:1840`), the public footer (`PublicShell.tsx:70`), the About section of `/help`, and the HTML `<meta name="author">`.
- It is **not** added to exported CVs. Those are the user's documents and go to recruiters.

### 1.7 Other anomalies found during the audit

- The editor footer reads "Local editor · AI suggestions require your review", and the public footer reads "Sign in and verify your email to export". Both are developer-facing copy.
- The header has a "Review writing" button **and** an "Account" button **and** an avatar **and** a workspace badge, all doing different things.
- In the preview header, "Brand ✓" next to **Change style** is unclear. Show "Design: Brand · Change".
- On a blank CV the start guide is collapsed ("Show start guide") while four task cards are shown. The guidance a new user most needs is hidden.

---

## 2. What the best builders do (benchmark)

| Pattern | Seen in | Adopt? |
|---|---|---|
| Two-pane editor: form left, live A4 preview right, with step navigation | Resume.io, FlowCV, Zety | Yes. Keep the current split, but remove the clutter above it. |
| A **profile completeness %** that tells you the next step ("+10% Add a summary") | Resume.io | Yes. This becomes the "CV strength" meter. |
| Paste a job and see the missing keywords | Teal, Rezi | Yes. We already have this; make it one tab of the AI Assistant. |
| Real-time content checks for weak verbs, clichés and missing numbers, inline as you type | Enhancv, Rezi | Yes. Use our deterministic linter, shown inline on the field. |
| A per-field **✨ AI** button, with the original kept and a diff to accept or reject | Kickresume, Rezi, Teal | Yes. This is the main AI surface. |
| Start choices: Upload CV / LinkedIn / Scratch / AI draft | Kickresume, Enhancv | Yes, as the first screen for a new CV. |
| Design picker as a visual grid with filters (Photo, ATS-friendly, Columns) | Resume.io, Novoresume | Yes. |
| One primary **Download** button; other formats in a menu | All of them | Yes. |

Reviewers' common criticism of AI writers is generic output ([Kickresume review](https://dupple.com/learn/best-ai-resume-builders)). Our evidence-grounded proposals are the differentiator, so the redesign keeps the accept/reject diff.

Sources: [dupple.com — Best AI resume builders 2026](https://dupple.com/learn/best-ai-resume-builders), [skillscouter.com](https://skillscouter.com/best-ai-resume-builders/), [indiehackers — 10 resume builders 2026](https://indiehackers.com/post/best-resume-builders-of-2026-the-10-tools-worth-using-this-year-093f81e5f2), [rapidevelopers — AI resume builder patterns](https://www.rapidevelopers.com/md/app-features/ai-based-resume-builder). Verify against hands-on trials of Resume.io, FlowCV and Teal before Phase 2.

---

## 3. Target experience

### 3.1 Information architecture — one job, one place

| Job | The one place | Name in UI |
|---|---|---|
| See / switch / create CVs | `/builder` library | **My CVs** |
| Fill in the CV | Editor, left pane, steps | Contact · Summary · Experience · … |
| Get AI help writing | ✨ button on each field + **AI Assistant** side panel | **AI Assistant** |
| Find problems | **Check** side panel + strength meter | **Check my CV** |
| Tailor to a job | AI Assistant → "Match a job" tab | **Match a job** |
| Change look | **Design** side panel (templates, colour, font, spacing, photo) | **Design** |
| Download | Primary button | **Download** (PDF default ▾ Word, Text, Print) |
| Account, billing, help | Avatar menu | — |
| Public CV checker (marketing) | Public site only, not in the editor nav | **Free CV check** |

### 3.2 Editor layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [CV] AI CV Builder   My CVs  Templates  Pricing        [Upgrade] (S)▾│  app header
├──────────────────────────────────────────────────────────────────────┤
│ ✎ Untitled resume ▾   Saved ✓        ↶ ↷  [Design] [Check 72%] [✨ AI] [Download ▾] │
├───────────┬───────────────────────────────┬──────────────────────────┤
│ STEPS     │ Contact details               │  Live preview (A4)       │
│ ● Contact │  [photo] Name  Headline       │   ─ or ─                 │
│ ○ Summary │  Email  Phone  Location       │  Side panel: Design /    │
│ ○ Work    │  ✨ Improve   ⚠ inline hints   │  Check / AI Assistant    │
│ ○ Educ.   │                               │  (replaces preview,      │
│ ○ Skills  │ [ Back ]          [ Next: Summary → ] │   × returns to it)  │
│ + Section │                               │                          │
│ ─────     │                               │                          │
│ CV strength 72% │                         │                          │
│ Next: add a summary (+10%) │              │                          │
└───────────┴───────────────────────────────┴──────────────────────────┘
                                     Developed by Elfasys Solution
```

Rules:
- Max **two rows of chrome** above the work area. The task-card strip, the context line, the "Your details, your wording" subheading and the separate start-guide bar are removed. Their jobs move into the steps rail and the strength meter.
- Side panels (Design, Check, AI) **replace the preview pane** and never cover the form. On mobile they become bottom sheets.
- **Back / Next** buttons on every step, so a beginner can go straight through.
- Steps show a status dot: empty / in progress / done / has issues.

### 3.3 New-CV start screen

Four large choices: **Upload my CV** (PDF/DOCX) · **Import from LinkedIn** · **Start from scratch** · **Let AI draft from my job title**. Below them: "Or try an example" (fictional demos). This replaces the current cold-start importer, guided start modal and demo modal, which become one flow.

### 3.4 AI Assistant (one door)

- **Per-field ✨ button** on summary, each bullet and skills. It offers *Improve wording · Add a result (XYZ) · Shorten · Fix grammar*. The result appears as an inline diff with **Accept / Try again / Keep mine**.
- The **AI Assistant panel** has three tabs:
  1. **Help me finish**: a guided chat-like list of what's missing ("Your Experience bullets have no numbers — want help adding a result to *Led migration…*?"). Each item jumps to the field and opens the ✨ action.
  2. **Match a job**: paste a posting, see matched / missing items, and get suggested edits backed by evidence.
  3. **Cover letter**.
- Remove "Review writing" from the header, remove the "Writing tools" group from More tools, and remove the separate XYZ coach entry. The XYZ coach becomes the "Add a result" action.
- Locked AI features for free users show a lock and one line of explanation. They are never hidden.

### 3.5 Visual design system

- **Tokens:** colour (brand green, neutral greys, semantic success/warn/error/info), spacing on a 4px scale, radius (8/12), shadow (2 levels), and type scale (13/14/16/20/28/36). Light mode first, with a dark-mode-ready token layer.
- **Fonts:** keep Source Sans 3 for UI and Source Serif 4 for display. Drop the letter-spaced micro labels.
- **Buttons:** one primary per view (Download, or Next inside the form). Use secondary, ghost and danger styles only.
- **Icons:** `lucide-react`, always with a visible label or `aria-label`. No emoji in the chrome.
- **Accessibility:** contrast ≥ 4.5:1, visible focus rings, 44px touch targets, and side panels that trap focus only on mobile.

---

## 4. Delivery phases

Each phase ships on its own with `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` passing.

### Phase 0 — Bug fixes that unblock users (small, do first)
1. Photo: show the unsupported-template warning and a "Switch to a photo design" action, and fix the misleading "Photo added" text (§1.2).
2. Account: auto-use the account workspace when signed in, and drop the sticky `cv-workspace=device` behaviour (or show it visibly with a one-click exit) (§1.4.1).
3. Export: do not require verification when email delivery is unconfigured, and treat Google sign-ins as verified (§1.4.2). *Delivered for unconfigured email only. Google sign-ins keep Google's own `email_verified` claim and are not verified unconditionally.*
4. Avatar shows the user's initial, and the status line shows one save indicator.
5. Footer credit "Developed by Elfasys Solution" in the editor and public footers.
6. Align the toolbar, task cards and editor to one container width.

Acceptance: a signed-in user with no email service can download a PDF. A photo on Brand shows the warning. Uploading a photo on Modern shows it in the preview. E2E tests cover all three.

### Phase 1 — Design tokens and CSS consolidation
- Add `src/app/tokens.css`, and migrate `globals.css`, `editor-polish.css` and `usability.css` into per-area files that use the tokens. Target 0 `!important` outside print rules.
- Add `lucide-react` and replace emoji icons.
- Run visual regression screenshots (Playwright) at 360 / 768 / 1440 widths for the library, editor, design panel and check panel.

### Phase 2 — Editor shell and navigation
- New header with an avatar menu, plus a single editor toolbar (inline CV title, undo/redo, Design, Check, AI, Download).
- Remove the task-card strip, the context line and the separate start-guide bar.
- Steps rail with status dots, the CV strength meter and the "next best step". Back/Next on each step.
- Side-panel framework: Design, Check and AI replace the preview, and become bottom sheets on mobile.

### Phase 3 — Check my CV redesign
- Docked panel, grouped by section, with live updates. Fix, Next issue and Dismiss controls. The panel stays open while editing.
- Strength meter replaces the 0/0 counters. Text view and file diagnostics move under "Advanced".
- Inline field hints (weak verb, no number, too long) that use the same linter.

### Phase 4 — AI Assistant consolidation
- Per-field ✨ menu with an inline diff to accept or reject.
- AI panel with Help me finish / Match a job / Cover letter. Retire the duplicate entry points listed in §1.5.
- Locked-feature states for the free plan.

### Phase 5 — Start flow, design picker, account pages
- Unified new-CV start screen (§3.3).
- Design picker grid with Photo / ATS / Columns filters and a live thumbnail. Add photo slots to Brand, Executive and Consulting.
- `/profile` becomes tabbed account settings. A one-time "Move browser CVs to your account" banner replaces the workspace UI.

### Phase 6 — Usability validation
- Five-task test with three non-technical users: create a CV from scratch, add a photo, fix two issues, tailor to a job, download a PDF. Target: each task done without help in under 3 minutes, and no "where do I go?" moments.
- Record the findings in `docs/plans/usability/`.

---

## 5. Out of scope / unchanged
- The resume document model, exporters and evidence rules for AI proposals stay the same. Only their UI changes.
- Pricing tiers and Stripe flows stay the same. Only the locked-state presentation changes.
- No branding in exported CVs.
