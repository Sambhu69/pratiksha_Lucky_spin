import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const nepalTime = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kathmandu',
    hour12: false,
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const statusColor =
      statusCode >= 500
        ? '\x1b[31m' // Red
        : statusCode >= 400
        ? '\x1b[33m' // Yellow
        : statusCode >= 300
        ? '\x1b[36m' // Cyan
        : '\x1b[32m'; // Green
    const reset = '\x1b[0m';

    console.log(
      `[${nepalTime} NPT] ${req.method} ${req.originalUrl || req.url} ${statusColor}${statusCode}${reset} - ${duration}ms`
    );
  });

  next();
}

