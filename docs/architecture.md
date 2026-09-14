# Architecture

## Current runtime

The current prototype is a small Node.js HTTP server with a static browser client.

```text
Browser
  |
  | HTTP + JSON + HttpOnly session cookie
  v
keystone/server.js
  |-- auth and session handling
  |-- application profile rules
  |-- customer and license workflows
  |-- activation proof verification
  |-- Ed25519 signing and verification
  |-- audit event writes
  |
  |-- keystone/.data/portal.json
  |-- keystone/.data/auth.json
  |-- keystone/.secrets/issuer-private.pem
  |-- keystone/.secrets/issuer-public.pem
```

## Domain model

The intended product boundary is:

```text
Application profile
  -> license options
  -> licenses
  -> activations

Customer
  -> licenses
```

An application profile is one application. It can offer multiple license options, and each option owns its type and duration. A license stores the selected option ID and a copy of the option duration used for issuance.

## Dashboard data

The dashboard is not a separate data store. It derives its values from `/api/state`:

- License metrics are calculated from license records and renewal audit events.
- Attention rows are active trials and licenses expiring within 30 days.
- Recent activity is derived from audit events.
- Notifications use the same audit event stream.
- App profile summaries use persisted profile records.

## Persistence

The prototype uses synchronous JSON reads and writes for simplicity. This is useful for local demonstrations but has no database transactions, locking strategy, replication, or multi-process coordination.

## Production direction

The repository's [HOSTING_SETUP.md](../HOSTING_SETUP.md) describes the intended migration to Cloudflare Workers, D1, and protected Worker Secrets. A production implementation should separate:

- HTTP handlers
- Authentication and authorization
- Domain validation
- Profile and option operations
- License lifecycle operations
- Activation and installation-limit operations
- Signing operations
- Persistence
- Audit logging

The GitHub issue [#1 Add multi-workspace support](https://github.com/cjramseyer/pro-app-license-portal/issues/1) tracks workspace isolation, membership, switching, and data migration.
