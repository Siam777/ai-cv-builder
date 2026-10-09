# Stripe Billing and Entitlement Infrastructure

## 1. Database schema for subscriptions

```typescript
// Proposed schema extension in src/lib/server/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  planId: text('plan_id').notNull(), // 'free' | 'job_hunter_monthly' | 'job_hunter_weekly' | 'lifetime'
  status: text('status').notNull(), // 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
  currentPeriodEnd: integer('current_period_end'),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const subscriptionUsage = sqliteTable('subscription_usage', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  periodMonth: text('period_month').notNull(), // e.g. '2026-10'
  tailoredResumesGenerated: integer('tailored_resumes_generated').default(0),
  aiBulletRewrites: integer('ai_bullet_rewrites').default(0),
});
```

---

## 2. Webhook handler specification

Endpoint: `/api/billing/webhook`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(sub);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionCanceled(sub);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

---

## 3. Server-side entitlement verification

```typescript
export type EntitlementFeature =
  | 'watermark_free_export'
  | 'unlimited_variants'
  | 'career_vault_storage'
  | 'job_tailoring_engine'
  | 'all_templates';

export async function checkEntitlement(
  userId: string,
  feature: EntitlementFeature
): Promise<{ allowed: boolean; reason?: string }> {
  const sub = await getSubscriptionByUserId(userId);

  const isActive = sub && (sub.status === 'active' || sub.status === 'trialing');

  if (sub?.planId === 'lifetime') {
    return { allowed: true };
  }

  switch (feature) {
    case 'watermark_free_export':
    case 'all_templates':
    case 'career_vault_storage':
      return {
        allowed: isActive,
        reason: isActive ? undefined : 'Active Job Hunter Pass required',
      };

    case 'unlimited_variants': {
      if (isActive) return { allowed: true };
      const variantCount = await countUserVariants(userId);
      return {
        allowed: variantCount < 1,
        reason: 'Free tier is limited to 1 active resume variant',
      };
    }

    case 'job_tailoring_engine': {
      if (!isActive) {
        return { allowed: false, reason: 'Job tailoring requires an active subscription' };
      }
      const usage = await getCurrentMonthUsage(userId);
      if (usage.tailoredResumesGenerated >= 50) {
        return { allowed: false, reason: 'Monthly tailoring limit (50) reached' };
      }
      return { allowed: true };
    }
  }
}
```

---

## 4. Watermark rendering contract

On PDF and print rendering:
```html
<!-- Injected when user lacks 'watermark_free_export' entitlement -->
<div class="print-watermark-footer" style="position: absolute; bottom: 8mm; left: 0; right: 0; text-align: center; font-size: 8pt; color: #888888; pointer-events: none;">
  Created with AI CV Builder • <a href="https://aicvbuilder.com/upgrade" style="color: #666666; text-decoration: underline;">Upgrade to remove watermark</a>
</div>
```

Testing verification:
- Test server export route without entitlement: verify `<div class="print-watermark-footer">` exists in output.
- Test server export route with valid subscription: verify watermark element is completely omitted from DOM.
