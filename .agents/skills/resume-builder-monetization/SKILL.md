---
name: resume-builder-monetization
description: Implement SaaS pricing tiers, Stripe Checkout, subscription lifecycle webhooks, customer portal, watermark export controls, and entitlement gating. Use for commercial monetization and billing infrastructure.
---

# Resume builder monetization and entitlements

Inspect existing account models ([schema.ts](file:///D:/utility-projects/ai-cv-builder/src/lib/server/schema.ts)) and authentication routes ([auth.ts](file:///D:/utility-projects/ai-cv-builder/src/lib/server/auth.ts)) before implementing billing. Read [stripe-and-entitlements.md](references/stripe-and-entitlements.md) for subscription lifecycle webhooks, database schemas, entitlement checks, and watermark enforcement.

## Commercial pricing tiers

Three monthly tiers (`src/lib/billing-plans.ts` is the source of truth; old IDs `job_hunter_weekly`/`job_hunter_monthly` map to `go`, `lifetime` to `pro`):
1. **Free ($0)**: full editor and all 12 designs, Check my CV and built-in writing helpers, 5 AI rewrites a day, PDF download with a small watermark.
2. **Go ($9.99 / month)**: everything in Free, no watermark, 50 AI rewrites a day, AI summary drafts, 20 tailored CV copies a month, cover letters.
3. **Pro ($29.99 / month)**: everything in Go, 200 AI rewrites a day, unlimited tailored copies, AI job coaching per requirement.

Beta: every signed-in account gets Go free for its first `BETA_GO_TRIAL_DAYS` days (30 by default, 0 switches it off), computed in `getUserSubscription` with no Stripe record. `AI_DAILY_USER_LIMIT`, when set, caps every plan; `AI_DAILY_GLOBAL_LIMIT` caps the installation. Use `node scripts/grant-plan.mjs --email … --plan pro` to give an existing account a plan for testing without Stripe.

## Stripe integration and checkout flow

1. **Checkout Session Creation**:
   - Provide `/api/billing/checkout` endpoint accepting `planId` (`go` or `pro`); prices come from `STRIPE_PRICE_GO` and `STRIPE_PRICE_PRO`.
   - Authenticate the request and attach the user's canonical ID to Stripe `client_reference_id` and metadata.
   - Redirect to Stripe Hosted Checkout with success and cancel callback URLs.
2. **Customer Portal**:
   - Provide `/api/billing/portal` endpoint generating a Stripe Billing Portal session for card updates, billing history, and self-service cancellations.
3. **Webhook Processing**:
   - Verify signatures cryptographically using the Stripe webhook secret (`STRIPE_WEBHOOK_SECRET`).
   - Handle core lifecycle events idempotently:
     - `checkout.session.completed`: Record customer ID, activate entitlement.
     - `customer.subscription.created` & `updated`: Update plan, status, and period expiration.
     - `customer.subscription.deleted`: Revoke premium entitlements gracefully at period end.
     - `invoice.payment_failed`: Flag account with payment warning.

## Entitlement gating and feature guards

Enforce entitlements strictly on the server:
1. **PDF / DOCX Export Gating**:
   - Verify entitlement during PDF generation. If the user is on the Free tier, append the professional watermark to the footer.
   - Disallow client-side tampering: Watermark removal must be validated server-side.
2. **AI quotas and plan features**:
   - Count every AI request against the plan's `aiRequestsPerDay` before calling the provider (429 `AI_LIMIT`).
   - AI summary drafts need Go or Pro and AI job coaching needs Pro; refuse with 402 `PLAN_REQUIRED` before any provider call.
   - Tailored copies are created in the browser, so their lock is presentation-only (see PLAN.md).
3. **Master Career Vault & Variant Limits**:
   - Allow free users to maintain 1 primary resume variant.
   - Prompt upgrade when creating secondary targeted variants or saving more than 10 bullets per entry into the vault.

## Verification and testing

Validate billing code with thorough automated and mock tests:
- Test webhook signature validation: Reject unauthenticated or tampered payloads.
- Test idempotent replay: Sending the same webhook event twice must not corrupt user entitlements or duplicate records.
- Test tier transition: Downgrade from Go or Pro locks premium features without deleting candidate data, and the beta period ends after its days.
- Test watermark presence: Verify watermark is present on free exports and absent on active subscriber exports.
