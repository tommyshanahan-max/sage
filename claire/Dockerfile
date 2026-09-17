# ClaireTv: vertical micro-drama, and the console a partner runs it from.
#
# node:22-slim like every other service on this box, so the base layer is
# already there and a second one costs nothing.
FROM node:22-slim

WORKDIR /app

# ffmpeg, for `make claire-video`: an episode is nine generated shots joined
# into one file, and its picture is a frame from that file. Nothing in the
# server uses it; the script runs in this image because the film is in its
# volume.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY lib ./lib
COPY public ./public

# A named volume starts root-owned, and without this the first write on a new
# box fails with EACCES and the catalogue looks broken on the day it is
# installed. The board learned this one the hard way.
RUN mkdir -p /data && chown -R 1000:1000 /data /app
USER 1000:1000

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
