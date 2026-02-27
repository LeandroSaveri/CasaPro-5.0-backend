import { query, transaction } from '../../config/database';
import { NotFoundError, ConflictError } from '../../core/errors/AppError';
import logger from '../../config/logger';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

interface UpdateUserData {
  name?: string;
  email?: string;
}

export class UserService {
  async findAll(page: number = 1, limit: number = 10): Promise<{
    users: Omit<UserRecord, 'password_hash'>[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM users WHERE is_active = true'
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query<UserRecord>(
      `SELECT id, name, email, role, is_active, created_at, updated_at, last_login_at
       FROM users
       WHERE is_active = true
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const totalPages = Math.ceil(total / limit);

    return {
      users: result.rows,
      total,
      page,
      totalPages
    };
  }

  async findById(id: string): Promise<Omit<UserRecord, 'password_hash'>> {
    const result = await query<UserRecord>(
      `SELECT id, name, email, role, is_active, created_at, updated_at, last_login_at
       FROM users
       WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    return result.rows[0];
  }

  async findByEmail(email: string): Promise<Omit<UserRecord, 'password_hash'> | null> {
    const result = await query<UserRecord>(
      `SELECT id, name, email, role, is_active, created_at, updated_at, last_login_at
       FROM users
       WHERE email = $1 AND is_active = true`,
      [email]
    );

    return result.rows[0] || null;
  }

  async update(id: string, data: UpdateUserData): Promise<Omit<UserRecord, 'password_hash'>> {
    const { name, email } = data;

    if (email) {
      const existingUser = await query<{ id: string }>(
        'SELECT id FROM users WHERE email = $1 AND id != $2 AND is_active = true',
        [email, id]
      );

      if (existingUser.rows.length > 0) {
        throw new ConflictError('Email already in use', 'EMAIL_EXISTS');
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      values.push(email.toLowerCase().trim());
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query<UserRecord>(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND is_active = true
       RETURNING id, name, email, role, is_active, created_at, updated_at, last_login_at`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    logger.info('User updated successfully', { userId: id });

    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    await transaction(async (client) => {
      const userResult = await client.query(
        'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 AND is_active = true RETURNING id',
        [id]
      );

      if (userResult.rows.length === 0) {
        throw new NotFoundError('User not found', 'USER_NOT_FOUND');
      }

      await client.query(
        'UPDATE projects SET is_archived = true WHERE user_id = $1',
        [id]
      );
    });

    logger.info('User deleted successfully', { userId: id });
  }

  async getUserStats(userId: string): Promise<{
    totalProjects: number;
    activeProjects: number;
    archivedProjects: number;
    lastActivity: Date | null;
  }> {
    const projectsResult = await query<{
      total_projects: number;
      active_projects: number;
      archived_projects: number;
    }>(
      `SELECT 
        COUNT(*) as total_projects,
        COUNT(*) FILTER (WHERE is_archived = false) as active_projects,
        COUNT(*) FILTER (WHERE is_archived = true) as archived_projects
       FROM projects
       WHERE user_id = $1`,
      [userId]
    );

    const userResult = await query<{ last_login_at: Date | null }>(
      'SELECT last_login_at FROM users WHERE id = $1',
      [userId]
    );

    return {
      totalProjects: parseInt(projectsResult.rows[0].total_projects.toString(), 10),
      activeProjects: parseInt(projectsResult.rows[0].active_projects.toString(), 10),
      archivedProjects: parseInt(projectsResult.rows[0].archived_projects.toString(), 10),
      lastActivity: userResult.rows[0]?.last_login_at || null
    };
  }
}

export const userService = new UserService();
