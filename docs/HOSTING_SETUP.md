# Free Hosting Setup Guide

This guide explains how to host the Pro App License Portal at no monthly infrastructure cost.

The recommended hosted target is Cloudflare Workers + D1 + Secrets. The current repository is still a Node 18 prototype with JSON persistence, so use the local Node deployment for development and demonstrations only. Do not use the current JSON-backed prototype as the production licensing authority until the production migration steps in this guide are complete.

## Hosting Plan

Use the following components:

- Cloudflare Workers for the public API and admin web service
- Cloudflare D1 for customers, application profiles, licenses, activations, and audit records
- Cloudflare Worker Secrets for the Ed25519 private signing key and admin secrets
- Cloudflare Pages or the Worker static asset support for the portal UI
- Stripe Payment Links or Lemon Squeezy for payments, added later through webhooks
- A private GitHub repository for source code

Expected infrastructure cost is zero for low-volume use within the provider's free allowances. Payment providers still charge transaction fees when customers purchase licenses.

## Home Assistant Hosting Option

The portal can also be hosted as a private Home Assistant add-on. This is useful when
the operator wants the licensing dashboard and local application data inside the same
Home Assistant installation. It does not require a monthly hosting fee.

### Recommended Home Assistant architecture

Use Home Assistant for the private operator-facing portal and local administration:

```text
Home Assistant
  └── Pro App License Portal add-on
        ├── Home Assistant ingress for the admin UI
        ├── Persistent /data volume for local state
        └── Optional management/API port
```

For a production licensing service, keep public payment webhooks and the signing
authority in the Cloudflare Worker deployment described later in this guide. The Home
Assistant add-on can operate as a private issuer or an administration client, but a
home installation is not a dependable public webhook endpoint and should not expose its
private signing key to the Internet.

### Home Assistant add-on setup

1. Create a separate add-on repository or add-on directory for the portal.
2. Add an add-on `config.yaml` with a unique slug, supported architectures, and
   `ingress: true`.
3. Package the Node portal in a Docker image based on a supported Home Assistant base
   image, or use a production runtime such as Node with a process supervisor.
4. Mount persistent application state at `/data`.
5. Configure the portal to listen on an internal port such as `3000`.
6. Expose the management port only when direct access from a trusted LAN client is
   required. Keep it disabled by default when Home Assistant ingress is sufficient.
7. Store the administrator password and signing configuration in add-on options or
   secrets, never in the image or repository.
8. Start the add-on and open it through the Home Assistant sidebar.

Example add-on metadata:

```yaml
name: "Pro App License Portal"
slug: "pro_app_license_portal"
description: "Private application licensing administration portal"
version: "0.1.0"
arch:
  - amd64
  - aarch64
init: false
ingress: true
panel_icon: "mdi:key-chain"
ports:
  3000/tcp: null
options:
  portal_admin_password: ""
schema:
  portal_admin_password: password
```

The exact base image and startup command depend on the Home Assistant add-on
repository conventions. The portal must bind to `0.0.0.0`, not only `localhost`, so
the Supervisor ingress proxy can reach it.

### Home Assistant persistence and backups

Persist at least:

- Portal database or state store
- Audit records
- Application profiles
- License metadata
- Activation records

Do not include raw private signing keys in ordinary application exports or customer
backup archives. If the add-on is the signing authority, protect the key in a separate
secret location and document how it is restored. Losing the signing key can prevent
verification of all licenses issued by that installation.

### Home Assistant limitations

- Ingress is appropriate for private administration, not public payment webhooks.
- Home Assistant may be offline, so payment processing and renewal callbacks cannot
  depend on it being reachable from the Internet.
- Home Assistant backups and restores can duplicate an installation; activation identity
  and signing-key handling must account for restore and migration scenarios.
- Direct port exposure should be limited to a trusted network and should not replace
  admin authentication.
- The add-on update lifecycle is separate from Worker deployment and must use valid
  semantic add-on versions.

### Home Assistant plus Cloudflare hybrid

The strongest free architecture is hybrid:

1. Run the private admin UI or local operations portal in Home Assistant ingress.
2. Run the public activation, payment webhook, and license-signing API in Cloudflare
   Workers with D1 and Worker Secrets.
3. Allow the Home Assistant instance to call the Worker API for activation and renewal.
4. Keep paid license verification available offline inside each licensed application.

This keeps the Home Assistant experience convenient without making a home network
publicly reachable or placing the production signing key inside a local add-on.

## Phase 1: Run the Current Prototype Locally

Use this phase to validate the licensing workflow before deploying a hosted service.

### 1. Install prerequisites

Install:

- Node.js 18 or newer
- Git
- A current browser

Verify the tools:

```powershell
node --version
npm --version
git --version
```

### 2. Clone the portal

```powershell
git clone https://github.com/cjramseyer/ha-keystone C:\devel\Personal-GitHub\ha-keystone
cd C:\devel\Personal-GitHub\ha-keystone
cd keystone
npm install
```

