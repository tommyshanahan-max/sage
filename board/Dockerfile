# The Board: a noticeboard for foreigners in China.
#
# node:22-slim, not alpine — the agent and the counter already build on this
# base, so it costs nothing extra on the box, where a second base image would.
FROM node:22-slim

WORKDIR /app

# Deps first, so a change to the app does not reinstall them.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY lib ./lib
COPY public ./public

# The data directory, owned by the user the container runs as.
#
# A named volume starts root-owned and Docker carries the image's ownership
# into a fresh one — so without this, the first write on a new box fails with
# EACCES and the board looks broken on the day it is installed.
RUN mkdir -p /data && chown -R 1000:1000 /data /app
USER 1000:1000

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
