# crowdfundme — the ledger.
#
# The same base as the board and the agent, so a second image costs this box
# nothing it is not already carrying.
FROM node:22-slim

WORKDIR /app

# Deps first, so a change to the app does not reinstall them.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY lib ./lib
COPY public ./public

# The data directory, owned by the user the container runs as. A named volume
# starts root-owned, so without this the first write on a new box fails with
# EACCES and the whole thing looks broken on the day it is installed.
RUN mkdir -p /data && chown -R 1000:1000 /data /app
USER 1000:1000

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
