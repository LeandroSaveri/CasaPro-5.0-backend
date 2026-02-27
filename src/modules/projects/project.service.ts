import { query, transaction, getClient } from '../../config/database';
import { NotFoundError, ForbiddenError, ConflictError } from '../../core/errors/AppError';
import logger from '../../config/logger';

interface ProjectRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  data: any;
  thumbnail_url: string | null;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CreateProjectData {
  name: string;
  description?: string;
  data?: any;
  thumbnailUrl?: string;
}

interface UpdateProjectData {
  name?: string;
  description?: string;
  data?: any;
  thumbnailUrl?: string;
  isArchived?: boolean;
}

export class ProjectService {
  async findAllByUser(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      includeArchived?: boolean;
    } = {}
  ): Promise<{
    projects: ProjectRecord[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, includeArchived = false } = options;
    const offset = (page - 1) * limit;

    let countQuery = 'SELECT COUNT(*) FROM projects WHERE user_id = $1';
    let dataQuery = `SELECT id, user_id, name, description, data, thumbnail_url, is_archived, created_at, updated_at 
                     FROM projects 
                     WHERE user_id = $1`;
    const queryParams: any[] = [userId];

    if (!includeArchived) {
      countQuery += ' AND is_archived = false';
      dataQuery += ' AND is_archived = false';
    }

    const countResult = await query<{ count: string }>(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count, 10);

    dataQuery += ' ORDER BY updated_at DESC LIMIT $2 OFFSET $3';
    
    const result = await query<ProjectRecord>(dataQuery, [userId, limit, offset]);

    const totalPages = Math.ceil(total / limit);

    return {
      projects: result.rows,
      total,
      page,
      totalPages
    };
  }

  async findById(id: string, userId: string, includeArchived: boolean = false): Promise<ProjectRecord> {
    const result = await query<ProjectRecord>(
      `SELECT id, user_id, name, description, data, thumbnail_url, is_archived, created_at, updated_at
       FROM projects
       WHERE id = $1
       AND (is_archived = false OR $2 = true)`,
      [id, includeArchived]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
    }

    const project = result.rows[0];

    if (project.user_id !== userId) {
      throw new ForbiddenError('You do not have access to this project', 'ACCESS_DENIED');
    }

    return project;
  }

  async create(userId: string, data: CreateProjectData): Promise<ProjectRecord> {
    const { name, description = null, data: projectData = {}, thumbnailUrl = null } = data;

    const result = await query<ProjectRecord>(
      `INSERT INTO projects (user_id, name, description, data, thumbnail_url, is_archived)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, name, description, data, thumbnail_url, is_archived, created_at, updated_at`,
      [userId, name, description, projectData, thumbnailUrl, false]
    );

    const project = result.rows[0];

    logger.info('Project created successfully', { projectId: project.id, userId });

    return project;
  }

  async update(
    id: string,
    userId: string,
    data: UpdateProjectData
  ): Promise<ProjectRecord> {
    await this.findById(id, userId, true);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(data.name);
      paramIndex++;
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(data.description);
      paramIndex++;
    }

    if (data.data !== undefined) {
      updates.push(`data = $${paramIndex}`);
      values.push(data.data);
      paramIndex++;
    }

    if (data.thumbnailUrl !== undefined) {
      updates.push(`thumbnail_url = $${paramIndex}`);
      values.push(data.thumbnailUrl);
      paramIndex++;
    }

    if (data.isArchived !== undefined) {
      updates.push(`is_archived = $${paramIndex}`);
      values.push(data.isArchived);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.findById(id, userId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);
    values.push(userId);

    const result = await query<ProjectRecord>(
      `UPDATE projects
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING id, user_id, name, description, data, thumbnail_url, is_archived, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project not found or access denied', 'PROJECT_NOT_FOUND');
    }

    logger.info('Project updated successfully', { projectId: id, userId });

    return result.rows[0];
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project not found or access denied', 'PROJECT_NOT_FOUND');
    }

    logger.info('Project deleted successfully', { projectId: id, userId });
  }

  async archive(id: string, userId: string): Promise<ProjectRecord> {
    return this.update(id, userId, { isArchived: true });
  }

  async unarchive(id: string, userId: string): Promise<ProjectRecord> {
    return this.update(id, userId, { isArchived: false });
  }

  async duplicate(id: string, userId: string, newName?: string): Promise<ProjectRecord> {
    const originalProject = await this.findById(id, userId);

    const duplicatedName = newName || `${originalProject.name} (Copy)`;

    const result = await query<ProjectRecord>(
      `INSERT INTO projects (user_id, name, description, data, thumbnail_url, is_archived)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, name, description, data, thumbnail_url, is_archived, created_at, updated_at`,
      [
        userId,
        duplicatedName,
        originalProject.description,
        originalProject.data,
        originalProject.thumbnail_url,
        false
      ]
    );

    const duplicatedProject = result.rows[0];

    logger.info('Project duplicated successfully', { 
      originalProjectId: id, 
      newProjectId: duplicatedProject.id, 
      userId 
    });

    return duplicatedProject;
  }

  async getProjectCount(userId: string): Promise<{
    total: number;
    active: number;
    archived: number;
  }> {
    const result = await query<{
      total: number;
      active: number;
      archived: number;
    }>(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_archived = false) as active,
        COUNT(*) FILTER (WHERE is_archived = true) as archived
       FROM projects
       WHERE user_id = $1`,
      [userId]
    );

    return {
      total: parseInt(result.rows[0].total.toString(), 10),
      active: parseInt(result.rows[0].active.toString(), 10),
      archived: parseInt(result.rows[0].archived.toString(), 10)
    };
  }

  async search(
    userId: string,
    searchTerm: string,
    options: {
      page?: number;
      limit?: number;
      includeArchived?: boolean;
    } = {}
  ): Promise<{
    projects: ProjectRecord[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, includeArchived = false } = options;
    const offset = (page - 1) * limit;
    const searchPattern = `%${searchTerm}%`;

    let countQuery = `SELECT COUNT(*) FROM projects 
                      WHERE user_id = $1 
                      AND (name ILIKE $2 OR description ILIKE $2)`;
    let dataQuery = `SELECT id, user_id, name, description, data, thumbnail_url, is_archived, created_at, updated_at 
                     FROM projects 
                     WHERE user_id = $1 
                     AND (name ILIKE $2 OR description ILIKE $2)`;
    
    const queryParams: any[] = [userId, searchPattern];

    if (!includeArchived) {
      countQuery += ' AND is_archived = false';
      dataQuery += ' AND is_archived = false';
    }

    const countResult = await query<{ count: string }>(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count, 10);

    dataQuery += ' ORDER BY updated_at DESC LIMIT $3 OFFSET $4';
    
    const result = await query<ProjectRecord>(dataQuery, [userId, searchPattern, limit, offset]);

    const totalPages = Math.ceil(total / limit);

    return {
      projects: result.rows,
      total,
      page,
      totalPages
    };
  }
}

export const projectService = new ProjectService();
