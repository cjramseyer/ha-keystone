# Keystone Licensing Portal Docs

Keystone is a private licensing portal for issuing and managing signed licenses for multiple applications.

## Guides

- [Getting started](getting-started.md): install, configure, run, and sign in locally.
- [Administrator guide](admin-guide.md): manage application profiles, customers, license options, and licenses.
- [API reference](api-reference.md): current authenticated API routes and request shapes.
- [Security](security.md): authentication, persistence, signing keys, and production warnings.
- [Architecture](architecture.md): how the current prototype is structured and where production hosting differs.

## Current status

The repository contains a working Node.js prototype with:

- Cookie-based administrator sessions
- JSON persistence for local development
- Ed25519 activation-proof verification
- Ed25519 signed license tokens
- Multiple application profiles
- Multiple duration-based license options per application
- Customer creation, selection, and deletion safeguards
- License issuance, renewal, revocation, and verification
- Audit-backed dashboard activity and notifications

The prototype is not yet a production licensing authority. Review [Security](security.md) and [Architecture](architecture.md) before exposing it to customers or the public Internet.
