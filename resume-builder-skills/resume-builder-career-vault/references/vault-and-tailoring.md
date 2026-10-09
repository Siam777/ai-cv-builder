# Master Career Vault and Tailoring Contracts

## 1. Data model: Vault vs. Variant

The Master Career Vault stores a candidate's complete professional record, while individual resumes are tailored projections:

```text
+--------------------------------------------------------------+
|                    Master Career Vault                       |
| - 15 Work Experiences (8-12 bullets each)                    |
| - 45 Skills categorized by domain & verified evidence        |
| - Complete education, degrees, patents, certifications       |
| - Verified quantitative impact pool                          |
+--------------------------------------------------------------+
                               |
         +---------------------+---------------------+
         | (1-Click Tailor)                          | (1-Click Tailor)
         v                                           v
+-------------------------------+   +-------------------------------+
| Resume Variant A (Stripe SWE) |   | Resume Variant B (Google SRE) |
| - Top 4 bullets per role      |   | - Distributed systems focus   |
| - Payments/Fintech highlighted|   | - Kubernetes/Infra highlighted|
| - 1-Page budget fit           |   | - 1-Page budget fit           |
+-------------------------------+   +-------------------------------+
```

### Proposed database schema extension

```typescript
// Proposed schema in src/lib/server/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const careerVaultEntries = sqliteTable('career_vault_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'experience' | 'education' | 'project' | 'certification'
  title: text('title').notNull(),
  organization: text('organization').notNull(),
  location: text('location'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  current: integer('current', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const careerVaultBullets = sqliteTable('career_vault_bullets', {
  id: text('id').primaryKey(),
  entryId: text('entry_id').notNull().references(() => careerVaultEntries.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  actionVerb: text('action_verb'),
  metricX: text('metric_x'), // Accomplished [X]
  metricY: text('metric_y'), // Measured by [Y]
  metricZ: text('metric_z'), // Doing [Z]
  tags: text('tags'), // JSON array of matched skill IDs or tags
  createdAt: text('created_at').notNull(),
});
```

---

## 2. Job description requirement extraction prompt contract

When sending a job description to the server AI provider:

```typescript
export interface ExtractedJobRequirements {
  jobTitle: string;
  company: string;
  hardRequirements: Array<{
    id: string;
    description: string;
    normalizedSkill?: string;
    weight: number; // e.g. 1.0
  }>;
  preferredQualifications: Array<{
    id: string;
    description: string;
    normalizedSkill?: string;
    weight: number; // e.g. 0.5
  }>;
  keyResponsibilities: string[];
}
```

System instruction guidance:
- Extract only requirements explicitly stated in the posting.
- Do not make assumptions about implicit requirements.
- Distinguish mandatory qualifications (e.g., *"Must have 5+ years"*, *"Required: Python"*) from nice-to-haves (*"Bonus if familiar with GCP"*).

---

## 3. Heuristic Evidence Matching and Coverage Algorithm

### Coverage Formula

$$\text{Coverage Score} = \frac{\sum_{\text{matched } r \in R} \text{weight}(r)}{\sum_{r \in R} \text{weight}(r)} \times 100\%$$

Where:
- $R$ is the set of all scorable requirements extracted from the job description.
- $\text{weight}(\text{hard requirement}) = 1.0$
- $\text{weight}(\text{preferred qualification}) = 0.5$

### Match categorization

For each requirement $r \in R$:
1. **Full Match**: Candidate vault possesses a bullet or verified skill directly evidencing the requirement with matching technology tags or semantic overlap $> 0.85$.
2. **Partial / Related**: Candidate possesses a related skill in the same taxonomy bucket (e.g. PostgreSQL when MySQL is requested), but explicitly flagged as related rather than identical.
3. **Skill Gap**: Candidate vault has no matching or related evidence.

```json
{
  "requirementId": "req-kubernetes",
  "requirementText": "5+ years Kubernetes production cluster management",
  "status": "matched",
  "matchedEvidence": [
    {
      "vaultBulletId": "bullet-42",
      "entryTitle": "Senior Infrastructure Engineer",
      "text": "Maintained 14 multi-region Kubernetes clusters running 800+ microservices."
    }
  ]
}
```

---

## 4. Google XYZ Impact Coach: Detection and Prompting

The Google XYZ Formula is defined as:
$$\text{"Accomplished [X], as measured by [Y], by doing [Z]"}$$

### Heuristic regex and semantic checks

A bullet is flagged as lacking impact if:
1. It contains action verbs and task descriptions but lacks any numerical, percentage, multiplier, or currency metrics:
   $$\neg (\backslash d+\% \mid \backslash \$\backslash d+ \mid \backslash d+x \mid \backslash d+\text{ms} \mid \backslash d+\text{ users})$$
2. It begins with weak or passive phrases (*"Responsible for"*, *"Worked on"*, *"Assisted team with"*).

### Conversational Elicitation Flow

When the user triggers the Google XYZ Coach:
1. **Identify Missing Component**:
   *"You mentioned: 'Optimized database queries and indexing for user dashboard.' What was the quantifiable outcome [Y]?"*
2. **Provide Multiple Suggestion Templates**:
   - Time/Latency: *"e.g., Reduced query latency from 800ms to 95ms"*
   - Scale/Volume: *"e.g., Enabled dashboard to serve 50,000 concurrent requests without timeout"*
   - Cost: *"e.g., Decreased monthly RDS spend by 28%"*
3. **Strict Invariant**:
   - The AI must wait for the user to provide or select the actual metric.
   - Never generate or guess plausible numbers. If the user indicates no metric is available, offer a qualitative impact formulation without false numbers.
