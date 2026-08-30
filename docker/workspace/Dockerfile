# Sage workspace: browser IDE + agentic CLI, running on your own VPS.
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
RUN mkdir -p /home/coder/projects

# code-server listens on 8080; only Caddy talks to it, never the public internet.
EXPOSE 8080
