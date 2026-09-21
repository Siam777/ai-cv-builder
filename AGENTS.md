# AI CV Builder project guidance

This folder is the home for the resume-builder application, its skills, and future plans.

Keep the implementation plan in PLAN.md and feature scope in FEATURE-PLAN.md. Save future project planning documents here, using docs/plans/ when separate detailed plans are useful. Update completed milestones and actual decisions without treating planned work as implemented.

Project skills live in .agents/skills/:
- resume-builder-product: document model, editor, persistence, imports, and feature planning.
- resume-builder-ai: evidence-grounded chatbot, AI proposals, and job tailoring.
- resume-builder-templates: resume layouts, pagination, and exports.

Read the relevant SKILL.md when working on its area. These skills guide development; they are not runtime chatbot prompts. Start implementation from the current PLAN.md and preserve unrelated work.

The app uses Next.js App Router and TypeScript. Run `npm run typecheck`, `npm test`, and `npm run build` for implementation changes; run `npm run test:e2e` for affected editor flows. See README.md for browser setup. Never treat later-phase features as available in the local editor.

PLAN.md owns implementation progress; FEATURE-PLAN.md owns release scope. When changing feature scope, synchronize resume-builder-skills/FEATURE-PLAN.md and its entry inside resume-builder-skills.zip. Installed skills under .agents/skills and their distribution copies must agree when skill guidance changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
