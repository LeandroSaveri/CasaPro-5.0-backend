import { query } from '../../config/database';
import { NotFoundError, ConflictError } from '../../core/errors/AppError';
import logger from '../../config/logger';
import { env } from '../../config/env';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    stripePriceId: null,
    quotas: {
      maxProjects: 3,
      maxStorageMB: 100,
      features: ['basic_2d', 'basic_3d']
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    stripePriceId: env.STRIPE_PRO_PRICE_ID,
    quotas: {
      maxProjects: 50,
      maxStorageMB: 5000,
      features: ['basic_2d', 'basic_3d', 'advanced_2d', 'advanced_3d', 'export_pdf']
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    stripePriceId: env.STRIPE_ENTERPRISE_PRICE_ID,
    quotas: {
      maxProjects: -1,
      maxStorageMB: -1,
      features: ['all']
    }
  }
} as const;

export type PlanId = keyof typeof PLANS;

interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan_id: PlanId;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  created_at: Date;
  updated_at: Date;
}

export class SubscriptionService {
  async createStripeCustomer(userId: string, email: string, name: string): Promise<string> {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { userId }
    });

    await query(
      'UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2',
      [customer.id, userId]
    );

    logger.info('Stripe customer created', { userId, customerId: customer.id });
    return customer.id;
  }

  async createSubscription(userId: string, planId: PlanId, paymentMethodId?: string): Promise<{ clientSecret: string | null; subscriptionId: string }> {
    const plan = PLANS[planId];
    if (!plan) {
      throw new NotFoundError('Plan not found', 'PLAN_NOT_FOUND');
    }

    const userResult = await query<{ stripe_customer_id: string | null; email: string; name: string }>(
      'SELECT stripe_customer_id, email, name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    let customerId = userResult.rows[0].stripe_customer_id;
    
    if (!customerId) {
      customerId = await this.createStripeCustomer(userId, userResult.rows[0].email, userResult.rows[0].name);
    }

    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId }
      });
    }

    if (planId === 'free') {
      await this.createLocalSubscription(userId, 'free', null, null, 'active');
      return { clientSecret: null, subscriptionId: 'free-local' };
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: plan.stripePriceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: { userId, planId }
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    await this.createLocalSubscription(userId, planId, customerId, subscription.id, 'trialing');

    return {
      clientSecret: paymentIntent?.client_secret || null,
      subscriptionId: subscription.id
    };
  }

  async createLocalSubscription(
    userId: string,
    planId: PlanId,
    customerId: string | null,
    subscriptionId: string | null,
    status: SubscriptionRecord['status']
  ): Promise<void> {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO subscriptions 
       (user_id, plan_id, stripe_customer_id, stripe_subscription_id, status, 
        current_period_start, current_period_end, cancel_at_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
        plan_id = $2,
        stripe_customer_id = COALESCE($3, subscriptions.stripe_customer_id),
        stripe_subscription_id = COALESCE($4, subscriptions.stripe_subscription_id),
        status = $5,
        current_period_start = $6,
        current_period_end = $7,
        cancel_at_period_end = $8,
        updated_at = NOW()`,
      [userId, planId, customerId, subscriptionId, status, now, periodEnd, false]
    );

    logger.info('Subscription saved', { userId, planId, status });
  }

  async handleWebhook(event: Stripe.Event): Promise<void> {
    logger.info('Processing Stripe webhook', { type: event.type });

    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          await this.activateSubscription(subscriptionId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.downgradeToFree(subscription.id);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.updateSubscriptionStatus(subscription.id, subscription.status as SubscriptionRecord['status']);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          await this.updateSubscriptionStatus(subscriptionId, 'past_due');
        }
        break;
      }
    }
  }

  async activateSubscription(stripeSubscriptionId: string): Promise<void> {
    await query(
      `UPDATE subscriptions 
       SET status = 'active', updated_at = NOW() 
       WHERE stripe_subscription_id = $1`,
      [stripeSubscriptionId]
    );
  }

  async updateSubscriptionStatus(stripeSubscriptionId: string, status: SubscriptionRecord['status']): Promise<void> {
    await query(
      `UPDATE subscriptions 
       SET status = $1, updated_at = NOW() 
       WHERE stripe_subscription_id = $2`,
      [status, stripeSubscriptionId]
    );
  }

  async downgradeToFree(stripeSubscriptionId: string): Promise<void> {
    await query(
      `UPDATE subscriptions 
       SET plan_id = 'free', status = 'active', stripe_subscription_id = NULL, 
           cancel_at_period_end = false, updated_at = NOW() 
       WHERE stripe_subscription_id = $1`,
      [stripeSubscriptionId]
    );
  }

  async getSubscription(userId: string): Promise<SubscriptionRecord | null> {
    const result = await query<SubscriptionRecord>(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async cancelSubscription(userId: string): Promise<void> {
    const sub = await this.getSubscription(userId);
    if (!sub || !sub.stripe_subscription_id) {
      throw new NotFoundError('No active subscription found', 'SUBSCRIPTION_NOT_FOUND');
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true
    });

    await query(
      'UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW() WHERE user_id = $1',
      [userId]
    );
  }

  async reactivateSubscription(userId: string): Promise<void> {
    const sub = await this.getSubscription(userId);
    if (!sub || !sub.stripe_subscription_id) {
      throw new NotFoundError('No subscription found', 'SUBSCRIPTION_NOT_FOUND');
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false
    });

    await query(
      'UPDATE subscriptions SET cancel_at_period_end = false, updated_at = NOW() WHERE user_id = $1',
      [userId]
    );
  }

  async createBillingPortalSession(userId: string, returnUrl: string): Promise<string> {
    const userResult = await query<{ stripe_customer_id: string }>(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.stripe_customer_id) {
      throw new NotFoundError('No customer found', 'CUSTOMER_NOT_FOUND');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: userResult.rows[0].stripe_customer_id,
      return_url: returnUrl
    });

    return session.url;
  }

  async getCurrentPlan(userId: string): Promise<{ plan: typeof PLANS[PlanId]; subscription: SubscriptionRecord | null }> {
    const subscription = await this.getSubscription(userId);
    const planId = subscription?.plan_id || 'free';
    return { plan: PLANS[planId], subscription };
  }
}

export const subscriptionService = new SubscriptionService();
