import { Router } from 'express';
import { projectController } from './project.controller';
import { authenticateToken } from '../../core/middleware/auth.middleware';
import { validateRequest } from '../../core/middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

const createProjectSchema = {
  body: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    data: z.any().optional(),
    thumbnailUrl: z.string().url().optional()
  })
};

const updateProjectSchema = {
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    data: z.any().optional(),
    thumbnailUrl: z.string().url().optional(),
    isArchived: z.boolean().optional()
  })
};

router.get(
  '/',
  authenticateToken,
  projectController.getAll
);

router.get(
  '/stats',
  authenticateToken,
  projectController.getStats
);

router.get(
  '/search',
  authenticateToken,
  projectController.search
);

router.post(
  '/',
  authenticateToken,
  validateRequest(createProjectSchema),
  projectController.create
);

router.get(
  '/:id',
  authenticateToken,
  projectController.getById
);

router.patch(
  '/:id',
  authenticateToken,
  validateRequest(updateProjectSchema),
  projectController.update
);

router.delete(
  '/:id',
  authenticateToken,
  projectController.delete
);

router.post(
  '/:id/archive',
  authenticateToken,
  projectController.archive
);

router.post(
  '/:id/unarchive',
  authenticateToken,
  projectController.unarchive
);

router.post(
  '/:id/duplicate',
  authenticateToken,
  projectController.duplicate
);

export default router;
