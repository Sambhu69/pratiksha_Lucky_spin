import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { AdminPayload } from '../middleware/auth.js';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export async function login(req: Request, res: Response) {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw AppError.badRequest('Invalid login credentials provided.', parseResult.error.format());
  }

  const { username, password } = parseResult.data;

  const result = await pool.query(
    'SELECT id, username, password_hash, role FROM admins WHERE username = $1',
    [username]
  );

  if (result.rows.length === 0) {
    throw AppError.unauthorized('Invalid username or password.');
  }

  const admin = result.rows[0];
  const isMatch = await bcrypt.compare(password, admin.password_hash);
  if (!isMatch) {
    throw AppError.unauthorized('Invalid username or password.');
  }

  const payload: AdminPayload = {
    id: admin.id,
    username: admin.username,
    role: admin.role,
  };

  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });

  // Set httpOnly security cookie
  res.cookie('pks_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
  });

  return sendSuccess(
    res,
    {
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    },
    'Login successful'
  );
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('pks_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
  });

  return sendSuccess(res, null, 'Logged out successfully');
}

export async function getMe(req: Request, res: Response) {
  if (!req.admin) {
    throw AppError.unauthorized();
  }

  const result = await pool.query(
    'SELECT id, username, role, created_at FROM admins WHERE id = $1',
    [req.admin.id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Admin account not found');
  }

  return sendSuccess(res, { admin: result.rows[0] });
}
