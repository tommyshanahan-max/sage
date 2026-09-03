SHELL := /bin/bash
COMPOSE := docker compose

.DEFAULT_GOAL := help

.PHONY: help up down restart reload rebuild logs shell shell-2 claude ps backup check doctor privacy password fix-browser instructions partner-sync partner-sync-2 partner-mockups whats-new

help: ## Show this help
	grep -hE '^[a-z0-9-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Build if needed and start everything
	test -f .env || { echo "no .env — run: cp .env.example .env && \$$EDITOR .env"; exit 1; }
	@grep -q '^COMPOSE_PROFILES=.*seat2' .env && ! grep -qE '^TOMSCODING_PASSWORD_2=.+' .env \
	  && { echo "seat2 is enabled but TOMSCODING_PASSWORD_2 is empty."; \
	       echo "Run 'make password' and set it, or clear COMPOSE_PROFILES for a single seat."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*browser' .env && ! grep -qE '^TOMSCODING_BROWSER_PASSWORD=.+' .env \
	  && { echo "browser is enabled but TOMSCODING_BROWSER_PASSWORD is empty."; \
	       echo "Add one, or drop 'browser' from COMPOSE_PROFILES."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*agent' .env && ! grep -qE '^TOMSCODING_AGENT_PASSWORD=.+' .env \
	  && { echo "agent is enabled but TOMSCODING_AGENT_PASSWORD is empty."; \
	       echo "That page drives an agent with your API key — it needs a password."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*agent' .env && ! grep -qE '^ANTHROPIC_API_KEY=.+' .env \
	  && { echo "agent is enabled but ANTHROPIC_API_KEY is empty."; \
	       echo "The agent has nothing to authenticate with and every turn will fail."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*partner' .env && ! grep -qE '^TOMSCODING_PARTNER_PASSWORD=.+' .env \
	  && { echo "partner is enabled but TOMSCODING_PARTNER_PASSWORD is empty."; \
	       echo "That seat is someone else's access to your work — it needs its own password."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*partner' .env && [ ! -d partner/source ] \
	  && { echo "partner is enabled but there is no snapshot yet."; \
	       echo "Run 'make partner-sync' first — it decides which repos and versions they see."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*partner2' .env && ! grep -qE '^TOMSCODING_PARTNER2_PASSWORD=.+' .env \
	  && { echo "partner2 is enabled but TOMSCODING_PARTNER2_PASSWORD is empty."; \
	       echo "That seat is someone else's access to your work — it needs its own password."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*partner2' .env && [ ! -d partner/source-2 ] \
	  && { echo "partner2 is enabled but it has no snapshot yet."; \
	       echo "Run 'make partner-sync-2' first — it decides which repos and versions they see."; \
	       exit 1; } || true
	@grep -q '^COMPOSE_PROFILES=.*analytics' .env && ! grep -qE '^TOMSCODING_STATS_PASSWORD=.+' .env \
	  && echo "note: no TOMSCODING_STATS_PASSWORD — the numbers page will be open to anyone with the address." || true
	@grep -q '^COMPOSE_PROFILES=.*analytics' .env && ! grep -qE '^TOMSCODING_STATS_SITES=.+' .env \
	  && { echo "analytics is enabled but TOMSCODING_STATS_SITES is empty."; \
	       echo "Nothing would be counted: a page whose origin is not listed is ignored."; \
	       exit 1; } || true
	@# Stamp what is being deployed before deploying it, so the agent's copy of
	@# "recent changes" is the commits that are actually running. Not fatal — a
	@# tarball instead of a checkout should still deploy — but it says so out
	@# loud when it fails. The first version of this swallowed its own error and
	@# wrote nothing on the box for a whole deploy without anyone noticing.
	@sh scripts/whats-new.sh 	  || echo "note: could not stamp the commit list; Sage will not know what changed"
	$(COMPOSE) up -d --build
	echo "up. https://$$(grep -E '^TOMSCODING_DOMAIN=' .env | cut -d= -f2-)"

down: ## Stop everything (volumes are kept)
	$(COMPOSE) down

restart: ## Restart all services
	$(COMPOSE) restart

partner-sync: ## Replace the snapshot the partner seat can see
	bash scripts/partner-sync.sh 1

partner-sync-2: ## Same, for the second partner seat
	bash scripts/partner-sync.sh 2

partner-mockups: ## Copy every partner's mockups out to ./mockups for review
	@mkdir -p mockups/partner mockups/partner-2
	@$(COMPOSE) cp partner:/work/mockups/. mockups/partner/ 2>/dev/null \
	  || echo "  (seat 1: not running, or nothing made yet)"
	@$(COMPOSE) cp partner-2:/work/mockups/. mockups/partner-2/ 2>/dev/null \
	  || echo "  (seat 2: not running, or nothing made yet)"
	@find mockups -name '*.html' -printf '%TY-%Tm-%Td %TH:%TM  %p\n' 2>/dev/null | sort -r || true

instructions: ## Update the agent instructions in the running workspace
	@# The image seeds these into the home volume on first start only, and the
	@# volume masks the image path from then on — so a rebuild leaves a running
	@# deployment on whatever it was first given. This copies the current files
	@# over the top. Sage reads the same volume, so it picks them up too, with
	@# no restart needed.
	@echo "this overwrites ~/.claude/CLAUDE.md and ~/.claude/tomscoding.md in the workspace."
	@echo "any edits made to them in the IDE will be lost."
	@printf 'continue? [y/N] ' && read a && [ "$$a" = y ]
	$(COMPOSE) cp docker/workspace/CLAUDE.md workspace:/home/coder/.claude/CLAUDE.md
	$(COMPOSE) cp docker/workspace/tomscoding.md workspace:/home/coder/.claude/tomscoding.md
	@echo "done. new conversations pick these up; existing ones need a fresh start."

fix-browser: ## Restart the browser after a black screen
	$(COMPOSE) restart browser
	@echo "give it a minute, then reload https://$$(grep -E '^TOMSCODING_BROWSER_DOMAIN=' .env | cut -d= -f2-)"

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

whats-new: ## Tell the agent what changed, without a restart
	@# `make up` does this as part of a deploy. Run it on its own after a
	@# `git pull` when you want Sage current but have no reason to rebuild:
	@# the file is re-read on its next turn, so nothing needs restarting.
	sh scripts/whats-new.sh

check: ## Verify every Caddy site resolves to a usable, unique address
	python3 scripts/check-sites.py

doctor: ## Check the path between you and the VPS
	bash scripts/doctor.sh

privacy: ## Show what public records say about who runs these sites
	@# Reads .env for the domains, then asks public registries. Nothing is
	@# changed and nothing is sent anywhere — it is the same lookup a stranger
	@# would do, run by you, on you.
	python3 scripts/privacy-check.py
