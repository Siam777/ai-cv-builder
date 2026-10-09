# Rendering and export acceptance

## Pagination

Keep a section heading with its first item and avoid splitting short experience entries where practical. Allow long entries to split without overflow or blank pages. Wait for fonts and assets before measuring or exporting. Do not derive page breaks solely from character counts.

Check one-page and multi-page content, a single very long role, empty optional sections, long URLs, unbroken strings, accented names, non-Latin scripts, and right-to-left text when supported. Exercise every template with both A4 and Letter. Verify density extremes do not clip or become unreadable.

## Format contracts

| Format | Verify |
| --- | --- |
| PDF | Selectable text, expected reading order, links, page boundaries, loaded fonts, no missing content, watermark on free tier |
| DOCX | Editable paragraphs and lists, semantic headings, sensible pagination; disclose differences from PDF |
| HTML | Standalone supported assets/styles, escaped content, working print styles, no injected scripts |
| Plain text (ATS) | Sequential section order, pure text stream, no layout artifacts, matching ATS Diagnostic tab |
| Markdown | Correct escaping, predictable headings/lists, preserved URLs |
| JSON | Schema version, round-trip fidelity, no credentials or hidden application state |

## ATS Diagnostic and Reading Order Checks

1. **Sidebar and Multi-Column Layouts (Creative Template)**:
   - Run plain-text extraction across the rendered DOM and verify reading order.
   - Assert that sidebar entries (e.g. Skills or Contact details) appear either cleanly before or cleanly after main experience entries, never interleaved between experience roles or interrupting bullet lists.
2. **Interactive `data-block-id` Sync**:
   - Assert that rendered blocks carry valid `data-block-id`, `data-section-id`, and `data-bullet-id` attributes.
   - Test click handlers: clicking on a rendered preview block must trigger the corresponding editor event without page reload.
3. **Export Watermark Verification**:
   - Verify that when `watermark_free_export` entitlement is absent, the footer watermark renders cleanly at the bottom margin without overlapping text blocks or causing page count inflation.

Text extraction checks should assert important facts and their order without relying on byte-identical PDFs. Visual inspection catches clipping and bad breaks that extraction misses. Test export errors as well as happy paths: unavailable fonts, failed jobs, expired downloads, and a document changed while rendering. An export job must capture a specific authorized revision.

