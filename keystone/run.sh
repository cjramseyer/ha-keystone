#!/usr/bin/with-contenv bashio
set -e

export HOST="0.0.0.0"
export PORT="3000"
export DATA_DIR="/data"
export SECRETS_DIR="/data/.secrets"

configured_password="$(bashio::config 'portal_admin_password')"
if [ -n "${configured_password}" ]; then
  export PORTAL_ADMIN_PASSWORD="${configured_password}"
fi

bashio::log.info "Starting Keystone Licensing Portal on port ${PORT}"
exec node /app/server.js
