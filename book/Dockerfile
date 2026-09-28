# Book: a shelf of teachers and a widget any of Tom's apps can drop in.
#
# node:22-slim, the base the board and Ferry already build on. No npm install:
# the server is node's own http module and nothing else, so there is nothing
# on this box that could be updated out from under it.
FROM node:22-slim

WORKDIR /app
COPY package.json server.mjs cli.mjs ./
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
