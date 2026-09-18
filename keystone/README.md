# Keystone Home Assistant Add-on

Keystone is a private, multi-application licensing portal packaged for Home Assistant. It provides an operator dashboard for application profiles, customers, license options, signed license issuance, renewals, revocation, audit events, and notifications.

This directory is the Home Assistant add-on package. The full product documentation is in the repository `docs/` directory; add-on-specific implementation notes are in [DOCS.md](DOCS.md).

## Install

1. Add the repository URL to a Home Assistant add-on store.
2. Open **Keystone Licensing Portal**.
3. Set `portal_admin_password` in the add-on Configuration tab.
4. Install and start the add-on.
5. Open the add-on through Home Assistant ingress.

The add-on listens on internal port `3000`, binds to `0.0.0.0`, and enables ingress. Ingress is the recommended access path. Direct port access is optional and should remain restricted to a trusted network.

## Configuration

| Option                  | Required    | Description                                     |
| ----------------------- | ----------- | ----------------------------------------------- |
| `portal_admin_password` | Recommended | Password for the `admin` administrator account. |

The default password is `change-me-local` only when the add-on starts without a configured password and has no existing `/data/auth.json`. Set a real password before the first start.

To set or reset the login, enter the desired `portal_admin_password` in the add-on Configuration tab, save, and restart the add-on. Keystone replaces the stored password hash during startup, so no SSH access or file deletion is required. Sign in with the username `admin` and the configured password.

## Persistent storage

Home Assistant maps the add-on data directory to `/data`. Keystone stores:

- `/data/portal.json`: profiles, customers, licenses, and audit events.
- `/data/auth.json`: administrator profile and password hash.
- `/data/session-secret`: local session material.
- `/data/.secrets/issuer-private.pem`: Ed25519 private signing key.
- `/data/.secrets/issuer-public.pem`: Ed25519 public signing key.

Back up `/data` securely. Never copy the private signing key into a public application repository, a customer installation, or a normal customer backup.

## App behavior

- Application profiles represent products.
- Each application can have multiple trial, Pro, or Base license options.
- Each option controls its own duration in days.
- Customers can be created before issuance or selected during issuance.
- Revoked licenses remain as historical records and fail token verification.
- The dashboard metrics and activity panels use persisted state and audit events.

## Troubleshooting

Check the add-on log first. Common causes include:

- The configuration was saved but the add-on was not restarted.
- The `/data` volume is not writable.
- The installed add-on has not been updated to the latest version.
- Direct port access is blocked; use Home Assistant ingress.

## Production warning

This add-on packages the local Node prototype. For a public production licensing authority, move signing operations to a protected secret manager or KMS, replace JSON persistence with a database, add MFA and rate limiting, implement activation-limit enforcement, and keep payment webhooks outside a private Home Assistant installation.
