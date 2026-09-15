# Getting Started

## Requirements

- Node.js 18 or newer
- A current browser
- PowerShell, Bash, or another terminal

Check the runtime:

```powershell
node --version
npm --version
```

## Configure the first administrator password

Set `PORTAL_ADMIN_PASSWORD` before the first server start:

```powershell
$env:PORTAL_ADMIN_PASSWORD = "use-a-long-local-password"
```

The default local username is `admin`. If `.data/auth.json` already exists, changing the environment variable does not change the stored password. Delete `.data/auth.json` and restart only when intentionally reinitializing local credentials.

For a disposable demo, the fallback password is `change-me-local`. Do not use that fallback outside a temporary local environment.

## Start the portal

```powershell
cd keystone
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Run source checks from the `keystone/` directory:

```powershell
cd keystone
npm run check
```

## Runtime directories

The first server start creates:

- `keystone/.data/portal.json`: customers, profiles, licenses, and audit events.
- `keystone/.data/auth.json`: the administrator username, display name, email, and password hash.
- `keystone/.data/session-secret`: reserved local session material.
- `keystone/.secrets/issuer-private.pem`: local Ed25519 private signing key.
- `keystone/.secrets/issuer-public.pem`: local Ed25519 public key.

`.data/` and `.secrets/` are excluded by `.gitignore`. Keep them out of source control.

## Direct HTML mode

Opening `keystone/index.html` directly uses read-only demo mode. Authentication, persistence, license issuance, and API calls require the Node server at `http://localhost:3000`.
