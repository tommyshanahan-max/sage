# Tom's Coding workspace: browser IDE + agentic CLI, running on your own VPS.
FROM codercom/code-server:latest

USER root

ARG NODE_MAJOR=22
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      curl \
      git \
      gnupg \
      htop \
      jq \
      less \
      locales \
      man-db \
      openssh-client \
      python3 \
      python3-pip \
      python3-venv \
      ripgrep \
      rsync \
      tmux \
      unzip \
      vim \
      zip \
    && rm -rf /var/lib/apt/lists/*

# Node.js from NodeSource. code-server bundles its own Node for the editor,
# but the CLI tooling below needs a real global install.
RUN curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --no-fund --no-audit \
      @anthropic-ai/claude-code \
      pnpm \
      yarn

RUN sed -i 's/^# en_US.UTF-8/en_US.UTF-8/' /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

USER coder
WORKDIR /home/coder

# code-server is launched against this directory. It must exist in the image so
# that the first `docker compose up` seeds it into the named volume.
RUN mkdir -p /home/coder/projects/.vscode \
             /home/coder/.local/share/code-server/User \
             /home/coder/.claude

# Open on a terminal with Claude Code already running, rather than on a
# welcome page. The editor is here for reading files and reviewing diffs; the
# terminal is the thing being used. Both files are seeded into the named
# volume on first start only — afterwards they are yours to edit in place,
# and a rebuild will not overwrite your changes.
COPY --chown=coder:coder settings.json /home/coder/.local/share/code-server/User/settings.json
COPY --chown=coder:coder tasks.json /home/coder/projects/.vscode/tasks.json

# User-level instructions, applying to every project opened in this workspace
# rather than to one repository. Seeded on first start; edit it in place
# afterwards. Derived from the plain-conversation prompt in the journey repo,
# with that app's apparatus removed and its rules about not inventing
# specifics translated to a context where the consequence is a broken deploy
# rather than a wrong answer.
COPY --chown=coder:coder CLAUDE.md /home/coder/.claude/CLAUDE.md

# code-server listens on 8080; only Caddy talks to it, never the public internet.
EXPOSE 8080
