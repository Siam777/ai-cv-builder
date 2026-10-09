---
name: resume-builder-templates
description: Build resume template systems, live paginated previews, and PDF, DOCX, HTML, text, Markdown, and JSON exports. Use for resume-builder rendering code and template quality checks.
---

# Resume templates and exports

Separate the canonical document from rendering. A template defines typography, spacing, column layout, and section treatments; it must not own or silently rewrite resume facts. Template switching preserves content, order, and visibility preferences. Read [rendering-checks.md](references/rendering-checks.md) when building exports or investigating pagination.

Begin with distinct practical options: Classic (single column), Modern (restrained typography), Compact (denser single column), and Creative (optional sidebar). Describe the single-column option as designed for simple text extraction; do not guarantee acceptance by all ATS products. Sidebar templates need explicit reading-order verification and must be validated via the ATS Plain-Text Diagnostic tab (see `resume-builder-ats-linter`).

Use bounded design tokens for accent color, font family, font size, line height, margins, and density. Provide A4 and Letter page sizes. Do not shrink text indefinitely to force one page. Treat longer CVs as valid. Preserve selectable text, visible headings, semantic contact links, and readable contrast.

Tag rendered elements with `data-block-id`, `data-section-id`, and `data-bullet-id` attributes to enable bidirectional synchronization between the preview stage and editor form fields (see `resume-builder-editor-ux`).

For a prototype, browser print may suffice if limitations are visible. For consistent hosted exports, use an isolated server renderer with controlled fonts and browser versions and a queue when traffic requires it. Use the same layout inputs for preview and export. Support conditional watermark rendering in print and PDF exports when accounts lack premium export entitlements (see `resume-builder-monetization`). Generate DOCX from structured data rather than converting a screenshot or PDF.

Escape user content in HTML and disable arbitrary scripts and remote asset loading in render jobs. Restrict fonts and image sources to approved assets. Treat uploaded assets and URLs as untrusted; protect the renderer against unauthorized network access. Authorize export downloads and expire hosted artifacts according to the product's retention policy.

Render representative content and inspect exported pages as well as extracted text. Report what was actually verified; no generic ATS compatibility badge based only on visual appearance.

