# Modern editor architecture and bidirectional sync

## Component hierarchy and contracts

To prevent monolithic state bloat in the resume studio, organize the editor into decoupled components:

```text
ResumeStudio (Container & Coordination)
├── EditorHeader (Meta, Storage, Undo/Redo, Export triggers)
├── EditorLayout (Two-column responsive stage)
│   ├── EditorSidebar (Sticky rail, section outline, reordering)
│   └── EditorCanvas (Continuous scrollable form inputs)
│       └── SectionEditor (Dispatches per section type)
│           ├── ContactSectionEditor
│           ├── SummarySectionEditor
│           ├── ExperienceSectionEditor
│           │   └── BulletList (Keyboard-driven list editor)
│           │       └── InlineAiMagicBar (Contextual diff popover)
│           └── CustomSectionEditor
└── PreviewStage (Render container, zoom controls, pagination)
    └── ResumePreview (Multi-page DOM renderer with data-block-id)
```

### State isolation principles

1. **Local vs. Canonical Document State**:
   - Keep keystroke-level text state local to input components during active editing to avoid blocking the main thread or causing layout recalculations on every character.
   - Flush local edits to the canonical document state on `blur`, debounce timers (e.g. 300ms), or delimiter keys (`Enter`).
2. **Undo/Redo Stack**:
   - Push snapshots to the undo stack only on discrete user actions (adding a bullet, removing a bullet, accepting an AI proposal, or finishing a debounce cycle).
   - Never push an undo state for every individual keystroke.
3. **Autosave Coordination**:
   - Provide an explicit state machine: `idle` -> `dirty` -> `saving` -> `saved` | `error`.
   - Reconcile incoming server revisions optimistically, warning if a concurrent modification occurs.

---

## Bidirectional preview synchronization protocol

Bidirectional sync allows users to seamlessly navigate between the rendered preview document and the underlying form inputs.

### DOM element identification

Rendered blocks in [resume-preview.tsx](file:///D:/utility-projects/ai-cv-builder/src/components/resume-preview.tsx) must expose standard data attributes:

```html
<div
  class="resume-block"
  data-block-id="experience-entry-1-bullet-2"
  data-section-id="experience"
  data-entry-id="exp-1"
  data-bullet-id="bullet-2"
  tabindex="0"
  role="button"
  aria-label="Click to edit bullet"
>
  Led development of high-throughput payment pipeline...
</div>
```

### Preview-to-editor interaction

1. Add click and `Enter` key listeners on preview blocks:
   ```typescript
   function handlePreviewBlockClick(event: React.MouseEvent<HTMLElement>) {
     const target = (event.target as HTMLElement).closest('[data-block-id]');
     if (!target) return;
     const sectionId = target.getAttribute('data-section-id');
     const entryId = target.getAttribute('data-entry-id');
     const bulletId = target.getAttribute('data-bullet-id');

     dispatchEditorFocus({ sectionId, entryId, bulletId });
   }
   ```
2. The editor listens for focus events, scrolls the target input smoothly into view (`element.scrollIntoView({ behavior: 'smooth', block: 'center' })`), and applies an accessible highlight ring (`ring-2 ring-primary/60 outline-none animate-pulse-short`).

### Editor-to-preview interaction

When an input in the editor gains focus:
1. Lookup the corresponding element in the preview DOM: `stage.querySelector(`[data-bullet-id="${bulletId}"]`)`.
2. If found, ensure the enclosing page is visible on the preview canvas and briefly highlight the rendered text with a subtle background glow.

---

## Streamlined BulletList component contract

### Keyboard interactions specification

| Key Event | Condition | Expected Behavior |
| :--- | :--- | :--- |
| `Enter` | Caret anywhere in bullet | Inserts a new bullet below. If cursor is mid-text, splits text cleanly; if cursor is at end, creates empty bullet and moves focus. |
| `Backspace` | Bullet is completely empty | Deletes current bullet, moves focus to the end of the previous bullet. |
| `Backspace` | Caret at position 0 with text | Merges text into preceding bullet (or preserves bullet based on UX preference). |
| `ArrowUp` | Caret at line 0, position 0 | Moves focus to the previous bullet, placing caret at the end. |
| `ArrowDown` | Caret at final line, end | Moves focus to the next bullet, placing caret at start. |
| `Alt + ArrowUp` | Bullet has focus | Swaps current bullet with the one above; preserves focus. |
| `Alt + ArrowDown`| Bullet has focus | Swaps current bullet with the one below; preserves focus. |

### Drag-and-drop mechanics

- Provide a vertical drag handle (`⋮⋮`) visible on hover or keyboard focus.
- Use accessible HTML5 drag-and-drop or lightweight pointer events.
- Set `aria-grabbed` and update live region announcements for assistive technologies when items are reordered.

---

## Inline AI Magic Bar specification

### Positioning and trigger

- Render an unobtrusive floating chip bar directly above or below the focused bullet input.
- Show options:
  - `✨ Improve`: Requests syntactic enhancement and stronger phrasing without adding new facts.
  - `📊 Add Metric`: Prompts for Google XYZ quantitative impact.
  - `🎯 Match Job`: Highlights keywords aligned with active target job.
  - `📏 Make Concise`: Trims character count to fit page limits.

### Inline diff visualization

Display the proposed replacement directly underneath the active input in an inline container:
- Deletions highlighted in red with strikethrough: `<del class="bg-red-500/20 text-red-700 line-through">assisted with</del>`
- Additions highlighted in green: `<ins class="bg-emerald-500/20 text-emerald-700 no-underline font-medium">Engineered</ins>`
- Keystroke actions:
  - `Tab` or `Enter`: Accepts proposal, replaces text in document, increments revision, closes popover.
  - `Esc`: Dismisses proposal immediately without modifying document.
