# API Reference

All routes below are served by the Node prototype at `http://localhost:3000`.

Administrative routes require the `keystone_session` HttpOnly cookie created by login. The health endpoint is public.

## Health

### `GET /api/health`

Returns service status.

```json
{
  "ok": true,
  "issuer": "ed25519",
  "persistence": "json"
}
```

## Authentication

### `POST /api/auth/login`

Request:

```json
{
  "email": "admin",
  "password": "your-password"
}
```

Creates an eight-hour HttpOnly, SameSite session cookie.

### `POST /api/auth/logout`

Expires the current session cookie.

### `GET /api/auth/session`

Returns authentication state and the administrator profile when authenticated.

### `PUT /api/auth/profile`

Request:

```json
{
  "name": "Jordan Admin",
  "email": "jordan@example.com"
}
```

Updates the administrator display name and email.

## State

### `GET /api/state`

Returns profiles, customers, licenses without raw tokens, recent audit events, and dashboard metrics.

The response includes:

- `profiles`
- `customers`
- `licenses`
- `audit_events`
- `metrics.active_licenses`
- `metrics.trials_in_progress`
- `metrics.renewal_rate`

## Customers

### `POST /api/customers`

Request:

```json
{
  "name": "Example Home",
  "email": "owner@example.com"
}
```

### `DELETE /api/customers/:customer_id`

Deletes a customer only when no active license references the customer. Returns `409` otherwise.

## Application profiles

### `POST /api/app-profiles`

Creates an application profile. New profiles default to an installation limit of `1` and an empty `license_options` list.

Request:

```json
{
  "app_id": "another-app",
  "name": "Another App",
  "installation_limit": 1,
  "features": ["advanced_reports"]
}
```

### `PUT /api/app-profiles/:app_id`

Updates the display name, installation limit, and feature entitlements.

### `DELETE /api/app-profiles/:app_id`

Deletes a profile only when no active license references it.

### `POST /api/app-profiles/:app_id/license-options`

Adds a license option.

Request:

```json
{
  "type": "trial",
  "label": "90-day trial",
  "length_days": 90
}
```

### `DELETE /api/app-profiles/:app_id/license-options/:option_id`

Removes an option only when no active license references it.

## Licenses

### `POST /api/licenses/issue`

Requires a valid application profile, option ID, customer or customer fields, instance value, and activation proof.

Important request fields:

```json
{
  "app_id": "another-app",
  "option_id": "trial-90-a1b2c3",
  "customer_id": "cust_123",
  "instance_value": "Example Home",
  "activation_request": {
    "app_id": "another-app",
    "instance_id": "install_123",
    "instance_key_id": "key_123",
    "nonce": "nonce_123",
    "instance_public_key": {
      "algorithm": "Ed25519",
      "encoding": "base64url",
      "value": "base64url-public-key"
    },
    "signature": {
      "algorithm": "Ed25519",
      "encoding": "base64url",
      "value": "base64url-signature"
    }
  }
}
```

The activation signature covers:

```text
app_id.instance_id.instance_key_id.nonce
```

`instance_public_key.value` may be either a raw 32-byte Ed25519 public key or a base64url-encoded SPKI public key. The structured `algorithm`, `encoding`, and `value` format is accepted by the portal.

### `POST /api/licenses/:license_id/renew`

Extends expiration by the license option duration and records a renewal audit event.

### `POST /api/licenses/:license_id/reissue`

Re-signs an active, unexpired license using its persisted claim snapshot and returns a new raw token for delivery. The license keeps the same ID, customer, expiration, features, and activation binding. The normalized activation request is also retained for support and audit purposes. The raw token is not persisted; only its replacement hash is stored.

### `POST /api/licenses/:license_id/revoke`

Marks a license revoked, retains its historical record, and records an audit event.

### `POST /api/licenses/verify`

Request:

```json
{
  "token": "signed-license-token"
}
```

Verifies the Ed25519 signature, audience, expiration, and persisted revocation status.
