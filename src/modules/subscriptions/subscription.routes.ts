import { Router } from 'express';
import { subscriptionController } from './subscription.controller';
import { authenticateToken } from '../../core/middleware/auth.middleware';

const router = Router();

// Webhook Stripe (público, mas verificado por signature)
router.post('/webhook', subscriptionController.handleWebhook);

// Rotas protegidas
router.get('/plans', authenticateToken, subscriptionController.getPlans);
router.get('/current', authenticateToken, subscriptionController.getCurrentSubscription);
router.post('/create', authenticateToken, subscriptionController.createSubscription);
router.post('/cancel', authenticateToken, subscriptionController.cancelSubscription);
router.post('/reactivate', authenticateToken, subscriptionController.reactivateSubscription);
router.post('/billing-portal', authenticateToken, subscriptionController.createBillingPortal);

export default router;
