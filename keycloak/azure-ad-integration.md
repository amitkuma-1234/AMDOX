# Azure AD Integration Guide for AMDOX ERP

## Overview

This guide describes how to federate Azure Active Directory (Entra ID) with Keycloak 25 for the AMDOX ERP platform, enabling enterprise SSO for tenants using Microsoft 365.

## Architecture

```
┌──────────────┐     OIDC/SAML     ┌──────────────┐     JWT      ┌──────────────┐
│   Azure AD   │ ◄──────────────── │   Keycloak   │ ──────────── │  AMDOX API   │
│  (Entra ID)  │                   │   (IdP Hub)  │              │  (NestJS)    │
└──────────────┘                   └──────────────┘              └──────────────┘
       ▲                                  ▲
       │                                  │
  Enterprise                        Tenant-Aware
  Users (AD)                        Identity Broker
```

## Prerequisites

1. **Azure AD Tenant** with admin access
2. **Keycloak 25** running with AMDOX realm configured
3. **DNS** configured for your Keycloak domain

---

## Step 1: Register Application in Azure AD

### 1.1 Create App Registration

1. Navigate to [Azure Portal](https://portal.azure.com) → **Azure Active Directory** → **App registrations**
2. Click **New registration**
3. Configure:
   - **Name**: `AMDOX ERP - Keycloak Federation`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: 
     - Type: `Web`
     - URI: `https://<keycloak-domain>/realms/amdox/broker/azure-ad/endpoint`

### 1.2 Configure Client Secret

1. Go to **Certificates & secrets** → **New client secret**
2. Description: `AMDOX Keycloak Federation`
3. Expiry: `24 months` (set calendar reminder for rotation)
4. **Copy the secret value immediately** — it won't be shown again

### 1.3 Configure API Permissions

1. Go to **API permissions** → **Add a permission**
2. Add the following **Microsoft Graph** delegated permissions:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
3. Click **Grant admin consent**

### 1.4 Configure Token Claims

1. Go to **Token configuration** → **Add optional claim**
2. Token type: **ID**
3. Add claims: `email`, `family_name`, `given_name`, `preferred_username`
4. Token type: **Access**
5. Add claims: `email`, `groups`

### 1.5 Note Required Values

```env
AZURE_AD_TENANT_ID=<your-tenant-id>
AZURE_AD_CLIENT_ID=<application-client-id>
AZURE_AD_CLIENT_SECRET=<client-secret-value>
```

---

## Step 2: Configure Keycloak Identity Provider

### 2.1 Add Azure AD as Identity Provider

1. Login to Keycloak Admin Console
2. Navigate to **Identity Providers** → **Add provider** → **OpenID Connect v1.0**
3. Configure:

| Field | Value |
|-------|-------|
| Alias | `azure-ad` |
| Display Name | `Sign in with Microsoft` |
| Discovery URL | `https://login.microsoftonline.com/<TENANT_ID>/v2.0/.well-known/openid-configuration` |
| Client ID | `<AZURE_AD_CLIENT_ID>` |
| Client Secret | `<AZURE_AD_CLIENT_SECRET>` |
| Client Authentication | `Client secret sent as post` |
| Default Scopes | `openid profile email` |
| Sync Mode | `import` |
| Trust Email | `true` |

### 2.2 Configure Mappers

Create the following identity provider mappers:

#### Email Mapper
- **Name**: `email`
- **Mapper Type**: `Attribute Importer`
- **Claim**: `email`
- **User Attribute Name**: `email`

#### First Name Mapper
- **Name**: `first-name`
- **Mapper Type**: `Attribute Importer`
- **Claim**: `given_name`
- **User Attribute Name**: `firstName`

#### Last Name Mapper
- **Name**: `last-name`
- **Mapper Type**: `Attribute Importer`
- **Claim**: `family_name`
- **User Attribute Name**: `lastName`

#### Tenant ID Mapper (Hardcoded per Integration)
- **Name**: `tenant-id`
- **Mapper Type**: `Hardcoded Attribute`
- **User Attribute Name**: `tenantId`
- **User Attribute Value**: `<TENANT_ID_FOR_THIS_AZURE_AD>`

> **Note**: Each Azure AD tenant integration maps to a specific AMDOX tenant. 
> For multi-tenant Azure AD, create separate Identity Providers per AMDOX tenant.

### 2.3 Configure First Login Flow

1. Go to **Authentication** → **Flows** → **Duplicate** `first broker login`
2. Name: `azure-ad-first-login`
3. Configure:
   - **Review Profile**: `REQUIRED` (first time only)
   - **Create User If Unique**: `ALTERNATIVE`
   - **Link Existing Account**: `ALTERNATIVE` (by email)
4. Set this flow in the Azure AD Identity Provider settings under **First Login Flow**

---

## Step 3: Tenant-Scoped Configuration

### 3.1 Per-Tenant Azure AD Setup

For each tenant that uses Azure AD, create a separate Identity Provider with:

```
Alias: azure-ad-{tenant-slug}
Display Name: Sign in with Microsoft ({Tenant Name})
```

### 3.2 Conditional Authentication Flow

To show the correct Azure AD login button per tenant, configure a custom authentication flow that:

1. Checks the `kc_idp_hint` query parameter
2. Redirects to the correct Azure AD IdP based on tenant context
3. Falls back to username/password if no hint is provided

### 3.3 Login URL Pattern

```
https://<keycloak>/realms/amdox/protocol/openid-connect/auth
  ?client_id=amdox-web
  &redirect_uri=https://app.amdox.com/callback
  &response_type=code
  &scope=openid profile email
  &kc_idp_hint=azure-ad-{tenant-slug}
```

---

## Step 4: Group/Role Mapping

### 4.1 Azure AD Group Claims

1. In Azure AD App Registration → **Token configuration**
2. **Add groups claim** → Select **Security groups**
3. Customize token properties: emit groups as **sAMAccountName**

### 4.2 Keycloak Group Mapper

Create an Identity Provider mapper:

- **Name**: `azure-ad-groups`
- **Mapper Type**: `Claim to Group`
- **Claim**: `groups`
- **Create groups if not exists**: `true`

### 4.3 Role Mapping Table

| Azure AD Group | Keycloak Role | AMDOX Permission |
|----------------|---------------|------------------|
| `AMDOX-Admins` | `tenant_admin` | Full tenant access |
| `AMDOX-Finance` | `accountant` | Finance module |
| `AMDOX-HR` | `hr_manager` | HR module |
| `AMDOX-Inventory` | `inventory_manager` | Inventory module |
| `AMDOX-Procurement` | `procurement_officer` | Procurement module |
| `AMDOX-Auditors` | `auditor` | Read-only audit |

---

## Step 5: Testing & Validation

### 5.1 Test Authentication Flow

```bash
# 1. Initiate login with Azure AD hint
open "http://localhost:8080/realms/amdox/protocol/openid-connect/auth?client_id=amdox-api&redirect_uri=http://localhost:3000/callback&response_type=code&scope=openid&kc_idp_hint=azure-ad"

# 2. Exchange code for tokens
curl -X POST http://localhost:8080/realms/amdox/protocol/openid-connect/token \
  -d "grant_type=authorization_code" \
  -d "client_id=amdox-api" \
  -d "client_secret=<secret>" \
  -d "code=<auth_code>" \
  -d "redirect_uri=http://localhost:3000/callback"

# 3. Verify token claims include tenant_id
jwt decode <access_token>
```

### 5.2 Verify Claims

The JWT should contain:
```json
{
  "sub": "user-uuid",
  "email": "user@company.com",
  "tenant_id": "tenant-uuid",
  "tenant_name": "Company Name",
  "roles": ["tenant_admin", "accountant"],
  "permissions": ["finance:read", "finance:write"]
}
```

---

## Security Considerations

1. **Client Secret Rotation**: Rotate Azure AD client secret every 12 months
2. **Conditional Access**: Apply Azure AD Conditional Access policies
3. **MFA**: Azure AD MFA is enforced before reaching Keycloak
4. **Session Management**: Configure session timeouts in both Azure AD and Keycloak
5. **Audit Logging**: Enable admin events in Keycloak for federation tracking
6. **SCIM Provisioning**: Consider Azure AD SCIM for automated user provisioning

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `invalid_client` error | Verify client ID/secret in Keycloak IdP config |
| User not created | Check "Create User If Unique" in first login flow |
| Missing tenant_id claim | Verify hardcoded attribute mapper is configured |
| Groups not syncing | Ensure group claims are enabled in Azure AD token config |
| CORS errors | Add Keycloak domain to Azure AD redirect URIs |
