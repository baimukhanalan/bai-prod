import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const vercelEnvPath = path.join(repoRoot, '.vercel', 'neon.env');
if (fs.existsSync(vercelEnvPath)) {
  const managedDatabaseUrl = dotenv.parse(fs.readFileSync(vercelEnvPath)).DATABASE_URL;
  if (managedDatabaseUrl) process.env.DATABASE_URL = managedDatabaseUrl;
}
dotenv.config({ path: [path.join(repoRoot, '.env.local'), path.join(repoRoot, '.env')], quiet: true });

export const env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  BOT_TOKEN: z.string().min(20),
  JWT_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().min(20),
  OPENAI_MODEL: z.string().default('gpt-5-mini'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEBAPP_URL: z.string().url(),
  CORS_ORIGINS: z.string().optional(),
  ADMIN_CHAT_ID: z.string().optional(),
  AI_DAILY_LIMIT: z.coerce.number().int().min(1).max(50).default(5),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
}).parse(process.env);

export const allowedOrigins = new Set([
  env.WEBAPP_URL.replace(/\/$/, ''),
  ...(env.CORS_ORIGINS?.split(',').map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean) ?? []),
  ...(env.NODE_ENV === 'development' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : []),
]);
