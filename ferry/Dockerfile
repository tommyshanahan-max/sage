# Ferry: a private room where two people read different languages.
#
# node:22-slim, the same base the board and the agent already build on — a
# second base image costs disk on the box for nothing.
FROM node:22-slim

WORKDIR /app

# Deps first, so a change to the app does not reinstall them. There is one.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.mjs ./
COPY lib ./lib
COPY public ./public

# The rooms live here. A named volume starts root-owned and Docker carries the
# image's ownership into a fresh one, so without this the first write on a new
# box fails with EACCES and the whole thing looks broken on the day it is
# installed. The board learned this one the hard way.
RUN mkdir -p /data && chown -R 1000:1000 /data /app
USER 1000:1000

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.mjs"]
