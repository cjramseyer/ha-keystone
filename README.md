# pro-app-license-portal

Keystone is a static prototype of the private licensing operations portal described in `LICENSE_PORTAL_IMPLEMENTATION.md`.

## Run locally

Run the authenticated portal server with Node 18 or newer:

```powershell
$env:PORTAL_ADMIN_PASSWORD = "replace-this-password"
npm start
```

Open `http://localhost:3000`. For a first-run local demo, the fallback administrator password is `change-me-local`; set `PORTAL_ADMIN_PASSWORD` before first launch for a real local password. The administrator username is `admin`.

Opening `index.html` directly also loads the navigation in read-only demo mode, but license issuance and authentication require the server URL above.

`npm run check` validates both JavaScript entry points.

The prototype includes:

- Application-profile-aware overview for Home Assistant Companion and Home Assistant Voice
- Multi-application profile registration and license issuance boundary
- License, trial, renewal, activation, and revenue overview metrics
- Expiring-license attention table and recent audit activity
- Responsive operator navigation
- Manual license issuance flow requiring customer, plan, license type, instance value, and activation request data
- Authenticated administrator sessions using an HttpOnly, SameSite cookie
- JSON persistence for customers, license metadata, and audit events in `.data/`
- Ed25519 issuer keys generated in `.secrets/` and excluded from git
- Signed activation-request verification before license issuance
- Signed license token verification through `/api/licenses/verify`
- Application-profile creation and deletion through the authenticated App profiles view
- Customer deletion for records with no active licenses, with server-side protection for active customers
- Standalone customer creation from the Customers view, with existing-customer reuse by email during issuance
- License issuance customer dropdown with existing-customer selection or an Add new customer path
- License revocation with historical retention, audit events, and revoked-token verification rejection
- One application profile per product with multiple typed, duration-based license options
- Application profile editing and add/remove license-package controls with active-license safeguards
- Persisted application profiles remain authoritative across server restarts; deleted demo profiles are not recreated

The server stores only a SHA-256 token hash in its persisted license metadata. The raw signed token is returned once from the issuance response so it can be delivered to the customer. The activation request must be JSON containing `app_id`, `installation_id`, `instance_key_id`, `nonce`, `instance_public_key`, and a base64url `signature` over `app_id.installation_id.instance_key_id.nonce`.

For production, replace the local JSON store with a database, move issuer keys to a secret manager or KMS, configure MFA and rate limiting, and rotate the initial local credentials. Delete `.data/auth.json` before restarting if the first-run password needs to be initialized again.

Each application profile contains license options such as `trial-90` or `pro-730`. An option has a type (`trial` or `pro`) and `length_days`; issuing a license uses that configured duration rather than a fixed application-side default. Application profiles do not store trial or Pro lengths themselves.

Profiles are persisted in `.data/portal.json`. A profile cannot be deleted while an active license references it; revoke or migrate those licenses first.
