# node:22-slim, not alpine — the board and the agent already build on this
# base, so it costs nothing extra on the box, where a second base image would.
FROM node:22-slim

WORKDIR /app

# No dependencies. Every platform this posts to is HTTP and a signature, and
# node has fetch and crypto. The SDKs bring a tree apiece — five platforms is
# five trees — and what they buy is types and retries, neither of which is
# worth that here. Same reasoning as board/lib/stripe.js.
COPY package.json ./
COPY cli.mjs ./
COPY lib ./lib

# A fresh named volume inherits ownership from the image, so without this the
# first write is EACCES on install day and the symptom is a job that vanishes.
RUN mkdir -p /data && chown -R 1000:1000 /data /app
USER 1000:1000

ENV POST_DIR=/data NODE_ENV=production

# No server. Nothing here listens: every entry point is `docker compose run`
# from the Makefile, and the Mac's half reaches this box over ssh rather than
# over a port. One less thing on the network, and ssh is already the door Tom
# has. Run without arguments and it says what it takes.
CMD ["node", "cli.mjs", "help"]
