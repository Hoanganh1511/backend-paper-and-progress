import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().startsWith('postgresql://'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  KEYCLOAK_BASE_URL: z.string().url(),
  KEYCLOAK_REALM: z.string(),
  KEYCLOAK_CLIENT_ID: z.string(),
  KEYCLOAK_CLIENT_SECRET: z.string(),

  JWT_ISSUER: z.string().url(),
  JWT_JWKS_URI: z.string().url(),
  JWT_AUDIENCE: z.string(),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(100),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:4000')
    .transform((s: string) => s.split(',')),
});

export type EnvConfig = z.infer<typeof envSchema>;
