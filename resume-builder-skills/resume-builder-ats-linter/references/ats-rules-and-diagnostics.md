# ATS Rules, Heuristics, and Diagnostic Specifications

## 1. Action verb taxonomy and passive phrase rules

### Weak/Passive patterns to flag

```typescript
export const WEAK_OPENING_PATTERNS = [
  /^responsible for\b/i,
  /^duties included\b/i,
  /^worked on\b/i,
  /^assisted (with|in)\b/i,
  /^helped (with|to)\b/i,
  /^served as\b/i,
  /^participated in\b/i,
  /^handled\b/i,
  /^tasked with\b/i,
];
```

### Recommended active verb categories

| Category | Recommended Strong Verbs |
| :--- | :--- |
| **Engineering & Architecture** | Architected, Engineered, Developed, Deployed, Refactored, Scaled, Automated, Benchmarked, Decoupled, Containerized |
| **Leadership & Strategy** | Spearheaded, Orchestrated, Guided, Directed, Championed, Founded, Mentored, Negotiated |
| **Optimization & Performance**| Optimized, Accelerated, Streamlined, Reduced, Consolidated, Mitigated, Minimized, Hardened |
| **Data & Analysis** | Formulated, Synthesized, Quantified, Derived, Extrapolated, Modeled, Evaluated, Forecasted |

---

## 2. Quantifiable metric detection regex

Detecting numerical and impact assertions within bullet strings:

```typescript
export const METRIC_PATTERNS = [
  // Percentages: 25%, 3.5%
  /\b\d+(\.\d+)?%\b/,
  // Currency values: $500, $1.2M, €40k, £100B
  /[$€£¥]\s*\d+(\.\d+)?[kmb]?\b/i,
  /\b\d+(\.\d+)?\s*[kmb]?\s*(dollars|usd|eur|gbp)\b/i,
  // Multipliers: 3x, 10x, 2.5x
  /\b\d+(\.\d+)?x\b/i,
  // Latency & time: 45ms, 2.5s, 30 minutes, 4 hours, 3 weeks
  /\b\d+(\.\d+)?\s*(ms|milliseconds|seconds|mins|minutes|hours|days|weeks|months)\b/i,
  // Scale & volume: 500k users, 10M requests, 40 microservices
  /\b\d+(\.\d+)?\s*(k|m|b|million|billion|thousand)?\s*(users|customers|requests|queries|nodes|clusters|endpoints|microservices|pipelines|engineers|developers)\b/i,
];

export function hasQuantifiableMetric(bulletText: string): boolean {
  return METRIC_PATTERNS.some((pattern) => pattern.test(bulletText));
}
```

---

## 3. ATS plain-text extraction and diagnostic inspector

Enterprise ATS systems (Taleo, Workday, Greenhouse) convert incoming PDF or DOCX files into a single flat UTF-8 text stream. Layout tables, multi-column divisions, and text boxes often cause text scrambling.

### Extraction algorithm specification

```typescript
export function extractAtsPlainText(document: ResumeDocument): string {
  const lines: string[] = [];

  // 1. Header & Contact
  lines.push(document.contact.name.toUpperCase());
  const contactParts = [
    document.contact.email,
    document.contact.phone,
    document.contact.location,
    document.contact.links?.map(l => l.url).join(' | '),
  ].filter(Boolean);
  lines.push(contactParts.join(' • '));
  lines.push('');

  // 2. Ordered Sections (strictly sequential, never interleaved)
  for (const section of document.sections.filter(s => s.visible)) {
    lines.push(section.title.toUpperCase());
    lines.push('----------------------------------------');

    if (section.type === 'summary' && section.content) {
      lines.push(section.content);
    } else if (section.type === 'experience') {
      for (const entry of section.entries) {
        lines.push(`${entry.title} - ${entry.organization}`);
        lines.push(`${entry.startDate} - ${entry.current ? 'Present' : entry.endDate || ''} | ${entry.location || ''}`);
        for (const bullet of entry.bullets) {
          lines.push(`• ${bullet.text}`);
        }
        lines.push('');
      }
    } else if (section.type === 'skills') {
      for (const entry of section.entries) {
        lines.push(`${entry.category}: ${entry.skills.join(', ')}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
```

### Diagnostic audit checklist

The diagnostic inspector must run the following checks on the rendered template:
1. **Reading Order Match**: Extracted plain-text section order must match visual order from top-left to bottom-right.
2. **Character Set Hygiene**: Assert that no unencoded private-use Unicode symbols or font ligatures corrupt keyword searches.
3. **No Stranded Headings**: Every rendered section heading must be followed by at least one entry on the same page.
4. **Header Extraction Integrity**: The applicant's name and contact information must be parseable at line 0–3 without preceding header cruft.

---

## 4. ATS Readiness Scoring Formula

$$\text{Readiness Score} = 0.25 S_{\text{verbs}} + 0.30 S_{\text{metrics}} + 0.25 S_{\text{extraction}} + 0.20 S_{\text{hygiene}}$$

Where:
- $S_{\text{verbs}} = \frac{\text{Bullets with strong active verbs}}{\text{Total experience bullets}}$
- $S_{\text{metrics}} = \frac{\text{Bullets with verified quantifiable metrics}}{\text{Total experience bullets}}$
- $S_{\text{extraction}} = 1.0 \text{ if clean reading order and no table/box hazards, else } 0.5$
- $S_{\text{hygiene}} = \text{Score based on filled contact fields, consistent dates, and word counts between 6 and 38}$
