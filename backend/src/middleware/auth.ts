import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';

export interface AdminPayload {
  id: string;
  username: string;
  role: 'SUPER_ADMIN' | 'STAFF';
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPayload;
    }
  }
}

export function requireAdminAuth(req: Request, _res: Response, next: NextFunction) {
  let token = req.cookies?.pks_token;

  // Fallback to Authorization: Bearer <token>
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(AppError.unauthorized('Authentication token missing. Please log in.'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AdminPayload;
    req.admin = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };
    next();
  } catch (err: any) {
    return next(AppError.unauthorized('Invalid or expired authentication session.'));
  }
}

