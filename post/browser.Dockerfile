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

# WHERE CHROMIUM LANDS, SAID OUT LOUD.
#
# Without this it goes to $HOME/.cache/ms-playwright, and the install runs as
# root while everything that uses it runs as 1000:1000 — so the browser sat in
# /root/.cache behind mode 700 and every run failed with "Looks like Playwright
# was just installed or updated — run npx playwright install". That message
# points at the image, and the image was fine: only the reader was wrong. A
# path named here does not depend on whose HOME is set.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

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
# /ms-playwright is readable by the user that actually runs the browser, which
# is the whole point of naming the path above. Read and execute is enough —
# nothing should be writing into it at runtime, and a browser that can rewrite
# its own binary is a worse idea than a rebuild.
RUN mkdir -p /profiles /data && chown -R 1000:1000 /profiles /data /app \
 && chmod -R a+rX /ms-playwright
USER 1000:1000

ENV POST_DIR=/data POST_PROFILES=/profiles NODE_ENV=production

CMD ["node", "browser/run.mjs", "--help"]
