import * as bcrypt from 'bcrypt';
import { query, transaction } from '../../config/database';
import { env } from '../../config/env';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError
} from '../../core/errors/AppError';
import { generateToken } from '../../core/middleware/auth.middleware';
import {
  RegisterInput,
  LoginInput
} from './auth.schema';
import logger from '../../config/logger';

interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  };
  token: string;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class AuthService {
  async register(data: RegisterInput): Promise<AuthResponse> {
    const { name, password } = data;
    const email = data.email.toLowerCase().trim();

    const existingUser = await query<UserRecord>(
      'SELECT id FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictError('Email already registered', 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const result = await query<UserRecord>(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash, 'user', true]
    );

    const user = result.rows[0];

    if (!user) {
      throw new Error('Failed to create user');
    }

    logger.info('User registered successfully', { userId: user.id, email: user.email });

    const token = generateToken({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at
      },
      token
    };
  }

  async login(data: LoginInput): Promise<AuthResponse> {
    const { password } = data;
    const email = data.email.toLowerCase().trim();

    const result = await query<UserRecord>(
      `SELECT id, name, email, password_hash, role, is_active, created_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const user = result.rows[0];

    if (!user) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Account is deactivated', 'ACCOUNT_INACTIVE');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info('User logged in successfully', { userId: user.id, email: user.email });

    const token = generateToken({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at
      },
      token
    };
  }

  async getCurrentUser(userId: string): Promise<AuthResponse['user']> {
    const result = await query<{
      id: string;
      name: string;
      email: string;
      role: string;
      created_at: Date;
    }>(
      `SELECT id, name, email, role, created_at
       FROM users
       WHERE id = $1 AND is_active = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const user = result.rows[0];

    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const userResult = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const user = userResult.rows[0];

    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!isCurrentValid) {
      throw new UnauthorizedError('Current password is incorrect', 'INVALID_PASSWORD');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    logger.info('Password changed successfully', { userId });
  }

  async deactivateAccount(userId: string): Promise<void> {
    await transaction(async (client) => {
      const result = await client.query(
        'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('User not found', 'USER_NOT_FOUND');
      }

      await client.query(
        'UPDATE projects SET is_archived = true WHERE user_id = $1',
        [userId]
      );
    });

    logger.info('Account deactivated', { userId });
  }
}

export const authService = new AuthService();
