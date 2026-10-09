import { NextResponse } from "next/server";
import { stripe } from "@/lib/server/stripe";
import { upsertSubscription, type PlanId } from "@/lib/server/entitlements";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook secret not configured on server." },
      { status: 500 },
    );
  }

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.userId;
      const planId = (session.metadata?.planId as PlanId) || "job_hunter_monthly";
      const customerId = String(session.customer || "");
      const subscriptionId = session.subscription ? String(session.subscription) : null;

      if (userId && customerId) {
        await upsertSubscription({
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          planId,
          status: "active",
          // 30 days default or fetched from subscription
          currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          cancelAtPeriodEnd: false,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = String(sub.customer);
      const status = sub.status; // 'active', 'past_due', etc.
      const currentPeriodEnd = (sub as any).current_period_end;
      const cancelAtPeriodEnd = sub.cancel_at_period_end;

      // Find user by customerId
      const { client } = (await import("@/lib/server/database")).database();
      const rows = await client.execute({
        sql: "SELECT user_id, plan_id FROM subscriptions WHERE stripe_customer_id = ?",
        args: [customerId],
      });

      if (rows.rows.length > 0) {
        const userId = String(rows.rows[0].user_id);
        const planId = (rows.rows[0].plan_id as PlanId) || "job_hunter_monthly";
        await upsertSubscription({
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          planId,
          status,
          currentPeriodEnd,
          cancelAtPeriodEnd,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = String(sub.customer);

      const { client } = (await import("@/lib/server/database")).database();
      const rows = await client.execute({
        sql: "SELECT user_id, plan_id FROM subscriptions WHERE stripe_customer_id = ?",
        args: [customerId],
      });

      if (rows.rows.length > 0) {
        const userId = String(rows.rows[0].user_id);
        const planId = (rows.rows[0].plan_id as PlanId) || "job_hunter_monthly";
        await upsertSubscription({
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          planId,
          status: "canceled",
          currentPeriodEnd: Math.floor(Date.now() / 1000),
          cancelAtPeriodEnd: true,
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = String(invoice.customer);

      const { client } = (await import("@/lib/server/database")).database();
      await client.execute({
        sql: "UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE stripe_customer_id = ?",
        args: [new Date().toISOString(), customerId],
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
