# AMDOX ERP — API Documentation

## Overview

The AMDOX API is a RESTful service built with NestJS 11. Interactive documentation is available via Swagger UI at `/api-docs` when the server is running.

**Base URL:** `https://api.amdox.io/api/v1/`

## Authentication

### JWT Bearer Token

All API requests require a valid JWT obtained from Keycloak:

```bash
# 1. Get token from Keycloak
curl -X POST "https://keycloak.amdox.io/realms/amdox/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=amdox-api" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "username=admin@amdox.io" \
  -d "password=${PASSWORD}"

# 2. Use token in API requests
curl -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "https://api.amdox.io/api/v1/employees"
```

### Token Refresh

```bash
curl -X POST "https://keycloak.amdox.io/realms/amdox/protocol/openid-connect/token" \
  -d "grant_type=refresh_token" \
  -d "client_id=amdox-api" \
  -d "refresh_token=${REFRESH_TOKEN}"
```

**Token Lifetime:**
- Access token: 15 minutes
- Refresh token: 30 days
- Rotation: New refresh token on each refresh

## Error Responses

All errors follow a standard schema:

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "details": [
    {
      "field": "amount",
      "constraint": "isPositive",
      "message": "amount must be a positive number"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/invoices",
  "traceId": "a1b2c3d4e5f6"
}
```

### Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Malformed request body |
| 401 | Unauthorized | Missing/invalid JWT |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable | Validation failure |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server error |

## Rate Limits

| Tier | Limit | Window |
|------|-------|--------|
| Standard | 1000 req | 1 minute |
| Authenticated | 1000 req/user | 1 minute |
| Unauthenticated | 100 req/IP | 1 minute |
| Bulk operations | 50 req | 1 minute |

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1705312260
```

## Pagination

### Cursor-based (Recommended)

```bash
GET /api/v1/employees?limit=20&cursor=eyJpZCI6MTAwfQ==

# Response
{
  "data": [...],
  "meta": {
    "hasMore": true,
    "nextCursor": "eyJpZCI6MTIwfQ==",
    "total": 500
  }
}
```

### Offset-based (Legacy)

```bash
GET /api/v1/employees?page=1&pageSize=20
```

## Versioning

- Current version: `v1`
- URL prefix: `/api/v1/`
- Backward compatibility maintained within major version
- Breaking changes → new version (`/api/v2/`)
- Deprecation notice: 6 months before removal

## Core Endpoints

### Finance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gl-accounts` | List GL accounts |
| POST | `/api/v1/journal-entries` | Create journal entry |
| GET | `/api/v1/invoices` | List invoices |
| POST | `/api/v1/invoices` | Create invoice |
| GET | `/api/v1/fiscal-periods` | List fiscal periods |

### HR & Payroll

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/employees` | List employees |
| POST | `/api/v1/employees` | Create employee |
| POST | `/api/v1/payroll/run` | Trigger payroll run |
| GET | `/api/v1/leave-requests` | List leave requests |
| POST | `/api/v1/leave-requests` | Submit leave request |

### Supply Chain

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/purchase-orders` | List POs |
| POST | `/api/v1/purchase-orders` | Create PO |
| POST | `/api/v1/goods-receipts` | Record goods receipt |
| GET | `/api/v1/inventory/stock` | Current stock levels |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe |
| GET | `/api-docs` | Swagger UI |
| GET | `/metrics` | Prometheus metrics |
