# JWT Secret Rotation Strategy

## Overview

AMDOX uses **RS256** (RSA Signature with SHA-256) for JWT signing. This document outlines the key management lifecycle and zero-downtime rotation procedure.

---

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Keycloak   │───▶│  JWKS        │◀───│  NestJS API  │
│  (Issuer)    │    │  Endpoint    │    │  (Verifier)  │
└──────────────┘    └──────────────┘    └──────────────┘
       │                                        │
       │  Signs tokens with                     │  Validates tokens
       │  active private key                    │  using public keys
       │                                        │  from JWKS endpoint
       ▼                                        ▼
  Private Key (RSA)                    Public Key (JWKS)
```

## Key Specifications

| Parameter | Value |
|-----------|-------|
| Algorithm | RS256 |
| Key Size | 2048 bits (minimum), 4096 recommended for production |
| Access Token Lifetime | 1 hour |
| Refresh Token Lifetime | 7 days |
| Key Rotation Period | 90 days |
| Overlap Period | 24 hours (old key still valid for verification) |

---

## Rotation Procedure

### Phase 1: Generate New Key Pair

```bash
# Generate new RSA 4096-bit key pair
openssl genpkey -algorithm RSA -out new-private-key.pem -pkeyopt rsa_keygen_bits:4096
openssl rsa -in new-private-key.pem -pubout -out new-public-key.pem
```

### Phase 2: Add New Key to Keycloak

1. Open Keycloak Admin Console → **Realm Settings** → **Keys**
2. Click **Providers** tab → **Add keystore** → **rsa-generated**
3. Configure:
   - **Priority**: Set HIGHER than the current active key (e.g., 200)
   - **Key size**: 4096
   - **Algorithm**: RS256
4. Save

> The new key becomes the **active signing key** immediately. Existing tokens signed with the old key remain valid because Keycloak's JWKS endpoint serves both keys.

### Phase 3: Verification Window (24 hours)

During the overlap period:
- New tokens are signed with the **new key**
- Old tokens are still verified against the **old key** via JWKS
- The NestJS API fetches the JWKS endpoint and caches keys with a TTL

```
Timeline:
─────────────────────────────────────────────────────
  T=0: New key added       T=1h: All access tokens     T=24h: Remove old key
       (both keys active)       use new key                   (cleanup)
─────────────────────────────────────────────────────
```

### Phase 4: Remove Old Key

After the overlap period (24 hours minimum, recommended 7 days for refresh tokens):

1. Go to **Realm Settings** → **Keys** → **Providers**
2. Delete the old key provider
3. Verify the JWKS endpoint no longer includes the old key

### Phase 5: Rotate Application Secrets

If using the confidential client secret (separate from JWT signing):

```bash
# Update in Keycloak Admin Console → Clients → amdox-api → Credentials
# Regenerate secret and update .env
KEYCLOAK_CLIENT_SECRET=<new-secret>
```

---

## NestJS JWKS Integration

The API validates tokens using the JWKS endpoint, making key rotation transparent:

```typescript
// jwt.strategy.ts
import { passportJwtSecret } from 'jwks-rsa';

JwtModule.register({
  secretOrKeyProvider: passportJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${KEYCLOAK_URL}/realms/amdox/protocol/openid-connect/certs`,
  }),
});
```

**Key caching**: JWKS keys are cached for 10 minutes by default. After rotation, the new key is automatically picked up on the next cache refresh.

---

## Automated Rotation (Recommended)

### Using Keycloak's Built-in Rotation

Keycloak can auto-generate keys. Configure via realm JSON:

```json
{
  "components": {
    "org.keycloak.keys.KeyProvider": [
      {
        "name": "rsa-generated",
        "providerId": "rsa-generated",
        "config": {
          "priority": ["100"],
          "keySize": ["4096"],
          "algorithm": ["RS256"]
        }
      }
    ]
  }
}
```

### Using a Scheduled Job

For fully automated rotation, create a cron job:

```bash
# Run every 90 days
0 0 1 */3 * /opt/amdox/scripts/rotate-jwt-keys.sh
```

---

## Refresh Token Rotation

In addition to signing key rotation, AMDOX implements **refresh token rotation** at the application level:

1. When a refresh token is used, a **new refresh token** is issued
2. The old refresh token is **blacklisted in Redis**
3. If a blacklisted refresh token is reused (token replay attack), **all tokens for that user are revoked**

```
Client                    API                     Redis
  │                        │                        │
  │── POST /auth/refresh ─▶│                        │
  │   (old refresh token)  │── Check blacklist ────▶│
  │                        │◀── Not blacklisted ────│
  │                        │── Blacklist old token ─▶│
  │                        │── Issue new pair ──────▶│
  │◀── New access + ───────│                        │
  │    refresh tokens      │                        │
```

---

## Emergency Revocation

If a key compromise is suspected:

1. **Immediately** remove the compromised key from Keycloak
2. All tokens signed with that key become invalid instantly
3. Users will need to re-authenticate
4. Generate and add a new key pair
5. Audit logs for any suspicious activity during the exposure window

```bash
# Force all users to re-authenticate by reducing token lifespans temporarily
# Keycloak Admin CLI
kcadm.sh update realms/amdox -s accessTokenLifespan=60
# After remediation, restore normal lifespan
kcadm.sh update realms/amdox -s accessTokenLifespan=3600
```

---

## Security Checklist

- [ ] Use RSA 4096-bit keys in production
- [ ] Rotate keys every 90 days
- [ ] Monitor JWKS endpoint availability
- [ ] Log all key rotation events
- [ ] Test rotation procedure in staging before production
- [ ] Maintain 24-hour key overlap window
- [ ] Store private keys in a secrets manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)
- [ ] Never commit private keys to version control
