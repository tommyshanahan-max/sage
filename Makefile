SHELL := /bin/bash
COMPOSE := docker compose

.DEFAULT_GOAL := help

.PHONY: help up down restart reload rebuild logs shell shell-2 claude ps backup doctor password

help: ## Show this help
	grep -hE '^[a-z0-9-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Build if needed and start everything
	test -f .env || { echo "no .env — run: cp .env.example .env && \$$EDITOR .env"; exit 1; }
	@grep -q '^COMPOSE_PROFILES=.*seat2' .env && ! grep -qE '^TOMSCODING_PASSWORD_2=.+' .env \
	  && { echo "seat2 is enabled but TOMSCODING_PASSWORD_2 is empty."; \
	       echo "Run 'make password' and set it, or clear COMPOSE_PROFILES for a single seat."; \
	       exit 1; } || true
	$(COMPOSE) up -d --build
	echo "up. https://$$(grep -E '^TOMSCODING_DOMAIN=' .env | cut -d= -f2-)"

down: ## Stop everything (volumes are kept)
	$(COMPOSE) down

restart: ## Restart all services
	$(COMPOSE) restart

reload: ## Reload Caddy config without dropping connections
	$(COMPOSE) exec caddy caddy reload --config /etc/caddy/Caddyfile

rebuild: ## Rebuild the workspace image (picks up new CLI versions)
	$(COMPOSE) build --no-cache workspace
	$(COMPOSE) up -d workspace

logs: ## Tail logs from all services
	$(COMPOSE) logs -f --tail=100

ps: ## Show container status
	$(COMPOSE) ps

shell: ## Open a shell in the workspace container
	$(COMPOSE) exec workspace bash

shell-2: ## Open a shell in the second seat
	$(COMPOSE) exec workspace-2 bash

claude: ## Run the Claude Code CLI in the workspace
	$(COMPOSE) exec workspace claude

password: ## Generate a strong password for TOMSCODING_PASSWORD
	openssl rand -base64 24

backup: ## Snapshot every workspace home volume to ./backups
	mkdir -p backups
	$(COMPOSE) run --rm --no-deps --user root -v "$$PWD/backups:/backup" --entrypoint sh workspace \
	  -c 'tar czf /backup/home-$$(date +%Y%m%d-%H%M%S).tar.gz -C /home/coder .'
	@grep -q '^COMPOSE_PROFILES=.*seat2' .env 2>/dev/null \
	  && $(COMPOSE) run --rm --no-deps --user root -v "$$PWD/backups:/backup" --entrypoint sh workspace-2 \
	       -c 'tar czf /backup/home2-$$(date +%Y%m%d-%H%M%S).tar.gz -C /home/coder .' \
	  || true
	ls -lh backups | tail -n 5

doctor: ## Check the path between you and the VPS
	bash scripts/doctor.sh
