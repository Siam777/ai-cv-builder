# Editor usability review — 2026-10-11

This review addresses the user's screenshots and reported difficulty with photos, bullet writing, summaries, starting a CV, reviews and overflowing panels. It is a local implementation slice within the existing release scope, not a claim that all usability or launch gates are complete.

## Problems and delivered changes

| Problem | Result |
| --- | --- |
| Photo control is hard to find; uploaded photos can remain disabled in the design | Direct **Add photo** action, explicit upload/change/remove controls, recoverable format/size/decode errors, resized image and automatic visibility. Unsupported designs offer **Use Modern design with photo**. Word and text exports clearly omit photos. |
| Bullet field collapses into a narrow strip | Full-width, readable, stretch-aligned bullet input with a simple prompt. |
| Inline actions do not clearly identify the source or application step | **Improve this bullet** opens the selected bullet in Writing help. Clearer/shorter instructions lead to the existing consent, original/proposed comparison and explicit acceptance workflow. Local drafts receive an actionable account explanation. |
| Writing panel grows beyond the page; users cannot reach its modes or close it | Bounded dialog with an independently scrolling body, sticky tabs, persistent Done button, focus containment and Escape. A pending generation can be closed without applying a change or retaining the body lock. Late preparation cannot initiate a new request after closing. |
| Summary and impact controls look like automatic AI output | Modes state which helpers run locally. Summary options reuse visible CV facts and keep whole outcome statements; blank CVs abstain. Users review/edit/confirm before replacing Profile. Impact questions appear one at a time and use the user's own result, with a preview and confirmation before replacement. Inline impact actions retain their exact bullet context, including bullets beyond the original six-question limit. Clickable invented-number examples were removed. |
| Starting from a blank screen is difficult | **Help me start** collects an introduction and one real job/project/course, then reviews the exact facts before saving in the current workspace. It preserves entered details on save failure and uses the chosen design. |
| Reviewer presents complicated analysis before giving a useful next step | **Check your CV** starts with Writing findings. Role checklist, Document text view and File diagnostics remain explicit separate modes. |
| Job comparison is dense and narrow on mobile | Three plain steps, full-width labels/inputs, collapsed technical detail, separate evidence meanings and a persistent footer explaining the missing prerequisite. AI coaching still requires separate consent. |
| Preview work runs during every keystroke | Pagination measurement is debounced, retaining font-ready measurement and cleanup. This reduces repeated layout work; it is not a measured production performance guarantee. |
| Account panel can also overflow the editor | Shared scrollable account dialog with focus containment and a persistent return action. |

## Turso

The private remote URL/token connected successfully. A read-only initial schema inspection showed an empty database. `npm run db:setup` applied migrations 001–005 successfully, establishing account, CV, AI, evidence/subscription and job-review history storage. No local account/CV records were copied or inspected. Existing device drafts remain in their browser storage. Restarting the app loads the newly configured database.

This establishes connectivity and migration execution, not hosted deployment, backup restoration, multi-instance load or account migration readiness.

## Verification

- Required typecheck, production build and all **120 unit tests** passed. The unit PDF checks used the installed Chromium; an initial sandbox invocation could not locate it, and the configured invocation passed.
- **51 distinct affected browser scenarios** passed across the affected suite and targeted reruns: editor, analyzer, focus/dialogs, bullet acceptance/rejection/Undo, local summary/impact/skills, job evidence/coaching and six new usability checks. Two configured coaching cases were explicitly rerun with an isolated synthetic provider and passed; no paid model call or real CV was used.
- New checks cover guided draft persistence, invalid/valid/removable photos, supported photo presentation, full-width bullet fields, selected bullet routing, scroll/close/re-edit at 360 and 1440 pixels, closing a pending request, default Writing findings and mobile job inputs.
- Existing tests that assumed the analyzer opened on Role checklist now explicitly select that mode. Other failed first-run assertions were scoped to the intended alert/control and passed on rerun.
- Visual review: [mobile writing dialog](usability/writing-360.png), [desktop writing dialog](usability/writing-1440.png), [mobile job comparison](usability/job-mobile.png). These captures contain synthetic test content.

## Remaining limits

Full AI CV generation from scratch is still planned. The delivered start wizard collects facts locally; account AI rewrites existing bullets after consent. Summary drafting and impact assembly are local helpers, not live model generation. Shared vault/chat orchestration remains planned.

The reported overflow and narrow-input problems are reproduced and corrected. Human first-use testing, assistive-technology review and performance/load validation remain open; this review does not establish that every possible hang is fixed.

The screenshots also show unusual imported role/company fragments. Without the original import file, their source cannot be reconstructed reliably. Import review still asks users to check the mapping against their file before saving.

Live email/OAuth, hosted deployment/restore, independent AI semantic review and the 120-pair held-out benchmark remain open. This work does not complete Q4/Q5 or change feature scope or skill instructions.