### 3. Configure a local administrator password

Set the password before the first launch:

```powershell
$env:PORTAL_ADMIN_PASSWORD = "use-a-long-local-password"
```

The current prototype uses `admin` as the administrator username. Do not use the fallback password outside a disposable local demo.

### 4. Start the portal

```powershell
npm start
```

Open:

```text
http://localhost:3000
```

Run the source checks in another terminal:

```powershell
cd keystone
npm run check
```

The prototype stores local state in `keystone/.data/` and generates issuer keys in `keystone/.secrets/`. Both directories must stay out of Git. Back them up securely if the local prototype is used for a private test environment.

## Phase 2: Prepare the Production Application

The current `keystone/server.js` and `keystone/app.js` are not yet Cloudflare Worker entry points. Before deployment, split the application into runtime-neutral modules.

### 1. Separate the portal layers

Create these logical modules:

```text
src/
  worker.ts              # Cloudflare Worker fetch handler
  auth.ts                # admin authentication and session validation
  profiles.ts            # application profile operations
  licenses.ts            # license issuance, renewal, and revocation
  activations.ts         # activation and lease operations
  signing.ts             # Ed25519 signing and verification
  db.ts                  # D1 queries
  validation.ts          # request and payload validation
  audit.ts               # audit event writes
  static-assets.ts       # portal UI assets
migrations/
  0001_initial.sql
wrangler.toml
```

Keep the signing and license rules independent of the HTTP framework so they can be tested locally and in the Worker runtime.

### 2. Replace JSON persistence with D1

Do not copy `.data/` into production. Create D1 tables for:

- `app_profiles`
- `customers`
- `licenses`
- `activations`
- `payment_events`
- `audit_events`
- `admin_users` or an external admin identity mapping

Use migrations and parameterized SQL. Do not build SQL statements by concatenating request values.

### 3. Move private keys to Worker Secrets

Generate an Ed25519 key pair outside the public repository. Keep:

- Private key: Cloudflare Worker Secret only
- Public key: application verification configuration and portal profile metadata

Never commit either private key or a production token to GitHub. The current `.secrets/` directory is for local development only.

### 4. Add production authentication

Protect administrative operations with Cloudflare Access, an external identity provider, or a carefully implemented admin authentication flow with MFA.

At minimum, protect:

- Application profile creation and editing
- License issuance
- License renewal
- License revocation
- Activation resets
- Signing-key rotation
- Payment event inspection

Do not expose issuer endpoints as unauthenticated public APIs.

## Phase 3: Install Cloudflare Tools

Install Wrangler:

```powershell
npm install --save-dev wrangler
npx wrangler login
```

The login command opens a browser. Authenticate with the Cloudflare account that owns the Worker and D1 database.

## Phase 4: Create the Free Cloudflare Resources

### 1. Create a Worker

From the portal repository:

```powershell
npx wrangler init pro-app-license-portal
```

Choose a Worker project and TypeScript if prompted. If the existing repository is retained instead of using generated files, add Wrangler configuration manually.

### 2. Create D1

```powershell
npx wrangler d1 create pro-app-license-portal-db
```

Copy the returned database binding into `wrangler.toml`.

Example configuration:

```toml
name = "pro-app-license-portal"
main = "src/worker.ts"
compatibility_date = "2026-09-14"

[[d1_databases]]
binding = "DB"
database_name = "pro-app-license-portal-db"
database_id = "replace-with-cloudflare-id"

[assets]
directory = "./public"
```

Use the exact configuration generated by Wrangler for the current Cloudflare runtime. Do not commit account-specific secrets.

### 3. Add database migrations

Create `migrations/0001_initial.sql` with the profile, customer, license, activation, payment, and audit tables described in `LICENSE_PORTAL_IMPLEMENTATION.md`.

Apply locally first:

```powershell
npx wrangler d1 migrations apply pro-app-license-portal-db --local
```

Apply to the hosted database only after reviewing the migration:

```powershell
npx wrangler d1 migrations apply pro-app-license-portal-db --remote
```

## Phase 5: Configure Secrets

Set the private signing key as a Worker Secret:

```powershell
npx wrangler secret put LICENSE_SIGNING_PRIVATE_KEY
```

Add separate secrets for administrative operations as needed:

```powershell
npx wrangler secret put PORTAL_ADMIN_SECRET
npx wrangler secret put PAYMENT_WEBHOOK_SECRET
```

Do not put these values in `wrangler.toml`, `.env` files committed to Git, or the BarTender add-on.

For local development, use an untracked `.dev.vars` file and keep it in `.gitignore`.

## Phase 6: Deploy the Worker

Run the local Worker first:

```powershell
npx wrangler dev
```

Verify the health endpoint:

```powershell
Invoke-WebRequest http://localhost:8787/v1/health
```

