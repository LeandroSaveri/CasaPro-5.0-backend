import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticateToken } from '../../core/middleware/auth.middleware';
import { authRateLimit } from '../../core/middleware/rateLimit.middleware';
import { validateRequest } from '../../core/middleware/validate.middleware';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema
} from './auth.schema';

const router = Router();

router.post(
  '/register',
  authRateLimit,
  validateRequest(registerSchema),
  authController.register
);

router.post(
  '/login',
  authRateLimit,
  validateRequest(loginSchema),
  authController.login
);

router.get(
  '/me',
  authenticateToken,
  authController.getMe
);

router.post(
  '/change-password',
  authenticateToken,
  validateRequest(changePasswordSchema),
  authController.changePassword
);

router.post(
  '/deactivate',
  authenticateToken,
  authController.deactivateAccount
);

export default router;
