---
name: resume-builder-product
description: Build or extend a CV/resume builder application, including its data model, editor, imports, versioning, and feature planning. Use for resume software development, not for writing an individual resume.
---

# Resume builder product

Inspect the repository and the requested feature before choosing an implementation. Preserve the existing stack. For a greenfield project, propose Next.js and TypeScript as a starting option; add a database, queue, object storage, or enterprise identity only when the requested scope needs them. Do not build an entire SaaS platform for a narrow feature request.

Read [data-and-imports.md](references/data-and-imports.md) for document modeling, persistence, import, or chatbot mutation work. Separate candidate facts, per-resume content, presentation settings, and AI proposals. One resume variant must not silently modify another.

Build a usable vertical slice first: enter history, select a template, edit a resume, save it, and export readable text and PDF. Support stable item IDs, named variants, section reordering, undo, and explicit save/error states. Resume content must survive template changes.

Treat the supplied R&D as a wishlist, not proof that features already exist. Verify current official provider documentation when implementing LinkedIn access, model APIs, taxonomy licensing, or integrations. Do not hardcode partner approval timelines, guarantee complete LinkedIn exports, or advertise legal compliance based on the R&D. A LinkedIn URL alone is not an import implementation.

For local imports, parse supported user-provided files without network transfer. If AI parsing sends text to a provider, show that distinction in the product before the user starts it. Keep credentials server-side. Document the actual storage and retention behavior; do not claim browser-only processing if telemetry, uploads, or AI requests include source text.

For hosted accounts, enforce document ownership on every read, write, export, and AI request. Add tenant isolation when organizations exist. Avoid resume content in routine application logs. Introduce deletion/export controls alongside persistent personal-data storage.

Validate the behavior affected by the implementation: save/reload, variant isolation, import preview/rollback, unauthorized document access, and failed or concurrent writes as relevant. Report implemented behavior separately from mocks, unavailable integrations, and remaining work.
