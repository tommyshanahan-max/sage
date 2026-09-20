# THE BROWSER HALF, AND WHY IT IS A SECOND IMAGE.
#
# The API half is node:22-slim with no dependencies. This one carries Chromium
# and Playwright, which is a few hundred megabytes — putting them in the same
# image would make every `make post` pull that weight to call four HTTP
# endpoints. Two images, one volume of state, and the small one stays small.
#
# WHY PLAYWRIGHT'S OWN BASE IMAGE IS NOT USED. It pins a Playwright version in
# its tag, and a tag that has been retired fails at build time on a box nobody
# is watching. Installing chromium from the npm package means the version is
# pinned in package.json, where it is visible in a diff and changed on purpose.
FROM node:22-slim

WORKDIR /app

# --with-deps installs the system libraries Chromium needs. Without it the
# browser launches and dies immediately with a missing .so, which reads like a
# Playwright bug rather than a missing apt package.
COPY browser/package.json ./
RUN npm install --no-audit --no-fund \
 && npx playwright install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*

COPY browser ./browser
COPY lib ./lib

# /profiles holds one Chromium profile per platform — the cookies that make a
# login survive. /data is the shared record of what has posted, the same
# volume the API half writes.
RUN mkdir -p /profiles /data && chown -R 1000:1000 /profiles /data /app
USER 1000:1000

ENV POST_DIR=/data POST_PROFILES=/profiles NODE_ENV=production

CMD ["node", "browser/run.mjs", "--help"]
