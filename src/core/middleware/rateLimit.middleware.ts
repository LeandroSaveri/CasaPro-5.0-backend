import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../../config/env';
import { TooManyRequestsError } from '../errors/AppError';
import logger from '../../config/logger';

export const globalRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    return req.path === '/health' || req.path === '/api/v1/health';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: 'Too many requests, please try again later'
      }
    });
  }
});

export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Strict rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_STRICT',
        message: 'Too many attempts, please try again in 15 minutes'
      }
    });
  }
});

export const authRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    return req.body?.email || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
      path: req.path
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT',
        message: 'Too many authentication attempts, please try again later'
      }
    });
  }
});
