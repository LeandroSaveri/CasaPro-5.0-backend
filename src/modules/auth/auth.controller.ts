import { Request, Response } from 'express';
import { authService } from './auth.service';
import {
  RegisterInput,
  LoginInput,
  ChangePasswordInput
} from './auth.schema';
import { ValidationError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/errorHandler';

export class AuthController {
  register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: RegisterInput = req.body;

    const result = await authService.register(data);

    res.status(201).json({
      success: true,
      data: result
    });
  });

  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: LoginInput = req.body;

    const result = await authService.login(data);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const user = await authService.getCurrentUser(req.user.id);

    res.status(200).json({
      success: true,
      data: { user }
    });
  });

  changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const { currentPassword, newPassword }: ChangePasswordInput = req.body;

    await authService.changePassword(req.user.id, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  });

  deactivateAccount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    await authService.deactivateAccount(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully'
    });
  });
}

export const authController = new AuthController();
