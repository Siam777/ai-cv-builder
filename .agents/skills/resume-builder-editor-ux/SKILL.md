---
name: resume-builder-editor-ux
description: Architect and implement modern interactive resume editor UX, including decomposing the studio monolith, keyboard-driven bullet list editing, bidirectional preview-to-editor sync, and inline contextual AI action chips. Use for resume editor component refactoring and interactive UX workflows.
---

# Resume builder editor UX

Inspect the existing editor implementation ([resume-studio.tsx](file:///D:/utility-projects/ai-cv-builder/src/components/resume-studio.tsx)) and layout contracts before modifying UI components. Preserve existing keyboard shortcuts, accessibility semantics, and schema validation. Read [editor-architecture.md](references/editor-architecture.md) for detailed component boundaries, event contracts, and bidirectional synchronization mechanics.

## Monolith decomposition

Break the monolithic studio component into focused, single-responsibility subcomponents:
- `EditorHeader`: Manages document title, variant switching, local vs. cloud storage indicator, undo/redo triggers, and export actions.
- `EditorSidebar`: Sticky navigation rail providing continuous document overview, section reordering, section visibility toggles, and instant jump navigation.
- `SectionEditor`: Polymorphic container for section-specific forms (contact, summary, experience, education, skills, projects, certifications, custom sections).
- `BulletList`: Streamlined, keyboard-centric list editing engine for accomplishment bullets.
- `FieldAi`: The sparkle (AI) menu on a field (bullet, summary, skills) and the inline accept or reject view it opens. `AIPanel` is the single AI Assistant side panel (Help me finish, Match a job, Cover letter).

Ensure all child components communicate through explicit callbacks or a lightweight context. Do not pass uncontrolled setters that trigger global re-renders on every keystroke; debounce autosave and separate fast local typing state from document persistence.

## Keyboard-driven bullet editing

Editing accomplishment bullets must feel like writing in a document rather than filling database inputs:
1. Pressing `Enter` on a bullet creates a new bullet directly below and transfers focus immediately.
2. Pressing `Backspace` on an empty bullet removes it and returns focus to the preceding bullet.
3. `ArrowUp` and `ArrowDown` at the boundaries of a bullet smoothly move focus between adjacent bullets.
4. Drag-and-drop reordering handles must be paired with accessible keyboard reordering shortcuts (`Alt+ArrowUp` / `Alt+ArrowDown`).

## Bidirectional preview synchronization

Create a seamless feedback loop between the editor inputs and the live rendered preview ([resume-preview.tsx](file:///D:/utility-projects/ai-cv-builder/src/components/resume-preview.tsx)):
1. Tag every rendered block in the preview with semantic attributes: `data-section-id`, `data-entry-id`, and `data-bullet-id`.
2. Attach preview click listeners: Clicking any text element in the preview identifies its block ID, scrolls the editor canvas to the corresponding input, and highlights it with a temporary focus ring (`ring-2 ring-primary/60`).
3. Reverse synchronization: Focusing an input in the editor scrolls the preview stage to ensure the corresponding page and block are visible.

## Inline sparkle menu (FieldAi)

Replace multi-step modal dialogs for rewrites with an inline contextual assistant on each field. Offer each action only where it works, and show unavailable AI actions with the reason (needs an account, not configured) instead of hiding them:
1. When a user focuses or hovers on a bullet, show a floating action bar with quick chips:
   - `✨ Improve`: Strengthens phrasing and clarity while preserving verified facts.
   - `📊 Add Metric`: Prompts for quantifiable outcome using Google XYZ structure.
   - `🎯 Match Job`: Highlights relevant skills and keywords matching the target job description.
   - `📏 Make Concise`: Trims wordiness to fit page budget.
2. Render an inline before/after diff directly beneath the active bullet (red strikethrough for removals, green highlight for additions).
3. Provide keyboard confirmation without trapping focus: focus moves to the Accept button when the diff appears (`Enter` accepts) and `Esc` keeps the original wording. Do not override `Tab`, so the Try again and Keep mine buttons stay reachable.
4. Maintain strict anti-hallucination verification: The inline assistant must pass proposed diffs through the verification contract ([ai-proposals.ts](file:///D:/utility-projects/ai-cv-builder/src/lib/ai-proposals.ts)) before showing the diff to the user.

## Verification and testing

Validate all editor UX changes with automated tests:
- Unit test keyboard navigation: `Enter` appends bullet, `Backspace` deletes empty bullet, boundary arrow navigation.
- Component test bidirectional sync: Clicking preview element triggers scroll and focus in editor.
- Performance test typing responsiveness: Rapid typing in a bullet must not cause lag or dropped frames on the preview stage.
- End-to-end tests: Verify undo/redo restores bullet state, inline AI diff acceptance updates the document revision, and autosave transitions cleanly between `saving`, `saved`, and `error` states.

## AI review patterns in this app (2026-10)

- Unavailable AI is shown with its reason and the one step that fixes it (`AiBlocked`: sign in, copy to account) and a one-time consent card (`AiConsent`); do not hide AI actions or re-ask consent per request.
- Built-in helpers and AI are labelled apart in the sparkle menu ("AI writing help" and "Quick (no AI)").
- Multi-item AI results (Write with AI bullets, Improve all, interview steps, skills) use one review list with unticked items, quoted evidence, withheld reasons and questions, and a single accept that is one Undo step.
- Examples with blanks use fill-in-the-blanks editing (`BlankFiller`): an inline field per blank, remove a blank, a progress line, and "Edit the whole sentence"; adding stays disabled until no blank is left.
- AI flows that walk several steps (the interview) replace the step form while the preview fills in live; every step can be skipped.
