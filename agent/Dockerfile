# The agent app: a chat UI in front of the Claude Agent SDK.
FROM node:22-slim

ARG DEBIAN_FRONTEND=noninteractive

# The Agent SDK drives the Claude Code harness, which shells out for its Bash,
# Glob and Grep tools. Without these the agent starts and then fails the first
# time it tries to look at anything.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      git \
      ripgrep \
    && rm -rf /var/lib/apt/lists/*

# The Agent SDK does not bundle the Claude Code CLI — it spawns one it expects
# to find already installed, and without it every turn dies instantly with an
# exit code and no explanation. `command -v` fails the build if the binary is
# not on PATH, so a missing CLI surfaces here rather than on the first message
# someone sends.
RUN npm install -g --no-fund --no-audit @anthropic-ai/claude-code \
    && command -v claude

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit

COPY server.js ./
COPY public ./public

# Compose mounts the IDE's home volume and points AGENT_WORKSPACE at the
# projects directory inside it, so the agent and the editor see one set of
# files. This default only applies if the container is run without that.
ENV AGENT_WORKSPACE=/workspace \
    NODE_ENV=production \
    PORT=3000

EXPOSE 3000
CMD ["node", "server.js"]
