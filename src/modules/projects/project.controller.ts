import { Request, Response } from 'express';
import { projectService } from './project.service';
import { ValidationError, ForbiddenError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/errorHandler';

interface CreateProjectBody {
  name: string;
  description?: string;
  data?: any;
  thumbnailUrl?: string;
}

interface UpdateProjectBody {
  name?: string;
  description?: string;
  data?: any;
  thumbnailUrl?: string;
  isArchived?: boolean;
}

export class ProjectController {
  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const includeArchived = req.query.includeArchived === 'true';

    const result = await projectService.findAllByUser(req.user.id, {
      page,
      limit,
      includeArchived
    });

    res.status(200).json({
      success: true,
      data: result
    });
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const { id } = req.params;

    const project = await projectService.findById(id, req.user.id);

    res.status(200).json({
      success: true,
      data: { project }
    });
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const data: CreateProjectBody = req.body;

    const project = await projectService.create(req.user.id, data);

    res.status(201).json({
      success: true,
      data: { project }
    });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const { id } = req.params;
    const data: UpdateProjectBody = req.body;

    const project = await projectService.update(id, req.user.id, data);

    res.status(200).json({
      success: true,
      data: { project }
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const { id } = req.params;

    await projectService.delete(id, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
  });

  archive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const { id } = req.params;

    const project = await projectService.archive(id, req.user.id);

    res.status(200).json({
      success: true,
      data: { project },
      message: 'Project archived successfully'
    });
  });

  unarchive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const { id } = req.params;

    const project = await projectService.unarchive(id, req.user.id);

    res.status(200).json({
      success: true,
      data: { project },
      message: 'Project unarchived successfully'
    });
  });

  duplicate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const { id } = req.params;
    const { name } = req.body;

    const project = await projectService.duplicate(id, req.user.id, name);

    res.status(201).json({
      success: true,
      data: { project },
      message: 'Project duplicated successfully'
    });
  });

  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const stats = await projectService.getProjectCount(req.user.id);

    res.status(200).json({
      success: true,
      data: { stats }
    });
  });

  search = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new ValidationError('Authentication required', {}, 'AUTH_REQUIRED');
    }

    const { q } = req.query;

    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const includeArchived = req.query.includeArchived === 'true';

    const result = await projectService.search(req.user.id, q as string, {
      page,
      limit,
      includeArchived
    });

    res.status(200).json({
      success: true,
      data: result
    });
  });
}

export const projectController = new ProjectController();
