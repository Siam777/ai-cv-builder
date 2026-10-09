---
name: resume-builder-ats-linter
description: Implement deterministic resume quality heuristics, real-time bullet linting, ATS plain-text extraction diagnostics, reading-order audits, and public ATS resume grader lead magnets. Use for ATS optimization and resume content verification.
---

# ATS Heuristic Quality Linter and Diagnostics

Inspect the document layout system ([layout.ts](file:///D:/utility-projects/ai-cv-builder/src/lib/layout.ts)) and presentation rules ([presentation.ts](file:///D:/utility-projects/ai-cv-builder/src/lib/presentation.ts)) before building or modifying ATS validation tools. Read [ats-rules-and-diagnostics.md](references/ats-rules-and-diagnostics.md) for deterministic rule dictionaries, regex metrics, reading-order verification protocols, and lead-magnet architecture.

## Deterministic writing heuristics and live linter

Implement fast, zero-latency client-side content linting that runs continuously during editing:
1. **Action Verb Strength**:
   - Detect weak or passive openings: *"Responsible for"*, *"Assisted with"*, *"Worked on"*, *"Helped team"*, *"Handled"*.
   - Suggest strong, domain-specific active verbs: *Engineered*, *Architected*, *Orchestrated*, *Optimized*, *Automated*, *Spearheaded*, *Decommissioned*.
2. **Quantifiable Impact Checker**:
   - Inspect experience bullets for verified metrics (percentages, dollar figures, latency reductions, user scale, multiplier gains).
   - Display a non-blocking indicator: `⚠️ Missing quantifiable outcome`.
3. **Bullet Length & Density Auditing**:
   - Flag bullets under 6 words as too brief to convey depth.
   - Flag bullets over 38 words as run-on statements that should be split into focused accomplishments.
4. **Structural Hygiene**:
   - Verify date consistency (e.g. `YYYY-MM` or standard month-year naming).
   - Ensure mandatory contact fields (Email, Location) are populated before export.

## ATS plain-text diagnostic inspector

Add a dedicated "ATS Diagnostic" preview tab alongside visual rendering:
1. **Simulate ATS Text Extraction**:
   - Extract plain text using a linear, non-visual DOM parser that mimics enterprise applicant tracking systems (Workday, Taleo, Greenhouse, iCIMS).
   - Strip CSS visual styling, display positioning, and multi-column visual floats.
2. **Reading Order Verification**:
   - Verify that sidebar layouts (such as Creative) serialize sections in logical semantic order (e.g. Header -> Summary -> Experience -> Education -> Skills), rather than interleaving sidebar fragments into body paragraphs.
3. **Hazardous Formatting Flags**:
   - Warn if text is embedded inside unsupported SVG elements, nested layout tables, or canvas objects that cannot be parsed by text extractors.
   - Validate that hyperlinks (LinkedIn, GitHub, portfolio) maintain clean semantic `<a>` tags with absolute URLs.

## Resume strength & ATS readiness score

Provide an overall readiness indicator:
1. Calculate a composite score (0–100%) based on deterministic rules:
   - Action verb strength: 25%
   - Metric & quantifiable outcome density: 30%
   - Reading order & extraction purity: 25%
   - Section completeness and date consistency: 20%
2. State clearly that the score is a deterministic writing heuristic, never a guarantee of recruiter review or interview probability.
3. Provide an actionable checklist where clicking any warning immediately highlights the relevant section or bullet in the editor.

## Free ATS Resume & Job Match Grader (Lead magnet)

Build an unauthenticated public funnel for candidate acquisition:
1. Allow visitors to upload an existing PDF resume and optionally paste a target job description.
2. Run the deterministic text extraction, ATS parsing diagnostics, and keyword coverage engine.
3. Display an instant, visually compelling diagnostic report showing top strengths and 3–5 critical gaps.
4. Provide a clear call to action: *"Fix these gaps and generate an evidence-tailored resume in 60 seconds."*

## Verification and testing

- Test linter against synthetic good and bad bullet fixtures: assert that passive verbs and missing metrics are reliably flagged.
- Test reading order on all 4 template families (Classic, Modern, Compact, Creative): assert identical logical section sequence in extracted text.
- Test edge cases: bullets containing currency symbols (€, £, $), non-Latin scripts, and hyphenated compound verbs.
