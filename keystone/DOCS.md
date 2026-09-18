# Keystone Add-on Documentation

## Purpose

The `keystone/` directory packages the licensing portal as a Home Assistant add-on. Home Assistant provides the container lifecycle, ingress, configuration UI, and persistent `/data` volume. The Node application provides the web UI and API.

```text
Home Assistant
  |
  +-- Keystone add-on
        |
        +-- ingress -> Node server on 0.0.0.0:3000
        +-- /data/portal.json
        +-- /data/auth.json
        +-- /data/.secrets/issuer-private.pem
```

## Package files

- `config.yaml`: Home Assistant add-on metadata, ingress, architecture, ports, and options.
- `build.yaml`: architecture-specific Home Assistant base images.
- `Dockerfile`: installs Node.js, copies the portal, and starts `run.sh`.
- `run.sh`: reads add-on options, sets runtime paths, and starts the server.
- `server.js`: API, persistence, authentication, signing, and static-file server.
- `app.js`, `index.html`, `styles.css`, `palette-overrides.css`: browser application.
- `icon.png`: Home Assistant add-on icon.

## Add-on configuration

The current add-on exposes one option:

```yaml
options:
  portal_admin_password: ""
schema:
  portal_admin_password: password
```

The startup script maps that option to `PORTAL_ADMIN_PASSWORD`. On every start, the server creates the administrator record if needed or updates its password hash when the configured password differs. This supports password resets entirely through the Home Assistant Configuration tab.

## Build and runtime

Home Assistant builds an architecture-specific image using `build.yaml`:

- `amd64`: `ghcr.io/home-assistant/amd64-base:3.19`
- `aarch64`: `ghcr.io/home-assistant/aarch64-base:3.19`

The Dockerfile installs `nodejs` and `npm`, copies the application into `/app`, and exposes port `3000`. `run.sh` sets:

```text
HOST=0.0.0.0
PORT=3000
DATA_DIR=/data
SECRETS_DIR=/data/.secrets
```

Binding to `0.0.0.0` is required for Supervisor ingress. Binding only to `localhost` would make the add-on unreachable through Home Assistant.

## Local development

Run the Node application without the Home Assistant wrapper from the repository root:

```powershell
cd keystone
$env:PORTAL_ADMIN_PASSWORD = "local-development-password"
npm start
```

Run checks:

```powershell
cd keystone
npm run check
```

Local development defaults to `HOST=127.0.0.1`, `PORT=3000`, and state under `keystone/.data/` unless environment variables override those paths.

## Data and backups

The `/data` volume contains both operational data and the local signing key. Back it up only through a protected administrative process.

Before restoring or copying `/data`:

1. Stop the add-on.
2. Preserve the existing `portal.json` and `auth.json`.
3. Treat `.secrets/issuer-private.pem` as a production secret.
4. Start the add-on and verify the health endpoint and administrator login.
5. Confirm that application profiles and license history are present.

Do not distribute the private key with a licensed application. Licensed applications need only the public verification key or a trusted public-key set.

## Ingress and direct access

Ingress is enabled through `config.yaml` and uses internal port `3000`. Use the Home Assistant sidebar panel for normal administration.

Direct access is optional because the port is declared but not published by default:

```yaml
ports:
  3000/tcp: null
```

If direct access is enabled in a local deployment, restrict it to a trusted network and keep administrator authentication enabled.

## Upgrade notes

The local prototype uses JSON persistence. Before changing versions:

1. Export or copy `/data` securely.
2. Stop the add-on.
3. Upgrade the add-on image.
4. Start the add-on.
5. Check the add-on log for migration errors.
6. Verify profiles, customers, licenses, and audit events in the UI.

The server performs compatibility normalization for older application profiles that stored legacy duration fields. New license durations should be configured through application license options.

## Security boundaries

The add-on is suitable for private administration and development demonstrations. It is not yet a complete public production licensing authority because:

- JSON persistence is not transactional.
- Sessions are stored in server memory.
- MFA is not implemented.
- Rate limiting is not implemented.
- Payment webhooks are not implemented.
- Activation records and installation-limit enforcement are incomplete.
- The local private key is file-backed rather than KMS-backed.

For production, use a protected signing service, a database, MFA, HTTPS, rate limiting, idempotent payment webhooks, and key rotation. See the repository-level [security guide](../docs/security.md) and [hosting guide](../docs/HOSTING_SETUP.md).
