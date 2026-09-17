# ClaireTv: vertical micro-drama, and the console a partner runs it from.
#
# node:22-slim like every other service on this box, so the base layer is
# already there and a second one costs nothing.
FROM node:22-slim

WORKDIR /app

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
