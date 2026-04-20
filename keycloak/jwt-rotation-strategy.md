# JWT Secret Rotation Strategy

## Overview

AMDOX uses RS256 (RSA-SHA256) asymmetric keys for JWT signing. This document outlines the key rotation strategy for both Keycloak-managed keys and application-level JWT handling.

## Key Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Keycloak 25                       │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐ ┌─────────────┐  │
│  │  Active Key  │  │ Passive Key │ │ Retired Key │  │
│  │  (Signing)   │  │ (Verify)    │ │ (Expired)   │  │
│  │  kid: key-3  │  │ kid: key-2  │ │ kid: key-1  │  │
│  └─────────────┘  └─────────────┘ └─────────────┘  │
│                                                     │
│  JWKS Endpoint: /realms/amdox/protocol/             │
│    openid-connect/certs                             │
└─────────────────────────────────────────────────────┘
         │
         ▼ (JWKS auto-discovery)
┌─────────────────────────────────────────────────────┐
│                  AMDOX NestJS API                    │
│                                                     │
│  JwtStrategy: validates using JWKS endpoint         │
│  - Caches JWKS keys (5 min TTL)                     │
│  - Auto-refreshes on kid mismatch                   │
│  - Supports multiple active keys                    │
└─────────────────────────────────────────────────────┘
```

## Rotation Schedule

| Component | Algorithm | Key Size | Rotation Period | Grace Period |
|-----------|-----------|----------|----------------|--------------|
| Keycloak RSA | RS256 | 2048-bit | 90 days | 30 days |
| Keycloak HMAC | HS256 | 256-bit | 90 days | 30 days |
| Keycloak AES | AES | 128-bit | 90 days | 30 days |
| App Refresh Token | RS256 | 2048-bit | 180 days | 60 days |

## Keycloak Key Provider Configuration

### RSA Key Provider (Primary Signing)

```json
{
  "name": "rsa-generated",
  "providerId": "rsa-generated",
  "config": {
    "priority": ["100"],
    "keySize": ["2048"],
    "algorithm": ["RS256"],
    "active": ["true"],
    "enabled": ["true"]
  }
}
```

### Rotation Procedure

#### Step 1: Generate New Key (Day 0)

1. Go to Keycloak Admin → **Realm Settings** → **Keys** → **Providers**
2. Add new RSA key provider with **higher priority**:
   - Priority: `200` (higher than current active key)
   - Key Size: `2048`
   - Algorithm: `RS256`
3. The new key automatically becomes the **active signing key**
4. The old key remains as a **passive verification key**

#### Step 2: Grace Period (Days 0-30)

During this period:
- **New tokens** are signed with the new key (kid: key-new)
- **Existing tokens** signed with old key (kid: key-old) are still valid
- The JWKS endpoint serves **both** keys
- API validates using JWKS auto-discovery (both keys work)

#### Step 3: Retire Old Key (Day 30)

1. Set old key provider priority to `0`
2. Wait for all access tokens to expire (max 1 hour)
3. Wait for all refresh tokens to expire or be rotated (max 7 days)
4. **Disable** old key provider (don't delete yet)

#### Step 4: Cleanup (Day 60)

1. **Delete** disabled key provider
2. Verify JWKS endpoint only serves current keys
3. Update audit log

## API-Side JWKS Handling

### NestJS JWT Strategy Configuration

```typescript
// The API uses jwks-rsa library for automatic key resolution
JwtModule.registerAsync({
  useFactory: () => ({
    // No static secret needed - keys fetched from JWKS
    secretOrKeyProvider: (request, rawJwtToken, done) => {
      const client = jwksClient({
        jwksUri: `${KEYCLOAK_URL}/realms/amdox/protocol/openid-connect/certs`,
        cache: true,
        cacheMaxAge: 300000, // 5 minutes
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      });

      const header = jwt.decode(rawJwtToken, { complete: true })?.header;
      client.getSigningKey(header.kid, (err, key) => {
        done(err, key?.getPublicKey());
      });
    },
  }),
});
```

### Key Cache Invalidation

The API handles key rotation automatically:

1. **Cache Hit**: Use cached JWKS key (5 min TTL)
2. **Cache Miss (new kid)**: Fetch fresh JWKS from Keycloak
3. **Validation Failure**: Clear cache and retry once
4. **Persistent Failure**: Reject token, log alert

## Automated Rotation via API

### Keycloak Admin API Rotation Script

```bash
#!/bin/bash
# rotate-keys.sh — Run via cron every 90 days

KEYCLOAK_URL="https://keycloak.amdox.com"
REALM="amdox"
ADMIN_TOKEN=$(curl -s -X POST \
  "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=admin-cli" \
  -d "client_secret=$KC_ADMIN_SECRET" | jq -r '.access_token')

# Get current key providers
CURRENT_KEYS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$KEYCLOAK_URL/admin/realms/$REALM/keys" | jq '.keys')

# Trigger key rotation by creating new provider
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "$KEYCLOAK_URL/admin/realms/$REALM/components" \
  -d '{
    "name": "rsa-generated-'$(date +%Y%m%d)'",
    "providerId": "rsa-generated",
    "providerType": "org.keycloak.keys.KeyProvider",
    "config": {
      "priority": ["200"],
      "keySize": ["2048"],
      "algorithm": ["RS256"],
      "active": ["true"],
      "enabled": ["true"]
    }
  }'

echo "Key rotation initiated at $(date)"
echo "Grace period: 30 days"
echo "Old keys will be retired after grace period"
```

## Monitoring & Alerts

| Metric | Threshold | Action |
|--------|-----------|--------|
| Key age | > 80 days | Warning: rotation due soon |
| Key age | > 90 days | Critical: rotate immediately |
| JWKS fetch failures | > 5/min | Alert: Keycloak connectivity |
| Token validation failures | > 10/min | Alert: possible key mismatch |
| Expired key still in JWKS | > 60 days post-rotation | Cleanup required |

## Emergency Rotation

In case of key compromise:

1. **Immediately** generate new key with highest priority
2. **Immediately** disable compromised key
3. **Force logout** all sessions: `POST /admin/realms/amdox/logout-all`
4. **Invalidate** all refresh tokens
5. **Clear** API-side JWKS cache
6. **Audit** all tokens signed with compromised key
7. **Notify** all tenants of forced re-authentication

## Compliance Notes

- All key rotations are logged in Keycloak admin events
- Key material never leaves Keycloak (only public keys in JWKS)
- RSA 2048-bit keys meet NIST SP 800-131A requirements
- 90-day rotation meets SOC 2 Type II requirements
- Emergency rotation procedure meets PCI DSS 3.6 requirements
