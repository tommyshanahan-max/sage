# Book: a shelf of teachers and a widget any of Tom's apps can drop in.
#
# node:22-slim, the base the board and Ferry already build on. ONE dependency,
# Anthropic's SDK, for the translated calls (lib/speak.mjs) — everything else
# is node's own http module. Installed from the lockfile, so what runs here is
# exactly what was tested, and a new release cannot arrive unannounced.
FROM node:22-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.mjs cli.mjs ./
COPY lib ./lib
COPY public ./public

# The shelf lives here. A fresh named volume takes the image's ownership, so
# without this the first write on a new box fails with EACCES — the board
# and Ferry both learned it the hard way.
RUN mkdir -p /data && chown -R 1000:1000 /data /app
USER 1000:1000

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.mjs"]
