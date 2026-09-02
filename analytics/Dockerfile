# The counter: how many people used it today, and what they used.
FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit

COPY server.js ./
COPY lib ./lib
COPY public ./public

# Created here, owned by the uid compose runs this as. Docker seeds a fresh
# named volume from the image's directory, ownership included — without this the
# volume arrives root-owned, the first append fails, and every count is lost
# quietly, which is the worst way for a counter to break.
RUN mkdir -p /data && chown 1000:1000 /data

# The data directory is a named volume in compose. This default only matters if
# the container is run without one, in which case the counts live and die with
# it — which is the honest outcome for a container started by hand.
ENV ANALYTICS_DIR=/data \
    NODE_ENV=production \
    PORT=3000

EXPOSE 3000
CMD ["node", "server.js"]
