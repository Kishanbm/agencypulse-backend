/**
 * Called by ConfigModule at startup.
 * Throws immediately if any required env variable is missing or invalid.
 * This ensures the app never boots in a broken state.
 */

interface EnvConfig {
  NODE_ENV?: string;
  PORT?: string;
  DATABASE_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  ENCRYPTION_KEY?: string;
  FRONTEND_URL?: string;
  [key: string]: string | undefined;
}

const REQUIRED: string[] = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
  'REDIS_PASSWORD',
];

const VALID_ENVS = ['development', 'production', 'test'];

export function validateEnv(config: EnvConfig): EnvConfig {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `[Config] Missing required environment variables: ${missing.join(', ')}\n` +
        `Copy .env.example to .env and fill in the values.`,
    );
  }

  // ENCRYPTION_KEY must be a 64-char hex string (32 bytes for AES-256)
  const encKey = config['ENCRYPTION_KEY'] ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(encKey)) {
    throw new Error(
      `[Config] ENCRYPTION_KEY must be a 64-character hex string (32 bytes).\n` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }

  const nodeEnv = config['NODE_ENV'] ?? 'development';
  if (!VALID_ENVS.includes(nodeEnv)) {
    throw new Error(
      `[Config] NODE_ENV must be one of: ${VALID_ENVS.join(', ')}. Got: "${nodeEnv}"`,
    );
  }

  return config;
}
