import { Request, Response } from 'express';
import { userService } from './user.service';
import { ValidationError, ForbiddenError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/errorHandler';

interface UpdateUserBody {
  name?: string;
  email?: string;
}

export class UserController {
  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

    const result = await userService.findAll(page, limit);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    if (req.user.id !== id && req.user.role !== 'admin') {
      throw new ForbiddenError('You can only access your own data', 'ACCESS_DENIED');
    }

    const user = await userService.findById(id);

    res.status(200).json({
      success: true,
      data: { user }
    });
  });

  getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const user = await userService.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: { user }
    });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateUserBody = req.body;

    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    if (req.user.id !== id && req.user.role !== 'admin') {
      throw new ForbiddenError('You can only update your own data', 'ACCESS_DENIED');
    }

    const user = await userService.update(id, data);

    res.status(200).json({
      success: true,
      data: { user }
    });
  });

  updateMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const data: UpdateUserBody = req.body;
    const user = await userService.update(req.user.id, data);

    res.status(200).json({
      success: true,
      data: { user }
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    if (req.user.id !== id && req.user.role !== 'admin') {
      throw new ForbiddenError('You can only delete your own account', 'ACCESS_DENIED');
    }

    await userService.delete(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  });

  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const stats = await userService.getUserStats(req.user.id);

    res.status(200).json({
      success: true,
      data: { stats }
    });
  });
}

export const userController = new UserController();
