# Rendering and export acceptance

## Pagination

Keep a section heading with its first item and avoid splitting short experience entries where practical. Allow long entries to split without overflow or blank pages. Wait for fonts and assets before measuring or exporting. Do not derive page breaks solely from character counts.

Check one-page and multi-page content, a single very long role, empty optional sections, long URLs, unbroken strings, accented names, non-Latin scripts, and right-to-left text when supported. Exercise every template with both A4 and Letter. Verify density extremes do not clip or become unreadable.

## Format contracts

| Format | Verify |
| --- | --- |
| PDF | Selectable text, expected reading order, links, page boundaries, loaded fonts, no missing content |
| DOCX | Editable paragraphs and lists, semantic headings, sensible pagination; disclose differences from PDF |
| HTML | Standalone supported assets/styles, escaped content, working print styles, no injected scripts |
| Plain text | Meaningful section order and labels without layout artifacts |
| Markdown | Correct escaping, predictable headings/lists, preserved URLs |
| JSON | Schema version, round-trip fidelity, no credentials or hidden application state |

Text extraction checks should assert important facts and their order without relying on byte-identical PDFs. Visual inspection catches clipping and bad breaks that extraction misses. Test export errors as well as happy paths: unavailable fonts, failed jobs, expired downloads, and a document changed while rendering. An export job must capture a specific authorized revision.
