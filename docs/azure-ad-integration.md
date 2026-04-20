# Azure AD Integration Guide for AMDOX

## Overview

This guide details how to configure Keycloak as an identity broker with Microsoft Azure Active Directory (Entra ID) for enterprise SSO in the AMDOX platform.

---

## Prerequisites

- Azure AD tenant with admin access
- Keycloak 25 running (via `docker-compose up keycloak`)
- AMDOX realm imported (`amdox`)

---

## Step 1: Register an Application in Azure AD

1. Navigate to **Azure Portal** → **Azure Active Directory** → **App registrations**
2. Click **New registration**
3. Configure:
   - **Name**: `AMDOX Keycloak SSO`
   - **Supported account types**: "Accounts in this organizational directory only" (Single tenant)
   - **Redirect URI**: `http://localhost:8080/realms/amdox/broker/azure-ad/endpoint`
4. Click **Register**
5. Note the **Application (client) ID** and **Directory (tenant) ID**

## Step 2: Create Client Secret

1. In the registered app, go to **Certificates & secrets**
2. Click **New client secret**
3. Set description: `Keycloak Integration` and expiry as needed
4. Click **Add** and **immediately copy the secret value**

## Step 3: Configure API Permissions

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Add:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
4. Click **Grant admin consent**

## Step 4: Configure Token Claims (Optional)

1. Go to **Token configuration** → **Add optional claim**
2. For **ID token**, add: `email`, `family_name`, `given_name`
3. For **Access token**, add: `email`

---

## Step 5: Configure Keycloak Identity Provider

1. Open Keycloak Admin Console: `http://localhost:8080/admin`
2. Select realm **amdox**
3. Navigate to **Identity providers** → Click on **azure-ad** (pre-configured but disabled)
4. Update the following fields:

| Field | Value |
|-------|-------|
| Client ID | `<Azure Application (client) ID>` |
| Client Secret | `<Azure client secret value>` |
| Authorization URL | `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/authorize` |
| Token URL | `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token` |
| Logout URL | `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/logout` |
| User Info URL | `https://graph.microsoft.com/oidc/userinfo` |
| Issuer | `https://login.microsoftonline.com/<TENANT_ID>/v2.0` |
| JWKS URL | `https://login.microsoftonline.com/<TENANT_ID>/discovery/v2.0/keys` |

5. Set **Enabled** to `ON`
6. Save

## Step 6: Configure Claim Mapping

The realm export already includes identity provider mappers for:
- `email` → `email`
- `given_name` → `firstName`
- `family_name` → `lastName`

To map the AMDOX tenant, manually assign the `tenantId` user attribute after the first login:

1. Go to **Users** → find the Azure AD linked user
2. Go to **Attributes** tab
3. Add attribute: `tenantId` = `<target-tenant-uuid>`

> **Note**: For automated tenant mapping, implement a custom Keycloak SPI that maps Azure AD groups to AMDOX tenants.

---

## Step 7: First Broker Login Flow

The default "first broker login" flow will:
1. Verify the user's email exists in Keycloak
2. If not, create a new Keycloak user linked to the Azure AD account
3. Prompt for any required actions (email verification is skipped since `trustEmail: true`)

---

## Multi-Tenant Considerations

For B2B SaaS deployments where each customer has their own Azure AD:

### Option A: Multiple Identity Providers
Create a separate Keycloak identity provider per customer Azure AD tenant:
- `azure-ad-customer-a`
- `azure-ad-customer-b`

### Option B: Multi-tenant Azure AD App
Change the Azure AD app registration to **Multitenant** and use a single Keycloak IdP:
- Set **Supported account types** to "Accounts in any organizational directory"
- Use `https://login.microsoftonline.com/common/...` endpoints

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid redirect URI" | Ensure the Keycloak callback URL is registered in Azure AD |
| User not mapped to tenant | Manually set the `tenantId` attribute in Keycloak |
| Claims missing from token | Check API permissions and optional claims configuration |
| CORS errors | Add the frontend origin to Keycloak client Web Origins |

---

## Security Checklist

- [ ] Replace development redirect URIs with production URLs
- [ ] Enable HTTPS on Keycloak in production
- [ ] Rotate Azure AD client secret before expiry
- [ ] Enable Conditional Access policies in Azure AD
- [ ] Configure session timeout limits appropriately
- [ ] Audit IdP login events regularly
