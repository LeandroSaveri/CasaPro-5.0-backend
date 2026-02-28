import { Request, Response } from 'express';
import { subscriptionService, PLANS } from './subscription.service';
import { asyncHandler } from '../../core/errors/errorHandler';
import { env } from '../../config/env';
import Stripe from 'stripe';

export class SubscriptionController {
  getPlans = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      data: {
        plans: Object.values(PLANS).map(p => ({
          id: p.id,
          name: p.name,
          quotas: p.quotas
        }))
      }
    });
  });

  getCurrentSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
      return;
    }

    const { plan, subscription } = await subscriptionService.getCurrentPlan(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        plan,
        subscription: subscription ? {
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        } : null
      }
    });
  });

  createSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
      return;
    }

    const { planId, paymentMethodId } = req.body;

    const result = await subscriptionService.createSubscription(req.user.id, planId, paymentMethodId);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  cancelSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
      return;
    }

    await subscriptionService.cancelSubscription(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period'
    });
  });

  reactivateSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
      return;
    }

    await subscriptionService.reactivateSubscription(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Subscription reactivated successfully'
    });
  });

  createBillingPortal = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
      return;
    }

    const url = await subscriptionService.createBillingPortalSession(req.user.id, `${env.FRONTEND_URL}/billing`);

    res.status(200).json({
      success: true,
      data: { url }
    });
  });

  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'] as string;

    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
      await subscriptionService.handleWebhook(event);
      res.status(200).json({ received: true });
    } catch (err) {
      logger.error('Webhook error', { error: err instanceof Error ? err.message : 'Unknown error' });
      res.status(400).json({ success: false, error: { message: 'Webhook error' } });
    }
  };
}

import logger from '../../config/logger';
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export const subscriptionController = new SubscriptionController();
