import * as express from 'express';
import * as cors from 'cors';
import * as helmet from 'helmet';
import { Application } from 'express';
import { env } from './config/env';
import logger, { logStream } from './config/logger';
import { errorHandler, notFoundHandler } from './core/errors/errorHandler';
import { globalRateLimit } from './core/middleware/rateLimit.middleware';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import projectRoutes from './modules/projects/project.routes';

const app: Application = express();

app.use(helmet());
app.use(cors({ 
  origin: env.CORS_ORIGIN,
  credentials: true 
}));
app.use(globalRateLimit);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/projects', projectRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
