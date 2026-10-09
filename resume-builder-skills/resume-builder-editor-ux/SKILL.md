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
- `InlineAiMagicBar`: Floating contextual popover directly on active bullets for instant rewrites.

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

## Inline contextual magic bar

Replace multi-step modal dialogs for bullet rewrites with an inline contextual assistant:
1. When a user focuses or hovers on a bullet, show a floating action bar with quick chips:
   - `✨ Improve`: Strengthens phrasing and clarity while preserving verified facts.
   - `📊 Add Metric`: Prompts for quantifiable outcome using Google XYZ structure.
   - `🎯 Match Job`: Highlights relevant skills and keywords matching the target job description.
   - `📏 Make Concise`: Trims wordiness to fit page budget.
2. Render an inline before/after diff directly beneath the active bullet (red strikethrough for removals, green highlight for additions).
3. Provide single-keystroke confirmation: `Tab` to accept changes, `Esc` to dismiss.
4. Maintain strict anti-hallucination verification: The inline assistant must pass proposed diffs through the verification contract ([ai-proposals.ts](file:///D:/utility-projects/ai-cv-builder/src/lib/ai-proposals.ts)) before showing the diff to the user.

## Verification and testing

Validate all editor UX changes with automated tests:
- Unit test keyboard navigation: `Enter` appends bullet, `Backspace` deletes empty bullet, boundary arrow navigation.
- Component test bidirectional sync: Clicking preview element triggers scroll and focus in editor.
- Performance test typing responsiveness: Rapid typing in a bullet must not cause lag or dropped frames on the preview stage.
- End-to-end tests: Verify undo/redo restores bullet state, inline AI diff acceptance updates the document revision, and autosave transitions cleanly between `saving`, `saved`, and `error` states.
