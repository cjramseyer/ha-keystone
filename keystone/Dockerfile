ARG BUILD_FROM
# The Home Assistant builder supplies the architecture-specific base image.
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Node is installed in the add-on image; application state is mounted at /data.
# Package versions are managed by the Home Assistant base image.
# hadolint ignore=DL3018
RUN apk add --no-cache nodejs npm

WORKDIR /app
COPY package.json package.json
COPY app.js app.js
COPY index.html index.html
COPY palette-overrides.css palette-overrides.css
COPY server.js server.js
COPY styles.css styles.css

RUN npm install --omit=dev --ignore-scripts

COPY run.sh /run.sh
RUN chmod 0755 /run.sh

EXPOSE 3000
CMD ["/run.sh"]
