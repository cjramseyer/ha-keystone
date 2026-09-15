# Security

## Current protections

- Administrative operations require an authenticated session.
- Sessions use an HttpOnly, SameSite cookie.
- Passwords are stored as scrypt-derived hashes with per-password salts.
- Activation requests require an application-generated public key and signature.
- License tokens use Ed25519 signatures.
- The application verifies the expected token audience and expiration.
- Revoked licenses fail server-side token verification.
- Raw license tokens are not persisted; only a SHA-256 token hash is stored with metadata.
- Private signing keys are stored under `.secrets/`, which is excluded from git.
- Customer deletion, profile deletion, option deletion, issuance, renewal, revocation, and profile edits create audit events.

## Local-only limitations

The prototype still has important limitations:

- The private key is stored as a local PEM file, not in a KMS or secret manager.
- JSON persistence is not suitable for concurrent production writes.
- There is no MFA.
- There is no rate limiting on public or administrative endpoints.
- Sessions are held in server memory and are lost on restart.
- Activation records and installation-limit enforcement are not complete.
- Payment webhooks and billing-provider verification are not implemented.
- The application uses a single implicit workspace; multi-workspace support is tracked separately.

## Production requirements

Before production use:

1. Replace JSON files with a transactional database.
2. Move Ed25519 private-key operations into a KMS or protected secret manager.
3. Add MFA or an identity provider such as Cloudflare Access.
4. Add CSRF protection, rate limiting, structured validation, and security headers.
5. Add activation records and enforce installation limits server-side.
6. Add idempotent payment webhook processing.
7. Add key rotation with current and previous public keys.
8. Define retention and deletion policies for customer data.
9. Run the service behind HTTPS and restrict administrative network access.
10. Remove the default local password from any deployed environment.
