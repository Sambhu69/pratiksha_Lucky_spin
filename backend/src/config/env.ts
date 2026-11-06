import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Ensure .env is resolved reliably whether run from repo root or backend/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback to cwd

// Force Node.js process timezone to Nepal Time
process.env.TZ = 'Asia/Kathmandu';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('4000'),
  TZ: z.literal('Asia/Kathmandu').default('Asia/Kathmandu'),

  // Discrete DB parameters (prevents parsing issues with special characters in passwords)
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default('5432'),
  DB_USER: z.string().default('pratikshya_admin'),
  DB_PASSWORD: z.string().default('Pratikshya@Pokhara2026!'),
  DB_NAME: z.string().default('pratikshya_lucky_spin'),

  // Optional connection string fallback
  DATABASE_URL: z.string().optional(),

  // Security Secrets
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
