import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pool } from './config/db.js';
import { env } from './config/env.js';
import { sendSuccess } from './utils/apiResponse.js';
import { AppError } from './utils/appError.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { router as apiRouter } from './routes/api.js';

export const app = express();

// 1. Security Headers
app.use(helmet());

// 2. Structured Request Logging (Asia/Kathmandu timestamps)
app.use(requestLogger);

// 3. CORS Configuration for Kiosk & Admin Frontend
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(','),
    credentials: true,
  })
);

// 4. Body & Cookie Parsing
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// 5. API Routes
app.use('/api', apiRouter);

// 6. Health & Diagnostics Endpoint
app.get(
  '/api/health',
  asyncHandler(async (_req: Request, res: Response) => {
    let dbStatus = 'DISCONNECTED';
    let dbTime = null;
    let dbTimezone = null;

    try {
      const dbResult = await pool.query(`
        SELECT 
          NOW() AS db_time, 
          current_setting('TIMEZONE') AS db_timezone
      `);
      dbStatus = 'CONNECTED';
      dbTime = dbResult.rows[0].db_time;
      dbTimezone = dbResult.rows[0].db_timezone;
    } catch (err: any) {
      dbStatus = `ERROR: ${err.message}`;
    }

    const memoryUsage = process.memoryUsage();

    return sendSuccess(res, {
      service: 'Pratikshya Lucky Spin Backend API',
      status: 'UP',
      location: 'Pokhara, Nepal',
      timezone: {
        configured: env.TZ,
        activeProcess: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offset: '+05:45',
        serverTimeNepal: new Date().toLocaleString('en-US', {
          timeZone: 'Asia/Kathmandu',
          hour12: false,
        }),
      },
      database: {
        status: dbStatus,
        timezone: dbTimezone,
        timestamp: dbTime,
        pool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        },
      },
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        memoryMB: {
          rss: (memoryUsage.rss / 1024 / 1024).toFixed(2),
          heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
          heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
        },
      },
    });
  })
);

// 6. 404 Route Handler
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
});

// 7. Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || (err instanceof AppError ? err.statusCode : 500);
  const isOperational = err.isOperational ?? false;

  if (statusCode >= 500) {
    console.error('[Unhandled Internal Error]:', err);
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational || env.NODE_ENV !== 'production' ? err.message : 'Internal Server Error',
    ...(err.details ? { details: err.details } : {}),
    timestamp: new Date().toISOString(),
  });
});
