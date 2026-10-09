---
name: resume-builder-monetization
description: Implement SaaS pricing tiers, Stripe Checkout, subscription lifecycle webhooks, customer portal, watermark export controls, and entitlement gating. Use for commercial monetization and billing infrastructure.
---

# Resume builder monetization and entitlements

Inspect existing account models ([schema.ts](file:///D:/utility-projects/ai-cv-builder/src/lib/server/schema.ts)) and authentication routes ([auth.ts](file:///D:/utility-projects/ai-cv-builder/src/lib/server/auth.ts)) before implementing billing. Read [stripe-and-entitlements.md](references/stripe-and-entitlements.md) for subscription lifecycle webhooks, database schemas, entitlement checks, and watermark enforcement.

## Commercial pricing tiers

Implement the 3-tier commercial model:
1. **Free / Local Tier ($0)**:
   - Unlimited local editing.
   - 1 active resume variant.
   - Classic template access.
   - Browser print export with subtle watermark footer (*"Created with AI CV Builder"*).
   - Plain text and JSON export.
2. **Job Hunter Pass ($19 / month or $9 / week)**:
   - Target audience: Active job seekers in a 2–8 week search cycle.
   - Unlimited tailored resume variants.
   - Cloud synchronization across devices.
   - All 4 template families (Classic, Modern, Compact, Creative).
   - Full Master Career Vault access.
   - 1-Click Job Tailoring Engine (50 tailored applications/month).
   - Full ATS Readiness and Keyword Coverage diagnostic reports.
   - Watermark-free PDF and DOCX exports.
3. **Lifetime / Power Pass ($79 one-time)**:
   - Target audience: Senior engineers and managers maintaining long-term career records.
   - Permanent Master Career Vault access and unlimited tailoring.
   - Priority AI processing queue.

## Stripe integration and checkout flow

1. **Checkout Session Creation**:
   - Provide `/api/billing/checkout` endpoint accepting `planId` and billing frequency.
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
2. **AI Tailoring Quotas**:
   - Check monthly quota consumption before triggering OpenAI job extraction and matching.
   - Return clean 402/403 status with actionable upgrade payload when quota is exhausted.
3. **Master Career Vault & Variant Limits**:
   - Allow free users to maintain 1 primary resume variant.
   - Prompt upgrade when creating secondary targeted variants or saving more than 10 bullets per entry into the vault.

## Verification and testing

Validate billing code with thorough automated and mock tests:
- Test webhook signature validation: Reject unauthenticated or tampered payloads.
- Test idempotent replay: Sending the same webhook event twice must not corrupt user entitlements or duplicate records.
- Test tier transition: Downgrade from Job Hunter Pass locks premium features without deleting candidate data.
- Test watermark presence: Verify watermark is present on free exports and absent on active subscriber exports.
