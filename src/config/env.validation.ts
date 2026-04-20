import * as Joi from 'joi';

/**
 * Joi validation schema for environment variables.
 * Applied at bootstrap via ConfigModule.forRoot().
 * Fails fast with clear error messages if required vars are missing.
 */
export const envValidationSchema = Joi.object({
  // ── Application ──────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  APP_NAME: Joi.string().default('AMDOX'),
  APP_VERSION: Joi.string().default('1.0.0'),
  CORS_ORIGINS: Joi.string().default('http://localhost:4200,http://localhost:3000'),

  // ── Database ─────────────────────────────────────────────
  DATABASE_URL: Joi.string().uri().required().messages({
    'any.required': 'DATABASE_URL is required. Example: postgresql://user:pass@localhost:5432/db',
  }),

  // ── Redis ────────────────────────────────────────────────
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().default(0),

  // ── Keycloak ─────────────────────────────────────────────
  KEYCLOAK_BASE_URL: Joi.string().uri().required(),
  KEYCLOAK_REALM: Joi.string().required(),
  KEYCLOAK_CLIENT_ID: Joi.string().required(),
  KEYCLOAK_CLIENT_SECRET: Joi.string().required(),
  KEYCLOAK_JWKS_URI: Joi.string().uri().required(),
  KEYCLOAK_TOKEN_URL: Joi.string().uri().required(),
  KEYCLOAK_USERINFO_URL: Joi.string().uri().required(),

  // ── JWT ──────────────────────────────────────────────────
  JWT_ACCESS_EXPIRATION: Joi.number().default(3600),
  JWT_REFRESH_EXPIRATION: Joi.number().default(604800),
  JWT_ISSUER: Joi.string().default('amdox-api'),

  // ── Elasticsearch ────────────────────────────────────────
  ELASTICSEARCH_NODE: Joi.string().uri().default('http://localhost:9200'),
  ELASTICSEARCH_USERNAME: Joi.string().allow('').default(''),
  ELASTICSEARCH_PASSWORD: Joi.string().allow('').default(''),

  // ── Rate Limiting ────────────────────────────────────────
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(60),

  // ── OpenTelemetry ────────────────────────────────────────
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
  OTEL_SERVICE_NAME: Joi.string().default('amdox-api'),

  // ── Logging ──────────────────────────────────────────────
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .default('debug'),
});
