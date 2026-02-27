import { Router } from 'express';
import { userController } from './user.controller';
import { authenticateToken, requireRole } from '../../core/middleware/auth.middleware';
import { validateRequest } from '../../core/middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

const updateUserSchema = {
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional()
  })
};

router.get(
  '/',
  authenticateToken,
  requireRole('admin'),
  userController.getAll
);

router.get(
  '/me',
  authenticateToken,
  userController.getMe
);

router.get(
  '/me/stats',
  authenticateToken,
  userController.getStats
);

router.patch(
  '/me',
  authenticateToken,
  validateRequest(updateUserSchema),
  userController.updateMe
);

router.get(
  '/:id',
  authenticateToken,
  userController.getById
);

router.patch(
  '/:id',
  authenticateToken,
  validateRequest(updateUserSchema),
  userController.update
);

router.delete(
  '/:id',
  authenticateToken,
  userController.delete
);

export default router;
