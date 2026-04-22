import * as Joi from 'joi';

/**
 * Joi validation schema for environment variables.
 * Ensures all required configuration is present and valid at startup.
 * Applied at bootstrap via ConfigModule.forRoot().
 */
export const envValidationSchema = Joi.object({
  // ── Application ──────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  APP_NAME: Joi.string().default('AMDOX ERP Platform'),
  APP_VERSION: Joi.string().default('1.0.0'),
  CORS_ORIGINS: Joi.string().default('http://localhost:4200,http://localhost:3000'),

  // ── Database ─────────────────────────────────────────────
  DATABASE_URL: Joi.string().uri().required().messages({
    'any.required': 'DATABASE_URL is required. Set it in .env file.',
  }),

  // ── Redis ────────────────────────────────────────────────
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
  REDIS_KEY_PREFIX: Joi.string().default('amdox:'),

  // ── Keycloak ─────────────────────────────────────────────
  KEYCLOAK_BASE_URL: Joi.string().uri().required(),
  KEYCLOAK_REALM: Joi.string().required(),
  KEYCLOAK_CLIENT_ID: Joi.string().required(),
  KEYCLOAK_CLIENT_SECRET: Joi.string().required(),
  KEYCLOAK_JWKS_URI: Joi.string().uri().required(),

  // ── JWT ──────────────────────────────────────────────────
  JWT_ACCESS_EXPIRATION: Joi.number().integer().default(3600),
  JWT_REFRESH_EXPIRATION: Joi.number().integer().default(604800),
  JWT_REFRESH_SECRET: Joi.string().default('amdox-refresh-secret-change-in-production'),
  JWT_ISSUER: Joi.string().required(),
  JWT_AUDIENCE: Joi.string().default('amdox-api'),

  // ── Elasticsearch ────────────────────────────────────────
  ELASTICSEARCH_NODE: Joi.string().uri().default('http://localhost:9200'),
  ELASTICSEARCH_USERNAME: Joi.string().allow('').default(''),
  ELASTICSEARCH_PASSWORD: Joi.string().allow('').default(''),

  // ── Rate Limiting ────────────────────────────────────────
  THROTTLE_TTL: Joi.number().integer().default(60),
  THROTTLE_LIMIT: Joi.number().integer().default(100),

  // ── Logging ──────────────────────────────────────────────
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .default('debug'),
  LOG_FORMAT: Joi.string().valid('pretty', 'json').default('pretty'),

  // ── OpenTelemetry ────────────────────────────────────────
  OTEL_ENABLED: Joi.boolean().default(false),
  OTEL_SERVICE_NAME: Joi.string().default('amdox-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
}).options({ allowUnknown: true });
