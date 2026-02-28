import { Router } from 'express';
import { quotaService } from './quota.service';
import { authenticateToken } from '../../core/middleware/auth.middleware';
import { asyncHandler } from '../../core/errors/errorHandler';

const router = Router();

router.get('/status', authenticateToken, asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    return;
  }

  const status = await quotaService.getQuotaStatus(req.user.id);

  res.status(200).json({
    success: true,
    data: status
  });
}));

export default router;
