# Canonical document and import contract

## Document boundaries

Use a versioned serializable document independent of any template. Suggested entities:

- Candidate profile: contact details and user-confirmed facts, each with a stable ID.
- Resume: ID, owner, name, optional target role, document revision, ordered sections, and presentation settings.
- Section: stable ID, type, display label, visibility, ordered entries. Start with summary, experience, education, skills, projects, certifications, and languages; permit custom sections when needed.
- Entry: stable ID, typed fields, bullet IDs, source references, and verification state.
- Source: manual input or import identifier and field/row reference. Do not retain entire raw source archives indefinitely just for provenance.
- AI proposal: base revision, operation list, evidence references, unresolved questions, and accepted/rejected status.
- Master Career Vault: comprehensive uncompressed repository of candidate accomplishments (10-20 bullets per job, full skills/certs inventory, and metric bank) from which targeted variants are derived.

Keep month-only dates as year/month values, not timezone-sensitive timestamps. Represent ongoing roles explicitly and unknown dates as unknown. Preserve original precision; do not invent a day or month. Allow overlapping roles and career gaps without treating either as factual errors.

Use optimistic concurrency or an equivalent revision check. Reject or reconcile stale saves; never overwrite newer work silently. Autosave needs pending, saved, and failed states. JSON backups include a schema version; migrations preserve unknown fields when feasible or explain unsupported data before import.

## Imports and cold-start onboarding

Support manual entry, JSON restore, pasted text, existing PDF/DOCX resumes, and user-supplied LinkedIn CSV/ZIP as separate adapters into the same staging model. Map available headers rather than requiring a fixed archive layout. The R&D names Profile, Positions, Education, Skills, Certifications, Languages, and Projects CSVs; these are examples to detect, not a completeness guarantee.

For cold-start PDF/DOCX onboarding:
- Ingest user-uploaded resume documents client-side or through a dedicated server parser.
- Extract plain text while preserving paragraph and bullet groupings.
- Use a structured schema extraction prompt (or local regex parser for standard sections) to map raw text into the canonical `documentSchema`.
- Render a mandatory staging preview screen showing extracted contact info, sections, experience entries, and parse warnings before committing.
- Give the user explicit choice to review, correct, or discard parsed fields before initializing their first resume and Master Career Vault.

Handle quoted commas/newlines, UTF-8 BOM, empty fields, duplicate rows, ambiguous dates, and missing files. For ZIPs, bound compressed size, total decompressed bytes, entry count, and per-entry size before processing; reject traversal paths and nested archives unless specifically supported. Never execute imported content. Render all imported text as untrusted text.

Show a preview of detected records, unsupported fields, and parse warnings. Let the user choose merge or replace. Replacement applies only to the selected resume and creates an undo snapshot. Prefer stable external IDs for matching; otherwise present ambiguous duplicates for resolution. Do not merge two jobs solely because their titles match. Commit validated changes atomically.

Test representative synthetic fixtures: multiline bullets, partial archive, malformed JSON, oversized archive, duplicate positions, non-Latin names, overlapping dates, and failed commit. A successful import must preserve accepted facts and expose omissions.

