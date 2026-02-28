import { config } from 'dotenv';

config();

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET'
] as const;

type RequiredEnvVar = typeof requiredEnvVars[number];

interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  BCRYPT_ROUNDS: number;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  CORS_ORIGIN: string | string[];
  
  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRO_PRICE_ID: string;
  STRIPE_ENTERPRISE_PRICE_ID: string;
  
  // Frontend URL para redirecionamentos
  FRONTEND_URL: string;
}

function getEnvVar(key: RequiredEnvVar): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}

function parseIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

function getCorsOrigin(): string | string[] {
  const origin = process.env.CORS_ORIGIN;
  if (!origin) {
    return [
      'https://casa-pro-5-0.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
  }
  return origin.split(',').map(o => o.trim());
}

export const env: EnvConfig = {
  NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  BCRYPT_ROUNDS: parseIntEnv('BCRYPT_ROUNDS', 12),
  RATE_LIMIT_WINDOW_MS: parseIntEnv('RATE_LIMIT_WINDOW_MS', 900000),
  RATE_LIMIT_MAX_REQUESTS: parseIntEnv('RATE_LIMIT_MAX_REQUESTS', 100),
  CORS_ORIGIN: getCorsOrigin(),
  
  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID || '',
  STRIPE_ENTERPRISE_PRICE_ID: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
  
  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
};

export default env;