Deploy after local checks pass:

```powershell
npx wrangler deploy
```

Record the deployed Worker URL, for example:

```text
https://pro-app-license-portal.example.workers.dev
```

A custom domain is optional. The `workers.dev` address can be used for an initial free deployment.

## Phase 7: Protect the Admin Interface

Use Cloudflare Access for the admin route or put the admin interface behind an identity-aware route.

Recommended separation:

```text
/v1/activate                 limited customer/application access
/v1/health                   public health status
/v1/webhooks/payment         provider-authenticated webhook
/admin                       Cloudflare Access protected
/v1/admin/*                  Cloudflare Access protected
```

The application itself must still authorize every administrative operation. Cloudflare Access is an additional perimeter, not a replacement for application authorization.

## Phase 8: Register an Application Profile

Create an application profile before issuing licenses. Each profile should define:

- Stable `app_id`
- Display name
- Plans and features
- Trial duration
- Installation limit
- Token audience
- Public verification keys
- Billing product references

Example:

```json
{
  "app_id": "bartender",
  "name": "BarTender",
  "plans": ["base", "pro"],
  "trial_days": 30,
  "installation_limit": 2,
  "token_audience": "bartender"
}
```

A license issued for one profile must not activate another application.

## Phase 9: Test Instance-Bound Activation

The application should generate an installation ID and instance key pair locally. A customer activation request should include:

- `app_id`
- `instance_id`
- `instance_key_id`
- `instance_public_key`
- Application version
- A nonce signed by the installation private key
- Customer information

Test the following cases before issuing real licenses:

- Valid instance request is accepted.
- Wrong application profile is rejected.
- Invalid signature is rejected.
- Reused installation exceeds the installation limit.
- Revoked activation cannot renew.
- A copied license cannot activate a different installation.
- A paid license continues to validate during a short portal outage.

## Phase 10: Add Trial and Paid Issuance

For the free MVP, issue licenses manually from the protected admin interface:

1. Create or find the customer.
2. Select the application profile.
3. Verify the customer's activation request.
4. Select `trial` or `paid` license type.
5. Set the expiration date and installation limit.
6. Select the feature entitlements.
7. Sign the license with the Worker Secret private key.
8. Deliver the raw signed token once to the customer.
9. Store only the token hash and license metadata.

The default trial should be 30 days. Paid licenses should validate offline after activation, with a documented lease renewal and offline grace period.

## Phase 11: Add Payment Webhooks Later

Start with Stripe Payment Links or Lemon Squeezy and manual issuance. When the workflow is proven:

1. Create a payment product for each application profile and plan.
2. Add the payment provider webhook URL.
3. Verify the webhook signature using `PAYMENT_WEBHOOK_SECRET`.
4. Store the provider event ID before processing.
5. Ignore duplicate event IDs.
6. Create or renew the corresponding license.
7. Record an audit event.
8. Send the customer delivery email through a separate email provider.

Do not treat a browser redirect from a payment page as proof of payment. Only verified webhooks or a server-side payment lookup should issue a license.

## Phase 12: Connect BarTender

The BarTender add-on should contain only:

- The public verification key set
- License parsing and signature verification
- Local license storage under `/data`
- Trial, expiration, and entitlement checks
- Optional activation/lease renewal calls

BarTender should not contain:

- The portal private signing key
- Payment credentials
- Admin credentials
- Customer database access
- License issuance endpoints

Configure the BarTender app to use the portal only for activation, renewal, and trial operations. Existing paid licenses should continue to work during the documented offline grace period.

## Phase 13: Production Checklist

Before using the portal for real customers:

- [ ] Replace JSON persistence with D1.
- [ ] Move Ed25519 private keys to Worker Secrets.
- [ ] Configure Cloudflare Access and MFA for administrators.
- [ ] Add rate limits to activation and public endpoints.
- [ ] Verify all webhook signatures.
- [ ] Add idempotency for payment events.
- [ ] Add audit records for issuance, renewal, revocation, and activation changes.
- [ ] Add application-profile audience checks.
- [ ] Add installation-limit enforcement.
- [ ] Test signing-key rotation.
- [ ] Test backup/restore and station/installation replacement behavior.
- [ ] Configure error monitoring without logging raw license tokens.
- [ ] Document retention and deletion of customer data.
- [ ] Test portal outage behavior from BarTender.
- [ ] Test an expired trial and an expired paid license.
- [ ] Confirm no private secrets are present in Git history.

## Important Limitations

Cloudflare's free tier is appropriate for low-volume licensing operations, but usage limits can change. Monitor Worker requests, D1 storage/query usage, webhook volume, and abuse. Do not rely on a free plan without reviewing the current provider terms.

The current local Node prototype is not a production Cloudflare Worker deployment. It is useful for developing the portal UI and issuance flow, but it must be migrated to D1-backed Worker modules before it becomes the production licensing authority.
